"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWatchContractEvent,
  useWaitForTransactionReceipt,
} from "wagmi";
import { readContract } from "@wagmi/core";
import { parseEther, formatEther } from "viem";
import {
  CONTRACT_ADDRESSES,
  QUINTY_ABI,
  SOMNIA_TESTNET_ID,
} from "../utils/contracts";
import {
  formatSTT,
  formatTimeLeft,
  formatAddress,
  wagmiConfig,
} from "../utils/web3";
import BountyCard from "./BountyCard";
import { uploadMetadataToIpfs, uploadToIpfs, BountyMetadata, IpfsImage } from "../utils/ipfs";

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

interface Submission {
  bountyId: bigint;
  solver: string;
  blindedIpfsCid: string;
  deposit: bigint;
  replies: readonly string[];
  revealIpfsCid: string;
  timestamp: bigint;
}

export default function BountyManager() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // State
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [submissions, setSubmissions] = useState<{
    [bountyId: number]: Submission[];
  }>({});
  const [selectedBounty, setSelectedBounty] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "browse" | "manage">(
    "browse"
  );

  // Form states
  const [newBounty, setNewBounty] = useState({
    title: "",
    description: "",
    amount: "",
    deadline: "",
    slashPercent: 30,
    allowMultipleWinners: false,
    winnerShares: [100],
    bountyType: "development" as
      | "development"
      | "design"
      | "marketing"
      | "research"
      | "other",
    requirements: [""],
    deliverables: [""],
    skills: [""],
    images: [] as string[], // IPFS CIDs for uploaded images
  });

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const [newSubmission, setNewSubmission] = useState({
    bountyId: 0,
    ipfsCid: "",
  });



  // Read bounty counter
  const { data: bountyCounter } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
    abi: QUINTY_ABI,
    functionName: "bountyCounter",
  });

  // Watch for bounty events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
    abi: QUINTY_ABI,
    eventName: "BountyCreated",
    onLogs(logs) {
      loadBountiesAndSubmissions();
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
    abi: QUINTY_ABI,
    eventName: "SubmissionCreated",
    onLogs(logs) {
      logs.forEach((log) => {
        const { bountyId } = log.args;
        if (bountyId) {
          loadBountiesAndSubmissions(); // Reload all for simplicity
        }
      });
    },
  });

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  // Remove image from upload list
  const removeImage = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload images to IPFS and get CIDs
  const uploadImages = async (): Promise<string[]> => {
    if (uploadedFiles.length === 0) return [];

    setIsUploadingImages(true);
    const uploadedCids: string[] = [];

    try {
      for (const file of uploadedFiles) {
        const cid = await uploadToIpfs(file, {
          bountyTitle: newBounty.title,
          type: 'bounty-image'
        });
        uploadedCids.push(cid);
      }
      return uploadedCids;
    } catch (error) {
      console.error("Error uploading images:", error);
      throw new Error("Failed to upload images to IPFS");
    } finally {
      setIsUploadingImages(false);
    }
  };

  // Load bounties and submissions
  const loadBountiesAndSubmissions = async () => {
    if (!bountyCounter) return;

    const bountyIds = Array.from({ length: Number(bountyCounter) }, (_, i) => i + 1);

    const loadedBounties: Bounty[] = [];
    const allSubmissions: { [bountyId: number]: Submission[] } = {};

    for (const id of bountyIds) {
      try {
        const bountyData = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
          abi: QUINTY_ABI,
          functionName: "getBounty",
          args: [BigInt(id)],
        });

        if (bountyData) {
          const [
            creator,
            description,
            amount,
            deadline,
            allowMultipleWinners,
            winnerShares,
            resolved,
            slashPercent,
            winners,
            slashed,
          ] = bountyData;

          // Extract metadata CID from description if present
          const metadataMatch = description.match(/Metadata: ipfs:\/\/([a-zA-Z0-9]+)/);
          const metadataCid = metadataMatch ? metadataMatch[1] : undefined;

          loadedBounties.push({
            id,
            creator,
            description,
            amount,
            deadline,
            allowMultipleWinners,
            winnerShares,
            resolved,
            slashPercent,
            winners,
            slashed,
            metadataCid,
          });

          const submissionCount = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
            abi: QUINTY_ABI,
            functionName: "getSubmissionCount",
            args: [BigInt(id)],
          });

          const loadedSubmissions: Submission[] = [];
          for (let i = 0; i < Number(submissionCount); i++) {
            const submissionData = await readContract(wagmiConfig, {
              address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
              abi: QUINTY_ABI,
              functionName: "getSubmission",
              args: [BigInt(id), BigInt(i)],
            });
            const [bId, solver, blindedIpfsCid, deposit, replies, revealIpfsCid, timestamp] = submissionData;
            loadedSubmissions.push({ bountyId: bId, solver, blindedIpfsCid, deposit, replies, revealIpfsCid, timestamp });
          }
          allSubmissions[id] = loadedSubmissions;
        }
      } catch (error) {
        console.error(`Error loading bounty or submissions for ID ${id}:`, error);
      }
    }

    setBounties(loadedBounties.reverse());
    setSubmissions(allSubmissions);
  };

  // Create bounty
  const createBounty = async () => {
    if (!isConnected) return;

    const deadlineTimestamp = Math.floor(
      new Date(newBounty.deadline).getTime() / 1000
    );

    // Add client-side validation for the deadline
    const nowTimestamp = Math.floor(Date.now() / 1000);
    if (deadlineTimestamp <= nowTimestamp) {
      alert("Error: The selected deadline is in the past. Please choose a future date and time.");
      return;
    }

    const slashPercent = newBounty.slashPercent * 100; // Convert to basis points

    try {
      // Upload images to IPFS first
      console.log("Uploading images to IPFS...");
      const imageCids = await uploadImages();
      console.log("Images uploaded to IPFS:", imageCids);

      // Create metadata for IPFS
      const metadata: BountyMetadata = {
        title: newBounty.title,
        description: newBounty.description,
        requirements: newBounty.requirements.filter((r) => r.trim()),
        deliverables: newBounty.deliverables.filter((d) => d.trim()),
        skills: newBounty.skills.filter((s) => s.trim()),
        images: imageCids,
        deadline: deadlineTimestamp,
        bountyType: newBounty.bountyType,
      };

      // Upload metadata to IPFS
      console.log("Uploading metadata to IPFS...");
      const metadataCid = await uploadMetadataToIpfs(metadata);
      console.log("Metadata uploaded to IPFS:", metadataCid);

      // Use metadata CID as the description parameter
      const descriptionWithMetadata = `${newBounty.title}\n\nMetadata: ipfs://${metadataCid}`;

      const winnerSharesArg = newBounty.allowMultipleWinners
        ? newBounty.winnerShares.map((s) => BigInt(s * 100))
        : [];

      console.log("Creating bounty on blockchain...");
      writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "createBounty",
        args: [
          descriptionWithMetadata,
          BigInt(deadlineTimestamp),
          newBounty.allowMultipleWinners,
          winnerSharesArg,
          BigInt(slashPercent),
        ],
        value: parseEther(newBounty.amount),
      });

      // Reset form
      setNewBounty({
        title: "",
        description: "",
        amount: "",
        deadline: "",
        slashPercent: 30,
        allowMultipleWinners: false,
        winnerShares: [100],
        bountyType: "development",
        requirements: [""],
        deliverables: [""],
        skills: [""],
        images: [],
      });
      setUploadedFiles([]);
    } catch (error) {
      console.error("Error creating bounty:", error);
      alert("Error creating bounty: " + (error as any).message);
    }
  };

  // Effect to handle transaction status
  useEffect(() => {
    if (isConfirmed) {
      // Reset form only after transaction is confirmed
      setNewBounty({
        title: "",
        description: "",
        amount: "",
        deadline: "",
        slashPercent: 30,
        allowMultipleWinners: false,
        winnerShares: [100],
        bountyType: "development",
        requirements: [""],
        deliverables: [""],
        skills: [""],
        images: [],
      });
      setUploadedFiles([]);

      alert("Bounty created successfully and confirmed on Somnia Testnet!");
      loadBountiesAndSubmissions(); // Reload bounties
    }
  }, [isConfirmed]);

  // Submit solution
  const submitSolution = async (bountyId?: number, ipfsCid?: string) => {
    if (!isConnected) return;

    const targetBountyId = bountyId || newSubmission.bountyId;
    const targetIpfsCid = ipfsCid || newSubmission.ipfsCid;

    if (!targetBountyId || !targetIpfsCid) return;

    const bounty = bounties.find((b) => b.id === targetBountyId);
    if (!bounty) return;

    const depositAmount = bounty.amount / BigInt(10); // 10% deposit

    try {
      const tx = await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "submitSolution",
        args: [BigInt(targetBountyId), targetIpfsCid],
        value: depositAmount,
      });

      console.log("Transaction hash:", tx);
      setNewSubmission({ bountyId: 0, ipfsCid: "" });
      alert("Solution submitted successfully! Transaction pending...");
    } catch (error) {
      console.error("Error submitting solution:", error);
      alert("Error submitting solution: " + (error as any).message);
    }
  };

  // Select winners
  const selectWinners = async (
    bountyId: number,
    winners: string[],
    subIds: number[]
  ) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "selectWinners",
        args: [BigInt(bountyId), winners, subIds.map((id) => BigInt(id))],
      });

      alert("Winners selected successfully!");
      loadBountiesAndSubmissions();
    } catch (error) {
      console.error("Error selecting winners:", error);
      alert("Error selecting winners");
    }
  };

  // Trigger slash
  const triggerSlash = async (bountyId: number) => {
    if (!isConnected) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "triggerSlash",
        args: [BigInt(bountyId)],
      });

      alert("Slash triggered successfully!");
      loadBountiesAndSubmissions();
    } catch (error) {
      console.error("Error triggering slash:", error);
      alert("Error triggering slash");
    }
  };

  // Add reply
  const addReply = async (bountyId: number, subId: number, content: string) => {
    if (!isConnected || !content.trim()) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "addReply",
        args: [
          BigInt(bountyId),
          BigInt(subId),
          content,
        ],
      });
      alert("Reply submitted successfully! It will appear after the transaction is confirmed.");
    } catch (error) {
      console.error("Error adding reply:", error);
      alert("Error adding reply");
    }
  };

  // Reveal solution
  const revealSolution = async (bountyId: number, subId: number, revealCid: string) => {
    if (!isConnected || !revealCid.trim()) return;

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "revealSolution",
        args: [
          BigInt(bountyId),
          BigInt(subId),
          revealCid,
        ],
      });
      alert("Solution revealed successfully! It will appear after the transaction is confirmed.");
    } catch (error) {
      console.error("Error revealing solution:", error);
      alert("Error revealing solution");
    }
  };

  useEffect(() => {
    if (bountyCounter) {
      loadBountiesAndSubmissions();
    }
  }, [bountyCounter]);

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-700">
          Please connect your wallet to use Quinty.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Quinty Bounty System
        </h2>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {["browse", "create"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} Bounties
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Create Bounty Tab */}
      {activeTab === "create" && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Create New Bounty</h3>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newBounty.title}
                onChange={(e) =>
                  setNewBounty({ ...newBounty, title: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Build a React Dashboard Component"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={newBounty.description}
                onChange={(e) =>
                  setNewBounty({ ...newBounty, description: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                placeholder="Detailed description of your bounty..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bounty Type
              </label>
              <select
                value={newBounty.bountyType}
                onChange={(e) =>
                  setNewBounty({
                    ...newBounty,
                    bountyType: e.target.value as any,
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="development">Development</option>
                <option value="design">Design</option>
                <option value="marketing">Marketing</option>
                <option value="research">Research</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount (STT)
                </label>
                <input
                  type="number"
                  value={newBounty.amount}
                  onChange={(e) =>
                    setNewBounty({ ...newBounty, amount: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="1.0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline
                </label>
                <input
                  type="datetime-local"
                  value={newBounty.deadline}
                  onChange={(e) =>
                    setNewBounty({ ...newBounty, deadline: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slash Percentage: {newBounty.slashPercent}%
              </label>
              <input
                type="range"
                min="25"
                max="50"
                value={newBounty.slashPercent}
                onChange={(e) =>
                  setNewBounty({
                    ...newBounty,
                    slashPercent: parseInt(e.target.value),
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>25%</span>
                <span>50%</span>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="allowMultipleWinners"
                name="allowMultipleWinners"
                type="checkbox"
                checked={newBounty.allowMultipleWinners}
                onChange={(e) =>
                  setNewBounty({
                    ...newBounty,
                    allowMultipleWinners: e.target.checked,
                    winnerShares: e.target.checked ? [50, 50] : [100],
                  })
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="allowMultipleWinners" className="ml-2 block text-sm text-gray-900">
                Allow Multiple Winners
              </label>
            </div>

            {newBounty.allowMultipleWinners && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Winner Shares (%)
                </label>
                {newBounty.winnerShares.map((share, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <input
                      type="number"
                      value={share}
                      onChange={(e) => {
                        const newShares = [...newBounty.winnerShares];
                        newShares[index] = parseInt(e.target.value) || 0;
                        setNewBounty({ ...newBounty, winnerShares: newShares });
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder={`Share for winner ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newShares = newBounty.winnerShares.filter(
                          (_, i) => i !== index
                        );
                        setNewBounty({ ...newBounty, winnerShares: newShares });
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setNewBounty({
                      ...newBounty,
                      winnerShares: [...newBounty.winnerShares, 0],
                    })
                  }
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Add Winner Share
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Total shares must equal 100%. Current total: {newBounty.winnerShares.reduce((a, b) => a + b, 0)}%
                </p>
              </div>
            )}

            {/* Requirements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requirements
              </label>
              {newBounty.requirements.map((req, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => {
                      const newReqs = [...newBounty.requirements];
                      newReqs[index] = e.target.value;
                      setNewBounty({ ...newBounty, requirements: newReqs });
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter a requirement..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newReqs = newBounty.requirements.filter(
                        (_, i) => i !== index
                      );
                      setNewBounty({ ...newBounty, requirements: newReqs });
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setNewBounty({
                    ...newBounty,
                    requirements: [...newBounty.requirements, ""],
                  })
                }
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Requirement
              </button>
            </div>

            {/* Deliverables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deliverables
              </label>
              {newBounty.deliverables.map((del, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={del}
                    onChange={(e) => {
                      const newDels = [...newBounty.deliverables];
                      newDels[index] = e.target.value;
                      setNewBounty({ ...newBounty, deliverables: newDels });
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Enter a deliverable..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newDels = newBounty.deliverables.filter(
                        (_, i) => i !== index
                      );
                      setNewBounty({ ...newBounty, deliverables: newDels });
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setNewBounty({
                    ...newBounty,
                    deliverables: [...newBounty.deliverables, ""],
                  })
                }
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Deliverable
              </button>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Skills
              </label>
              {newBounty.skills.map((skill, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skill}
                    onChange={(e) => {
                      const newSkills = [...newBounty.skills];
                      newSkills[index] = e.target.value;
                      setNewBounty({ ...newBounty, skills: newSkills });
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    placeholder="e.g., React, TypeScript, UI/UX..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newSkills = newBounty.skills.filter(
                        (_, i) => i !== index
                      );
                      setNewBounty({ ...newBounty, skills: newSkills });
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setNewBounty({
                    ...newBounty,
                    skills: [...newBounty.skills, ""],
                  })
                }
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Add Skill
              </button>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Images (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center text-gray-500"
                >
                  <div className="w-12 h-12 mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📷</span>
                  </div>
                  <span className="text-sm">Click to upload images</span>
                  <span className="text-xs">Supports JPG, PNG, GIF up to 10MB each</span>
                </label>
              </div>

              {/* Preview uploaded images */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4">
                  <h6 className="text-sm font-medium text-gray-700 mb-2">
                    Selected Images ({uploadedFiles.length})
                  </h6>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={createBounty}
              disabled={
                !newBounty.title ||
                !newBounty.description ||
                !newBounty.amount ||
                !newBounty.deadline ||
                isPending ||
                isConfirming ||
                isUploadingImages
              }
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-lg"
            >
              {isUploadingImages
                ? "Uploading Images to IPFS..."
                : isPending
                ? "Preparing Transaction..."
                : isConfirming
                ? "Confirming on Blockchain..."
                : "Create Bounty with IPFS Metadata"}
            </button>

            {/* Transaction Status */}
            {hash && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm">
                  <strong>Transaction Hash:</strong>{" "}
                  <a
                    href={`https://shannon-explorer.somnia.network/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-mono"
                  >
                    {hash}
                  </a>
                </p>
                {isConfirming && (
                  <p className="text-sm text-blue-600 mt-2">
                    ⏳ Waiting for confirmation on Somnia Testnet...
                  </p>
                )}
                {isConfirmed && (
                  <p className="text-sm text-green-600 mt-2">
                    ✅ Transaction confirmed!
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Error:</strong> {error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Browse Bounties Tab */}
      {activeTab === "browse" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900">
              All Bounties ({bounties.length})
            </h3>
            <div className="flex gap-2">
              <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">All Types</option>
                <option value="development">Development</option>
                <option value="design">Design</option>
                <option value="marketing">Marketing</option>
                <option value="research">Research</option>
                <option value="other">Other</option>
              </select>
              <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {bounties.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No bounties found
              </h3>
              <p className="text-gray-600 mb-4">
                Be the first to create a bounty!
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Bounty
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {bounties.map((bounty) => (
                <BountyCard
                  key={bounty.id}
                  bounty={bounty}
                  submissions={submissions[bounty.id] || []}
                  onSubmitSolution={submitSolution}
                  onSelectWinners={selectWinners}
                  onTriggerSlash={triggerSlash}
                  onAddReply={addReply}
                  onRevealSolution={revealSolution}
                />
              ))}
            </div>
          )}
        </div>
      )}


    </div>
  );
}
