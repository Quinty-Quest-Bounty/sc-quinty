import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

// Define Somnia Testnet with proper chain structure
const somniaTestnetChain = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  network: "somnia-testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Somnia Test Token",
    symbol: "STT",
  },
  rpcUrls: {
    public: { http: ["https://dream-rpc.somnia.network/"] },
    default: { http: ["https://dream-rpc.somnia.network/"] },
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "Quinty ",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [somniaTestnetChain],
  transports: {
    [somniaTestnetChain.id]: http(),
  },
});

// Utility functions
export const formatSTT = (wei: bigint): string => {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
};

export const parseSTT = (stt: string): bigint => {
  return BigInt(Math.floor(parseFloat(stt) * 1e18));
};

export const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatTimeLeft = (deadline: bigint): string => {
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = Number(deadline) - now;

  if (timeLeft <= 0) return "Expired";

  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
