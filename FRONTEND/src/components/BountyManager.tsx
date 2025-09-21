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
import {
  CONTRACT_ADDRESSES,
  QUINTY_ABI,
  SOMNIA_TESTNET_ID,
} from "../utils/contracts";
import { parseSTT, wagmiConfig } from "../utils/web3";
import BountyCard from "./BountyCard";
import {
  uploadMetadataToIpfs,
  uploadToIpfs,
  BountyMetadata,
} from "../utils/ipfs";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";
import {
  Plus,
  Minus,
  Upload,
  X,
  Calendar as CalendarIcon,
  DollarSign,
  Target,
  Users,
  Clock,
  ChevronDown,
} from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { format } from "date-fns";

// V2 Interfaces matching contract structs
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

export default function BountyManager() {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // State
  const [bounties, setBounties] = useState<Bounty[]>([]);
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

  // Date and time state for the calendar
  const [deadlineDate, setDeadlineDate] = useState<Date>();
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Sync date and time to deadline field
  useEffect(() => {
    if (deadlineDate && deadlineTime) {
      const [hours, minutes] = deadlineTime.split(":");
      const combinedDateTime = new Date(deadlineDate);
      combinedDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));

      // Format for datetime-local input
      const formattedDateTime = combinedDateTime.toISOString().slice(0, 16);
      setNewBounty((prev) => ({ ...prev, deadline: formattedDateTime }));
    }
  }, [deadlineDate, deadlineTime]);

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
    onLogs() {
      loadBountiesAndSubmissions();
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
    abi: QUINTY_ABI,
    eventName: "SubmissionCreated",
    onLogs(logs) {
      logs.forEach((log: any) => {
        const { bountyId } = log.args || {};
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
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // Remove image from upload list
  const removeImage = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
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
          type: "bounty-image",
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

  // Load bounties and submissions with the new getBountyData function
  const loadBountiesAndSubmissions = async () => {
    if (!bountyCounter) return;

    const bountyIds = Array.from(
      { length: Number(bountyCounter) },
      (_, i) => i + 1
    );
    const loadedBounties: Bounty[] = [];

    for (const id of bountyIds) {
      try {
        // 1. Get all bounty metadata using the new robust function
        const bountyData = await readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
            .Quinty as `0x${string}`,
          abi: QUINTY_ABI,
          functionName: "getBountyData",
          args: [BigInt(id)],
        });

        if (bountyData) {
          const bountyArray = bountyData as any[];
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
          ] = bountyArray;

          // 2. Get submissions separately
          const submissionCount = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
              .Quinty as `0x${string}`,
            abi: QUINTY_ABI,
            functionName: "getSubmissionCount",
            args: [BigInt(id)],
          });

          const submissions: Submission[] = [];
          for (let i = 0; i < Number(submissionCount); i++) {
            const submissionData = await readContract(wagmiConfig, {
              address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
                .Quinty as `0x${string}`,
              abi: QUINTY_ABI,
              functionName: "getSubmissionStruct",
              args: [BigInt(id), BigInt(i)],
            });
            if (submissionData) {
              submissions.push(submissionData as unknown as Submission);
            }
          }

          const metadataMatch = description.match(
            /Metadata: ipfs:\/\/([a-zA-Z0-9]+)/
          );
          const metadataCid = metadataMatch ? metadataMatch[1] : undefined;

          // 3. Assemble the full bounty object
          loadedBounties.push({
            id,
            creator,
            description,
            amount,
            deadline,
            allowMultipleWinners,
            winnerShares,
            status,
            slashPercent,
            submissions,
            selectedWinners,
            selectedSubmissionIds,
            metadataCid,
          });
        }
      } catch (error) {
        console.error(`Error loading bounty data for ID ${id}:`, error);
      }
    }

    setBounties(loadedBounties.reverse());
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
      alert(
        "Error: The selected deadline is in the past. Please choose a future date and time."
      );
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
        value: parseSTT(newBounty.amount),
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
      setDeadlineDate(undefined);
      setDeadlineTime("23:59");
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
      setDeadlineDate(undefined);
      setDeadlineTime("23:59");
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
      writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "submitSolution",
        args: [BigInt(targetBountyId), targetIpfsCid],
        value: depositAmount,
      });

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
      writeContract({
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
      writeContract({
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
      writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "addReply",
        args: [BigInt(bountyId), BigInt(subId), content],
      });
      alert(
        "Reply submitted successfully! It will appear after the transaction is confirmed."
      );
    } catch (error) {
      console.error("Error adding reply:", error);
      alert("Error adding reply");
    }
  };

  // Reveal solution
  const revealSolution = async (
    bountyId: number,
    subId: number,
    revealCid: string
  ) => {
    if (!isConnected || !revealCid.trim()) return;

    try {
      writeContract({
        address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].Quinty as `0x${string}`,
        abi: QUINTY_ABI,
        functionName: "revealSolution",
        args: [BigInt(bountyId), BigInt(subId), revealCid],
      });
      alert(
        "Solution revealed successfully! It will appear after the transaction is confirmed."
      );
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
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Target className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Quinty Bounty</h1>
        <p className="text-muted-foreground text-lg">
          Post tasks with 100% STT escrow and blinded submissions for secure,
          transparent project completion.
        </p>
      </div>
      <div className="mb-6">
        {/* <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Quinty Bounty System
        </h2> */}

        {/* Tab Navigation */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-8">
            {["browse", "create"].map((tab) => (
              <Button
                key={tab}
                variant="ghost"
                onClick={() => setActiveTab(tab as any)}
                className={`border-b-2 rounded-none ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} Bounties
              </Button>
            ))}
          </nav>
        </div>
      </div>

      {/* Create Bounty Tab */}
      {activeTab === "create" && (
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6" />
                Create New Bounty
              </CardTitle>
              <p className="text-muted-foreground">
                Create a detailed bounty with IPFS metadata and smart contract
                escrow
              </p>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* LEFT COLUMN - Basic Info & Details */}
                <div className="space-y-6">
                  {/* Basic Information */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          1
                        </span>
                      </div>
                      <h4 className="font-semibold">Basic Information</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Title *</label>
                        <Input
                          type="text"
                          value={newBounty.title}
                          onChange={(e) =>
                            setNewBounty({
                              ...newBounty,
                              title: e.target.value,
                            })
                          }
                          placeholder="e.g., Build a React Dashboard Component"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Bounty Type
                        </label>
                        <Select
                          value={newBounty.bountyType}
                          onValueChange={(value) =>
                            setNewBounty({
                              ...newBounty,
                              bountyType: value as any,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="development">
                              Development
                            </SelectItem>
                            <SelectItem value="design">Design</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Description *
                        </label>
                        <textarea
                          value={newBounty.description}
                          onChange={(e) =>
                            setNewBounty({
                              ...newBounty,
                              description: e.target.value,
                            })
                          }
                          className="w-full min-h-[80px] p-3 border border-input rounded-md bg-background resize-none text-sm"
                          placeholder="Detailed description of your bounty..."
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Bounty Details */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          2
                        </span>
                      </div>
                      <h4 className="font-semibold">Bounty Details</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Amount (STT) *
                          </label>
                          <Input
                            type="number"
                            value={newBounty.amount}
                            onChange={(e) =>
                              setNewBounty({
                                ...newBounty,
                                amount: e.target.value,
                              })
                            }
                            placeholder="1.0"
                            step="0.01"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Deadline *
                          </label>
                          <div className="flex gap-2">
                            <Popover
                              open={isCalendarOpen}
                              onOpenChange={setIsCalendarOpen}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="flex-1 justify-between font-normal"
                                >
                                  {deadlineDate
                                    ? format(deadlineDate, "PPP")
                                    : "Select date"}
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={deadlineDate}
                                  onSelect={(date) => {
                                    setDeadlineDate(date);
                                    setIsCalendarOpen(false);
                                  }}
                                  disabled={(date) => date < new Date()}
                                />
                              </PopoverContent>
                            </Popover>
                            <Input
                              type="time"
                              value={deadlineTime}
                              onChange={(e) => setDeadlineTime(e.target.value)}
                              className="w-24"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
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
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>25%</span>
                          <span>50%</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            id="allowMultipleWinners"
                            name="allowMultipleWinners"
                            type="checkbox"
                            checked={newBounty.allowMultipleWinners}
                            onChange={(e) =>
                              setNewBounty({
                                ...newBounty,
                                allowMultipleWinners: e.target.checked,
                                winnerShares: e.target.checked
                                  ? [50, 50]
                                  : [100],
                              })
                            }
                            className="h-4 w-4 text-primary border-gray-300 rounded"
                          />
                          <label
                            htmlFor="allowMultipleWinners"
                            className="text-sm font-medium flex items-center gap-1"
                          >
                            <Users className="w-4 h-4" />
                            Allow Multiple Winners
                          </label>
                        </div>

                        {newBounty.allowMultipleWinners && (
                          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                            <label className="text-sm font-medium">
                              Winner Shares (%)
                            </label>
                            {newBounty.winnerShares.map((share, index) => (
                              <div
                                key={index}
                                className="flex gap-2 items-center"
                              >
                                <Input
                                  type="number"
                                  value={share}
                                  onChange={(e) => {
                                    const newShares = [
                                      ...newBounty.winnerShares,
                                    ];
                                    newShares[index] =
                                      parseInt(e.target.value) || 0;
                                    setNewBounty({
                                      ...newBounty,
                                      winnerShares: newShares,
                                    });
                                  }}
                                  placeholder={`Winner ${index + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const newShares =
                                      newBounty.winnerShares.filter(
                                        (_, i) => i !== index
                                      );
                                    setNewBounty({
                                      ...newBounty,
                                      winnerShares: newShares,
                                    });
                                  }}
                                  className="h-8 w-8"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            <div className="flex justify-between items-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setNewBounty({
                                    ...newBounty,
                                    winnerShares: [
                                      ...newBounty.winnerShares,
                                      0,
                                    ],
                                  })
                                }
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Share
                              </Button>
                              <Badge
                                variant={
                                  newBounty.winnerShares.reduce(
                                    (a, b) => a + b,
                                    0
                                  ) === 100
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                Total:{" "}
                                {newBounty.winnerShares.reduce(
                                  (a, b) => a + b,
                                  0
                                )}
                                %
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* RIGHT COLUMN - Requirements, Media & Submit */}
                <div className="space-y-6">
                  {/* Requirements & Skills */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          3
                        </span>
                      </div>
                      <h4 className="font-semibold">Requirements & Skills</h4>
                    </div>

                    <div className="space-y-4">
                      {/* Requirements */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Requirements
                        </label>
                        <div className="space-y-2">
                          {newBounty.requirements.map((req, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                type="text"
                                value={req}
                                onChange={(e) => {
                                  const newReqs = [...newBounty.requirements];
                                  newReqs[index] = e.target.value;
                                  setNewBounty({
                                    ...newBounty,
                                    requirements: newReqs,
                                  });
                                }}
                                placeholder="Enter a requirement..."
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newReqs = newBounty.requirements.filter(
                                    (_, i) => i !== index
                                  );
                                  setNewBounty({
                                    ...newBounty,
                                    requirements: newReqs,
                                  });
                                }}
                                className="h-8 w-8"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setNewBounty({
                                ...newBounty,
                                requirements: [...newBounty.requirements, ""],
                              })
                            }
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Requirement
                          </Button>
                        </div>
                      </div>

                      {/* Deliverables */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Deliverables
                        </label>
                        <div className="space-y-2">
                          {newBounty.deliverables.map((del, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                type="text"
                                value={del}
                                onChange={(e) => {
                                  const newDels = [...newBounty.deliverables];
                                  newDels[index] = e.target.value;
                                  setNewBounty({
                                    ...newBounty,
                                    deliverables: newDels,
                                  });
                                }}
                                placeholder="Enter a deliverable..."
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newDels = newBounty.deliverables.filter(
                                    (_, i) => i !== index
                                  );
                                  setNewBounty({
                                    ...newBounty,
                                    deliverables: newDels,
                                  });
                                }}
                                className="h-8 w-8"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setNewBounty({
                                ...newBounty,
                                deliverables: [...newBounty.deliverables, ""],
                              })
                            }
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Deliverable
                          </Button>
                        </div>
                      </div>

                      {/* Skills */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Required Skills
                        </label>
                        <div className="space-y-2">
                          {newBounty.skills.map((skill, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                type="text"
                                value={skill}
                                onChange={(e) => {
                                  const newSkills = [...newBounty.skills];
                                  newSkills[index] = e.target.value;
                                  setNewBounty({
                                    ...newBounty,
                                    skills: newSkills,
                                  });
                                }}
                                placeholder="e.g., React, TypeScript..."
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  const newSkills = newBounty.skills.filter(
                                    (_, i) => i !== index
                                  );
                                  setNewBounty({
                                    ...newBounty,
                                    skills: newSkills,
                                  });
                                }}
                                className="h-8 w-8"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setNewBounty({
                                ...newBounty,
                                skills: [...newBounty.skills, ""],
                              })
                            }
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Skill
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Media Upload */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          4
                        </span>
                      </div>
                      <h4 className="font-semibold">Media & Assets</h4>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        Images (Optional)
                      </label>

                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-muted-foreground/50 transition-colors">
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
                          className="cursor-pointer flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <div className="w-12 h-12 mb-2 bg-muted rounded-full flex items-center justify-center">
                            <Upload className="w-6 h-6" />
                          </div>
                          <span className="text-sm font-medium mb-1">
                            Click to upload images
                          </span>
                          <span className="text-xs text-center">
                            JPG, PNG, GIF up to 10MB each
                          </span>
                        </label>
                      </div>

                      {/* Preview uploaded images */}
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              Selected Images ({uploadedFiles.length})
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {uploadedFiles.map((file, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`Preview ${index + 1}`}
                                  className="w-full h-20 object-cover rounded-lg border"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => removeImage(index)}
                                  className="absolute -top-2 -right-2 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                                <div className="text-xs text-muted-foreground mt-1 truncate">
                                  {file.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Submit Section */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          5
                        </span>
                      </div>
                      <h4 className="font-semibold">Create Bounty</h4>
                    </div>

                    <div className="space-y-4">
                      <Button
                        onClick={createBounty}
                        disabled={
                          !newBounty.title ||
                          !newBounty.description ||
                          !newBounty.amount ||
                          !deadlineDate ||
                          isPending ||
                          isConfirming ||
                          isUploadingImages
                        }
                        className="w-full h-10 font-semibold"
                      >
                        {isUploadingImages ? (
                          <>
                            <Upload className="w-4 h-4 mr-2 animate-spin" />
                            Uploading to IPFS...
                          </>
                        ) : isPending ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Preparing Transaction...
                          </>
                        ) : isConfirming ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Confirming...
                          </>
                        ) : (
                          <>
                            <Target className="w-4 h-4 mr-2" />
                            Create Bounty
                          </>
                        )}
                      </Button>

                      {/* Transaction Status */}
                      {hash && (
                        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                          <div className="space-y-2">
                            <p className="text-xs font-medium">
                              Transaction Hash:
                            </p>
                            <a
                              href={`https://shannon-explorer.somnia.network/tx/${hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-mono text-xs break-all"
                            >
                              {hash}
                            </a>
                            {isConfirming && (
                              <div className="flex items-center gap-2 text-xs text-blue-600">
                                <Clock className="w-3 h-3 animate-spin" />
                                Waiting for confirmation...
                              </div>
                            )}
                            {isConfirmed && (
                              <div className="flex items-center gap-2 text-xs text-green-600">
                                <span>✅</span>
                                Transaction confirmed!
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg">
                          <p className="text-xs text-red-600">
                            <strong>Error:</strong> {error.message}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
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
              <Select>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
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
              <Button onClick={() => setActiveTab("create")}>
                <Target className="w-4 h-4 mr-2" />
                Create Bounty
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {bounties.map((bounty) => (
                <BountyCard
                  key={bounty.id}
                  bounty={bounty}
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
