'use client';

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";
import { fetchMetadataFromIpfs, BountyMetadata, IpfsImage } from "../utils/ipfs";

// V2 Interfaces
interface Reply {
  replier: string;
  content: string;
  timestamp: bigint;
}

interface Submission {
  solver: string;
  blindedIpfsCid: string;
  revealIpfsCid: string;
  deposit: bigint;
  replies: readonly Reply[];
  revealed: boolean;
}

interface Bounty {
  id: number;
  creator: string;
  description: string;
  amount: bigint;
  deadline: bigint;
  allowMultipleWinners: boolean;
  winnerShares: readonly bigint[];
  status: number; // Enum: 0:OPEN, 1:PENDING_REVEAL, 2:RESOLVED, 3:DISPUTED, 4:EXPIRED
  slashPercent: bigint;
  submissions: readonly Submission[];
  selectedWinners: readonly string[];
  selectedSubmissionIds: readonly bigint[];
  metadataCid?: string;
}

interface BountyCardProps {
  bounty: Bounty;
  onSubmitSolution: (bountyId: number, ipfsCid: string) => void;
  onSelectWinners: (bountyId: number, winners: string[], subIds: number[]) => void;
  onTriggerSlash: (bountyId: number) => void;
  onAddReply: (bountyId: number, subId: number, content: string) => void;
  onRevealSolution: (bountyId: number, subId: number, revealCid: string) => void;
}

const BountyStatusEnum = ['Open', 'Pending Reveal', 'Resolved', 'Disputed', 'Expired'];
const StatusColors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-red-500", "bg-gray-500"];

export default function BountyCard({
  bounty,
  onSubmitSolution,
  onSelectWinners,
  onTriggerSlash,
  onAddReply,
  onRevealSolution,
}: BountyCardProps) {
  const { address } = useAccount();
  const [metadata, setMetadata] = useState<BountyMetadata | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [submissionCid, setSubmissionCid] = useState("");
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<number[]>([]);
  const [replyContent, setReplyContent] = useState<{ [subId: number]: string }>({});
  const [revealCid, setRevealCid] = useState<{ [subId: number]: string }>({});

  const isCreator = address?.toLowerCase() === bounty.creator.toLowerCase();

  useEffect(() => {
    const loadMetadata = async () => {
      if (!bounty.metadataCid) return;
      setIsLoadingMetadata(true);
      try {
        const meta = await fetchMetadataFromIpfs(bounty.metadataCid);
        setMetadata(meta);
      } catch (error) {
        console.error("Failed to load bounty metadata:", error);
      } finally {
        setIsLoadingMetadata(false);
      }
    };
    loadMetadata();
  }, [bounty.metadataCid]);

  const handleSelectWinners = () => {
    const selectedSolvers = selectedSubmissions.map(i => bounty.submissions[i].solver);
    onSelectWinners(bounty.id, selectedSolvers, selectedSubmissions);
  };

  const statusLabel = BountyStatusEnum[bounty.status] || 'Unknown';
  const statusColor = StatusColors[bounty.status] || 'bg-gray-500';

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
      {/* Card Header */}
      <div className="p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="text-xl">Bounty #{bounty.id}</h3>
            <p className="text-lg text-gray-600 font-normal mt-1">{metadata?.title || bounty.description.split('\n')[0]}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium text-white ${statusColor}`}>
            {statusLabel}
          </div>
        </div>
        <div className="flex justify-between items-baseline mt-4">
            <div className="text-3xl font-bold text-green-600">{formatSTT(bounty.amount)} STT</div>
            <div className="text-sm text-gray-500">Deadline: {formatTimeLeft(bounty.deadline)}</div>
        </div>
      </div>

      {/* Details & Submissions Toggle */}
      <div className="px-6 pb-4 border-t border-gray-100">
        <button onClick={() => setShowDetails(!showDetails)} className="text-primary-600 font-medium text-sm">
          {showDetails ? 'Hide Details & Submissions' : 'Show Details & Submissions'}
        </button>
      </div>

      {/* Collapsible Section */}
      {showDetails && (
        <div className="px-6 pb-6">
          {/* Metadata Details */}
          {/* ... UI to show metadata.requirements, skills etc. ... */}

          {/* Submissions Section */}
          <div className="mt-4 pt-4 border-t">
            <h5 className="font-semibold mb-3">Submissions ({bounty.submissions.length})</h5>
            <div className="space-y-4">
              {bounty.submissions.map((sub, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {isCreator && bounty.status === 0 && (
                        <input type="checkbox" onChange={() => setSelectedSubmissions(p => p.includes(index) ? p.filter(i => i !== index) : [...p, index])} />
                      )}
                      <p>{formatAddress(sub.solver)}</p>
                      {sub.solver.toLowerCase() === bounty.creator.toLowerCase() && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Creator</span>}
                    </div>
                    <a href={`https://ipfs.io/ipfs/${sub.blindedIpfsCid}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">View Submission</a>
                  </div>
                  {/* Replies */}
                  <div className="mt-2 pl-5 border-l-2 border-gray-200 space-y-2">
                    {sub.replies.map((reply, rIndex) => (
                      <div key={rIndex} className="text-xs">
                        <span className="font-semibold">{formatAddress(reply.replier)}:</span> {reply.content}
                      </div>
                    ))}
                    {bounty.status === 0 && (isCreator || address === sub.solver) && (
                      <div className="flex gap-2 pt-1">
                        <input type="text" placeholder="Add reply..." value={replyContent[index] || ''} onChange={e => setReplyContent({...replyContent, [index]: e.target.value})} className="flex-1 text-xs"/>
                        <button onClick={() => onAddReply(bounty.id, index, replyContent[index])} className="text-xs bg-gray-200 px-2 py-1 rounded">Reply</button>
                      </div>
                    )}
                  </div>
                  {/* Reveal UI */}
                  {bounty.status === 1 && address === sub.solver && !sub.revealed && (
                     <div className="mt-2 flex gap-2 pl-5">
                        <input type="text" placeholder="Reveal Solution IPFS CID" value={revealCid[index] || ''} onChange={e => setRevealCid({...revealCid, [index]: e.target.value})} className="flex-1 text-xs"/>
                        <button onClick={() => onRevealSolution(bounty.id, index, revealCid[index])} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Reveal</button>
                      </div>
                  )}
                </div>
              ))}
            </div>
            {isCreator && bounty.status === 0 && <button onClick={handleSelectWinners} disabled={selectedSubmissions.length === 0} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-md">Select Winner(s)</button>}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="bg-gray-50 p-4 border-t mt-auto">
        {bounty.status === 0 && !isCreator && <button onClick={() => {/* UI for submitSolution */}} className="w-full bg-blue-600 text-white p-2 rounded-md">Submit Your Solution</button>}
        {bounty.status === 0 && isCreator && isExpired && <button onClick={() => onTriggerSlash(bounty.id)} className="w-full bg-red-600 text-white p-2 rounded-md">Trigger Slash</button>}
      </div>
    </div>
  );
}