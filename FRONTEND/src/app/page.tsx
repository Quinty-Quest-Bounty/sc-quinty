'use client';

import React, { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import BountyManager from '../components/BountyManager';
import DisputeManager from '../components/DisputeManager';
import ReputationDisplay from '../components/ReputationDisplay';
import AirdropManager from '../components/AirdropManager';
import NetworkBanner from '../components/NetworkBanner';

export default function Home() {
  const { isConnected } = useAccount();
  const [activeSection, setActiveSection] = useState<'bounties' | 'disputes' | 'reputation' | 'airdrops'>('bounties');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary-600">Quinty DAO</h1>
              </div>
              <div className="hidden md:block ml-8">
                <div className="ml-10 flex items-baseline space-x-4">
                  {[
                    { id: 'bounties', label: 'Bounties', icon: '🎯' },
                    { id: 'disputes', label: 'Disputes', icon: '⚖️' },
                    { id: 'reputation', label: 'Reputation', icon: '🏆' },
                    { id: 'airdrops', label: 'Airdrops', icon: '🎁' }
                  ].map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id as any)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeSection === section.id
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="mr-2">{section.icon}</span>
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 py-3 overflow-x-auto">
            {[
              { id: 'bounties', label: 'Bounties', icon: '🎯' },
              { id: 'disputes', label: 'Disputes', icon: '⚖️' },
              { id: 'reputation', label: 'Reputation', icon: '🏆' },
              { id: 'airdrops', label: 'Airdrops', icon: '🎁' }
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={`flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Network Banner */}
        {isConnected && <NetworkBanner />}

        {!isConnected ? (
          <div className="text-center py-12">
            <div className="mx-auto max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">🎯</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Welcome to Quinty DAO
              </h2>
              <p className="text-lg text-gray-700 mb-8">
                A decentralized bounty platform with DAO governance, reputation NFTs, and transparent dispute resolution on Somnia Testnet.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl mb-2">🎯</div>
                    <h3 className="font-semibold mb-1 text-gray-800">Create Bounties</h3>
                    <p className="text-gray-700">Post tasks with 100% STT escrow and blinded submissions</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl mb-2">⚖️</div>
                    <h3 className="font-semibold mb-1 text-gray-800">DAO Disputes</h3>
                    <p className="text-gray-700">Community voting with staking for fair resolution</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl mb-2">🏆</div>
                    <h3 className="font-semibold mb-1 text-gray-800">NFT Reputation</h3>
                    <p className="text-gray-700">Earn soulbound badges for successful participation</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow">
                    <div className="text-2xl mb-2">🎁</div>
                    <h3 className="font-semibold mb-1 text-gray-800">Airdrop Tasks</h3>
                    <p className="text-gray-700">Transparent promotion campaigns with verified rewards</p>
                  </div>
                </div>
                <div className="pt-4">
                  <ConnectButton />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Network Status */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    Connected to <strong>Somnia Testnet</strong> • Chain ID: 50312 • Native Token: STT
                  </p>
                </div>
              </div>
            </div>

            {/* Active Section Content */}
            {activeSection === 'bounties' && <BountyManager />}
            {activeSection === 'disputes' && <DisputeManager />}
            {activeSection === 'reputation' && <ReputationDisplay />}
            {activeSection === 'airdrops' && <AirdropManager />}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Quinty DAO</h3>
              <p className="text-gray-700 text-sm">
                Decentralized bounty system with transparent governance and reputation-based rewards.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Features</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• 100% STT Escrow</li>
                <li>• Blinded IPFS Submissions</li>
                <li>• DAO Voting & Disputes</li>
                <li>• Soulbound NFT Badges</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Network</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Somnia Testnet</li>
                <li>• Chain ID: 50312</li>
                <li>• Native STT Token</li>
                <li>• Low-Cost Transactions</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Smart Contracts</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Quinty: 0x76FD...DC0f</li>
                <li>• Reputation: 0x43FE...C4cC</li>
                <li>• Disputes: 0xDc69...C75</li>
                <li>• Airdrops: 0xB265...6F94</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500">
              Built with ❤️ for the Somnia Testnet ecosystem. Open source and decentralized.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}