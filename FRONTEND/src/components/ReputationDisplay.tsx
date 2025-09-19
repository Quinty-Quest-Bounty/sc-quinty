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

interface UserReputation {
  bountiesCreated: number;
  successfulBounties: number;
  creationSuccessRate: number;
  firstBountyTimestamp: number;
  solvesAttempted: number;
  successfulSolves: number;
  solveSuccessRate: number;
  totalSolvedCount: number;
  tokenId: number;
  level: string;
  hasCreatorBadge: boolean;
  hasSolverBadge: boolean;
}

interface UserStats {
  address: string;
  reputation: UserReputation;
  hasNFT: boolean;
  tokenURI: string;
}

export default function ReputationDisplay() {
  const { address, isConnected } = useAccount();

  // State
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserStats[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    "profile" | "leaderboard" | "badges"
  >("profile");
  const [searchAddress, setSearchAddress] = useState("");

  // Read user's reputation
  const { data: reputation, refetch: refetchReputation } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: "getUserReputation",
    args: address ? [address] : undefined,
    query: { enabled: isConnected },
  });

  // Read user's NFT balance
  const { data: nftBalance } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected },
  });

  // Read token URI if user has NFT
  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    functionName: "tokenURI",
    args: userStats?.reputation.tokenId
      ? [BigInt(userStats.reputation.tokenId)]
      : undefined,
    query: { enabled: !!userStats?.reputation.tokenId && userStats.reputation.tokenId > 0 },
  });

  // Watch for reputation updates
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    eventName: "ReputationUpdated",
    onLogs() {
      refetchReputation();
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID]
      .QuintyReputation as `0x${string}`,
    abi: REPUTATION_ABI,
    eventName: "BadgeMintedOrUpgraded",
    onLogs() {
      refetchReputation();
    },
  });

  // Load user stats
  useEffect(() => {
    if (address && reputation && nftBalance !== undefined) {
      const repData = reputation as any[];
      const userRep: UserReputation = {
        bountiesCreated: Number(repData[0]),
        successfulBounties: Number(repData[1]),
        creationSuccessRate: Number(repData[2]),
        firstBountyTimestamp: Number(repData[3]),
        solvesAttempted: Number(repData[4]),
        successfulSolves: Number(repData[5]),
        solveSuccessRate: Number(repData[6]),
        totalSolvedCount: Number(repData[7]),
        tokenId: Number(repData[8]),
        level: repData[9] as string,
        hasCreatorBadge: repData[10] as boolean,
        hasSolverBadge: repData[11] as boolean,
      };

      setUserStats({
        address,
        reputation: userRep,
        hasNFT: Number(nftBalance) > 0,
        tokenURI: (tokenURI as string) || "",
      });
    }
  }, [address, reputation, nftBalance, tokenURI]);

  // Search for another user's reputation
  const searchUserReputation = async () => {
    if (!searchAddress.trim() || !isAddress(searchAddress)) {
        alert("Please enter a valid Ethereum address.");
        return;
    }

    try {
        const repData = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].QuintyReputation as `0x${string}`,
            abi: REPUTATION_ABI,
            functionName: "getUserReputation",
            args: [searchAddress as `0x${string}`],
        });

        const nftBalance = await readContract(wagmiConfig, {
            address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].QuintyReputation as `0x${string}`,
            abi: REPUTATION_ABI,
            functionName: "balanceOf",
            args: [searchAddress as `0x${string}`],
        });

        if (repData) {
            const repArray = repData as any[];
            const searchedRep: UserReputation = {
                bountiesCreated: Number(repArray[0]),
                successfulBounties: Number(repArray[1]),
                creationSuccessRate: Number(repArray[2]),
                firstBountyTimestamp: Number(repArray[3]),
                solvesAttempted: Number(repArray[4]),
                successfulSolves: Number(repArray[5]),
                solveSuccessRate: Number(repArray[6]),
                totalSolvedCount: Number(repArray[7]),
                tokenId: Number(repArray[8]),
                level: repArray[9] as string,
                hasCreatorBadge: repArray[10] as boolean,
                hasSolverBadge: repArray[11] as boolean,
            };

            let tokenURI = "";
            if (searchedRep.tokenId > 0) {
                tokenURI = await readContract(wagmiConfig, {
                    address: CONTRACT_ADDRESSES[SOMNIA_TESTNET_ID].QuintyReputation as `0x${string}`,
                    abi: REPUTATION_ABI,
                    functionName: "tokenURI",
                    args: [BigInt(searchedRep.tokenId)],
                }) as string;
            }

            const searchedStats: UserStats = {
                address: searchAddress,
                reputation: searchedRep,
                hasNFT: Number(nftBalance) > 0,
                tokenURI: tokenURI as string,
            };

            setLeaderboard((prev) => {
                const filtered = prev.filter((u) => u.address.toLowerCase() !== searchAddress.toLowerCase());
                return [...filtered, searchedStats].sort(
                    (a, b) =>
                        (b.reputation.successfulBounties + b.reputation.successfulSolves) -
                        (a.reputation.successfulBounties + a.reputation.successfulSolves)
                );
            });
        }
    } catch (error) {
        console.error("Error searching user:", error);
        alert("Could not find reputation for the given address.");
    }
  };

  // Get level color
  const getLevelColor = (level: string) => {
    switch (level) {
      case "Gold":
        return "text-yellow-600 bg-yellow-100";
      case "Silver":
        return "text-gray-600 bg-gray-100";
      case "Bronze":
        return "text-orange-600 bg-orange-100";
      default:
        return "text-gray-500 bg-gray-50";
    }
  };

  // Get level requirements
  const getLevelRequirements = () => [
    { level: "Bronze", rate: 50, actions: 5, color: "orange" },
    { level: "Silver", rate: 80, actions: 20, color: "gray" },
    { level: "Gold", rate: 95, actions: 50, color: "yellow" },
  ];

  // Format timestamp
  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Format success rate
  const formatSuccessRate = (rate: number) => {
    return (rate / 100).toFixed(1) + "%";
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
          Quinty Reputation System
        </h2>
        <p className="text-gray-700">
          Build your reputation through successful bounties and earn NFT badges
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "profile", label: "My Profile" },
            { id: "leaderboard", label: "Leaderboard" },
            { id: "badges", label: "Badge System" },
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
      {selectedTab === "profile" && userStats && (
        <div className="space-y-6">
          {/* User Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-600">
                    {userStats.reputation.level
                      ? userStats.reputation.level[0]
                      : "?"}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {formatAddress(userStats.address)}
                  </h3>
                  {userStats.reputation.level && (
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(
                        userStats.reputation.level
                      )}`}
                    >
                      {userStats.reputation.level} Level
                    </span>
                  )}
                </div>
              </div>
              {userStats.hasNFT && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">NFT Badge</div>
                  <div className="text-lg font-semibold">
                    #{userStats.reputation.tokenId}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reputation Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Creator Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Creator Stats
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bounties Created:</span>
                  <span className="font-medium">
                    {userStats.reputation.bountiesCreated}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Successful:</span>
                  <span className="font-medium">
                    {userStats.reputation.successfulBounties}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Rate:</span>
                  <span className="font-medium">
                    {formatSuccessRate(
                      userStats.reputation.creationSuccessRate
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Since:</span>
                  <span className="font-medium text-sm">
                    {formatDate(userStats.reputation.firstBountyTimestamp)}
                  </span>
                </div>
              </div>
            </div>

            {/* Solver Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Solver Stats
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Attempts:</span>
                  <span className="font-medium">
                    {userStats.reputation.solvesAttempted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Successful:</span>
                  <span className="font-medium">
                    {userStats.reputation.successfulSolves}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Rate:</span>
                  <span className="font-medium">
                    {formatSuccessRate(userStats.reputation.solveSuccessRate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Solved:</span>
                  <span className="font-medium">
                    {userStats.reputation.totalSolvedCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Overall Performance */}
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Overall
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Activity:</span>
                  <span className="font-medium">
                    {userStats.reputation.bountiesCreated +
                      userStats.reputation.solvesAttempted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Success:</span>
                  <span className="font-medium">
                    {userStats.reputation.successfulBounties +
                      userStats.reputation.successfulSolves}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Overall Rate:</span>
                  <span className="font-medium">
                    {userStats.reputation.bountiesCreated +
                      userStats.reputation.solvesAttempted >
                    0
                      ? formatSuccessRate(
                          ((userStats.reputation.successfulBounties +
                            userStats.reputation.successfulSolves) /
                            (userStats.reputation.bountiesCreated +
                              userStats.reputation.solvesAttempted)) *
                            10000
                        )
                      : "0%"}
                  </span>
                </div>
              </div>
            </div>

            {/* NFT Badge */}
            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                NFT Badge
              </h4>
              {userStats.hasNFT ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Token ID:</span>
                    <span className="font-medium">
                      #{userStats.reputation.tokenId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Level:</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(
                        userStats.reputation.level
                      )}`}
                    >
                      {userStats.reputation.level}
                    </span>
                  </div>
                  {userStats.tokenURI && (
                    <div className="text-xs text-gray-500 break-all">
                      URI: {userStats.tokenURI}
                    </div>
                  )}
                  <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Badge Preview</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <div className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-sm">No Badge Yet</span>
                  </div>
                  <p className="text-xs">
                    Complete more bounties to earn your first NFT badge!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Tab */}
      {selectedTab === "leaderboard" && (
        <div className="space-y-6">
          {/* Search User */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">
              Search User Reputation
            </h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter wallet address (0x...)"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
              />
              <button
                onClick={searchUserReputation}
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
              <h3 className="text-xl font-semibold">Top Performers</h3>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                Search for users to build the leaderboard
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {leaderboard.map((user, index) => (
                  <div
                    key={user.address}
                    className="p-6 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-600">
                          #{index + 1}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {formatAddress(user.address)}
                        </div>
                        {user.reputation.level && (
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(
                              user.reputation.level
                            )}`}
                          >
                            {user.reputation.level}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {user.reputation.successfulBounties +
                          user.reputation.successfulSolves}{" "}
                        successes
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.reputation.bountiesCreated}C /{" "}
                        {user.reputation.successfulSolves}S
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Badge System Tab */}
      {selectedTab === "badges" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">
              Badge Level Requirements
            </h3>
            <p className="text-gray-700 mb-6">
              Earn NFT badges by maintaining high success rates and completing
              bounties. Badges are soulbound and represent your permanent
              reputation in the Quinty ecosystem.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {getLevelRequirements().map((req) => (
                <div
                  key={req.level}
                  className="border border-gray-200 rounded-lg p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4
                      className={`text-lg font-semibold text-${req.color}-600`}
                    >
                      {req.level} Badge
                    </h4>
                    <div
                      className={`w-12 h-12 bg-${req.color}-100 rounded-full flex items-center justify-center`}
                    >
                      <span
                        className={`text-lg font-bold text-${req.color}-600`}
                      >
                        {req.level[0]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min Success Rate:</span>
                      <span className="font-medium">{req.rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min Actions:</span>
                      <span className="font-medium">{req.actions}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <div className="text-sm text-gray-700">
                      Requirements apply to both creator and solver activities.
                      Maintain {req.rate}% success rate with at least{" "}
                      {req.actions} completed actions.
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Badge Benefits */}
            <div className="mt-8 p-6 bg-blue-50 rounded-lg">
              <h4 className="text-lg font-semibold text-blue-800 mb-3">
                Badge Benefits
              </h4>
              <ul className="space-y-2 text-sm text-blue-700">
                <li>
                  • <strong>Visual Recognition:</strong> Display your
                  achievements with unique NFT artwork
                </li>
                <li>
                  • <strong>Trust Building:</strong> Higher-tier badges increase
                  credibility with collaborators
                </li>
                <li>
                  • <strong>Future Utility:</strong> Badges may unlock exclusive
                  features, discounts, or access
                </li>
                <li>
                  • <strong>Permanent Record:</strong> Soulbound tokens create
                  an immutable reputation history
                </li>
                <li>
                  • <strong>Cross-Platform:</strong> Reputation can be verified
                  across other DeFi platforms
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
