# Quinty V3 Deployment Guide

## ✅ Completed Steps

1. **Updated Pragma** - All contracts use `^0.8.28` for VS Code compatibility
2. **Compiled Contracts** - All 13 contracts compiled successfully
3. **Built Frontend** - Single-page Quinty V3 app with Registry/Factory pattern integration

## 📋 Next Steps to Deploy

### Step 1: Fund Deployer Wallet

**Account**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
**Network**: Base Sepolia
**Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

**Required**: ~0.01 ETH for deployment

### Step 2: Deploy Contracts

```bash
cd /Users/askar/Documents/quinty/sc-quinty
npx hardhat run scripts/deploy.ts --network baseSepolia
```

This will:
- Deploy QuintyRegistry
- Deploy QuintyFactory
- Grant factory UPGRADER_ROLE
- Deploy all 9 core contracts via factory
- Setup all connections
- Save addresses to `deployments.json`

### Step 3: Update Frontend Config

After deployment, copy the registry address from terminal output and update:

**File**: `fe-quinty-v3/src/contracts/config.ts`
**Line 13**:
```typescript
export const QUINTY_REGISTRY_ADDRESS = "0x..."; // Paste deployed registry address
```

### Step 4: Test Frontend

```bash
cd fe-quinty-v3
npm run dev
```

Open http://localhost:5173 and:
1. Connect MetaMask (Base Sepolia)
2. Create a test bounty
3. Submit a solution
4. Verify contract interactions

## 🎯 Features Implemented

### Smart Contracts (Registry/Factory Pattern)
- ✅ QuintyRegistry - Central contract registry with versioning
- ✅ QuintyFactory - Automated deployment & registration
- ✅ Quinty - Core bounty contract
- ✅ QuintyNFT - Soulbound badges
- ✅ 5 funding contracts (GrantProgram, Crowdfunding, LookingForGrant, AirdropBounty, SocialVerification)

### Frontend (Single Page)
- ✅ MetaMask connection with auto network switch
- ✅ Registry pattern integration (query all addresses in 1 call)
- ✅ Browse bounties
- ✅ Create bounty form
- ✅ Submit solution form
- ✅ Auto-refresh on contract upgrades
- ✅ Protocol pause detection
- ✅ Responsive design

## 📁 File Structure

```
sc-quinty/
├── contracts/               # 13 Solidity contracts
├── scripts/deploy.ts        # Automated deployment script
├── fe-quinty-v3/
│   └── src/
│       ├── contracts/
│       │   ├── config.ts    # Contract configuration
│       │   └── abis.ts      # Contract ABIs
│       ├── hooks/
│       │   ├── useWallet.ts     # MetaMask connection
│       │   ├── useRegistry.ts   # Registry pattern
│       │   └── useQuinty.ts     # Bounty operations
│       ├── App.tsx          # Main UI
│       └── App.css          # Styles
```

## 🔄 Registry/Factory Benefits

**Before** (Old V2):
- Hardcode 9 contract addresses
- Manual updates on every deployment
- Frontend breaks on upgrades

**After** (New V3):
- Hardcode ONLY 1 address (Registry)
- Auto-discovery of all contracts
- Seamless upgrades via events
- Version tracking

**Frontend Integration**:
```typescript
// Query registry for ALL addresses in ONE call
const addresses = await registry.getAllContracts();

// Listen for upgrades
registry.on('ContractRegistered', () => {
  refreshContracts(); // Auto-update
});
```

## ⚠️ Important Notes

1. **Gas Warning**: QuintyFactory is 101KB (exceeds 24KB limit). This is fine for testnets but needs optimization for mainnet.

2. **Deployment Order**: The deploy script handles everything automatically via factory pattern.

3. **Contract Addresses**: After deployment, ONLY update the registry address in frontend config. All other addresses are fetched automatically.

4. **Testing**: Run `npx hardhat test` to verify all 240 tests pass before deployment.

## 🚀 Quick Deploy Command

After wallet is funded:

```bash
# Deploy contracts
npx hardhat run scripts/deploy.ts --network baseSepolia

# Copy registry address from output
# Update fe-quinty-v3/src/contracts/config.ts

# Start frontend
cd fe-quinty-v3 && npm run dev
```

Done! 🎉
