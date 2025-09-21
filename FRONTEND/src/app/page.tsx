"use client";

import React, { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import BountyManager from "../components/BountyManager";
import DisputeManager from "../components/DisputeManager";
import ReputationDisplay from "../components/ReputationDisplay";
import AirdropManager from "../components/AirdropManager";
import NetworkBanner from "../components/NetworkBanner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Target,
  Scale,
  Trophy,
  Gift,
  Users,
  Code,
  Coins,
  Shield,
} from "lucide-react";

export default function Home() {
  const { isConnected } = useAccount();
  const [activeSection, setActiveSection] = useState<
    "bounties" | "disputes" | "reputation" | "airdrops"
  >("bounties");

  const navigationItems = [
    { id: "bounties", label: "Bounties", icon: Target },
    { id: "disputes", label: "Disputes", icon: Scale },
    { id: "reputation", label: "Reputation", icon: Trophy },
    { id: "airdrops", label: "Airdrops", icon: Gift },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                {/* <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <Target className="h-5 w-5 text-primary-foreground" />
                </div> */}
                <h1 className="text-xl font-bold tracking-tight">Quinty </h1>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex">
                <div className="flex items-center space-x-1">
                  {navigationItems.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveSection(item.id as any)}
                      className="flex items-center space-x-2"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  ))}
                </div>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2 py-3 overflow-x-auto">
            {navigationItems.map((item) => (
              <Button
                key={item.id}
                variant={activeSection === item.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSection(item.id as any)}
                className="flex-shrink-0 flex items-center space-x-2"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Network Banner */}
        {isConnected && <NetworkBanner />}

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              {/* Hero Section */}
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                    <Target className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                    Welcome to Quinty
                  </h1>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    A decentralized bounty platform with governance, reputation
                    NFTs, and transparent dispute resolution on Somnia Testnet.
                  </p>
                </div>
                <div className="pt-4">
                  <ConnectButton />
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
                <Card className="text-left">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <Target className="h-5 w-5 text-blue-600" />
                      </div>
                      <CardTitle>Create Bounties</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Post tasks with 100% STT escrow and blinded submissions
                      for secure, transparent project completion.
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card className="text-left">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                        <Scale className="h-5 w-5 text-green-600" />
                      </div>
                      <CardTitle> Disputes</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Community voting with staking mechanisms ensures fair
                      resolution of conflicts and disputes.
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card className="text-left">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                        <Trophy className="h-5 w-5 text-yellow-600" />
                      </div>
                      <CardTitle>NFT Reputation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Earn soulbound achievement badges that showcase your
                      successful participation and contributions.
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card className="text-left">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                        <Gift className="h-5 w-5 text-purple-600" />
                      </div>
                      <CardTitle>Airdrop Tasks</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Participate in transparent promotion campaigns with
                      verified rewards and community benefits.
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Section Content */}
            {activeSection === "bounties" && <BountyManager />}
            {activeSection === "disputes" && <DisputeManager />}
            {activeSection === "reputation" && <ReputationDisplay />}
            {activeSection === "airdrops" && <AirdropManager />}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                  <Target className="h-4 w-4 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Quinty </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Decentralized bounty system with transparent governance and
                reputation-based rewards on Somnia Testnet.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center space-x-2">
                  <Shield className="h-3 w-3" />
                  <span>100% STT Escrow</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Code className="h-3 w-3" />
                  <span>Blinded IPFS Submissions</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Users className="h-3 w-3" />
                  <span> Voting & Disputes</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Trophy className="h-3 w-3" />
                  <span>Soulbound NFT Badges</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Network</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Badge variant="outline" className="mr-2">
                    Somnia Testnet
                  </Badge>
                </li>
                <li>
                  <Badge variant="outline" className="mr-2">
                    Chain ID: 50312
                  </Badge>
                </li>
                <li className="flex items-center space-x-2">
                  <Coins className="h-3 w-3" />
                  <span>Native STT Token</span>
                </li>
                <li>Low-Cost Transactions</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Smart Contracts</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <div className="flex flex-col">
                    <span className="font-medium">Quinty</span>
                    <code className="text-xs">
                      0x5110CE4c643923CA05f3c48aDb5a0f7718Ddfd15
                    </code>
                  </div>
                </li>
                <li>
                  <div className="flex flex-col">
                    <span className="font-medium">Reputation</span>
                    <code className="text-xs">
                      0x347B1EEE3Fb806EE1aF1D02Bd1781CF1523d8A3F
                    </code>
                  </div>
                </li>
                <li>
                  <div className="flex flex-col">
                    <span className="font-medium">Disputes</span>
                    <code className="text-xs">
                      0x25e505A0E77BAc255bEA230e2Ad1b93c1490d7F2
                    </code>
                  </div>
                </li>
                <li>
                  <div className="flex flex-col">
                    <span className="font-medium">Airdrops</span>
                    <code className="text-xs">
                      0xaa00D6519d7bbECb27a5e0cF07dC5Bc0f75F46Df
                    </code>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <p className="text-sm text-muted-foreground">
              Built with ❤️ for the Somnia Testnet ecosystem
            </p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Open Source</span>
              <Separator orientation="vertical" className="h-4" />
              <span>Decentralized</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
