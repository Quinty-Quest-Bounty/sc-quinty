'use client';

import React from "react";

interface NftBadgeProps {
  level: string;
  badgeType: "Creator" | "Solver";
}

const NftBadge: React.FC<NftBadgeProps> = ({ level, badgeType }) => {
  const levelColors = {
    Bronze: { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-700", shadow: "shadow-orange-200" },
    Silver: { bg: "bg-gray-100", border: "border-gray-400", text: "text-gray-700", shadow: "shadow-gray-300" },
    Gold: { bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-700", shadow: "shadow-yellow-200" },
    None: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-400", shadow: "shadow-gray-100" },
  };

  const badgeLevel = level && (level === "Bronze" || level === "Silver" || level === "Gold") ? level : "None";
  const colors = levelColors[badgeLevel];

  const Icon = () => badgeType === 'Creator' 
    ? <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.5 3.964z" /> // Pencil
    : <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />; // Shield

  return (
    <div className={`w-48 h-64 rounded-2xl border-4 ${colors.border} ${colors.bg} p-4 flex flex-col items-center justify-between shadow-lg ${colors.shadow} transform hover:scale-105 transition-transform`}>
      <div className={`font-bold text-lg ${colors.text}`}>{badgeLevel}</div>
      <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border-4 border-white shadow-inner">
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <Icon />
        </svg>
      </div>
      <div className={`font-semibold text-xl ${colors.text}`}>{badgeType}</div>
    </div>
  );
};

export default NftBadge;
