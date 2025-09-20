'use client';

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWatchContractEvent,
} from "wagmi";
import {
  CONTRACT_ADDRESSES,
  DISPUTE_ABI,
  QUINTY_ABI, // Import Quinty ABI to get submission details
  SOMNIA_TESTNET_ID,
  MIN_VOTING_STAKE,
} from "../utils/contracts";
import { readContract } from "@wagmi/core";
import { formatSTT, formatTimeLeft, formatAddress, wagmiConfig, parseSTT } from "../utils/web3";

// Interfaces
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
}

interface Submission {
  solver: string;
  blindedIpfsCid: string;
}

export default function DisputeManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // State
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [eligibleBounties, setEligibleBounties] = useState<Bounty[]>([]);
  const [votes, setVotes] = useState<{ [disputeId: number]: Vote[] }>({});
  const [disputedSubmissions, setDisputedSubmissions] = useState<{ [bountyId: number]: Submission[] }>({});
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  // Form states
  const [voteForm, setVoteForm] = useState<{rank1: string; rank2: string; rank3: string; stakeAmount: string;}>({ rank1: '-1', rank2: '-1', rank3: '-1', stakeAmount: MIN_VOTING_STAKE });
  const [pengadilanForm, setPengadilanForm] = useState({ bountyId: "" });

  // Read dispute counter
  const { data: disputeCounter, refetch: refetchDisputes } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].DisputeResolver as `0x${string}`,
    abi: DISPUTE_ABI,
    functionName: "disputeCounter",
  });

  // Read bounty counter
  const { data: bountyCounter } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
    abi: QUINTY_ABI,
    functionName: "bountyCounter",
  });

  // Function to fetch submissions for a given bounty
  const fetchSubmissionsForBounty = async (bountyId: number) => {
    if (disputedSubmissions[bountyId]) return; // Already fetched

    try {
      const submissionCount = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "getSubmissionCount",
        args: [BigInt(bountyId)],
      });

      const loadedSubmissions: Submission[] = [];
      for (let i = 0; i < Number(submissionCount); i++) {
        const subData = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
          abi: QUINTY_ABI,
          functionName: "getSubmission",
          args: [BigInt(bountyId), BigInt(i)],
        });
        const [, solver, blindedIpfsCid] = subData as any;
        loadedSubmissions.push({ solver, blindedIpfsCid });
      }
      setDisputedSubmissions(prev => ({ ...prev, [bountyId]: loadedSubmissions }));
    } catch (error) {
      console.error(`Error fetching submissions for bounty ${bountyId}:`, error);
    }
  };

  // Load all disputes
  const loadDisputes = async () => {
    if (disputeCounter === undefined) return;

    const loadedDisputes: Dispute[] = [];
    for (let i = 1; i <= Number(disputeCounter); i++) {
      try {
        const disputeData = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].DisputeResolver as `0x${string}`,
          abi: DISPUTE_ABI,
          functionName: "getDispute",
          args: [BigInt(i)],
        });
        
        if (disputeData) {
          const [bountyId, isExpiry, amount, votingEnd, resolved, voteCount] = disputeData as any;
          const dispute: Dispute = {
            id: i,
            bountyId: Number(bountyId),
            isExpiry,
            amount,
            votingEnd: Number(votingEnd),
            resolved,
            voteCount: Number(voteCount),
          };
          loadedDisputes.push(dispute);
          fetchSubmissionsForBounty(dispute.bountyId); // Fetch submissions for the disputed bounty
        }
      } catch (error) {
        console.error(`Error loading dispute ${i}:`, error);
      }
    }
    setDisputes(loadedDisputes.reverse());
  };

  // Cast vote
  const castVote = async () => {
    if (!isConnected || !selectedDispute) return;

    const rankings = [voteForm.rank1, voteForm.rank2, voteForm.rank3].map(Number);
    if (rankings.some(r => r < 0)) {
      alert("Please rank 3 unique submissions.");
      return;
    }
    const uniqueRankings = new Set(rankings);
    if (uniqueRankings.size !== 3) {
      alert("Rankings must be for 3 unique submissions.");
      return;
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "vote",
        args: [BigInt(selectedDispute.id), rankings.map(r => BigInt(r))],
        value: parseSTT(voteForm.stakeAmount),
      });

      alert("Vote cast successfully!");
      refetchDisputes();
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
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "resolveDispute",
        args: [BigInt(disputeId)],
      });

      alert("Dispute resolved successfully!");
      refetchDisputes();
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
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "initiatePengadilanDispute",
        args: [BigInt(pengadilanForm.bountyId)],
      });

      setPengadilanForm({ bountyId: 0 });
      alert("Pengadilan dispute initiated successfully!");
      refetchDisputes();
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
        <p className="text-gray-700">Please connect your wallet to participate in disputes.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Dispute Resolution (Pengadilan DAO)</h2>
        <p className="text-gray-700">Participate in community voting to resolve bounty disputes and expiries.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Initiate Pengadilan Dispute</h3>
        <p className="text-gray-600 mb-4">As a bounty creator, you can dispute a winner selection if you believe there was an issue. This must be done within 7 days of resolution.</p>
        <div className="flex gap-4 items-center">
          <input
            type="number"
            placeholder="Bounty ID to Dispute"
            value={pengadilanForm.bountyId || ""}
            onChange={(e) => setPengadilanForm({ bountyId: parseInt(e.target.value) || 0 })}
            className="border border-gray-300 rounded-md px-3 py-2"
          />
          <button
            onClick={initiatePengadilan}
            disabled={!pengadilanForm.bountyId}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Initiate Dispute
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Active Disputes ({disputes.filter((d) => !d.resolved).length})</h3>
        {disputes.filter(d => !d.resolved).length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">No active disputes.</div>
        ) : (
          <div className="space-y-4">
            {disputes.filter(d => !d.resolved).map((dispute) => (
              <div key={dispute.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Dispute #{dispute.id} (for Bounty #{dispute.bountyId})</h4>
                    <div className="flex items-center gap-4 mt-2">
                      <span className={`px-2 py-1 rounded-full text-sm ${dispute.isExpiry ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                        {dispute.isExpiry ? "Expiry Vote" : "Pengadilan Dispute"}
                      </span>
                      <span className="text-sm text-gray-500">{dispute.voteCount} votes cast</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-600">{formatSTT(dispute.amount)} STT</div>
                    <div className="text-sm text-gray-500">Voting ends in {formatTimeLeft(BigInt(dispute.votingEnd))}</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700">
                  {dispute.isExpiry
                    ? "The bounty deadline has passed. Community members can vote to rank the top 3 submissions. The highest-ranked non-winner receives 10% of the slash amount, and correct voters share 5%."
                    : "The bounty creator has disputed the winner selection. Community can vote to overturn the decision. If successful, 80% refund to creator, 10% to voters, 10% to original solver."}
                </div>

                {selectedDispute?.id !== dispute.id && <button onClick={() => setSelectedDispute(dispute)} className="text-blue-600">Show Details & Vote</button>}

                {selectedDispute?.id === dispute.id && (
                  <div className="border-t pt-4">
                    <h5 className="font-medium mb-3">Submissions for Bounty #{dispute.bountyId}</h5>
                    <div className="space-y-2 mb-4">
                      {disputedSubmissions[dispute.bountyId]?.map((sub, index) => (
                        <div key={index} className="p-2 border rounded-md bg-white flex justify-between items-center">
                          <span>Submission #{index} by {formatAddress(sub.solver)}</span>
                          <a href={`https://ipfs.io/ipfs/${sub.blindedIpfsCid}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">View on IPFS</a>
                        </div>
                      ))}
                    </div>

                    <h5 className="font-medium mb-3">Cast Your Vote (Minimum {MIN_VOTING_STAKE} STT stake)</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Rank Top 3 Submissions</label>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">1st Place</label>
                            <select value={voteForm.rank1} onChange={(e) => setVoteForm({...voteForm, rank1: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                              <option value="-1" disabled>Select</option>
                              {disputedSubmissions[dispute.bountyId]?.map((_, index) => <option key={index} value={index}>Submission #{index}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">2nd Place</label>
                            <select value={voteForm.rank2} onChange={(e) => setVoteForm({...voteForm, rank2: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                              <option value="-1" disabled>Select</option>
                              {disputedSubmissions[dispute.bountyId]?.map((_, index) => <option key={index} value={index}>Submission #{index}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">3rd Place</label>
                            <select value={voteForm.rank3} onChange={(e) => setVoteForm({...voteForm, rank3: e.target.value})} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                              <option value="-1" disabled>Select</option>
                              {disputedSubmissions[dispute.bountyId]?.map((_, index) => <option key={index} value={index}>Submission #{index}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stake Amount (STT)</label>
                        <input type="number" value={voteForm.stakeAmount} onChange={(e) => setVoteForm({ ...voteForm, stakeAmount: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2" min={MIN_VOTING_STAKE} step="0.0001" placeholder={MIN_VOTING_STAKE} />
                        <p className="text-xs text-gray-500 mt-1">Higher stakes give more voting power.</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button onClick={castVote} disabled={parseFloat(voteForm.stakeAmount) < parseFloat(MIN_VOTING_STAKE)} className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50">Cast Vote ({voteForm.stakeAmount} STT)</button>
                      <button onClick={() => setSelectedDispute(null)} className="ml-2 text-gray-600">Hide</button>
                    </div>
                  </div>
                )}

                {Date.now() / 1000 > dispute.votingEnd && (
                  <div className="border-t pt-4 mt-4">
                    <button onClick={() => resolveDispute(dispute.id)} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Resolve Dispute & Distribute Rewards</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}