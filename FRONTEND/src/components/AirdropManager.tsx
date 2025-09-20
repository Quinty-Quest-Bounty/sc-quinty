"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWatchContractEvent,
  useChainId,
} from "wagmi";
import { readContract } from "@wagmi/core";
import {
  CONTRACT_ADDRESSES,
  AIRDROP_ABI,
  SOMNIA_TESTNET_ID,
} from "../utils/contracts";
import {
  formatSTT,
  formatTimeLeft,
  formatAddress,
  wagmiConfig,
  parseSTT,
} from "../utils/web3";
import { uploadToIpfs, formatIpfsUrl, IpfsImage } from "../utils/ipfs";
import { ensureSomniaNetwork } from "../utils/network";
import AirdropCard from "./AirdropCard";

interface Airdrop {
  id: number;
  creator: string;
  title: string;
  description: string;
  totalAmount: bigint;
  perQualifier: bigint;
  maxQualifiers: number;
  qualifiersCount: number;
  deadline: number;
  createdAt: number;
  resolved: boolean;
  cancelled: boolean;
  requirements: string;
  imageUrl?: string;
}

interface Entry {
  solver: string;
  ipfsProofCid: string;
  timestamp: number;
  status: number; // 0: Pending, 1: Approved, 2: Rejected
  feedback: string;
}

export default function AirdropManager() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();

  // State
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [entries, setEntries] = useState<{ [airdropId: number]: Entry[] }>({});
  const [selectedAirdrop, setSelectedAirdrop] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "browse" | "manage">(
    "browse"
  );

  // Form states
  const [newAirdrop, setNewAirdrop] = useState({
    title: "",
    description: "",
    perQualifier: "",
    maxQualifiers: 100,
    deadline: "",
    requirements: "",
    imageUrl: "",
  });

  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [newEntry, setNewEntry] = useState({
    airdropId: 0,
    ipfsProofCid: "",
    twitterUrl: "",
    description: "",
  });

  const [verificationForm, setVerificationForm] = useState({
    airdropId: 0,
    entryId: 0,
    status: 1, // 1 = Approved
    feedback: "",
    qualifiedIndices: [] as number[],
  });

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [modalAirdropId, setModalAirdropId] = useState<number | null>(null);

  // Read airdrop counter
  const { data: airdropCounter, refetch: refetchAirdropCounter } =
    useReadContract({
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
      refetchAirdropCounter();
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .AirdropBounty as `0x${string}`,
    abi: AIRDROP_ABI,
    eventName: "EntrySubmitted",
    onLogs() {
      if (selectedAirdrop) {
        loadEntries(selectedAirdrop);
      }
    },
  });

  // Load all airdrops
  const loadAirdrops = async () => {
    if (airdropCounter === undefined) return;

    const loadedAirdrops: Airdrop[] = [];
    for (let i = 1; i <= Number(airdropCounter); i++) {
      try {
        const airdrop = await readAirdrop(i);
        if (airdrop) {
          loadedAirdrops.push(airdrop);
        }
      } catch (error) {
        console.error(`Error loading airdrop ${i}:`, error);
      }
    }
    setAirdrops(loadedAirdrops.reverse());
  };

  // Read specific airdrop
  const readAirdrop = async (airdropId: number): Promise<Airdrop | null> => {
    try {
      const airdropData = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "getAirdrop",
        args: [BigInt(airdropId)],
      });

      if (airdropData) {
        const [
          creator,
          title,
          description,
          totalAmount,
          perQualifier,
          maxQualifiers,
          qualifiersCount,
          deadline,
          createdAt,
          resolved,
          cancelled,
          requirements,
        ] = airdropData as any;
        return {
          id: airdropId,
          creator,
          title,
          description,
          totalAmount,
          perQualifier,
          maxQualifiers: Number(maxQualifiers),
          qualifiersCount: Number(qualifiersCount),
          deadline: Number(deadline),
          createdAt: Number(createdAt),
          resolved,
          cancelled,
          requirements,
          imageUrl: description.includes("ipfs://")
            ? description.match(/ipfs:\/\/[^\s\n]+/)?.[0]
            : undefined,
        };
      }
      return null;
    } catch (e) {
      console.error(`Error reading airdrop ${airdropId}:`, e);
      return null;
    }
  };

  // Load entries for an airdrop
  const loadEntries = async (airdropId: number) => {
    try {
      const entryCount = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "getEntryCount",
        args: [BigInt(airdropId)],
      });

      const loadedEntries: Entry[] = [];
      for (let i = 0; i < Number(entryCount); i++) {
        const entryData = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
            .AirdropBounty as `0x${string}`,
          abi: AIRDROP_ABI,
          functionName: "getEntry",
          args: [BigInt(airdropId), BigInt(i)],
        });
        const [solver, ipfsProofCid, timestamp, status, feedback] =
          entryData as any;
        loadedEntries.push({
          solver,
          ipfsProofCid,
          timestamp: Number(timestamp),
          status: Number(status),
          feedback,
        });
      }

      setEntries((prev) => ({
        ...prev,
        [airdropId]: loadedEntries,
      }));
    } catch (error) {
      console.error(`Error loading entries for airdrop ${airdropId}:`, error);
    }
  };

  const validateAndSetImage = (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return false;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return false;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      validateAndSetImage(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setIsDragOver(false);
    setNewAirdrop({ ...newAirdrop, imageUrl: "" });
  };

  // Create airdrop
  const createAirdrop = async () => {
    if (
      !isConnected ||
      !newAirdrop.title ||
      !newAirdrop.perQualifier ||
      !newAirdrop.deadline ||
      !newAirdrop.requirements
    )
      return;

    // Check if user is on Somnia Testnet using wagmi's reliable chainId
    if (chainId !== SOMNIA_TESTNET_ID) {
      const networkOk = await ensureSomniaNetwork();
      if (!networkOk) {
        alert("Please connect to Somnia Testnet to create airdrops");
        return;
      }
    }

    try {
      let finalImageUrl = newAirdrop.imageUrl;

      // Upload image first if selected but not yet uploaded
      if (selectedImage && !finalImageUrl) {
        setIsUploading(true);
        try {
          const cid = await uploadToIpfs(selectedImage, {
            name: `airdrop-image-${Date.now()}`,
            type: "airdrop-banner",
          });
          finalImageUrl = `ipfs://${cid}`;
        } catch (error) {
          console.error("Error uploading image:", error);
          alert("Error uploading image. Please try again.");
          return;
        } finally {
          setIsUploading(false);
        }
      }

      const deadlineTimestamp = Math.floor(
        new Date(newAirdrop.deadline).getTime() / 1000
      );
      const perQualifierWei = parseSTT(newAirdrop.perQualifier);
      const totalAmount = perQualifierWei * BigInt(newAirdrop.maxQualifiers);

      // Include image URL in description if available
      const descriptionWithImage = finalImageUrl
        ? `${newAirdrop.description}\n\nImage: ${finalImageUrl}`
        : newAirdrop.description || "";

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "createAirdrop",
        args: [
          newAirdrop.title,
          descriptionWithImage,
          perQualifierWei,
          BigInt(newAirdrop.maxQualifiers),
          BigInt(deadlineTimestamp),
          newAirdrop.requirements,
        ],
        value: totalAmount,
      });

      console.log("Create airdrop transaction hash:", txHash);

      // Reset form
      setNewAirdrop({
        title: "",
        description: "",
        perQualifier: "",
        maxQualifiers: 100,
        deadline: "",
        requirements: "",
        imageUrl: "",
      });
      setSelectedImage(null);
      setImagePreview(null);

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
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "submitEntry",
        args: [BigInt(newEntry.airdropId), newEntry.ipfsProofCid],
      });

      console.log("Submit entry transaction hash:", txHash);

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

  // Verify entry
  const verifyEntry = async () => {
    if (
      !isConnected ||
      !verificationForm.airdropId ||
      verificationForm.entryId === undefined
    )
      return;

    try {
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "verifyEntry",
        args: [
          BigInt(verificationForm.airdropId),
          BigInt(verificationForm.entryId),
          verificationForm.status,
          verificationForm.feedback || "",
        ],
      });

      console.log("Verify entry transaction hash:", txHash);

      setVerificationForm({
        airdropId: 0,
        entryId: 0,
        status: 1,
        feedback: "",
        qualifiedIndices: [],
      });

      alert("Entry verified successfully!");
      loadAirdrops();
      if (selectedAirdrop) {
        loadEntries(selectedAirdrop);
      }
    } catch (error) {
      console.error("Error verifying entry:", error);
      alert("Error verifying entry");
    }
  };

  // Verify and distribute rewards
  const verifyAndDistribute = async (
    airdropId?: number,
    selectedIndices?: number[]
  ) => {
    // Use parameters if provided, otherwise fall back to form state
    const targetAirdropId = airdropId || verificationForm.airdropId;
    const targetIndices = selectedIndices || verificationForm.qualifiedIndices;

    if (!isConnected) {
      alert("Please connect your wallet first.");
      return;
    }

    if (!targetAirdropId || targetAirdropId === 0) {
      alert("Invalid airdrop ID. Please try again.");
      return;
    }

    if (targetIndices.length === 0) {
      alert("Please select at least one participant to receive rewards.");
      return;
    }

    // Validate that all indices are valid numbers
    if (targetIndices.some((i) => isNaN(i) || i < 0)) {
      alert("Invalid participant selection. Please try again.");
      return;
    }

    // Check contract address
    const contractAddress =
      CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]?.AirdropBounty;
    if (!contractAddress) {
      alert(
        "Contract address not found. Please check your network configuration."
      );
      return;
    }

    setIsDistributing(true);
    try {
      // Check if current user is the creator of this airdrop
      const airdrop = airdrops.find((a) => a.id === targetAirdropId);
      if (!airdrop) {
        alert("Airdrop not found. Please refresh and try again.");
        setIsDistributing(false);
        return;
      }

      if (airdrop.creator.toLowerCase() !== address?.toLowerCase()) {
        alert(
          "Only the airdrop creator can verify entries and distribute rewards."
        );
        setIsDistributing(false);
        return;
      }

      // Check airdrop status
      if (airdrop.resolved) {
        alert("This airdrop has already been resolved.");
        setIsDistributing(false);
        return;
      }

      if (airdrop.cancelled) {
        alert("This airdrop has been cancelled.");
        setIsDistributing(false);
        return;
      }

      // Check if deadline has passed
      const now = Math.floor(Date.now() / 1000);
      if (now < airdrop.deadline) {
        alert("Cannot distribute rewards before the airdrop deadline.");
        setIsDistributing(false);
        return;
      }

      // Validate entries exist for this airdrop
      const airdropEntries = entries[targetAirdropId];
      if (!airdropEntries || airdropEntries.length === 0) {
        alert("No entries found for this airdrop. Please load entries first.");
        setIsDistributing(false);
        return;
      }

      // Validate all indices are within range
      const maxIndex = airdropEntries.length - 1;
      const invalidIndices = targetIndices.filter((i) => i < 0 || i > maxIndex);
      if (invalidIndices.length > 0) {
        alert(
          `Invalid entry indices: ${invalidIndices.join(
            ", "
          )}. Valid range is 0-${maxIndex}.`
        );
        setIsDistributing(false);
        return;
      }

      const entryIds = targetIndices.map((i) => BigInt(i));
      const statuses = targetIndices.map(() => 1); // 1 = approved status
      const feedbacks = targetIndices.map(
        () => "Approved for reward distribution"
      );

      console.log("Attempting to distribute rewards with params:", {
        airdropId: targetAirdropId,
        indices: targetIndices,
        entryIds: entryIds.map((id) => id.toString()),
        statuses,
        feedbacks,
        entriesCount: airdropEntries.length,
        contractAddress: contractAddress,
        network: SOMNIA_TESTNET_ID,
      });

      const txHash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "verifyMultipleEntries",
        args: [BigInt(targetAirdropId), entryIds, statuses, feedbacks],
      });

      console.log("Verification transaction hash:", txHash);

      alert("Entries verified successfully! Now finalizing airdrop...");

      // After verification, finalize the airdrop to distribute rewards
      const finalizeTxHash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "finalizeAirdrop",
        args: [BigInt(targetAirdropId)],
      });

      console.log("Finalize airdrop transaction hash:", finalizeTxHash);

      // Reset verification form
      setVerificationForm({
        airdropId: 0,
        entryId: 0,
        status: 1,
        feedback: "",
        qualifiedIndices: [],
      });

      alert("Rewards distributed successfully!");
      loadAirdrops();
      // Refresh entries for the airdrop
      loadEntries(targetAirdropId);
    } catch (error: any) {
      console.error("Error distributing rewards:", error);

      // More detailed error reporting
      let errorMessage = "Error distributing rewards. ";
      if (error?.message) {
        errorMessage += `Details: ${error.message}`;
      } else if (error?.reason) {
        errorMessage += `Reason: ${error.reason}`;
      } else {
        errorMessage += "Please check the console for more details.";
      }

      alert(errorMessage);
    } finally {
      setIsDistributing(false);
    }
  };

  // Cancel airdrop
  const cancelAirdrop = async (airdropId: number) => {
    if (!isConnected || !airdropId) return;

    setIsCancelling(true);
    try {
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "cancelAirdrop",
        args: [BigInt(airdropId)],
      });

      console.log("Cancel airdrop transaction hash:", txHash);

      alert("Airdrop cancelled successfully!");
      loadAirdrops();
    } catch (error) {
      console.error("Error cancelling airdrop:", error);
      alert("Error cancelling airdrop. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Finalize airdrop
  const finalizeAirdrop = async (airdropId: number) => {
    if (!isConnected || !airdropId) return;

    setIsFinalizing(true);
    try {
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
          .AirdropBounty as `0x${string}`,
        abi: AIRDROP_ABI,
        functionName: "finalizeAirdrop",
        args: [BigInt(airdropId)],
      });

      console.log("Finalize airdrop transaction hash:", txHash);

      alert("Airdrop finalized successfully!");
      loadAirdrops();
    } catch (error) {
      console.error("Error finalizing airdrop:", error);
      alert("Error finalizing airdrop. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  };

  useEffect(() => {
    if (airdropCounter !== undefined) {
      loadAirdrops();
    }
  }, [airdropCounter]);

  useEffect(() => {
    if (selectedAirdrop) {
      loadEntries(selectedAirdrop);
    }
  }, [selectedAirdrop]);

  // Load entries for user's campaigns when in manage tab
  useEffect(() => {
    if (activeTab === "manage" && address && airdrops.length > 0) {
      const userCampaigns = airdrops.filter(
        (a) => a.creator === address && !a.resolved && !a.cancelled
      );
      userCampaigns.forEach((campaign) => {
        loadEntries(campaign.id);
      });
    }
  }, [activeTab, address, airdrops]);

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Wallet Connection Required
          </h3>
          <p className="text-gray-700 text-lg">
            Please connect your wallet to use Airdrop Bounties.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">
          Airdrop Bounties
        </h2>
        <p className="text-gray-700 text-lg max-w-2xl mx-auto">
          Create transparent promotion tasks with verifiable social proofs and distribute rewards fairly
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex justify-center space-x-12">
          {["browse", "create", "manage"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-3 px-6 border-b-2 font-semibold text-base transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Campaigns
            </button>
          ))}
        </nav>
      </div>

      {/* Create Airdrop Tab */}
      {activeTab === "create" && (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Create Promotion Campaign
            </h3>
            <p className="text-gray-700 text-lg">
              Launch transparent promotional campaigns with fixed STT rewards for verified social media engagement.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Campaign Title *
              </label>
              <input
                type="text"
                value={newAirdrop.title}
                onChange={(e) =>
                  setNewAirdrop({ ...newAirdrop, title: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Enter campaign title..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Campaign Description
              </label>
              <textarea
                value={newAirdrop.description}
                onChange={(e) =>
                  setNewAirdrop({ ...newAirdrop, description: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={3}
                placeholder="Describe your promotional campaign..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Requirements (What users need to do) *
              </label>
              <textarea
                value={newAirdrop.requirements}
                onChange={(e) =>
                  setNewAirdrop({ ...newAirdrop, requirements: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={3}
                placeholder="e.g., Post on X/Twitter with #QuintyDAO hashtag, get 100+ likes, include wallet address..."
                required
              />
            </div>

            {/* Image Upload Section */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Campaign Image (Optional)
              </label>
              <div className="space-y-3">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Campaign preview"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver
                        ? "border-primary-400 bg-primary-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="space-y-2">
                      <svg
                        className={`mx-auto h-12 w-12 ${
                          isDragOver ? "text-primary-500" : "text-gray-400"
                        }`}
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div>
                        <label
                          htmlFor="image-upload"
                          className="cursor-pointer"
                        >
                          <span
                            className={`hover:text-primary-500 ${
                              isDragOver
                                ? "text-primary-600"
                                : "text-primary-600"
                            }`}
                          >
                            Upload an image
                          </span>
                          <span
                            className={`${
                              isDragOver ? "text-primary-500" : "text-gray-500"
                            }`}
                          >
                            {" "}
                            or drag and drop
                          </span>
                        </label>
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                      <p
                        className={`text-xs ${
                          isDragOver ? "text-primary-600" : "text-gray-500"
                        }`}
                      >
                        {isDragOver
                          ? "Drop your image here"
                          : "PNG, JPG, GIF up to 5MB"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Reward Per Qualifier (STT) *
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="10"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Max Qualifiers *
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Deadline *
              </label>
              <input
                type="datetime-local"
                value={newAirdrop.deadline}
                onChange={(e) =>
                  setNewAirdrop({ ...newAirdrop, deadline: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>

            {/* Total Cost Display */}
            {newAirdrop.perQualifier && newAirdrop.maxQualifiers && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-3 text-lg">
                  Campaign Summary
                </h4>
                <div className="grid grid-cols-2 gap-4 text-blue-800">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm font-medium">Total Budget</div>
                    <div className="text-xl font-bold">
                      {(
                        parseFloat(newAirdrop.perQualifier) *
                        newAirdrop.maxQualifiers
                      ).toFixed(2)} STT
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm font-medium">Per User</div>
                    <div className="text-xl font-bold">{newAirdrop.perQualifier} STT</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm font-medium">Max Participants</div>
                    <div className="text-xl font-bold">{newAirdrop.maxQualifiers} users</div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm font-medium">Distribution</div>
                    <div className="text-sm font-semibold">First-come, first-served</div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={createAirdrop}
              disabled={
                isUploading ||
                !newAirdrop.title ||
                !newAirdrop.perQualifier ||
                !newAirdrop.maxQualifiers ||
                !newAirdrop.deadline ||
                !newAirdrop.requirements
              }
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            >
              {isUploading ? (
                <>
                  <span className="inline-block animate-spin mr-2">⚙️</span>
                  Uploading Image...
                </>
              ) : (
                <>
                  🚀 Create Campaign
                  {newAirdrop.perQualifier && newAirdrop.maxQualifiers && (
                    <span className="ml-2 opacity-90">
                      ({(
                        parseFloat(newAirdrop.perQualifier) *
                        newAirdrop.maxQualifiers
                      ).toFixed(2)} STT)
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Browse Airdrops Tab */}
      {activeTab === "browse" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-gray-900">
              Active Campaigns
            </h3>
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
              {airdrops.filter((a) => !a.resolved && !a.cancelled).length} campaigns
            </div>
          </div>

          {airdrops.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">
                No Campaigns Yet
              </h4>
              <p className="text-gray-600 mb-6">
                Be the first to create an airdrop campaign!
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                Create First Campaign
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {airdrops
                .filter((a) => !a.resolved && !a.cancelled)
                .map((airdrop) => (
                  <AirdropCard
                    key={airdrop.id}
                    airdrop={airdrop}
                    onShowSubmitModal={() => {
                      setModalAirdropId(airdrop.id);
                      setShowSubmitModal(true);
                    }}
                  />
                ))}
            </div>
          )}

          {/* Submit Entry Modal */}
          {showSubmitModal && modalAirdropId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    Submit Your Entry
                  </h3>
                  <button
                    onClick={() => {
                      setShowSubmitModal(false);
                      setModalAirdropId(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Twitter/X Post URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://twitter.com/..."
                      value={newEntry.airdropId === modalAirdropId ? newEntry.twitterUrl : ""}
                      onChange={(e) =>
                        setNewEntry({
                          ...newEntry,
                          airdropId: modalAirdropId,
                          twitterUrl: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      IPFS Proof CID *
                    </label>
                    <input
                      type="text"
                      placeholder="QmExample123..."
                      value={newEntry.airdropId === modalAirdropId ? newEntry.ipfsProofCid : ""}
                      onChange={(e) =>
                        setNewEntry({
                          ...newEntry,
                          airdropId: modalAirdropId,
                          ipfsProofCid: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Upload screenshots or proof to IPFS and paste the CID here
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      placeholder="Any additional information..."
                      value={newEntry.airdropId === modalAirdropId ? newEntry.description : ""}
                      onChange={(e) =>
                        setNewEntry({
                          ...newEntry,
                          airdropId: modalAirdropId,
                          description: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        submitEntry();
                        setShowSubmitModal(false);
                        setModalAirdropId(null);
                      }}
                      disabled={!newEntry.ipfsProofCid || newEntry.airdropId !== modalAirdropId}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Submit Entry
                    </button>
                    <button
                      onClick={() => {
                        setShowSubmitModal(false);
                        setModalAirdropId(null);
                      }}
                      className="px-6 py-3 border border-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* View Entries Modal */}
          {selectedAirdrop && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    Campaign Entries
                  </h3>
                  <button
                    onClick={() => setSelectedAirdrop(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>
                {entries[selectedAirdrop]?.length > 0 ? (
                  <div className="space-y-3">
                    {entries[selectedAirdrop].map((entry, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-gray-900">
                            {formatAddress(entry.solver)}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              entry.status === 1
                                ? "bg-green-100 text-green-800"
                                : entry.status === 2
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {entry.status === 1
                              ? "Approved"
                              : entry.status === 2
                              ? "Rejected"
                              : "Pending"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">
                          <div className="mb-1"><strong>IPFS:</strong> {entry.ipfsProofCid}</div>
                          <div className="mb-1">
                            <strong>Submitted:</strong> {new Date(entry.timestamp * 1000).toLocaleDateString()}
                          </div>
                          {entry.feedback && (
                            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                              <strong className="text-blue-900">Feedback:</strong>
                              <p className="text-blue-800 mt-1">{entry.feedback}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📝</div>
                    <p className="text-gray-600">
                      No entries submitted yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manage Tab - Redesigned for Better UX */}
      {activeTab === "manage" && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Manage Your Campaigns</h3>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 rounded-xl border border-blue-200 max-w-2xl mx-auto">
              <p className="text-blue-800 font-medium">
                📝 Review submissions and select eligible participants for rewards
              </p>
            </div>
          </div>

          {/* Your Active Campaigns */}
          <div className="space-y-4">
            {airdrops.filter(
              (a) => a.creator === address && !a.resolved && !a.cancelled
            ).length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="text-8xl mb-6">📋</div>
                <h4 className="text-2xl font-bold text-gray-900 mb-3">
                  No Active Campaigns
                </h4>
                <p className="text-gray-600 mb-6 text-lg">
                  You don't have any active campaigns to manage. Create your first campaign to get started!
                </p>
                <button
                  onClick={() => setActiveTab("create")}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg"
                >
                  🚀 Create New Campaign
                </button>
              </div>
            ) : (
              airdrops
                .filter(
                  (a) => a.creator === address && !a.resolved && !a.cancelled
                )
                .map((airdrop) => (
                  <div key={airdrop.id} className="bg-white rounded-lg shadow">
                    {/* Campaign Header */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            {airdrop.title || `Campaign #${airdrop.id}`}
                          </h4>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Reward:</span>
                              <div className="font-medium text-green-600">
                                {formatSTT(airdrop.perQualifier)} STT each
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Progress:</span>
                              <div className="font-medium">
                                {airdrop.qualifiersCount}/
                                {airdrop.maxQualifiers} qualified
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Deadline:</span>
                              <div className="font-medium">
                                {formatTimeLeft(BigInt(airdrop.deadline))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {Date.now() / 1000 > airdrop.deadline && (
                            <button
                              onClick={() => finalizeAirdrop(airdrop.id)}
                              disabled={isFinalizing}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isFinalizing ? "Finalizing..." : "Finalize"}
                            </button>
                          )}
                          <button
                            onClick={() => cancelAirdrop(airdrop.id)}
                            disabled={isCancelling}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCancelling ? "Cancelling..." : "Cancel"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Submissions Section */}
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h5 className="font-medium text-gray-900">
                          Submissions ({entries[airdrop.id]?.length || 0})
                        </h5>
                        <button
                          onClick={() => {
                            if (selectedAirdrop === airdrop.id) {
                              setSelectedAirdrop(null);
                            } else {
                              setSelectedAirdrop(airdrop.id);
                              // Always load entries when reviewing
                              loadEntries(airdrop.id);
                            }
                          }}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          {selectedAirdrop === airdrop.id
                            ? "Hide Submissions"
                            : "Review Submissions"}
                        </button>
                      </div>

                      {!entries[airdrop.id] ||
                      entries[airdrop.id].length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="text-4xl mb-2">💭</div>
                          <p>
                            No submissions yet. Share your campaign to get
                            participants!
                          </p>
                        </div>
                      ) : (
                        <>
                          {selectedAirdrop === airdrop.id && (
                            <div className="space-y-3 mb-6">
                              {entries[airdrop.id].map((entry, index) => (
                                <div
                                  key={index}
                                  className={`border rounded-lg p-4 ${
                                    verificationForm.qualifiedIndices.includes(
                                      index
                                    )
                                      ? "border-green-500 bg-green-50"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-2">
                                        <span className="font-medium text-gray-900">
                                          {formatAddress(entry.solver)}
                                        </span>
                                        <span
                                          className={`px-2 py-1 rounded-full text-xs ${
                                            entry.status === 1
                                              ? "bg-green-100 text-green-800"
                                              : entry.status === 2
                                              ? "bg-red-100 text-red-800"
                                              : "bg-yellow-100 text-yellow-800"
                                          }`}
                                        >
                                          {entry.status === 1
                                            ? "Approved"
                                            : entry.status === 2
                                            ? "Rejected"
                                            : "Pending"}
                                        </span>
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        <div>IPFS: {entry.ipfsProofCid}</div>
                                        <div>
                                          Submitted:{" "}
                                          {new Date(
                                            entry.timestamp * 1000
                                          ).toLocaleDateString()}
                                        </div>
                                        {entry.feedback && (
                                          <div className="mt-1 text-blue-600">
                                            Feedback: {entry.feedback}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          const newQualified =
                                            verificationForm.qualifiedIndices.includes(
                                              index
                                            )
                                              ? verificationForm.qualifiedIndices.filter(
                                                  (i) => i !== index
                                                )
                                              : [
                                                  ...verificationForm.qualifiedIndices,
                                                  index,
                                                ];
                                          setVerificationForm({
                                            ...verificationForm,
                                            airdropId: airdrop.id,
                                            qualifiedIndices: newQualified,
                                          });
                                        }}
                                        className={`px-3 py-1 rounded text-sm font-medium ${
                                          verificationForm.qualifiedIndices.includes(
                                            index
                                          )
                                            ? "bg-green-600 text-white hover:bg-green-700"
                                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        }`}
                                      >
                                        {verificationForm.qualifiedIndices.includes(
                                          index
                                        )
                                          ? "✓ Selected"
                                          : "Select"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          {selectedAirdrop === airdrop.id &&
                            verificationForm.qualifiedIndices.length > 0 && (
                              <div className="bg-blue-50 rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h6 className="font-medium text-blue-900">
                                      Ready to Distribute Rewards
                                    </h6>
                                    <p className="text-sm text-blue-700">
                                      {verificationForm.qualifiedIndices.length}{" "}
                                      participants selected •
                                      {formatSTT(
                                        airdrop.perQualifier *
                                          BigInt(
                                            verificationForm.qualifiedIndices
                                              .length
                                          )
                                      )}{" "}
                                      STT total
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      verifyAndDistribute(
                                        airdrop.id,
                                        verificationForm.qualifiedIndices
                                      );
                                    }}
                                    disabled={isDistributing}
                                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isDistributing
                                      ? "Distributing..."
                                      : "Distribute Rewards"}
                                  </button>
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
