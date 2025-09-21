'use client';

import React from 'react';
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";
import { IpfsImage } from "../utils/ipfs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Users, Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
      {airdrop.imageUrl && (
        <div className="relative w-full h-40 overflow-hidden">
          <IpfsImage
            cid={airdrop.imageUrl.replace('ipfs://', '')}
            alt={airdrop.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute top-4 right-4">
            <Badge variant={isExpired ? "outline" : "default"} className="backdrop-blur-sm bg-white/90">
              <Clock className="w-3 h-3 mr-1" />
              {isExpired ? 'Expired' : airdrop.resolved ? 'Ended' : 'Active'}
            </Badge>
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="space-y-2">
          <CardTitle className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent line-clamp-1">
            {airdrop.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-2 h-[40px] leading-relaxed">
            {airdrop.description?.replace(/\n\nImage:.*$/, '') || "Social media promotion task."}
          </p>
        </div>

        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              Progress
            </span>
            <span className="font-medium">{airdrop.qualifiersCount} / {airdrop.maxQualifiers}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <span className="text-muted-foreground">Creator:</span>
            <div className="font-medium text-foreground truncate">{formatAddress(airdrop.creator)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Deadline:
            </span>
            <div className="font-medium text-foreground">{formatTimeLeft(BigInt(airdrop.deadline))}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-100">
          <div className="text-left">
            <div className="text-xl font-bold text-emerald-600">{formatSTT(airdrop.perQualifier)} STT</div>
            <div className="text-xs text-muted-foreground">per qualifier</div>
          </div>
          {!isExpired && !airdrop.resolved && airdrop.qualifiersCount < airdrop.maxQualifiers ? (
            <Button
              onClick={onShowSubmitModal}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Entry
            </Button>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                "px-4 py-2 text-sm font-semibold",
                airdrop.resolved && "bg-gray-100 text-gray-500",
                isExpired && "bg-red-50 text-red-600",
                airdrop.qualifiersCount >= airdrop.maxQualifiers && "bg-blue-50 text-blue-600"
              )}
            >
              {airdrop.resolved ? 'Ended' : isExpired ? 'Expired' : 'Full'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
