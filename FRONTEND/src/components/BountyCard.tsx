"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";
import {
  fetchMetadataFromIpfs,
  BountyMetadata,
  IpfsImage,
} from "../utils/ipfs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Users,
  Trophy,
  ExternalLink,
  MessageCircle,
  Unlock,
  User,
} from "lucide-react";

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
  const [, setIsLoadingMetadata] = useState(false);
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


  // Get status color for badge variant
  const getStatusVariant = (status: number) => {
    switch (status) {
      case 0:
        return "default"; // Open
      case 1:
        return "secondary"; // Pending Reveal
      case 2:
        return "outline"; // Resolved
      case 3:
        return "destructive"; // Disputed
      case 4:
        return "secondary"; // Expired
      default:
        return "outline";
    }
  };

  // Get difficulty color based on amount
  const getDifficultyLevel = (amount: bigint) => {
    const amountNum = Number(amount);
    if (amountNum >= 10000) return { label: "Advanced", color: "text-red-600" };
    if (amountNum >= 5000)
      return { label: "Intermediate", color: "text-yellow-600" };
    return { label: "Beginner", color: "text-green-600" };
  };

  const difficulty = getDifficultyLevel(bounty.amount);

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-0 shadow-sm">
      {/* Image Header */}
      {metadata?.images && metadata.images.length > 0 && (
        <div className="relative overflow-hidden rounded-t-lg">
          <img
            src={`https://ipfs.io/ipfs/${metadata.images[0]}`}
            alt={metadata.title}
            className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div className="absolute top-4 right-4">
            <Badge
              variant={getStatusVariant(bounty.status)}
              className="shadow-sm"
            >
              {statusLabel}
            </Badge>
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-bold text-gray-900 line-clamp-2">
              {metadata?.title || bounty.description.split("\n")[0]}
            </h3>
            <p className="text-sm text-muted-foreground">
              {metadata?.description?.slice(0, 120)}...
            </p>
          </div>
          {!metadata?.images && (
            <Badge
              variant={getStatusVariant(bounty.status)}
              className="shrink-0"
            >
              {statusLabel}
            </Badge>
          )}
        </div>

        {/* Bounty Reward Section */}
        <div className="flex items-center justify-between pt-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              Bounty Reward
            </p>
            <p className="text-2xl font-bold text-primary">
              {formatSTT(bounty.amount)} STT
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              Difficulty
            </p>
            <p className={`text-sm font-semibold ${difficulty.color}`}>
              {difficulty.label}
            </p>
          </div>
        </div>

        {/* Creator Info */}
        <div className="flex items-center gap-2 pt-4 pb-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Created by</span>
          <Badge variant="outline" className="text-xs">
            {formatAddress(bounty.creator)}
          </Badge>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>Deadline</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>Submissions</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{formatTimeLeft(bounty.deadline)}</span>
          <span className="font-medium">{bounty.submissions.length}</span>
        </div>

        {/* Technologies */}
        {bounty.allowMultipleWinners && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">Technologies</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                Multiple Winners
              </Badge>
              <Badge variant="outline" className="text-xs">
                STT
              </Badge>
              <Badge variant="outline" className="text-xs">
                IPFS
              </Badge>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Action Buttons */}
      <CardContent className="pt-0">
        <div className="flex gap-2 mb-4">
          <Button
            variant="default"
            className="flex-1 bg-black hover:bg-gray-800 text-white"
            onClick={() => {
              if (bounty.status === 0 && !isCreator && !showSubmissionForm) {
                setShowSubmissionForm(true);
              } else if (isCreator && bounty.status === 0) {
                // Handle winner selection
              }
            }}
          >
            <Trophy className="w-4 h-4 mr-2" />
            {bounty.status === 0 && !isCreator ? "Apply Now" : "Manage"}
          </Button>
        </div>


        {/* Toggle Details */}
        <Button
          variant="ghost"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full mt-4 text-sm"
        >
          {showDetails
            ? "Hide Details & Submissions"
            : "Show Details & Submissions"}
        </Button>
      </CardContent>

      {/* Collapsible Section */}
      {showDetails && (
        <CardContent className="pt-0">
          <Separator className="mb-6" />

          {/* Metadata Details */}
          {metadata && (
            <div className="mb-6">
              <h5 className="font-semibold mb-3 text-gray-900">
                Bounty Details
              </h5>
              {/* Render remaining images here if they exist */}
              {metadata.images && metadata.images.length > 1 && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {metadata.images.slice(1).map((cid, index) => (
                    <img
                      key={index}
                      src={`https://ipfs.io/ipfs/${cid}`}
                      alt={`Bounty image ${index + 2}`}
                      className="rounded-lg object-cover h-20"
                    />
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-4 leading-relaxed">
                {metadata.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">Slash on Expiry</p>
                  <p className="text-muted-foreground">
                    {Number(bounty.slashPercent) / 100}%
                  </p>
                </div>
                {bounty.allowMultipleWinners &&
                  bounty.winnerShares.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">
                        Winner Allocation
                      </p>
                      <div className="space-y-1">
                        {bounty.winnerShares.slice(0, 3).map((share, index) => (
                          <p
                            key={index}
                            className="text-xs text-muted-foreground"
                          >
                            {index + 1}. {Number(share) / 100}%
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
              <Separator className="my-4" />
            </div>
          )}

          {/* Winners Display for Pending Reveal */}
          {bounty.status === 1 && bounty.selectedWinners.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-600" />
                <h5 className="font-bold text-gray-900">Selected Winners</h5>
              </div>
              <div className="space-y-3">
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
                      className="flex justify-between items-center bg-white rounded-lg p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={index === 0 ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {index === 0
                            ? "🥇"
                            : index === 1
                            ? "🥈"
                            : index === 2
                            ? "🥉"
                            : "🏆"}
                        </Badge>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">
                            {formatAddress(winner)}
                          </p>
                          {submission?.revealed && (
                            <Badge variant="outline" className="text-xs mt-1">
                              ✅ Revealed
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary text-sm">
                          {winnerShare}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSTT(
                            (bounty.amount * BigInt(winnerShare)) / BigInt(100)
                          )}{" "}
                          STT
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submissions Section */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              <h5 className="font-semibold text-gray-900">
                Submissions ({bounty.submissions.length})
              </h5>
            </div>
            <div className="space-y-3">
              {bounty.submissions.map((sub, index) => {
                const isWinner = bounty.selectedSubmissionIds.includes(
                  BigInt(index)
                );
                const winnerIndex = bounty.selectedSubmissionIds.findIndex(
                  (id) => id === BigInt(index)
                );

                return (
                  <Card
                    key={index}
                    className={`p-4 ${
                      isWinner
                        ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200"
                        : "bg-muted/20"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
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
                          <Badge
                            variant={
                              winnerIndex === 0 ? "default" : "secondary"
                            }
                            className="text-xs"
                          >
                            {winnerIndex === 0
                              ? "🥇 1st Place"
                              : winnerIndex === 1
                              ? "🥈 2nd Place"
                              : winnerIndex === 2
                              ? "🥉 3rd Place"
                              : `🏆 ${winnerIndex + 1}th Place`}
                          </Badge>
                        )}

                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatAddress(sub.solver)}
                          </p>
                          {sub.solver.toLowerCase() ===
                            bounty.creator.toLowerCase() && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Creator
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://ipfs.io/ipfs/${sub.blindedIpfsCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </a>
                      </Button>
                    </div>
                    {/* Replies */}
                    {sub.replies.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Discussion ({sub.replies.length})
                          </span>
                        </div>
                        {sub.replies.map((reply, rIndex) => (
                          <div
                            key={rIndex}
                            className="text-sm bg-muted/50 p-3 rounded-lg"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-gray-900 text-xs">
                                {formatAddress(reply.replier)}
                              </span>
                              {reply.replier.toLowerCase() ===
                                bounty.creator.toLowerCase() && (
                                <Badge variant="outline" className="text-xs">
                                  Creator
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-800 text-sm leading-relaxed">
                              {reply.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {bounty.status === 0 &&
                      (isCreator ||
                        address?.toLowerCase() ===
                          sub.solver.toLowerCase()) && (
                        <div className="flex gap-2 pt-3 border-t">
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
                            className="flex-1 text-sm border border-input rounded-md p-2 bg-background"
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              onAddReply(bounty.id, index, replyContent[index])
                            }
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Reply
                          </Button>
                        </div>
                      )}
                    {/* Reveal UI */}
                    {bounty.status === 1 &&
                      address?.toLowerCase() === sub.solver.toLowerCase() &&
                      !sub.revealed && (
                        <div className="mt-3 pt-3 border-t">
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
                              className="flex-1 text-sm border border-input rounded-md p-2 bg-background focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                onRevealSolution(
                                  bounty.id,
                                  index,
                                  revealCid[index]
                                )
                              }
                              disabled={!revealCid[index]?.trim()}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Unlock className="w-3 h-3 mr-1" />
                              Reveal
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            💡 Reveal your actual solution to claim rewards
                          </p>
                        </div>
                      )}

                    {/* Already Revealed Indicator */}
                    {bounty.status === 1 && sub.revealed && isWinner && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-green-600">
                            ✅ Solution Revealed
                          </Badge>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`https://ipfs.io/ipfs/${sub.revealIpfsCid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View Solution
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            {isCreator && bounty.status === 0 && (
              <Card className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h6 className="font-bold text-gray-900">
                      Ready to Select Winners?
                    </h6>
                    <p className="text-sm text-muted-foregrou nd">
                      {selectedSubmissions.length > 0
                        ? `${selectedSubmissions.length} submission(s) selected`
                        : "Select submissions and assign rankings"}
                    </p>
                    {bounty.allowMultipleWinners && (
                      <p className="text-xs text-blue-600">
                        💡 Maximum {maxWinners} winner(s) allowed
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSelectWinners}
                    disabled={
                      selectedSubmissions.length === 0 ||
                      selectedSubmissions.some((id) => !winnerRanks[id])
                    }
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Confirm Winners
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </CardContent>
      )}

      {/* Submission Form Modal */}
      {showSubmissionForm && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          <div className="space-y-3">
            <h6 className="font-semibold text-gray-900">
              Submit Your Solution
            </h6>
            <input
              type="text"
              value={submissionCid}
              onChange={(e) => setSubmissionCid(e.target.value)}
              placeholder="Enter your solution IPFS CID"
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            />
            <div className="flex gap-3">
              <Button onClick={handleSubmitSolution} className="flex-1">
                Confirm Submission
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSubmissionForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      )}

      {bounty.status === 0 && isCreator && isExpired && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          <Button
            onClick={() => onTriggerSlash(bounty.id)}
            variant="destructive"
            className="w-full"
          >
            Trigger Slash
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
