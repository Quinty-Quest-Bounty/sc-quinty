"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import {
  CONTRACT_ADDRESSES,
  REPUTATION_ABI,
  SOMNIA_TESTNET_ID,
} from "../utils/contracts";
import { readContract } from "@wagmi/core";
import { formatAddress, wagmiConfig } from "../utils/web3";
import { isAddress } from "viem";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  Trophy,
  Target,
  User,
  Search,
  Award,
  TrendingUp,
  Medal,
  Star,
} from "lucide-react";

interface UserStatsData {
  bountiesCreated: number;
  submissions: number;
  wins: number;
}

interface UserAchievements {
  achievements: number[];
  tokenIds: number[];
}

interface UserProfile {
  address: string;
  stats: UserStatsData;
  achievements: UserAchievements;
}

// Achievement Type Enum (matching contract)
const ACHIEVEMENT_TYPES = [
  "FIRST_SOLVER",
  "ACTIVE_SOLVER",
  "SKILLED_SOLVER",
  "EXPERT_SOLVER",
  "LEGEND_SOLVER",
  "FIRST_WIN",
  "SKILLED_WINNER",
  "EXPERT_WINNER",
  "CHAMPION_WINNER",
  "LEGEND_WINNER",
  "FIRST_CREATOR",
  "ACTIVE_CREATOR",
  "SKILLED_CREATOR",
  "EXPERT_CREATOR",
  "LEGEND_CREATOR",
  "MONTHLY_CHAMPION",
  "MONTHLY_BUILDER",
];

const ACHIEVEMENT_NAMES = {
  0: "First Solver",
  1: "Active Solver",
  2: "Skilled Solver",
  3: "Expert Solver",
  4: "Legend Solver",
  5: "First Win",
  6: "Skilled Winner",
  7: "Expert Winner",
  8: "Champion Winner",
  9: "Legend Winner",
  10: "First Creator",
  11: "Active Creator",
  12: "Skilled Creator",
  13: "Expert Creator",
  14: "Legend Creator",
  15: "Monthly Champion",
  16: "Monthly Builder",
};

const ACHIEVEMENT_MILESTONES = [1, 10, 25, 50, 100];

export default function ReputationDisplay() {
  const { address, isConnected } = useAccount();

  // State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    "profile" | "leaderboard" | "achievements"
  >("profile");
  const [searchAddress, setSearchAddress] = useState("");
  const [loading, setLoading] = useState(true);

  // Read user stats
  const { data: userStats, refetch: refetchStats } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: "getUserStats",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  // Read user achievements
  const { data: userAchievements, refetch: refetchAchievements } =
    useReadContract({
      address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
        .QuintyReputation as `0x${string}`,
      abi: REPUTATION_ABI,
      functionName: "getUserAchievements",
      args: address ? [address] : undefined,
      query: { enabled: isConnected && !!address },
    });

  // Read user's NFT balance
  const { data: nftBalance } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address },
  });

  // Watch for achievement updates
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    eventName: "AchievementUnlocked",
    onLogs() {
      refetchStats();
      refetchAchievements();
    },
  });

  // Load user profile data
  useEffect(() => {
    if (address && userStats && userAchievements) {
      const achievementsArray = userAchievements as any[];

      const stats = {
        bountiesCreated: Number(userStats.totalBountiesCreated || 0),
        submissions: Number(userStats.totalSubmissions || 0),
        wins: Number(userStats.totalWins || 0),
      };

      const achievements = {
        achievements: achievementsArray[0]
          ? achievementsArray[0].map((a: any) => Number(a))
          : [],
        tokenIds: achievementsArray[1]
          ? achievementsArray[1].map((t: any) => Number(t))
          : [],
      };

      setUserProfile({
        address,
        stats,
        achievements,
      });
      setLoading(false);
    }
  }, [address, userStats, userAchievements]);

  // Search for another user
  const searchUserProfile = async () => {
    if (!searchAddress.trim() || !isAddress(searchAddress)) {
      alert("Please enter a valid Ethereum address.");
      return;
    }

    try {
      const [statsData, achievementsData] = await Promise.all([
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
            .QuintyReputation as `0x${string}`,
          abi: REPUTATION_ABI,
          functionName: "getUserStats",
          args: [searchAddress as `0x${string}`],
        }),
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
            .QuintyReputation as `0x${string}`,
          abi: REPUTATION_ABI,
          functionName: "getUserAchievements",
          args: [searchAddress as `0x${string}`],
        }),
      ]);

      const stats = {
        bountiesCreated: Number(statsData.totalBountiesCreated || 0),
        submissions: Number(statsData.totalSubmissions || 0),
        wins: Number(statsData.totalWins || 0),
      };

      const achievementsArray = achievementsData as any[];
      const achievements = {
        achievements: achievementsArray[0]
          ? achievementsArray[0].map((a: any) => Number(a))
          : [],
        tokenIds: achievementsArray[1]
          ? achievementsArray[1].map((t: any) => Number(t))
          : [],
      };

      const searchedProfile: UserProfile = {
        address: searchAddress,
        stats,
        achievements,
      };

      setLeaderboard((prev) => {
        const filtered = prev.filter(
          (u) => u.address.toLowerCase() !== searchAddress.toLowerCase()
        );
        return [...filtered, searchedProfile].sort(
          (a, b) =>
            b.stats.wins +
            b.stats.bountiesCreated -
            (a.stats.wins + a.stats.bountiesCreated)
        );
      });
    } catch (error) {
      console.error("Error searching user:", error);
      alert("Could not find data for the given address.");
    }
  };

  // Helper functions
  const getAchievementBadge = (achievementType: number) => {
    const name =
      ACHIEVEMENT_NAMES[achievementType as keyof typeof ACHIEVEMENT_NAMES] ||
      "Unknown";
    const category =
      achievementType < 5
        ? "Solver"
        : achievementType < 10
        ? "Winner"
        : achievementType < 15
        ? "Creator"
        : "Season";

    const tier =
      achievementType < 15
        ? ACHIEVEMENT_MILESTONES[achievementType % 5]
        : "Monthly";

    return { name, category, tier };
  };

  const getProgressToNext = (
    current: number,
    type: "solver" | "winner" | "creator"
  ) => {
    const nextMilestone = ACHIEVEMENT_MILESTONES.find((m) => m > current);
    return nextMilestone ? nextMilestone - current : 0;
  };

  if (!isConnected) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-center mb-2">
              Connect Your Wallet
            </CardTitle>
            <CardDescription className="text-center">
              Please connect your wallet to view reputation data.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Quinty Reputation</h1>
        <p className="text-muted-foreground text-lg">
          Earn milestone-based NFT achievements for your contributions
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "leaderboard", label: "Leaderboard", icon: TrendingUp },
            { id: "achievements", label: "Guide", icon: Award },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={selectedTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedTab(tab.id as any)}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all"
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Profile Tab */}
      {selectedTab === "profile" && (
        <div className="space-y-6">
          {loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                <CardTitle className="mb-2">Loading Profile</CardTitle>
                <CardDescription>
                  Fetching your achievement data from the blockchain
                </CardDescription>
              </CardContent>
            </Card>
          )}

          {!loading && !userProfile && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Star className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="mb-2">Welcome to Quinty!</CardTitle>
                <CardDescription className="text-center max-w-md">
                  You haven't started your journey yet. Create bounties or
                  submit solutions to earn your first achievements!
                </CardDescription>
              </CardContent>
            </Card>
          )}

          {userProfile && (
            <div className="space-y-6">
              {/* Profile Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-lg font-semibold">
                        {userProfile.address.slice(2, 4).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-2xl">
                        {formatAddress(userProfile.address)}
                      </CardTitle>
                      <CardDescription>
                        {userProfile.achievements.achievements.length}{" "}
                        achievements earned
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Solutions Submitted
                    </CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {userProfile.stats.submissions}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        Next milestone:{" "}
                        {getProgressToNext(
                          userProfile.stats.submissions,
                          "solver"
                        )}{" "}
                        more
                      </p>
                    </div>
                    <Progress
                      value={(userProfile.stats.submissions % 10) * 10}
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Bounties Won
                    </CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {userProfile.stats.wins}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        Next milestone:{" "}
                        {getProgressToNext(userProfile.stats.wins, "winner")}{" "}
                        more
                      </p>
                    </div>
                    <Progress
                      value={(userProfile.stats.wins % 10) * 10}
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Bounties Created
                    </CardTitle>
                    <Medal className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {userProfile.stats.bountiesCreated}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        Next milestone:{" "}
                        {getProgressToNext(
                          userProfile.stats.bountiesCreated,
                          "creator"
                        )}{" "}
                        more
                      </p>
                    </div>
                    <Progress
                      value={(userProfile.stats.bountiesCreated % 10) * 10}
                      className="mt-2"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Achievements ({userProfile.achievements.achievements.length}
                    )
                  </CardTitle>
                  <CardDescription>
                    Milestone-based NFT badges for your contributions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userProfile.achievements.achievements.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userProfile.achievements.achievements.map(
                        (achievement, index) => {
                          const badge = getAchievementBadge(achievement);
                          const tokenId =
                            userProfile.achievements.tokenIds[index];
                          return (
                            <Card
                              key={achievement}
                              className="relative overflow-hidden"
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-gradient-to-r from-primary to-primary/60 rounded-lg flex items-center justify-center text-primary-foreground font-bold">
                                    {badge.category[0]}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold">
                                      {badge.name}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      {badge.category} • Level {badge.tier}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="text-xs mt-1"
                                    >
                                      NFT #{tokenId}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        }
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        No achievements yet
                      </h3>
                      <p className="text-muted-foreground">
                        Start participating to earn your first badge!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* NFT Integration */}
              <Card>
                <CardHeader>
                  <CardTitle>NFT Wallet Integration</CardTitle>
                  <CardDescription>
                    View your achievements in compatible wallets
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <span className="font-medium">NFT Balance</span>
                    <Badge variant="secondary" className="text-sm">
                      {Number(nftBalance || 0)} NFTs
                    </Badge>
                  </div>

                  <div className="space-y-3 text-sm">
                    <h4 className="font-medium">To view in MetaMask:</h4>
                    <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
                      <li>Go to NFTs tab → Import NFT</li>
                      <li>
                        Contract:{" "}
                        <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                          {
                            CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
                              .QuintyReputation
                          }
                        </code>
                      </li>
                      <li>
                        Token IDs:{" "}
                        {userProfile.achievements.tokenIds.join(", ") ||
                          "None yet"}
                      </li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {selectedTab === "leaderboard" && (
        <div className="space-y-6">
          {/* Search User */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search User Achievements
              </CardTitle>
              <CardDescription>
                Enter a wallet address to view achievements and add to
                leaderboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Enter wallet address (0x...)"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={searchUserProfile}
                  disabled={!searchAddress.trim()}
                  className="px-6"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Contributors
              </CardTitle>
              <CardDescription>
                Community leaderboard based on achievements and contributions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No users in leaderboard
                  </h3>
                  <p className="text-muted-foreground">
                    Search for users to build the leaderboard
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboard.map((user, index) => (
                    <div
                      key={user.address}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <Avatar>
                          <AvatarFallback>
                            {user.address.slice(2, 4).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">
                            {formatAddress(user.address)}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {user.achievements.achievements.length}{" "}
                              achievements
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg">
                          {user.stats.wins + user.stats.bountiesCreated}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.stats.bountiesCreated} Created •{" "}
                          {user.stats.wins} Won
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Achievement Guide Tab */}
      {selectedTab === "achievements" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievement Categories
              </CardTitle>
              <CardDescription>
                Learn about the different types of achievements and how to earn
                them
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Solver Achievements */}
                <Card className="border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                      <Target className="h-5 w-5" />
                      Solver Badges
                    </CardTitle>
                    <CardDescription>
                      Earned by submitting solutions to bounties
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ACHIEVEMENT_MILESTONES.map((milestone, index) => (
                      <div
                        key={milestone}
                        className="flex items-center justify-between p-2 rounded-md bg-blue-50"
                      >
                        <span className="text-sm font-medium">
                          Level {index + 1}
                        </span>
                        <Badge variant="outline" className="text-blue-600">
                          {milestone} submissions
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Winner Achievements */}
                <Card className="border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                      <Trophy className="h-5 w-5" />
                      Winner Badges
                    </CardTitle>
                    <CardDescription>
                      Earned by winning bounty competitions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ACHIEVEMENT_MILESTONES.map((milestone, index) => (
                      <div
                        key={milestone}
                        className="flex items-center justify-between p-2 rounded-md bg-green-50"
                      >
                        <span className="text-sm font-medium">
                          Level {index + 1}
                        </span>
                        <Badge variant="outline" className="text-green-600">
                          {milestone} wins
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Creator Achievements */}
                <Card className="border-purple-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-600">
                      <Medal className="h-5 w-5" />
                      Creator Badges
                    </CardTitle>
                    <CardDescription>
                      Earned by creating bounties for the community
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ACHIEVEMENT_MILESTONES.map((milestone, index) => (
                      <div
                        key={milestone}
                        className="flex items-center justify-between p-2 rounded-md bg-purple-50"
                      >
                        <span className="text-sm font-medium">
                          Level {index + 1}
                        </span>
                        <Badge variant="outline" className="text-purple-600">
                          {milestone} bounties
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* NFT Benefits */}
          <Card className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                NFT Achievement Benefits
              </CardTitle>
              <CardDescription>
                Why achievements matter in the Quinty ecosystem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Soulbound NFTs</h4>
                      <p className="text-sm text-muted-foreground">
                        Permanent, non-transferable reputation tokens that stay
                        with you forever
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Star className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Custom Artwork</h4>
                      <p className="text-sm text-muted-foreground">
                        Each achievement features unique IPFS-hosted images and
                        metadata
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Milestone-Based</h4>
                      <p className="text-sm text-muted-foreground">
                        Clear progression system with set targets to work
                        towards
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Wallet Integration</h4>
                      <p className="text-sm text-muted-foreground">
                        Visible in MetaMask and other NFT-compatible wallets
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Season Tracking</h4>
                      <p className="text-sm text-muted-foreground">
                        Monthly leaderboards and special seasonal achievements
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Medal className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Community Recognition</h4>
                      <p className="text-sm text-muted-foreground">
                        Showcase your contributions and build your reputation
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
