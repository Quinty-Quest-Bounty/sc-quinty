# Quinty - On-Chain Bounty & Quest Platform

Smart contracts for a bounty and social quest system on Base network.

## Contracts

| Contract | Description |
|----------|-------------|
| **Quinty.sol** | Bounty system with 1% deposit, phase deadlines, and slash mechanism |
| **Quest.sol** | Social quest tasks with fixed ETH rewards per qualifier |
| **QuintyReputation.sol** | Soulbound ERC-721 achievement NFTs (milestones) |
| **QuintyNFT.sol** | Soulbound badge NFTs (creator/solver/team) |

## Deployed on Base Sepolia

| Contract | Address |
|----------|---------|
| Quinty | `0x034cf0b72BcB1b529a2B0458275E0307CD6b5459` |
| Quest | `0x86cc170e725784812A31F548c434e425bc0181B1` |
| QuintyReputation | `0x3Fc6d21B3AC4E419a2bEe6BeB40E00FfF2bF1014` |
| QuintyNFT | `0x6fcd78D8BB923E20B3C657C65f64A20a4a6b9884` |

## Development

```bash
npm install                  # Install dependencies
npx hardhat compile          # Compile contracts
npx hardhat test             # Run tests
npx hardhat run scripts/deploy.ts --network baseSepolia  # Deploy
npx ts-node scripts/export-abis.ts  # Export ABIs
```

## Environment Setup

```bash
cp .env.example .env
# Fill in PRIVATE_KEY and RPC URLs
```

See [CLAUDE.md](./CLAUDE.md) for full architecture documentation.
