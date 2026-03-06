# sc-quinty

Smart contracts for the Quinty bounty and quest platform, deployed on Base Sepolia.

## Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| Quinty | `0x034cf0b72BcB1b529a2B0458275E0307CD6b5459` | Multi-winner bounty system with escrow |
| Quest | `0x86cc170e725784812A31F548c434e425bc0181B1` | Social quests with delegated verifiers |
| QuintyReputation | `0x3Fc6d21B3AC4E419a2bEe6BeB40E00FfF2bF1014` | Soulbound achievement badges |
| QuintyNFT | `0x6fcd78D8BB923E20B3C657C65f64A20a4a6b9884` | Badge NFTs (Creator/Solver/Team) |

**Chain:** Base Sepolia (84532) | **USDC:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Tech Stack

- Solidity 0.8.28
- Hardhat
- OpenZeppelin v5.4.0 (Ownable, ReentrancyGuard, Pausable, SafeERC20, ERC721)
- TypeScript tests and scripts

## Quick Start

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Key Scripts

```bash
npx hardhat run scripts/deploy.ts --network baseSepolia    # Deploy contracts
npx ts-node scripts/export-abis.ts                          # Export ABIs to exported-abis/
npx hardhat run scripts/setup-contracts.ts --network baseSepolia  # Post-deploy setup
```

## Environment Variables

```env
PRIVATE_KEY=your_deployer_private_key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_key
```

## Security Features

- Pull-based withdrawals (no push payments)
- ReentrancyGuard on all state-changing functions
- Pausable with owner-only emergency pause
- SafeERC20 for all token transfers
- Token whitelist for ERC-20 support
- Soulbound NFTs (transfer disabled)

## Full Documentation

[docs.quinty.io/smart-contracts](https://docs.quinty.io/smart-contracts)
