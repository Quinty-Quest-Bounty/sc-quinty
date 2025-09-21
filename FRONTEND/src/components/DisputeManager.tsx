"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import {
  CONTRACT_ADDRESSES,
  DISPUTE_ABI,
  QUINTY_ABI, // Import Quinty ABI to get submission details
  SOMNIA_TESTNET_ID,
  MIN_VOTING_STAKE,
} from "../utils/contracts";
import { readContract } from "@wagmi/core";
import {
  formatSTT,
  formatTimeLeft,
  formatAddress,
  wagmiConfig,
  parseSTT,
} from "../utils/web3";

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

interface Bounty {
  id: number;
  creator: string;
  description: string;
  amount: bigint;
  deadline: bigint;
  allowMultipleWinners: boolean;
  winnerShares: readonly bigint[];
  status: number; // 0:OPEN, 1:PENDING_REVEAL, 2:RESOLVED, 3:DISPUTED, 4:EXPIRED
  slashPercent: bigint;
  selectedWinners: readonly string[];
  selectedSubmissionIds: readonly bigint[];
  metadataCid?: string;
}

export default function DisputeManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // State
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [eligibleBounties, setEligibleBounties] = useState<Bounty[]>([]);
  const [disputedSubmissions, setDisputedSubmissions] = useState<{
    [bountyId: number]: Submission[];
  }>({});
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  // Form states
  const [voteForm, setVoteForm] = useState<{
    rank1: string;
    rank2: string;
    rank3: string;
    stakeAmount: string;
  }>({ rank1: "-1", rank2: "-1", rank3: "-1", stakeAmount: MIN_VOTING_STAKE });

  // Read dispute counter
  const { data: disputeCounter, refetch: refetchDisputes } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .DisputeResolver as `0x${string}`,
    abi: DISPUTE_ABI,
    functionName: "disputeCounter",
  });

  // Read bounty counter
  const { data: bountyCounter } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
    abi: QUINTY_ABI,
    functionName: "bountyCounter",
  });

  // Load eligible bounties for pengadilan dispute
  const loadEligibleBounties = async () => {
    if (bountyCounter === undefined) return;

    console.log("🔍 DEBUG: Starting to load eligible bounties...");
    console.log("🔍 DEBUG: Bounty counter:", Number(bountyCounter));

    const loadedBounties: Bounty[] = [];
    for (let i = 1; i <= Number(bountyCounter); i++) {
      try {
        console.log(`🔍 DEBUG: Loading bounty ${i}...`);
        const bountyData = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
            .Quinty as `0x${string}`,
          abi: QUINTY_ABI,
          functionName: "getBountyData",
          args: [BigInt(i)],
        });

        if (bountyData) {
          const [
            creator,
            description,
            amount,
            deadline,
            allowMultipleWinners,
            winnerShares,
            status,
            slashPercent,
            selectedWinners,
            selectedSubmissionIds,
          ] = bountyData as any;

          console.log(`🔍 DEBUG: Bounty ${i} data:`, {
            creator,
            description: description?.substring(0, 50) + "...",
            amount: amount?.toString(),
            deadline: deadline?.toString(),
            status: Number(status),
            selectedWinners: selectedWinners?.length,
            selectedSubmissionIds: selectedSubmissionIds?.length,
          });

          // Only include PENDING_REVEAL bounties (status 1) that can be disputed
          if (status === 1 && selectedWinners.length > 0) {
            console.log(`✅ DEBUG: Bounty ${i} is eligible for dispute!`);
            const bounty: Bounty = {
              id: i,
              creator,
              description,
              amount,
              deadline,
              allowMultipleWinners,
              winnerShares,
              status,
              slashPercent,
              selectedWinners,
              selectedSubmissionIds,
            };
            loadedBounties.push(bounty);
          } else {
            console.log(`❌ DEBUG: Bounty ${i} not eligible - status: ${Number(status)}, selectedWinners: ${selectedWinners?.length}`);
          }
        } else {
          console.log(`❌ DEBUG: No data returned for bounty ${i}`);
        }
      } catch (error) {
        console.error(`Error loading bounty ${i}:`, error);
      }
    }
    console.log(`🔍 DEBUG: Total eligible bounties found: ${loadedBounties.length}`);
    setEligibleBounties(loadedBounties);
  };

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
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
            .Quinty as `0x${string}`,
          abi: QUINTY_ABI,
          functionName: "getSubmission",
          args: [BigInt(bountyId), BigInt(i)],
        });
        const [, solver, blindedIpfsCid] = subData as any;
        loadedSubmissions.push({ solver, blindedIpfsCid });
      }
      setDisputedSubmissions((prev) => ({
        ...prev,
        [bountyId]: loadedSubmissions,
      }));
    } catch (error) {
      console.error(
        `Error fetching submissions for bounty ${bountyId}:`,
        error
      );
    }
  };

  // Load all disputes
  const loadDisputes = async () => {
    if (disputeCounter === undefined) return;

    const loadedDisputes: Dispute[] = [];
    for (let i = 1; i <= Number(disputeCounter); i++) {
      try {
        const disputeData = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
            .DisputeResolver as `0x${string}`,
          abi: DISPUTE_ABI,
          functionName: "getDispute",
          args: [BigInt(i)],
        });

        if (disputeData) {
          const [bountyId, isExpiry, amount, votingEnd, resolved, voteCount] =
            disputeData as any;
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

    const rankings = [voteForm.rank1, voteForm.rank2, voteForm.rank3].map(
      Number
    );
    if (rankings.some((r) => r < 0)) {
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
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "vote",
        args: [BigInt(selectedDispute.id), rankings.map((r) => BigInt(r))],
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
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .DisputeResolver as `0x${string}`,
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
  const initiatePengadilan = async (bounty: Bounty) => {
    if (!isConnected) return;

    // Calculate required stake (10% of bounty amount)
    const requiredStake = (bounty.amount * BigInt(1000)) / BigInt(10000); // 10%

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .DisputeResolver as `0x${string}`,
        abi: DISPUTE_ABI,
        functionName: "initiatePengadilanDispute",
        args: [BigInt(bounty.id)],
        value: requiredStake,
      });

      alert("Pengadilan dispute initiated successfully!");
      refetchDisputes();
      loadEligibleBounties(); // Refresh the list
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

  useEffect(() => {
    if (bountyCounter) {
      loadEligibleBounties();
    }
  }, [bountyCounter]);

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">⚖️</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Wallet Connection Required
          </h3>
          <p className="text-gray-700 text-lg">
            Please connect your wallet to participate in dispute resolution.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">
          ⚖️ Dispute Resolution (Pengadilan DAO)
        </h2>
        <p className="text-gray-700 text-lg max-w-3xl mx-auto">
          Participate in community voting to resolve bounty disputes and
          expiries. Help maintain fairness and justice in the ecosystem.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            🔍 Initiate Pengadilan Dispute
          </h3>
          <p className="text-gray-600 text-lg">
            As a bounty creator, you can dispute a winner selection if you
            believe there was an issue.
          </p>
        </div>

        {eligibleBounties.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📝</div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              No Bounties Available for Dispute
            </h4>
            <p className="text-gray-600">
              Only resolved bounties in PENDING_REVEAL state can be disputed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 mb-4">
              Available Bounties for Dispute ({eligibleBounties.length})
            </h4>
            <div className="grid gap-4">
              {eligibleBounties.map((bounty) => {
                const requiredStake =
                  (bounty.amount * BigInt(1000)) / BigInt(10000);
                const isCreator =
                  address?.toLowerCase() === bounty.creator.toLowerCase();

                return (
                  <div
                    key={bounty.id}
                    className={`border-2 rounded-lg p-4 ${
                      isCreator
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900">
                          Bounty #{bounty.id}
                        </h5>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {bounty.description.split("\\n")[0] ||
                            "No description available"}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="text-green-600 font-semibold">
                            {formatSTT(bounty.amount)} STT
                          </span>
                          <span className="text-gray-500">
                            Creator: {formatAddress(bounty.creator)}
                          </span>
                          <span className="text-blue-600">
                            {bounty.selectedWinners.length} winner(s) selected
                          </span>
                        </div>
                        {isCreator && (
                          <div className="mt-2 p-2 bg-yellow-100 rounded text-sm text-yellow-800">
                            ⚠️ You are the creator of this bounty
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 mb-2">
                          Required Stake: {formatSTT(requiredStake)} STT
                        </div>
                        <button
                          onClick={() => initiatePengadilan(bounty)}
                          disabled={!isCreator}
                          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                            isCreator
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          {isCreator
                            ? "⚖️ Dispute This Bounty"
                            : "Only Creator Can Dispute"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            📊 Active Disputes
          </h3>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold inline-block">
            {disputes.filter((d) => !d.resolved).length} ongoing disputes
          </div>
        </div>

        {disputes.filter((d) => !d.resolved).length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">⚖️</div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              No Active Disputes
            </h4>
            <p className="text-gray-600">
              All disputes have been resolved. The community is working
              harmoniously!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {disputes
              .filter((d) => !d.resolved)
              .map((dispute) => (
                <div
                  key={dispute.id}
                  className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 mb-2">
                          Dispute #{dispute.id} • Bounty #{dispute.bountyId}
                        </h4>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              dispute.isExpiry
                                ? "bg-yellow-200 text-yellow-800"
                                : "bg-red-200 text-red-800"
                            }`}
                          >
                            {dispute.isExpiry
                              ? "⏰ Expiry Vote"
                              : "⚖️ Pengadilan Dispute"}
                          </span>
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                            🗳️ {dispute.voteCount} votes
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-green-600 mb-1">
                          {formatSTT(dispute.amount)} STT
                        </div>
                        <div className="text-sm text-gray-600">
                          ⏱️ Ends: {formatTimeLeft(BigInt(dispute.votingEnd))}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`rounded-lg p-4 mb-4 text-sm ${
                        dispute.isExpiry
                          ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                          : "bg-red-50 border border-red-200 text-red-800"
                      }`}
                    >
                      <div className="font-semibold mb-2">
                        {dispute.isExpiry
                          ? "ℹ️ How Expiry Voting Works:"
                          : "ℹ️ How Pengadilan Dispute Works:"}
                      </div>
                      {dispute.isExpiry
                        ? "The bounty deadline has passed. Community members can vote to rank the top 3 submissions. The highest-ranked non-winner receives 10% of the slash amount, and correct voters share 5%."
                        : "The bounty creator has disputed the winner selection. Community can vote to overturn the decision. If successful, 80% refund to creator, 10% to voters, 10% to original solver."}
                    </div>

                    {selectedDispute?.id !== dispute.id && (
                      <button
                        onClick={() => setSelectedDispute(dispute)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        🗳️ Show Details & Vote
                      </button>
                    )}

                    {selectedDispute?.id === dispute.id && (
                      <div className="border-t pt-6 mt-6">
                        <h5 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          📝 Submissions for Bounty #{dispute.bountyId}
                        </h5>
                        <div className="space-y-3 mb-6">
                          {disputedSubmissions[dispute.bountyId]?.map(
                            (sub, index) => (
                              <div
                                key={index}
                                className="p-4 border-2 border-gray-200 rounded-lg bg-white hover:border-blue-300 transition-colors"
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-semibold text-gray-900">
                                      Submission #{index}
                                    </span>
                                    <div className="text-sm text-gray-600 mt-1">
                                      by {formatAddress(sub.solver)}
                                    </div>
                                  </div>
                                  <a
                                    href={`https://ipfs.io/ipfs/${sub.blindedIpfsCid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                  >
                                    🔗 View on IPFS
                                  </a>
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                          <h5 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            🗳️ Cast Your Vote
                          </h5>
                          <p className="text-sm text-blue-800 mb-4">
                            💰 Minimum stake: {MIN_VOTING_STAKE} STT • Higher
                            stakes = more voting power
                          </p>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-lg p-4">
                              <label className="block text-sm font-bold text-gray-900 mb-3">
                                🏆 Rank Top 3 Submissions
                              </label>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    🥇 1st Place
                                  </label>
                                  <select
                                    value={voteForm.rank1}
                                    onChange={(e) =>
                                      setVoteForm({
                                        ...voteForm,
                                        rank1: e.target.value,
                                      })
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="-1" disabled>
                                      Select submission...
                                    </option>
                                    {disputedSubmissions[dispute.bountyId]?.map(
                                      (sub, index) => (
                                        <option key={index} value={index}>
                                          Submission #{index} -{" "}
                                          {formatAddress(sub.solver)}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    🥈 2nd Place
                                  </label>
                                  <select
                                    value={voteForm.rank2}
                                    onChange={(e) =>
                                      setVoteForm({
                                        ...voteForm,
                                        rank2: e.target.value,
                                      })
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="-1" disabled>
                                      Select submission...
                                    </option>
                                    {disputedSubmissions[dispute.bountyId]?.map(
                                      (sub, index) => (
                                        <option key={index} value={index}>
                                          Submission #{index} -{" "}
                                          {formatAddress(sub.solver)}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    🥉 3rd Place
                                  </label>
                                  <select
                                    value={voteForm.rank3}
                                    onChange={(e) =>
                                      setVoteForm({
                                        ...voteForm,
                                        rank3: e.target.value,
                                      })
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  >
                                    <option value="-1" disabled>
                                      Select submission...
                                    </option>
                                    {disputedSubmissions[dispute.bountyId]?.map(
                                      (sub, index) => (
                                        <option key={index} value={index}>
                                          Submission #{index} -{" "}
                                          {formatAddress(sub.solver)}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4">
                              <label className="block text-sm font-bold text-gray-900 mb-3">
                                💰 Your Stake Amount (STT)
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
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min={MIN_VOTING_STAKE}
                                step="0.0001"
                                placeholder={MIN_VOTING_STAKE}
                              />
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-800 font-medium">
                                  💡 Higher stakes increase your voting
                                  influence
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                  Minimum: {MIN_VOTING_STAKE} STT
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={castVote}
                            disabled={
                              parseFloat(voteForm.stakeAmount) <
                              parseFloat(MIN_VOTING_STAKE)
                            }
                            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg disabled:cursor-not-allowed"
                          >
                            🗳️ Cast Vote ({voteForm.stakeAmount} STT)
                          </button>
                          <button
                            onClick={() => setSelectedDispute(null)}
                            className="px-6 py-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                          >
                            Hide Details
                          </button>
                        </div>
                      </div>
                    )}

                    {Date.now() / 1000 > dispute.votingEnd && (
                      <div className="border-t pt-6 mt-6">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <h6 className="font-bold text-green-900 mb-2">
                            ⏰ Voting Period Ended
                          </h6>
                          <p className="text-sm text-green-800 mb-4">
                            The voting period has concluded. Anyone can now
                            resolve this dispute and distribute rewards.
                          </p>
                          <button
                            onClick={() => resolveDispute(dispute.id)}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg"
                          >
                            ⚖️ Resolve Dispute & Distribute Rewards
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
