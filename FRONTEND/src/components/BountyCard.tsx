"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";
import {
  fetchMetadataFromIpfs,
  BountyMetadata,
  IpfsImage,
} from "../utils/ipfs";

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
  onSelectWinners: (
    bountyId: number,
    winners: string[],
    subIds: number[]
  ) => void;
  onTriggerSlash: (bountyId: number) => void;
  onAddReply: (bountyId: number, subId: number, content: string) => void;
  onRevealSolution: (
    bountyId: number,
    subId: number,
    revealCid: string
  ) => void;
}

const BountyStatusEnum = [
  "Open",
  "Pending Reveal",
  "Resolved",
  "Disputed",
  "Expired",
];
const StatusColors = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-red-500",
  "bg-gray-500",
];

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
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<number[]>([]);
  const [winnerRanks, setWinnerRanks] = useState<{ [subId: number]: number }>(
    {}
  );
  const [replyContent, setReplyContent] = useState<{ [subId: number]: string }>(
    {}
  );
  const [revealCid, setRevealCid] = useState<{ [subId: number]: string }>({});

  const isCreator = address?.toLowerCase() === bounty.creator.toLowerCase();
  const isExpired = BigInt(Math.floor(Date.now() / 1000)) > bounty.deadline;

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
    // Sort selected submissions by their assigned ranks
    const rankedSubmissions = selectedSubmissions
      .filter((subId) => winnerRanks[subId] > 0)
      .sort((a, b) => winnerRanks[a] - winnerRanks[b]);

    const selectedSolvers = rankedSubmissions.map(
      (i) => bounty.submissions[i].solver
    );
    onSelectWinners(bounty.id, selectedSolvers, rankedSubmissions);
  };

  const handleRankChange = (subId: number, rank: number) => {
    setWinnerRanks((prev) => ({
      ...prev,
      [subId]: rank,
    }));
  };

  const toggleSubmissionSelection = (index: number) => {
    setSelectedSubmissions((prev) => {
      const isSelected = prev.includes(index);
      if (isSelected) {
        // Remove from selection and clear rank
        setWinnerRanks((prevRanks) => {
          const newRanks = { ...prevRanks };
          delete newRanks[index];
          return newRanks;
        });
        return prev.filter((i) => i !== index);
      } else {
        // Add to selection with default rank
        const nextRank = Math.max(0, ...Object.values(winnerRanks)) + 1;
        setWinnerRanks((prev) => ({ ...prev, [index]: nextRank }));
        return [...prev, index];
      }
    });
  };

  // Get max allowed winners based on winner shares
  const maxWinners = bounty.allowMultipleWinners
    ? bounty.winnerShares.length
    : 1;

  const handleSubmitSolution = () => {
    if (!submissionCid.trim()) {
      alert("Please enter a valid IPFS CID.");
      return;
    }
    onSubmitSolution(bounty.id, submissionCid);
    setShowSubmissionForm(false);
    setSubmissionCid("");
  };

  const statusLabel = BountyStatusEnum[bounty.status] || "Unknown";
  const statusColor = StatusColors[bounty.status] || "bg-gray-500";

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
      {/* Image Header */}
      {metadata?.images && metadata.images.length > 0 && (
        <img
          src={`https://ipfs.io/ipfs/${metadata.images[0]}`}
          alt={metadata.title}
          className="w-full h-48 object-cover rounded-t-xl"
        />
      )}

      {/* Card Header */}
      <div className="p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">
              Bounty #{bounty.id}
            </h3>
            <p className="text-lg text-gray-600 font-normal mt-1">
              {metadata?.title || bounty.description.split("\n")[0]}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium text-white ${statusColor}`}
            >
              {statusLabel}
            </div>
            {bounty.allowMultipleWinners && (
              <div className="px-3 py-1 rounded-full text-sm font-medium text-indigo-800 bg-indigo-100">
                Multiple Winners
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between items-baseline mt-4">
          <div className="text-3xl font-bold text-green-600">
            {formatSTT(bounty.amount)} STT
          </div>
          <div className="text-sm text-gray-500">
            Deadline: {formatTimeLeft(bounty.deadline)}
          </div>
        </div>
      </div>

      {/* Details & Submissions Toggle */}
      <div className="px-6 pb-4 border-t border-gray-100">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
        >
          {showDetails
            ? "Hide Details & Submissions"
            : "Show Details & Submissions"}
        </button>
      </div>

      {/* Collapsible Section */}
      {showDetails && (
        <div className="px-6 pb-6">
          {/* Metadata Details */}
          {metadata && (
            <div className="mb-4 pb-4 border-b">
              <h5 className="font-semibold mb-2 text-gray-800">
                Bounty Details
              </h5>
              {/* Render remaining images here if they exist */}
              {metadata.images && metadata.images.length > 1 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {metadata.images.slice(1).map((cid, index) => (
                    <img
                      key={index}
                      src={`https://ipfs.io/ipfs/${cid}`}
                      alt={`Bounty image ${index + 2}`}
                      className="rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-600 whitespace-pre-wrap mb-4">
                {metadata.description}
              </p>

              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>Slash on Expiry:</strong>{" "}
                  {Number(bounty.slashPercent) / 100}%
                </p>
                {bounty.allowMultipleWinners &&
                  bounty.winnerShares.length > 0 && (
                    <div>
                      <strong>Winner Allocation:</strong>
                      <ul className="list-disc pl-5 mt-1">
                        {bounty.winnerShares.map((share, index) => (
                          <li key={index}>
                            Winner {index + 1}: {Number(share) / 100}%
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Winners Display for Pending Reveal */}
          {bounty.status === 1 && bounty.selectedWinners.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-300">
              <h5 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                🏆 Selected Winners
              </h5>
              <div className="space-y-2">
                {bounty.selectedWinners.map((winner, index) => {
                  const submissionIndex = Number(
                    bounty.selectedSubmissionIds[index]
                  );
                  const submission = bounty.submissions[submissionIndex];
                  const winnerShare = bounty.winnerShares[index]
                    ? Number(bounty.winnerShares[index]) / 100
                    : 0;

                  return (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-white rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${
                            index === 0
                              ? "bg-yellow-200 text-yellow-800"
                              : index === 1
                              ? "bg-gray-200 text-gray-800"
                              : index === 2
                              ? "bg-orange-200 text-orange-800"
                              : "bg-blue-200 text-blue-800"
                          }`}
                        >
                          {index === 0
                            ? "🥇"
                            : index === 1
                            ? "🥈"
                            : index === 2
                            ? "🥉"
                            : "🏆"}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {formatAddress(winner)}
                        </span>
                        {submission?.revealed && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                            ✅ Revealed
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          {winnerShare}% •{" "}
                          {formatSTT(
                            (bounty.amount * BigInt(winnerShare)) / BigInt(100)
                          )}{" "}
                          STT
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submissions Section */}
          <div className="mt-4">
            <h5 className="font-semibold mb-3 text-gray-800">
              Submissions ({bounty.submissions.length})
            </h5>
            <div className="space-y-4">
              {bounty.submissions.map((sub, index) => {
                const isWinner = bounty.selectedSubmissionIds.includes(
                  BigInt(index)
                );
                const winnerIndex = bounty.selectedSubmissionIds.findIndex(
                  (id) => id === BigInt(index)
                );

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      isWinner
                        ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-medium text-sm flex items-center gap-3">
                        {/* Winner Selection for Creator */}
                        {isCreator && bounty.status === 0 && (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedSubmissions.includes(index)}
                              onChange={() => toggleSubmissionSelection(index)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            {selectedSubmissions.includes(index) && (
                              <select
                                value={winnerRanks[index] || 1}
                                onChange={(e) =>
                                  handleRankChange(
                                    index,
                                    parseInt(e.target.value)
                                  )
                                }
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                              >
                                {Array.from({ length: maxWinners }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1 === 1
                                      ? "🥇 1st"
                                      : i + 1 === 2
                                      ? "🥈 2nd"
                                      : i + 1 === 3
                                      ? "🥉 3rd"
                                      : `${i + 1}th`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                        {/* Winner Badge for Pending Reveal Phase */}
                        {isWinner && bounty.status === 1 && (
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-bold ${
                                winnerIndex === 0
                                  ? "bg-yellow-200 text-yellow-800"
                                  : winnerIndex === 1
                                  ? "bg-gray-200 text-gray-800"
                                  : winnerIndex === 2
                                  ? "bg-orange-200 text-orange-800"
                                  : "bg-blue-200 text-blue-800"
                              }`}
                            >
                              {winnerIndex === 0
                                ? "🥇 1st Place"
                                : winnerIndex === 1
                                ? "🥈 2nd Place"
                                : winnerIndex === 2
                                ? "🥉 3rd Place"
                                : `🏆 ${winnerIndex + 1}th Place`}
                            </span>
                          </div>
                        )}

                        <p className="text-sm font-semibold text-gray-900">
                          {formatAddress(sub.solver)}
                        </p>
                        {sub.solver.toLowerCase() ===
                          bounty.creator.toLowerCase() && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                            Creator
                          </span>
                        )}
                      </div>
                      <a
                        href={`https://ipfs.io/ipfs/${sub.blindedIpfsCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 text-sm hover:underline font-medium"
                      >
                        View Submission
                      </a>
                    </div>
                    {/* Replies */}
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                      {sub.replies.map((reply, rIndex) => (
                        <div
                          key={rIndex}
                          className="text-sm bg-gray-100 p-3 rounded-lg"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900">
                              {formatAddress(reply.replier)}
                            </span>
                            {reply.replier.toLowerCase() ===
                              bounty.creator.toLowerCase() && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                                Creator
                              </span>
                            )}
                          </div>
                          <p className="text-gray-800">{reply.content}</p>
                        </div>
                      ))}
                      {bounty.status === 0 &&
                        (isCreator ||
                          address?.toLowerCase() ===
                            sub.solver.toLowerCase()) && (
                          <div className="flex gap-2 pt-2">
                            <input
                              type="text"
                              placeholder="Add reply..."
                              value={replyContent[index] || ""}
                              onChange={(e) =>
                                setReplyContent({
                                  ...replyContent,
                                  [index]: e.target.value,
                                })
                              }
                              className="flex-1 text-sm border-gray-300 rounded-md p-2"
                            />
                            <button
                              onClick={() =>
                                onAddReply(
                                  bounty.id,
                                  index,
                                  replyContent[index]
                                )
                              }
                              className="text-sm bg-blue-600 text-white font-medium px-4 py-2 rounded-md"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                    </div>
                    {/* Reveal UI - Styled like reply form */}
                    {bounty.status === 1 &&
                      address?.toLowerCase() === sub.solver.toLowerCase() &&
                      !sub.revealed && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter your solution reveal IPFS CID..."
                              value={revealCid[index] || ""}
                              onChange={(e) =>
                                setRevealCid({
                                  ...revealCid,
                                  [index]: e.target.value,
                                })
                              }
                              className="flex-1 text-sm border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                            <button
                              onClick={() =>
                                onRevealSolution(
                                  bounty.id,
                                  index,
                                  revealCid[index]
                                )
                              }
                              disabled={!revealCid[index]?.trim()}
                              className="text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium px-4 py-2 rounded-md transition-colors"
                            >
                              🔓 Reveal
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            💡 Reveal your actual solution to claim rewards
                          </p>
                        </div>
                      )}

                    {/* Already Revealed Indicator */}
                    {bounty.status === 1 && sub.revealed && isWinner && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-600 font-medium">
                            ✅ Solution Revealed
                          </span>
                          <a
                            href={`https://ipfs.io/ipfs/${sub.revealIpfsCid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View Final Solution
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isCreator && bounty.status === 0 && (
              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h6 className="font-bold text-gray-900 mb-1">
                      Ready to Select Winners?
                    </h6>
                    <p className="text-sm text-gray-600">
                      {selectedSubmissions.length > 0
                        ? `${selectedSubmissions.length} submission(s) selected`
                        : "Select submissions and assign rankings"}
                    </p>
                    {bounty.allowMultipleWinners && (
                      <p className="text-xs text-blue-600 mt-1">
                        💡 Maximum {maxWinners} winner(s) allowed
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleSelectWinners}
                    disabled={
                      selectedSubmissions.length === 0 ||
                      selectedSubmissions.some((id) => !winnerRanks[id])
                    }
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold px-6 py-3 rounded-lg transition-all duration-200 shadow-lg disabled:cursor-not-allowed"
                  >
                    🏆 Confirm Winners
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="bg-gray-50 p-4 border-t mt-auto">
        {bounty.status === 0 && !isCreator && !showSubmissionForm && (
          <button
            onClick={() => setShowSubmissionForm(true)}
            className="w-full bg-blue-600 text-white p-2 rounded-md"
          >
            Submit Your Solution
          </button>
        )}

        {showSubmissionForm && (
          <div className="space-y-3">
            <input
              type="text"
              value={submissionCid}
              onChange={(e) => setSubmissionCid(e.target.value)}
              placeholder="Enter your solution IPFS CID"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSubmitSolution}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md font-medium"
              >
                Confirm Submission
              </button>
              <button
                onClick={() => setShowSubmissionForm(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 p-2 rounded-md font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {bounty.status === 0 && isCreator && isExpired && (
          <button
            onClick={() => onTriggerSlash(bounty.id)}
            className="w-full bg-red-600 text-white p-2 rounded-md"
          >
            Trigger Slash
          </button>
        )}
      </div>
    </div>
  );
}
