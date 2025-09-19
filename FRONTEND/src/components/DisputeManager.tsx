"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWatchContractEvent,
} from "wagmi";
import { parseEther } from "viem";
import {
  CONTRACT_ADDRESSES,
  DISPUTE_ABI,
  SOMNIA_TESTNET_ID,
  MIN_VOTING_STAKE,
} from "../utils/contracts";
import { readContract } from "@wagmi/core";
import { formatSTT, formatTimeLeft, formatAddress, wagmiConfig } from "../utils/web3";

interface Dispute {
  id: number;
  bountyId: number;
  isExpiry: boolean;
  amount: bigint;
  votingEnd: number;
  voteCount: number;
  resolved: boolean;
}

interface Vote {
  voter: string;
  stake: bigint;
  rankedSubIds: number[];
  timestamp: number;
}

export default function DisputeManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // State
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [votes, setVotes] = useState<{ [disputeId: number]: Vote[] }>({});
  const [selectedDispute, setSelectedDispute] = useState<number | null>(null);

  // Form states
  const [voteForm, setVoteForm] = useState({
    disputeId: 0,
    rankings: [0, 1, 2] as number[],
    stakeAmount: MIN_VOTING_STAKE,
  });

  const [pengadilanForm, setPengadilanForm] = useState({
    bountyId: 0,
  });

  // Read dispute counter
  const { data: disputeCounter, refetch: refetchDisputes } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .DisputeResolver as `0x${string}`,
    abi: DISPUTE_ABI,
    functionName: "disputeCounter",
  });

  // Watch for dispute events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .DisputeResolver as `0x${string}`,
    abi: DISPUTE_ABI,
    eventName: "DisputeInitiated",
    onLogs(logs) {
      refetchDisputes();
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .DisputeResolver as `0x${string}`,
    abi: DISPUTE_ABI,
    eventName: "VoteCast",
    onLogs(logs) {
      refetchDisputes();
    },
  });

  // Load all disputes
  const loadDisputes = async () => {
    if (disputeCounter === undefined) return;

    const loadedDisputes: Dispute[] = [];
    for (let i = 1; i <= Number(disputeCounter); i++) {
      try {
        const dispute = await readDispute(i);
        if (dispute) {
          loadedDisputes.push(dispute);
          loadVotes(dispute);
        }
      } catch (error) {
        console.error(`Error loading dispute ${i}:`, error);
      }
    }
    setDisputes(loadedDisputes.reverse());
  };

  // Read specific dispute
  const readDispute = async (disputeId: number): Promise<Dispute | null> => {
    try {
      const disputeData = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "getDispute",
        args: [BigInt(disputeId)],
      });

      if (disputeData) {
        const [bountyId, isExpiry, amount, votingEnd, resolved, voteCount] = disputeData as any;
        return {
          id: disputeId,
          bountyId: Number(bountyId),
          isExpiry,
          amount,
          votingEnd: Number(votingEnd),
          resolved,
          voteCount: Number(voteCount),
        };
      }
      return null;
    } catch (e) {
      console.error(`Error reading dispute ${disputeId}:`, e);
      return null;
    }
  };

  // Load votes for a dispute
  const loadVotes = async (dispute: Dispute) => {
    if (!dispute) return;

    try {
        const loadedVotes: Vote[] = [];
        for (let i = 0; i < dispute.voteCount; i++) {
            const voteData = await readContract(wagmiConfig, {
                address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].DisputeResolver as `0x${string}`,
                abi: DISPUTE_ABI,
                functionName: "getVote",
                args: [BigInt(dispute.id), BigInt(i)],
            });
            const [voter, stake, rankedSubIds, timestamp] = voteData as any;
            loadedVotes.push({ voter, stake, rankedSubIds: rankedSubIds.map(Number), timestamp: Number(timestamp) });
        }
        setVotes((prev) => ({
            ...prev,
            [dispute.id]: loadedVotes,
        }));
    } catch (error) {
        console.error(`Error loading votes for dispute ${dispute.id}:`, error);
    }
  };

  // Cast vote
  const castVote = async () => {
    if (!isConnected || !voteForm.disputeId) return;

    // Validate rankings
    const uniqueRankings = new Set(voteForm.rankings);
    if (uniqueRankings.size !== 3) {
      alert("Rankings must be unique (rank 3 different submissions)");
      return;
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "vote",
        args: [
          BigInt(voteForm.disputeId),
          voteForm.rankings.map((r) => BigInt(r)),
        ],
        value: parseEther(voteForm.stakeAmount),
      });

      setVoteForm({
        disputeId: 0,
        rankings: [0, 1, 2],
        stakeAmount: MIN_VOTING_STAKE,
      });

      alert("Vote cast successfully!");
      loadDisputes();
    } catch (error) {
      console.error("Error casting vote:", error);
      alert("Error casting vote");
    }
  };

  // Resolve dispute
  const resolveDispute = async (disputeId: number) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "resolveDispute",
        args: [BigInt(disputeId)],
      });

      alert("Dispute resolved successfully!");
      loadDisputes();
    } catch (error) {
      console.error("Error resolving dispute:", error);
      alert("Error resolving dispute");
    }
  };

  // Initiate pengadilan dispute
  const initiatePengadilan = async () => {
    if (!isConnected || !pengadilanForm.bountyId) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "initiatePengadilanDispute",
        args: [BigInt(pengadilanForm.bountyId)],
      });

      setPengadilanForm({ bountyId: 0 });
      alert("Pengadilan dispute initiated successfully!");
      loadDisputes();
    } catch (error) {
      console.error("Error initiating pengadilan:", error);
      alert("Error initiating pengadilan dispute");
    }
  };

  useEffect(() => {
    if (disputeCounter) {
      loadDisputes();
    }
  }, [disputeCounter]);

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-700">
          Please connect your wallet to participate in disputes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Dispute Resolution (Pengadilan DAO)
        </h2>
        <p className="text-gray-700">
          Participate in community voting to resolve bounty disputes and
          expiries
        </p>
      </div>

      {/* Initiate Pengadilan Dispute */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">
          Initiate Pengadilan Dispute
        </h3>
        <p className="text-gray-600 mb-4">
          As a bounty creator, you can dispute the winner selection within 7
          days of resolution.
        </p>
        <div className="flex gap-4">
          <input
            type="number"
            placeholder="Bounty ID"
            value={pengadilanForm.bountyId || ""}
            onChange={(e) =>
              setPengadilanForm({ bountyId: parseInt(e.target.value) || 0 })
            }
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <button
            onClick={initiatePengadilan}
            disabled={!pengadilanForm.bountyId}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Initiate Pengadilan Dispute
          </button>
        </div>
      </div>

      {/* Active Disputes */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">
            Active Disputes ({disputes.filter((d) => !d.resolved).length})
          </h3>
        </div>

        {disputes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No disputes found.
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <div key={dispute.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      Dispute #{dispute.id} - Bounty #{dispute.bountyId}
                    </h4>
                    <div className="flex items-center gap-4 mt-2">
                      <span
                        className={`px-2 py-1 rounded-full text-sm ${
                          dispute.isExpiry
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {dispute.isExpiry
                          ? "Expiry Vote"
                          : "Pengadilan Dispute"}
                      </span>
                      <span className="text-sm text-gray-500">
                        {dispute.voteCount} votes cast
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-600">
                      {formatSTT(dispute.amount)} STT
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatTimeLeft(BigInt(dispute.votingEnd))}
                    </div>
                    <div
                      className={`mt-1 px-2 py-1 rounded-full text-xs ${
                        dispute.resolved
                          ? "bg-green-100 text-green-800"
                          : Date.now() / 1000 > dispute.votingEnd
                          ? "bg-gray-100 text-gray-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {dispute.resolved
                        ? "Resolved"
                        : Date.now() / 1000 > dispute.votingEnd
                        ? "Voting Ended"
                        : "Voting Active"}
                    </div>
                  </div>
                </div>

                {/* Dispute Description */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h5 className="font-medium mb-2">
                    {dispute.isExpiry
                      ? "Expiry Voting"
                      : "Pengadilan Court Dispute"}
                  </h5>
                  <p className="text-gray-600 text-sm">
                    {dispute.isExpiry
                      ? "The bounty deadline has passed. Community members can vote to rank the top 3 submissions. The highest-ranked non-winner receives 10% of the slash amount, and correct voters share 5%."
                      : "The bounty creator has disputed the winner selection. Community can vote to overturn the decision. If successful, 80% refund to creator, 10% to voters, 10% to original solver."}
                  </p>
                </div>

                {/* Voting Interface */}
                {!dispute.resolved &&
                  Date.now() / 1000 <= dispute.votingEnd && (
                    <div className="border-t pt-4">
                      <h5 className="font-medium mb-3">
                        Cast Your Vote (Minimum {MIN_VOTING_STAKE} STT stake)
                      </h5>

                      <div className="grid grid-cols-1 gap-4">
                        {/* Rankings */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Rank Top 3 Submissions (1st = best, 3rd = worst)
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[0, 1, 2].map((position) => (
                              <div key={position}>
                                <label className="block text-xs text-gray-600 mb-1">
                                  {position === 0
                                    ? "1st Place"
                                    : position === 1
                                    ? "2nd Place"
                                    : "3rd Place"}
                                </label>
                                <select
                                  value={voteForm.rankings[position]}
                                  onChange={(e) => {
                                    const newRankings = [...voteForm.rankings];
                                    newRankings[position] = parseInt(
                                      e.target.value
                                    );
                                    setVoteForm({
                                      ...voteForm,
                                      rankings: newRankings,
                                    });
                                  }}
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                >
                                  {[0, 1, 2, 3, 4].map((subId) => (
                                    <option key={subId} value={subId}>
                                      Submission #{subId}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Stake Amount */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Stake Amount (STT)
                          </label>
                          <input
                            type="number"
                            value={voteForm.stakeAmount}
                            onChange={(e) =>
                              setVoteForm({
                                ...voteForm,
                                stakeAmount: e.target.value,
                              })
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            min={MIN_VOTING_STAKE}
                            step="0.0001"
                            placeholder={MIN_VOTING_STAKE}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Higher stakes give more voting power. You earn
                            rewards if your vote aligns with the majority.
                          </p>
                        </div>

                        {/* Vote Button */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setVoteForm({
                                ...voteForm,
                                disputeId: dispute.id,
                              });
                              castVote();
                            }}
                            disabled={
                              parseFloat(voteForm.stakeAmount) <
                              parseFloat(MIN_VOTING_STAKE)
                            }
                            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50"
                          >
                            Cast Vote ({voteForm.stakeAmount} STT)
                          </button>
                          <button
                            onClick={() =>
                              setSelectedDispute(
                                selectedDispute === dispute.id
                                  ? null
                                  : dispute.id
                              )
                            }
                            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                          >
                            {selectedDispute === dispute.id
                              ? "Hide Details"
                              : "View Details"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Resolution Button */}
                {!dispute.resolved &&
                  Date.now() / 1000 > dispute.votingEnd &&
                  dispute.voteCount > 0 && (
                    <div className="border-t pt-4">
                      <button
                        onClick={() => resolveDispute(dispute.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                      >
                        Resolve Dispute & Distribute Rewards
                      </button>
                    </div>
                  )}

                {/* Detailed Voting Results */}
                {selectedDispute === dispute.id && (
                  <div className="border-t pt-4 mt-4">
                    <h6 className="font-medium mb-3">Voting Details</h6>

                    {votes[dispute.id]?.length > 0 ? (
                      <div className="space-y-2">
                        {votes[dispute.id].map((vote, index) => (
                          <div key={index} className="bg-gray-50 rounded p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                {formatAddress(vote.voter)}
                              </span>
                              <span className="text-sm text-gray-600">
                                Stake: {formatSTT(vote.stake)} STT
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Rankings:{" "}
                              {vote.rankedSubIds
                                .map((id, i) => `${i + 1}. Submission #${id}`)
                                .join(" | ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        No votes cast yet.
                      </p>
                    )}

                    {/* Voting Guidelines */}
                    <div className="bg-blue-50 rounded-lg p-4 mt-4">
                      <h6 className="font-medium text-blue-900 mb-2">
                        Voting Guidelines
                      </h6>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>
                          • Review all submissions carefully before voting
                        </li>
                        <li>
                          • Rank based on quality, creativity, and adherence to
                          requirements
                        </li>
                        <li>
                          • Higher stakes give more voting power but also higher
                          risk
                        </li>
                        <li>
                          • Rewards are distributed proportionally to correct
                          voters
                        </li>
                        <li>• Votes are final and cannot be changed</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Resolved Disputes History */}
        {disputes.filter((d) => d.resolved).length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Resolved Disputes</h3>
            <div className="space-y-2">
              {disputes
                .filter((d) => d.resolved)
                .map((dispute) => (
                  <div key={dispute.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">
                          Dispute #{dispute.id}
                        </span>
                        <span className="text-gray-500 ml-2">
                          ({dispute.isExpiry ? "Expiry" : "Pengadilan"})
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatSTT(dispute.amount)} STT
                        </div>
                        <div className="text-xs text-gray-500">
                          {dispute.voteCount} votes
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
