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
  "FIRST_SOLVER", "ACTIVE_SOLVER", "SKILLED_SOLVER", "EXPERT_SOLVER", "LEGEND_SOLVER",
  "FIRST_WIN", "SKILLED_WINNER", "EXPERT_WINNER", "CHAMPION_WINNER", "LEGEND_WINNER",
  "FIRST_CREATOR", "ACTIVE_CREATOR", "SKILLED_CREATOR", "EXPERT_CREATOR", "LEGEND_CREATOR",
  "MONTHLY_CHAMPION", "MONTHLY_BUILDER"
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
  16: "Monthly Builder"
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
  const { data: userAchievements, refetch: refetchAchievements } = useReadContract({
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
        achievements: achievementsArray[0] ? achievementsArray[0].map((a: any) => Number(a)) : [],
        tokenIds: achievementsArray[1] ? achievementsArray[1].map((t: any) => Number(t)) : [],
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
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].QuintyReputation as `0x${string}`,
          abi: REPUTATION_ABI,
          functionName: "getUserStats",
          args: [searchAddress as `0x${string}`],
        }),
        readContract(wagmiConfig, {
          address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].QuintyReputation as `0x${string}`,
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

      const achievements = {
        achievements: achievementsArray[0] ? achievementsArray[0].map((a: any) => Number(a)) : [],
        tokenIds: achievementsArray[1] ? achievementsArray[1].map((t: any) => Number(t)) : [],
      };

      const searchedProfile: UserProfile = {
        address: searchAddress,
        stats,
        achievements,
      };

      setLeaderboard((prev) => {
        const filtered = prev.filter((u) => u.address.toLowerCase() !== searchAddress.toLowerCase());
        return [...filtered, searchedProfile].sort(
          (a, b) => (b.stats.wins + b.stats.bountiesCreated) - (a.stats.wins + a.stats.bountiesCreated)
        );
      });
    } catch (error) {
      console.error("Error searching user:", error);
      alert("Could not find data for the given address.");
    }
  };

  // Helper functions
  const getAchievementBadge = (achievementType: number) => {
    const name = ACHIEVEMENT_NAMES[achievementType as keyof typeof ACHIEVEMENT_NAMES] || "Unknown";
    const category = achievementType < 5 ? "Solver" :
                    achievementType < 10 ? "Winner" :
                    achievementType < 15 ? "Creator" : "Season";

    const tier = achievementType < 15 ?
      ACHIEVEMENT_MILESTONES[achievementType % 5] :
      "Monthly";

    return { name, category, tier };
  };

  const getProgressToNext = (current: number, type: "solver" | "winner" | "creator") => {
    const nextMilestone = ACHIEVEMENT_MILESTONES.find(m => m > current);
    return nextMilestone ? nextMilestone - current : 0;
  };

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">
          Please connect your wallet to view reputation data.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Quinty Achievement System
        </h2>
        <p className="text-gray-700">
          Earn milestone-based NFT achievements for your contributions to the Quinty ecosystem
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "profile", label: "My Profile" },
            { id: "leaderboard", label: "Leaderboard" },
            { id: "achievements", label: "Achievement Guide" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.id
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {selectedTab === "profile" && (
        <>
          {loading && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Profile...</h3>
              <p className="text-gray-600">Fetching your achievement data from the blockchain.</p>
            </div>
          )}

          {!loading && !userProfile && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">🆕</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Quinty!</h3>
              <p className="text-gray-600 mb-4">
                You haven't started your journey yet. Create bounties or submit solutions to earn your first achievements!
              </p>
            </div>
          )}

          {userProfile && (
            <div className="space-y-8">
              {/* Profile Header */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {formatAddress(userProfile.address)}
                </h3>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{userProfile.stats.submissions}</div>
                    <div className="text-sm text-blue-800">Solutions Submitted</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Progress to next: {getProgressToNext(userProfile.stats.submissions, "solver")} more
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{userProfile.stats.wins}</div>
                    <div className="text-sm text-green-800">Bounties Won</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Progress to next: {getProgressToNext(userProfile.stats.wins, "winner")} more
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{userProfile.stats.bountiesCreated}</div>
                    <div className="text-sm text-purple-800">Bounties Created</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Progress to next: {getProgressToNext(userProfile.stats.bountiesCreated, "creator")} more
                    </div>
                  </div>
                </div>

                {/* Achievements */}
                <div className="border-t pt-6">
                  <h4 className="text-lg font-semibold mb-4">
                    Achievements ({userProfile.achievements.achievements.length})
                  </h4>

                  {userProfile.achievements.achievements.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {userProfile.achievements.achievements.map((achievement, index) => {
                        const badge = getAchievementBadge(achievement);
                        const tokenId = userProfile.achievements.tokenIds[index];
                        return (
                          <div key={achievement} className="bg-gray-50 rounded-lg p-4 border">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-400 rounded-lg flex items-center justify-center text-white font-bold">
                                {badge.category[0]}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{badge.name}</div>
                                <div className="text-sm text-gray-600">{badge.category} • Level {badge.tier}</div>
                                <div className="text-xs text-gray-500">NFT #{tokenId}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">🏆</div>
                      <p>No achievements yet. Start participating to earn your first badge!</p>
                    </div>
                  )}
                </div>

                {/* NFT Info */}
                <div className="border-t pt-6 mt-6">
                  <h4 className="text-lg font-semibold mb-4">NFT Wallet Integration</h4>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">NFT Balance:</span>
                      <span className="text-blue-600 font-bold">{Number(nftBalance || 0)} NFTs</span>
                    </div>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p><strong>To view in MetaMask:</strong></p>
                      <p>1. Go to NFTs tab → Import NFT</p>
                      <p>2. Contract: <code className="bg-blue-100 px-1 rounded text-xs">{CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].QuintyReputation}</code></p>
                      <p>3. Token IDs: {userProfile.achievements.tokenIds.join(", ") || "None yet"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Leaderboard Tab */}
      {selectedTab === "leaderboard" && (
        <div className="space-y-6">
          {/* Search User */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Search User Achievements</h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter wallet address (0x...)"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
              />
              <button
                onClick={searchUserProfile}
                disabled={!searchAddress.trim()}
                className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                Search
              </button>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold">Top Contributors</h3>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Search for users to build the leaderboard
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {leaderboard.map((user, index) => (
                  <div key={user.address} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">
                          {formatAddress(user.address)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.achievements.achievements.length} achievements
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-lg text-gray-800">
                        {user.stats.wins + user.stats.bountiesCreated} Total
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.stats.bountiesCreated} Created • {user.stats.wins} Won
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Achievement Guide Tab */}
      {selectedTab === "achievements" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Achievement Categories</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Solver Achievements */}
              <div className="border border-blue-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-blue-600 mb-4">🔧 Solver Badges</h4>
                <div className="space-y-3">
                  {ACHIEVEMENT_MILESTONES.map((milestone, index) => (
                    <div key={milestone} className="flex justify-between">
                      <span className="text-sm">Level {index + 1}:</span>
                      <span className="text-sm font-medium">{milestone} submissions</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  Earned by submitting solutions to bounties
                </p>
              </div>

              {/* Winner Achievements */}
              <div className="border border-green-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-green-600 mb-4">🏆 Winner Badges</h4>
                <div className="space-y-3">
                  {ACHIEVEMENT_MILESTONES.map((milestone, index) => (
                    <div key={milestone} className="flex justify-between">
                      <span className="text-sm">Level {index + 1}:</span>
                      <span className="text-sm font-medium">{milestone} wins</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  Earned by winning bounty competitions
                </p>
              </div>

              {/* Creator Achievements */}
              <div className="border border-purple-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-purple-600 mb-4">💡 Creator Badges</h4>
                <div className="space-y-3">
                  {ACHIEVEMENT_MILESTONES.map((milestone, index) => (
                    <div key={milestone} className="flex justify-between">
                      <span className="text-sm">Level {index + 1}:</span>
                      <span className="text-sm font-medium">{milestone} bounties</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  Earned by creating bounties for the community
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">
                🎨 NFT Achievement Benefits
              </h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• <strong>Soulbound NFTs:</strong> Permanent, non-transferable reputation tokens</li>
                <li>• <strong>Custom Artwork:</strong> Each achievement has unique IPFS-hosted images</li>
                <li>• <strong>Wallet Integration:</strong> Visible in MetaMask and other NFT-compatible wallets</li>
                <li>• <strong>Milestone-Based:</strong> Clear progression system with set targets</li>
                <li>• <strong>Season Tracking:</strong> Monthly leaderboards and special seasonal achievements</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}