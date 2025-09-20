'use client';

import React from 'react';
import { formatSTT, formatTimeLeft, formatAddress } from "../utils/web3";
import { IpfsImage } from "../utils/ipfs";

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
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden transition-transform hover:scale-[1.02] duration-300">
      {airdrop.imageUrl && (
        <div className="w-full h-40 overflow-hidden">
          <IpfsImage
            cid={airdrop.imageUrl.replace('ipfs://', '')}
            alt={airdrop.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-6 flex flex-col flex-grow">
        <div className="flex-grow">
          <h4 className="text-lg font-bold text-gray-900 mb-1 truncate">{airdrop.title}</h4>
          <p className="text-sm text-gray-600 mb-4 line-clamp-2 h-[40px]">
            {airdrop.description?.replace(/\n\nImage:.*$/, '') || "Social media promotion task."}
          </p>

          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{airdrop.qualifiersCount} / {airdrop.maxQualifiers}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
            <div>
              <span className="text-gray-500">Creator:</span>
              <div className="font-medium text-gray-800">{formatAddress(airdrop.creator)}</div>
            </div>
            <div>
              <span className="text-gray-500">Deadline:</span>
              <div className="font-medium text-gray-800">{formatTimeLeft(BigInt(airdrop.deadline))}</div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
          <div className="text-left">
            <div className="text-xl font-bold text-green-600">{formatSTT(airdrop.perQualifier)} STT</div>
            <div className="text-xs text-gray-500">per qualifier</div>
          </div>
          {!isExpired && !airdrop.resolved && airdrop.qualifiersCount < airdrop.maxQualifiers ? (
            <button onClick={onShowSubmitModal} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Submit Entry
            </button>
          ) : (
            <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-semibold">
              {airdrop.resolved ? 'Ended' : isExpired ? 'Expired' : 'Full'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
