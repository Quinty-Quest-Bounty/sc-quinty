'use client';

import React from 'react';
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";
import { IpfsImage } from "../utils/ipfs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";
import { Calendar, Users, Send, Clock, Gift, Coins, User, Target } from "lucide-react";
import { cn } from "../lib/utils";

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
  resolved: boolean;
  cancelled: boolean;
  requirements: string;
  imageUrl?: string;
}

interface AirdropCardProps {
  airdrop: Airdrop;
  onShowSubmitModal: () => void;
}

export default function AirdropCard({ airdrop, onShowSubmitModal }: AirdropCardProps) {
  const progress = Math.min((airdrop.qualifiersCount / airdrop.maxQualifiers) * 100, 100);
  const isExpired = Date.now() / 1000 > airdrop.deadline;

  const getStatusColor = () => {
    if (airdrop.resolved) return "default";
    if (isExpired) return "destructive";
    if (airdrop.qualifiersCount >= airdrop.maxQualifiers) return "secondary";
    return "default";
  };

  const getStatusText = () => {
    if (airdrop.resolved) return "Completed";
    if (isExpired) return "Expired";
    if (airdrop.qualifiersCount >= airdrop.maxQualifiers) return "Full";
    return "Active";
  };

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
      {/* Status Badge */}
      <div className="absolute top-4 right-4 z-10">
        <Badge variant={getStatusColor()}>
          <Clock className="w-3 h-3 mr-1" />
          {getStatusText()}
        </Badge>
      </div>

      {/* Image Section */}
      {airdrop.imageUrl && (
        <div className="relative w-full h-48 overflow-hidden bg-muted">
          <IpfsImage
            cid={airdrop.imageUrl.replace('ipfs://', '')}
            alt={airdrop.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        </div>
      )}

      <CardHeader className="space-y-4">
        {/* Title and Description */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg leading-tight line-clamp-2">
                {airdrop.title}
              </CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {airdrop.description?.replace(/\n\nImage:.*$/, '') || "Social media promotion task"}
              </CardDescription>
            </div>
          </div>
        </div>

        {/* Creator Info */}
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {airdrop.creator.slice(2, 4).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            by {formatAddress(airdrop.creator)}
          </span>
        </div>

        <Separator />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Users className="h-3 w-3" />
              Participants
            </div>
            <div className="font-semibold">
              {airdrop.qualifiersCount} / {airdrop.maxQualifiers}
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Calendar className="h-3 w-3" />
              Deadline
            </div>
            <div className="font-semibold text-sm">
              {formatTimeLeft(BigInt(airdrop.deadline))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Reward Section */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
                {formatSTT(airdrop.perQualifier)}
              </span>
              <span className="text-sm font-medium text-green-600">STT</span>
            </div>
            <div className="text-xs text-muted-foreground">per qualifier</div>
          </div>

          {/* Action Button */}
          {!isExpired && !airdrop.resolved && airdrop.qualifiersCount < airdrop.maxQualifiers ? (
            <Button onClick={onShowSubmitModal} size="sm">
              <Send className="w-4 h-4 mr-2" />
              Submit Entry
            </Button>
          ) : (
            <Badge variant="outline" className="px-3 py-1">
              {getStatusText()}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
