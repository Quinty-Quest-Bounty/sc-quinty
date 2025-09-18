"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";
import {
  formatIpfsUrl,
  fetchMetadataFromIpfs,
  BountyMetadata,
} from "../utils/ipfs";

interface Bounty {
  id: number;
  creator: string;
  description: string;
  amount: bigint;
  deadline: bigint;
  allowMultipleWinners: boolean;
  winnerShares: readonly bigint[];
  resolved: boolean;
  slashPercent: bigint;
  winners: readonly string[];
  slashed: boolean;
  metadataCid?: string;
}

interface BountyCardProps {
  bounty: Bounty;
  onSubmitSolution?: (bountyId: number, ipfsCid: string) => void;
  onSelectWinners?: (
    bountyId: number,
    winners: string[],
    subIds: number[]
  ) => void;
  onTriggerSlash?: (bountyId: number) => void;
  showManagementActions?: boolean;
}

export default function BountyCard({
  bounty,
  onSubmitSolution,
  onSelectWinners,
  onTriggerSlash,
  showManagementActions = true,
}: BountyCardProps) {
  const { address } = useAccount();
  const [metadata, setMetadata] = useState<BountyMetadata | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [submissionCid, setSubmissionCid] = useState("");
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Load metadata from IPFS if available
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

  const isExpired = Date.now() / 1000 > Number(bounty.deadline);
  const isCreator = address === bounty.creator;
  const canManage = isCreator && showManagementActions;

  const getBountyStatus = () => {
    if (bounty.resolved) {
      return bounty.slashed
        ? { label: "Slashed", color: "bg-red-500 text-white" } // Improved contrast
        : { label: "Resolved", color: "bg-green-500 text-white" }; // Improved contrast
    }
    if (isExpired) {
      return { label: "Expired", color: "bg-orange-500 text-white" }; // Improved contrast
    }
    return { label: "Active", color: "bg-blue-500 text-white" }; // Improved contrast
  };

  const handleSubmitSolution = () => {
    if (submissionCid.trim() && onSubmitSolution) {
      onSubmitSolution(bounty.id, submissionCid);
      setSubmissionCid("");
    }
  };

  const status = getBountyStatus();
  const depositAmount = bounty.amount / BigInt(10); // 10% deposit

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Header with primary info */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900">
                Bounty #{bounty.id}
              </h3>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}
              >
                {status.label}
              </span>
            </div>

            <p className="text-gray-600 mb-3 line-clamp-2">
              {metadata?.title || bounty.description}
            </p>

            {metadata?.bountyType && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                  {metadata.bountyType.charAt(0).toUpperCase() +
                    metadata.bountyType.slice(1)}
                </span>
                {metadata.skills &&
                  metadata.skills.slice(0, 2).map((skill, index) => (
                    <span
                      key={index}
                      className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                {metadata.skills && metadata.skills.length > 2 && (
                  <span className="text-sm text-gray-500">
                    +{metadata.skills.length - 2} more
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="text-right ml-4">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {formatSTT(bounty.amount)} STT
            </div>
            <div className="text-sm text-gray-500 mb-1">
              {formatTimeLeft(bounty.deadline)}
            </div>
            {bounty.allowMultipleWinners && (
              <div className="text-xs text-blue-600">Multiple Winners</div>
            )}
          </div>
        </div>

        {/* Metadata Images */}
        {metadata?.images && metadata.images.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto">
              {metadata.images.slice(0, 3).map((imageCid, index) => (
                <IpfsImage
                  key={index}
                  cid={imageCid}
                  alt={`Bounty ${bounty.id} image ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  fallback="/placeholder-image.png"
                />
              ))}
              {metadata.images.length > 3 && (
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                  +{metadata.images.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Creator and details */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-4">
            <span>Creator: {formatAddress(bounty.creator)}</span>
            <span>Slash: {Number(bounty.slashPercent) / 100}%</span>
            {bounty.winners.length > 0 && (
              <span>Winners: {bounty.winners.length}</span>
            )}
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>

        {/* Expanded details */}
        {showDetails && (
          <div className="border-t pt-4 mt-4">
            {isLoadingMetadata ? (
              <div className="text-center py-4">
                <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading details...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {metadata?.requirements && (
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">
                      Requirements
                    </h5>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {metadata.requirements.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {metadata?.deliverables && (
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">
                      Deliverables
                    </h5>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {metadata.deliverables.map((deliverable, index) => (
                        <li key={index}>{deliverable}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {metadata?.skills && (
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">
                      Required Skills
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {metadata.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  <p>Full Description: {bounty.description}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action sections */}
      <div className="border-t bg-gray-50">
        {/* Submit Solution (for non-creators, if bounty is active) */}
        {!bounty.resolved && !isCreator && (
          <div className="p-4">
            <h5 className="font-medium text-gray-900 mb-3">Submit Solution</h5>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="IPFS CID (e.g., QmExample...)"
                value={submissionCid}
                onChange={(e) => setSubmissionCid(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSubmitSolution}
                disabled={!submissionCid.trim() || isExpired}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit ({formatSTT(depositAmount)} STT)
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Requires 10% deposit of bounty amount. Refunded if not selected as
              winner.
            </p>
          </div>
        )}

        {/* Management Actions (for creators) */}
        {canManage && !bounty.resolved && (
          <div className="p-4 border-t">
            <h5 className="font-medium text-gray-900 mb-3">Manage Bounty</h5>
            <div className="flex gap-3">
              <button
                onClick={() => onSelectWinners?.(bounty.id, [address], [0])}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
              >
                Select Winner
              </button>

              {isExpired && (
                <button
                  onClick={() => onTriggerSlash?.(bounty.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Trigger Slash
                </button>
              )}
            </div>
          </div>
        )}

        {/* Winner Display */}
        {bounty.resolved && bounty.winners.length > 0 && (
          <div className="p-4 border-t">
            <h5 className="font-medium text-gray-900 mb-2">Winners</h5>
            <div className="space-y-1">
              {bounty.winners.map((winner, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-gray-600">{formatAddress(winner)}</span>
                  {bounty.winnerShares[index] && (
                    <span className="font-medium text-green-600">
                      {(Number(bounty.winnerShares[index]) / 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
