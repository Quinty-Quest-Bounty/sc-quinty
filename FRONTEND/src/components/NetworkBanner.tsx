'use client';

import { useChainId } from 'wagmi';
import { SOMNIA_TESTNET_ID } from '../utils/contracts';
import { ensureSomniaNetwork } from '../utils/network';

export default function NetworkBanner() {
  const chainId = useChainId();
  const isOnSomnia = chainId === SOMNIA_TESTNET_ID;

  const handleSwitchNetwork = async () => {
    const success = await ensureSomniaNetwork();
    if (success) {
      // Force page refresh to update chain state
      window.location.reload();
    }
  };

  if (isOnSomnia) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-green-500">✅</span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-green-800">
              Connected to <strong>Somnia Testnet</strong> • All transactions will use <strong>STT tokens</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-yellow-500">⚠️</span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-800">
              <strong>Wrong Network:</strong> Please switch to Somnia Testnet to use Quinty features
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Current network does not support STT tokens
            </p>
          </div>
        </div>
        <button
          onClick={handleSwitchNetwork}
          className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm px-4 py-2 rounded-md font-medium"
        >
          Switch to Somnia
        </button>
      </div>
    </div>
  );
}