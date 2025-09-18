# Quinty DAO Frontend

A complete frontend implementation for the Quinty decentralized bounty system on Somnia Testnet.

## Features Implemented

### 🎯 Bounty Management
- **Create Bounties**: Post tasks with STT escrow, deadlines, and slash percentages
- **Submit Solutions**: Upload blinded IPFS submissions with 10% deposits
- **Select Winners**: Creators can choose winners and distribute rewards
- **Communication**: Threaded replies between creators and solvers
- **Solution Reveals**: Winners can reveal actual solutions post-resolution

### ⚖️ Dispute Resolution (Pengadilan DAO)
- **Expiry Voting**: Community votes on expired bounties to rank top submissions
- **Pengadilan Disputes**: Creators can dispute winner selections
- **Staking System**: 0.0001 STT minimum stakes for voting participation
- **Weighted Voting**: Higher stakes provide more voting power
- **Reward Distribution**: Proportional rewards for correct voters

### 🏆 Reputation System
- **Profile Display**: Comprehensive creator and solver statistics
- **NFT Badges**: View soulbound reputation tokens with levels
- **Leaderboards**: Compare performance with other users
- **Badge Requirements**: Bronze/Silver/Gold level progression system
- **Success Rates**: Track creation and solving performance metrics

### 🎁 Airdrop Bounties
- **Campaign Creation**: Set up promotion tasks with fixed STT rewards
- **Entry Submission**: Users submit social media proofs via IPFS
- **Verification System**: Community or creator verification of entries
- **Transparent Distribution**: First-come-first-served reward allocation
- **Progress Tracking**: Real-time campaign progress and qualification status

## Technical Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS for responsive design
- **Web3**: Wagmi v2 + RainbowKit for wallet connections
- **Network**: Somnia Testnet (Chain ID: 50312)
- **Contracts**: Direct integration with deployed smart contracts

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your WalletConnect Project ID
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Open Application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Smart Contract Integration

### Contract Addresses (Somnia Testnet)
- **Quinty Core**: `0x76FD733c7134BCeC5C1f80F1751E8Ac8b4a3DC0f`
- **QuintyReputation**: `0x43FED42239B2121e5e0fABdE3E99cf530CC3c4cC`
- **DisputeResolver**: `0xDc691A0c6a107AE7cf59F8c53A7B0f4f33427C75`
- **AirdropBounty**: `0xB265400F901Be063F00bF9BA62F5847200E26F94`

### Key Functions Implemented
- Bounty creation with escrow management
- Solution submission with IPFS integration
- Winner selection and reward distribution
- Dispute initiation and voting mechanisms
- Reputation tracking and NFT minting
- Airdrop campaign management

## Component Architecture

### Core Components
- **BountyManager**: Complete bounty lifecycle management
- **DisputeManager**: DAO voting and dispute resolution
- **ReputationDisplay**: User profiles and leaderboards
- **AirdropManager**: Promotion campaign system

### Utility Functions
- **contracts.ts**: ABI definitions and contract addresses
- **web3.ts**: Wagmi configuration and helper functions

## User Flows

### Creating a Bounty
1. Connect wallet to Somnia Testnet
2. Navigate to "Create Bounties" tab
3. Fill in description, amount, deadline, slash percentage
4. Submit transaction with full STT escrow
5. Monitor submissions and manage communications

### Participating in Disputes
1. View active disputes in "Disputes" section
2. Review submission details and requirements
3. Stake minimum 0.0001 STT to vote
4. Rank top 3 submissions in order of preference
5. Earn proportional rewards if vote aligns with majority

### Building Reputation
1. Create successful bounties to improve creator stats
2. Submit winning solutions to boost solver reputation
3. Maintain high success rates to earn NFT badges
4. View progress toward Bronze/Silver/Gold levels

### Airdrop Campaigns
1. Create promotion campaigns with fixed rewards
2. Specify social media requirements and verification
3. Users submit Twitter/X posts with IPFS proofs
4. Verify qualified entries and distribute rewards
5. Track campaign progress and completion

## Network Configuration

### Somnia Testnet Details
- **Chain ID**: 50312
- **RPC**: https://dream-rpc.somnia.network/
- **Currency**: STT (Somnia Test Token)
- **Explorer**: https://shannon-explorer.somnia.network

### Wallet Setup
1. Add Somnia Testnet to your wallet:
   - Network Name: Somnia Testnet
   - RPC URL: https://dream-rpc.somnia.network/
   - Chain ID: 50312
   - Currency Symbol: STT

2. Get test STT tokens from the Somnia faucet

## IPFS Integration

The application supports IPFS for:
- Blinded solution submissions
- Solution reveals after bounty resolution
- Airdrop social media proof uploads
- NFT metadata and badge images

For production use, integrate with:
- Pinata for reliable IPFS pinning
- Web3.Storage for decentralized uploads
- IPFS gateways for content retrieval

## Development Notes

### State Management
- Uses React hooks for local component state
- Wagmi provides Web3 state management
- Contract events trigger automatic updates

### Error Handling
- Comprehensive try-catch blocks for contract calls
- User-friendly error messages and transaction feedback
- Loading states for better UX

### Responsive Design
- Mobile-first approach with Tailwind CSS
- Collapsible navigation for mobile devices
- Touch-friendly interface elements

## Future Enhancements

### Near-term Improvements
- Real-time contract event monitoring
- Enhanced IPFS file upload interface
- Improved mobile responsiveness
- Better error handling and validation

### Advanced Features
- Oracle integration for automated verification
- Cross-chain compatibility
- Advanced reputation algorithms
- Governance token integration

## Contributing

This is a proof-of-concept implementation covering all core Quinty features. For production deployment:

1. Enhance error handling and edge cases
2. Add comprehensive testing suite
3. Implement proper IPFS file management
4. Add advanced UI/UX improvements
5. Integrate with production RPC endpoints

## License

Open source implementation for the Quinty DAO ecosystem on Somnia Testnet.