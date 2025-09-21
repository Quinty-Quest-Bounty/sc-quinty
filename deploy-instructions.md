# Quinty Smart Contracts - Deployment Instructions

## Prerequisites

1. **Get STT tokens for Somnia Testnet**

   - Visit the Somnia Testnet faucet to get test STT tokens
   - You'll need STT for gas fees on deployment

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` file and add:

   - `PRIVATE_KEY`: Your wallet private key (without 0x prefix)
   - `SOMNIA_TESTNET_RPC`: RPC URL for Somnia Testnet (default: https://dream-rpc.somnia.network/)

## Deployment Commands

### Test deployment locally first:

```bash
npx hardhat run scripts/deploy.ts --network hardhat
```

### Deploy to Somnia Testnet:

```bash
npx hardhat run scripts/deploy.ts --network somniaTestnet
```

## Deployed Contracts

The deployment script will deploy 4 contracts in order:

1. **QuintyReputation** - Soulbound NFT reputation system
2. **DisputeResolver** - voting for disputes
3. **Quinty** - Core bounty management contract
4. **AirdropBounty** - Transparent promotion tasks

After deployment, the script automatically:

- Sets contract interconnections
- Transfers QuintyReputation ownership to Quinty contract
- Saves deployment info to `deployments.json`

## Network Configuration

- **Chain ID**: 50312
- **Native Token**: STT (Somnia Test Token)
- **RPC URL**: https://dream-rpc.somnia.network/
- **Compiler**: Solidity 0.8.28 with IR optimization

## Security Notes

- Never commit your `.env` file
- Keep your private key secure
- Test on local network before mainnet deployment
- Verify contracts on block explorer after deployment
