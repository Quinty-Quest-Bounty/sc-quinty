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
  AIRDROP_ABI,
  SOMNIA_TESTNET_ID,
} from "../utils/contracts";
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";

interface Airdrop {
  id: number;
  creator: string;
  totalAmount: bigint;
  perQualifier: bigint;
  maxQualifiers: number;
  qualifiersCount: number;
  deadline: number;
  resolved: boolean;
  cancelled: boolean;
}

interface Entry {
  solver: string;
  ipfsProofCid: string;
  qualified: boolean;
  verified: boolean;
}

export default function AirdropManager() {
  const { address, isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // State
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [entries, setEntries] = useState<{ [airdropId: number]: Entry[] }>({});
  const [selectedAirdrop, setSelectedAirdrop] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "browse" | "manage">(
    "browse"
  );

  // Form states
  const [newAirdrop, setNewAirdrop] = useState({
    perQualifier: "",
    maxQualifiers: 100,
    deadline: "",
    description: "",
    requirements: "",
  });

  const [newEntry, setNewEntry] = useState({
    airdropId: 0,
    ipfsProofCid: "",
    twitterUrl: "",
    description: "",
  });

  const [verificationForm, setVerificationForm] = useState({
    airdropId: 0,
    qualifiedIndices: [] as number[],
  });

  // Read airdrop counter
  const { data: airdropCounter } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .AirdropBounty as `0x${string}`,
    abi: AIRDROP_ABI,
    functionName: "airdropCounter",
  });

  // Watch for airdrop events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .AirdropBounty as `0x${string}`,
    abi: AIRDROP_ABI,
    eventName: "AirdropCreated",
    onLogs() {
      loadAirdrops();
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .AirdropBounty as `0x${string}`,
    abi: AIRDROP_ABI,
    eventName: "EntrySubmitted",
    onLogs() {
      loadAirdrops();
    },
  });

  // Load all airdrops
  const loadAirdrops = async () => {
    if (!airdropCounter) return;

    const loadedAirdrops: Airdrop[] = [];
    for (let i = 1; i <= Number(airdropCounter); i++) {
      try {
        const airdrop = await readAirdrop(i);
        if (airdrop) {
          loadedAirdrops.push(airdrop);
          loadEntries(i);
        }
      } catch (error) {
        console.error(`Error loading airdrop ${i}:`, error);
      }
    }
    setAirdrops(loadedAirdrops);
  };

  // Read specific airdrop
  const readAirdrop = async (airdropId: number): Promise<Airdrop | null> => {
    try {
      // Simplified implementation for demo
      // In real app, you would properly decode the contract response
      return {
        id: airdropId,
        creator: address || "0x0000000000000000000000000000000000000000",
        totalAmount: parseEther("100"),
        perQualifier: parseEther("1"),
        maxQualifiers: 100,
        qualifiersCount: 0,
        deadline: Math.floor(Date.now() / 1000) + 604800, // 7 days
        resolved: false,
        cancelled: false,
      };
    } catch {
      return null;
    }
  };

  // Load entries for an airdrop
  const loadEntries = async (airdropId: number) => {
    try {
      // Simplified implementation
      // In real app, you would read entry count and load each entry
      setEntries((prev) => ({
        ...prev,
        [airdropId]: [],
      }));
    } catch (error) {
      console.error(`Error loading entries for airdrop ${airdropId}:`, error);
    }
  };

  // Create airdrop
  const createAirdrop = async () => {
    if (!isConnected || !newAirdrop.perQualifier || !newAirdrop.deadline)
      return;

    const deadlineTimestamp = Math.floor(
      new Date(newAirdrop.deadline).getTime() / 1000
    );
    const perQualifierWei = parseEther(newAirdrop.perQualifier);
    const totalAmount = perQualifierWei * BigInt(newAirdrop.maxQualifiers);

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "createAirdrop",
        args: [
          perQualifierWei,
          BigInt(newAirdrop.maxQualifiers),
          BigInt(deadlineTimestamp),
        ],
        value: totalAmount,
      });

      // Reset form
      setNewAirdrop({
        perQualifier: "",
        maxQualifiers: 100,
        deadline: "",
        description: "",
        requirements: "",
      });

      alert("Airdrop created successfully!");
    } catch (error) {
      console.error("Error creating airdrop:", error);
      alert("Error creating airdrop");
    }
  };

  // Submit entry
  const submitEntry = async () => {
    if (!isConnected || !newEntry.airdropId || !newEntry.ipfsProofCid) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "submitEntry",
        args: [BigInt(newEntry.airdropId), newEntry.ipfsProofCid],
      });

      setNewEntry({
        airdropId: 0,
        ipfsProofCid: "",
        twitterUrl: "",
        description: "",
      });

      alert("Entry submitted successfully!");
      loadAirdrops();
    } catch (error) {
      console.error("Error submitting entry:", error);
      alert("Error submitting entry");
    }
  };

  // Verify and distribute
  const verifyAndDistribute = async () => {
    if (
      !isConnected ||
      !verificationForm.airdropId ||
      verificationForm.qualifiedIndices.length === 0
    )
      return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "verifyAndDistribute",
        args: [
          BigInt(verificationForm.airdropId),
          verificationForm.qualifiedIndices.map((i) => BigInt(i)),
        ],
      });

      setVerificationForm({
        airdropId: 0,
        qualifiedIndices: [],
      });

      alert("Verification and distribution completed!");
      loadAirdrops();
    } catch (error) {
      console.error("Error verifying and distributing:", error);
      alert("Error verifying and distributing");
    }
  };

  // Cancel airdrop
  const cancelAirdrop = async (airdropId: number) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "cancelAirdrop",
        args: [BigInt(airdropId)],
      });

      alert("Airdrop cancelled successfully!");
      loadAirdrops();
    } catch (error) {
      console.error("Error cancelling airdrop:", error);
      alert("Error cancelling airdrop");
    }
  };

  // Finalize airdrop
  const finalizeAirdrop = async (airdropId: number) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "finalizeAirdrop",
        args: [BigInt(airdropId)],
      });

      alert("Airdrop finalized successfully!");
      loadAirdrops();
    } catch (error) {
      console.error("Error finalizing airdrop:", error);
      alert("Error finalizing airdrop");
    }
  };

  useEffect(() => {
    if (airdropCounter) {
      loadAirdrops();
    }
  }, [airdropCounter]);

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-700">
          Please connect your wallet to use Airdrop Bounties.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Airdrop Bounties
        </h2>
        <p className="text-gray-700">
          Create transparent promotion tasks with verifiable social proofs
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {["browse", "create", "manage"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Airdrops
            </button>
          ))}
        </nav>
      </div>

      {/* Create Airdrop Tab */}
      {activeTab === "create" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">
            Create Promotion Airdrop
          </h3>
          <p className="text-gray-700 mb-6">
            Create transparent promotional campaigns with fixed STT rewards for
            verified social media engagement.
          </p>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Description
              </label>
              <textarea
                value={newAirdrop.description}
                onChange={(e) =>
                  setNewAirdrop({ ...newAirdrop, description: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                placeholder="Describe your promotional campaign..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requirements (What users need to do)
              </label>
              <textarea
                value={newAirdrop.requirements}
                onChange={(e) =>
                  setNewAirdrop({ ...newAirdrop, requirements: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={2}
                placeholder="e.g., Post on X/Twitter with #QuintyDAO hashtag, get 100+ likes..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reward Per Qualifier (STT)
                </label>
                <input
                  type="number"
                  value={newAirdrop.perQualifier}
                  onChange={(e) =>
                    setNewAirdrop({
                      ...newAirdrop,
                      perQualifier: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="10"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Qualifiers
                </label>
                <input
                  type="number"
                  value={newAirdrop.maxQualifiers}
                  onChange={(e) =>
                    setNewAirdrop({
                      ...newAirdrop,
                      maxQualifiers: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deadline
              </label>
              <input
                type="datetime-local"
                value={newAirdrop.deadline}
                onChange={(e) =>
                  setNewAirdrop({ ...newAirdrop, deadline: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            {/* Total Cost Display */}
            {newAirdrop.perQualifier && newAirdrop.maxQualifiers && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">
                  Campaign Summary
                </h4>
                <div className="space-y-1 text-sm text-blue-800">
                  <div>
                    Total Budget:{" "}
                    {(
                      parseFloat(newAirdrop.perQualifier) *
                      newAirdrop.maxQualifiers
                    ).toFixed(2)}{" "}
                    STT
                  </div>
                  <div>Per User: {newAirdrop.perQualifier} STT</div>
                  <div>Max Participants: {newAirdrop.maxQualifiers} users</div>
                  <div>First-come, first-served distribution</div>
                </div>
              </div>
            )}

            <button
              onClick={createAirdrop}
              disabled={
                !newAirdrop.perQualifier ||
                !newAirdrop.maxQualifiers ||
                !newAirdrop.deadline
              }
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              Create Airdrop Campaign
              {newAirdrop.perQualifier && newAirdrop.maxQualifiers && (
                <span className="ml-2">
                  (
                  {(
                    parseFloat(newAirdrop.perQualifier) *
                    newAirdrop.maxQualifiers
                  ).toFixed(2)}{" "}
                  STT)
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Browse Airdrops Tab */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">
              Active Campaigns (
              {airdrops.filter((a) => !a.resolved && !a.cancelled).length})
            </h3>
          </div>

          {airdrops.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No airdrop campaigns found. Create the first one!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {airdrops
                .filter((a) => !a.resolved && !a.cancelled)
                .map((airdrop) => (
                  <div
                    key={airdrop.id}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          Airdrop Campaign #{airdrop.id}
                        </h4>
                        <p className="text-gray-600 mt-1">
                          Social media promotion task with verified rewards
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {formatSTT(airdrop.perQualifier)} STT
                        </div>
                        <div className="text-sm text-gray-600">
                          per qualifier
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-sm">
                        <span className="text-gray-500">Creator:</span>
                        <div className="font-medium">
                          {formatAddress(airdrop.creator)}
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Progress:</span>
                        <div className="font-medium">
                          {airdrop.qualifiersCount}/{airdrop.maxQualifiers}
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Remaining:</span>
                        <div className="font-medium">
                          {formatSTT(
                            airdrop.totalAmount -
                              airdrop.perQualifier *
                                BigInt(airdrop.qualifiersCount)
                          )}{" "}
                          STT
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Deadline:</span>
                        <div className="font-medium">
                          {formatTimeLeft(airdrop.deadline)}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>
                          {Math.round(
                            (airdrop.qualifiersCount / airdrop.maxQualifiers) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min(
                              (airdrop.qualifiersCount /
                                airdrop.maxQualifiers) *
                                100,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Requirements */}
                    <div className="bg-blue-50 rounded-lg p-4 mb-4">
                      <h5 className="font-medium text-blue-900 mb-2">
                        How to Qualify:
                      </h5>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Post on X/Twitter with specified hashtags</li>
                        <li>• Include your wallet address in the post</li>
                        <li>• Get minimum engagement (likes/retweets)</li>
                        <li>• Upload proof via IPFS</li>
                        <li>• Wait for community verification</li>
                      </ul>
                    </div>

                    {/* Entry Submission */}
                    {airdrop.qualifiersCount < airdrop.maxQualifiers &&
                      Date.now() / 1000 < airdrop.deadline && (
                        <div className="border-t pt-4">
                          <h5 className="font-medium mb-3">
                            Submit Your Entry
                          </h5>
                          <div className="space-y-3">
                            <input
                              type="url"
                              placeholder="Twitter/X Post URL"
                              value={
                                newEntry.airdropId === airdrop.id
                                  ? newEntry.twitterUrl
                                  : ""
                              }
                              onChange={(e) =>
                                setNewEntry({
                                  ...newEntry,
                                  airdropId: airdrop.id,
                                  twitterUrl: e.target.value,
                                })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder="IPFS Proof CID (upload screenshot/link)"
                              value={
                                newEntry.airdropId === airdrop.id
                                  ? newEntry.ipfsProofCid
                                  : ""
                              }
                              onChange={(e) =>
                                setNewEntry({
                                  ...newEntry,
                                  airdropId: airdrop.id,
                                  ipfsProofCid: e.target.value,
                                })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            />
                            <textarea
                              placeholder="Additional notes (optional)"
                              value={
                                newEntry.airdropId === airdrop.id
                                  ? newEntry.description
                                  : ""
                              }
                              onChange={(e) =>
                                setNewEntry({
                                  ...newEntry,
                                  airdropId: airdrop.id,
                                  description: e.target.value,
                                })
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={submitEntry}
                                disabled={
                                  !newEntry.ipfsProofCid ||
                                  newEntry.airdropId !== airdrop.id
                                }
                                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                              >
                                Submit Entry
                              </button>
                              <button
                                onClick={() =>
                                  setSelectedAirdrop(
                                    selectedAirdrop === airdrop.id
                                      ? null
                                      : airdrop.id
                                  )
                                }
                                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50"
                              >
                                {selectedAirdrop === airdrop.id
                                  ? "Hide"
                                  : "View"}{" "}
                                Entries
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Status Indicators */}
                    <div className="border-t pt-4 flex gap-2">
                      {airdrop.qualifiersCount >= airdrop.maxQualifiers && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                          Fully Qualified
                        </span>
                      )}
                      {Date.now() / 1000 > airdrop.deadline && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                          Deadline Passed
                        </span>
                      )}
                    </div>

                    {/* Entry Details */}
                    {selectedAirdrop === airdrop.id && (
                      <div className="border-t pt-4 mt-4">
                        <h6 className="font-medium mb-3">Submitted Entries</h6>
                        {entries[airdrop.id]?.length > 0 ? (
                          <div className="space-y-2">
                            {entries[airdrop.id].map((entry, index) => (
                              <div
                                key={index}
                                className="bg-gray-50 rounded p-3"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium">
                                    {formatAddress(entry.solver)}
                                  </span>
                                  <div className="flex gap-2">
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs ${
                                        entry.qualified
                                          ? "bg-green-100 text-green-800"
                                          : entry.verified
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-yellow-100 text-yellow-800"
                                      }`}
                                    >
                                      {entry.qualified
                                        ? "Qualified"
                                        : entry.verified
                                        ? "Verified"
                                        : "Pending"}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  IPFS: {entry.ipfsProofCid}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-sm">
                            No entries submitted yet.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === "manage" && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">Airdrop Management</h3>

          {/* Verification Interface */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-lg font-semibold mb-4">
              Verify and Distribute Rewards
            </h4>
            <p className="text-gray-600 mb-4">
              As a campaign creator or verifier, review submissions and approve
              qualified entries.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Airdrop ID
                </label>
                <input
                  type="number"
                  placeholder="Enter airdrop ID"
                  value={verificationForm.airdropId || ""}
                  onChange={(e) =>
                    setVerificationForm({
                      ...verificationForm,
                      airdropId: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Qualified Entry Indices (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="0,1,2,3..."
                  value={verificationForm.qualifiedIndices.join(",")}
                  onChange={(e) =>
                    setVerificationForm({
                      ...verificationForm,
                      qualifiedIndices: e.target.value
                        .split(",")
                        .map((i) => parseInt(i.trim()))
                        .filter((i) => !isNaN(i)),
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <button
              onClick={verifyAndDistribute}
              disabled={
                !verificationForm.airdropId ||
                verificationForm.qualifiedIndices.length === 0
              }
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Verify & Distribute Rewards
            </button>
          </div>

          {/* Creator Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-lg font-semibold mb-4">Creator Actions</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium mb-2">Cancel Airdrop</h5>
                <p className="text-sm text-gray-600 mb-3">
                  Cancel an airdrop with no approved entries and get your funds
                  back.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Airdrop ID"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      const input = document.querySelector(
                        'input[placeholder="Airdrop ID"]'
                      ) as HTMLInputElement;
                      const id = parseInt(input?.value || "0");
                      if (id > 0) cancelAirdrop(id);
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div>
                <h5 className="font-medium mb-2">Finalize Airdrop</h5>
                <p className="text-sm text-gray-600 mb-3">
                  Manually finalize an airdrop after the deadline.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Airdrop ID"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      const inputs = document.querySelectorAll(
                        'input[placeholder="Airdrop ID"]'
                      ) as NodeListOf<HTMLInputElement>;
                      const id = parseInt(inputs[1]?.value || "0");
                      if (id > 0) finalizeAirdrop(id);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
                  >
                    Finalize
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* My Campaigns */}
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-lg font-semibold mb-4">My Campaigns</h4>

            {airdrops.filter((a) => a.creator === address).length === 0 ? (
              <p className="text-gray-600">
                You haven't created any airdrop campaigns yet.
              </p>
            ) : (
              <div className="space-y-3">
                {airdrops
                  .filter((a) => a.creator === address)
                  .map((airdrop) => (
                    <div
                      key={airdrop.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h5 className="font-medium">
                            Campaign #{airdrop.id}
                          </h5>
                          <div className="text-sm text-gray-600">
                            {airdrop.qualifiersCount}/{airdrop.maxQualifiers}{" "}
                            qualified • {formatSTT(airdrop.perQualifier)} STT
                            each
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`px-2 py-1 rounded-full text-xs ${
                              airdrop.resolved
                                ? "bg-green-100 text-green-800"
                                : airdrop.cancelled
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {airdrop.resolved
                              ? "Completed"
                              : airdrop.cancelled
                              ? "Cancelled"
                              : "Active"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
