# Quinty Protocol Upgrade Guide

## Overview

The Quinty protocol uses a Registry/Factory pattern inspired by Aave, Synthetix, and Uniswap to enable seamless contract upgrades without breaking frontend integrations. This guide explains how to upgrade contracts, migrate state, and manage versioning.

## Architecture Summary

```
┌─────────────────────┐
│  QuintyRegistry     │ ← Central source of truth for all contract addresses
│  (Versioning)       │   - Tracks all versions of each contract type
│  (Access Control)   │   - Auto-deprecates old versions
└──────────┬──────────┘   - Emergency pause functionality
           │
           │ Queries latest versions
           │
┌──────────▼──────────┐
│  QuintyFactory      │ ← Deploys contracts and auto-registers them
│  (Deployment)       │   - Individual deploy functions
│  (Setup)            │   - Full ecosystem deployment
└─────────────────────┘   - Connection setup helpers
```

## Contract Versioning

### Version Lifecycle

1. **Active** - Latest version, returned by `getContract()`
2. **Deprecated** - Older version, still accessible via `getContractByVersion()`
3. **Upgraded** - When new version registered, old version auto-deprecated

### Version Tracking

```solidity
// Get latest version
address latest = registry.getContract(QUINTY);

// Get specific version
address v1 = registry.getContractByVersion(QUINTY, 1);
address v2 = registry.getContractByVersion(QUINTY, 2);

// Get all versions
address[] memory versions = registry.getAllVersions(QUINTY);

// Get version info
IQuintyRegistry.ContractInfo memory info = registry.getContractInfo(QUINTY);
// info.version, info.isActive, info.deployedAt, info.deprecatedAt
```

## Upgrading Individual Contracts

### Step 1: Deploy New Version

Use the factory to deploy the new version. The factory automatically registers it in the registry and deprecates the old version.

```bash
# Example: Upgrade Quinty contract to v2
```

```solidity
// Using factory (recommended)
await factory.deployQuinty(); // Deploys and registers v2, deprecates v1

// Or manually (advanced)
const QuintyV2 = await ethers.getContractFactory("QuintyV2");
const quintyV2 = await QuintyV2.deploy();
await quintyV2.waitForDeployment();
await registry.registerContract(QUINTY, await quintyV2.getAddress());
```

### Step 2: Setup Connections

If the new contract needs connections to other contracts, use the factory setup helpers or manually configure:

```solidity
// For core contracts
await factory.setupCoreConnections();

// For funding contracts
await factory.setupFundingConnections();

// Or manually
const quintyV2Address = await registry.getContract(QUINTY);
const reputationAddress = await registry.getContract(QUINTY_REPUTATION);
await quintyV2.setAddresses(reputationAddress, disputeAddress, nftAddress);
```

### Step 3: Migrate State (if needed)

If the new contract needs state from the old contract, implement a migration function:

```solidity
// Example migration function in QuintyV2
function migrateFromV1(address _v1Address) external onlyOwner {
    QuintyV1 oldContract = QuintyV1(_v1Address);

    // Migrate critical state
    uint256 oldBountyCount = oldContract.bountyCount();
    for (uint256 i = 1; i <= oldBountyCount; i++) {
        // Migrate bounty data
        // Note: This is gas-intensive, consider batch migration
    }
}
```

**Important**: State migration is complex and gas-intensive. Consider:
- Batch migration for large datasets
- Off-chain indexing and reconstruction
- Leaving old contract read-only for historical data
- Using proxy patterns for future upgrades

### Step 4: Frontend Update (Zero Downtime)

Frontend automatically uses the new version:

```javascript
// Frontend code (no changes needed!)
const addresses = await registry.getAllContracts();
const quinty = new ethers.Contract(addresses.quinty, QuintyABI, signer);
// Now uses v2 automatically
```

## Upgrading the Entire Ecosystem

### Option 1: Individual Upgrades (Recommended)

Upgrade contracts one at a time to minimize risk:

```solidity
// 1. Upgrade Quinty
await factory.deployQuinty();

// 2. Upgrade DisputeResolver
const newQuinty = await registry.getContract(QUINTY);
await factory.deployDisputeResolver(newQuinty);

// 3. Setup connections
await factory.setupCoreConnections();
```

### Option 2: Full Ecosystem Re-deployment (Advanced)

Deploy all contracts at once (creates v2 of everything):

```solidity
// Deploy all contracts (creates v2 of each)
await factory.deployFullEcosystem(
    "ipfs://QmNewReputationURI/",
    "ipfs://QmNewNFTURI/"
);

// Setup all connections
await factory.setupCoreConnections();
await factory.setupFundingConnections();
```

**Warning**: This creates new instances of ALL contracts. Use only if:
- Starting a new protocol season
- Implementing breaking changes across multiple contracts
- Testing in staging environment

## Rollback Procedures

### Quick Rollback (Manual Registry Update)

If a critical bug is found in the new version:

```solidity
// 1. Deprecate the buggy version
await registry.deprecateContract(QUINTY, 2); // Deprecate v2

// 2. Manually activate the old version (requires custom function)
// Note: Standard registry doesn't support re-activation
// Consider deploying old contract code as v3 instead

// Better approach: Redeploy old version as new version
await factory.deployQuinty(); // Deploy v3 with old code
```

### Emergency Pause

Pause the entire protocol while investigating:

```solidity
// Pause all protocol operations
await registry.setPaused(true);

// Frontend should check pause status
const isPaused = await registry.isPaused();
if (isPaused) {
    // Show maintenance message
}

// Unpause when ready
await registry.setPaused(false);
```

## Migration Patterns

### Pattern 1: Read-Only Old Contract

**Best for**: Preserving historical data

```solidity
// New contract reads from old contract
contract QuintyV2 {
    address public immutable quintyV1;

    function getBountyFromV1(uint256 bountyId) external view returns (BountyInfo memory) {
        return QuintyV1(quintyV1).getBountyInfo(bountyId);
    }
}
```

### Pattern 2: State Snapshot + Reconstruction

**Best for**: Large datasets, infrequent access

```solidity
// Off-chain indexer creates snapshot
// New contract reconstructs critical state only
contract QuintyV2 {
    mapping(address => uint256) public migratedReputation;

    function batchMigrateReputation(
        address[] calldata users,
        uint256[] calldata scores
    ) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            migratedReputation[users[i]] = scores[i];
        }
    }
}
```

### Pattern 3: Dual-Read Period

**Best for**: Gradual migration

```solidity
// New contract coexists with old contract
// Reads from old, writes to new
contract QuintyV2 {
    address public quintyV1;
    bool public migrationComplete;

    function getBountyInfo(uint256 bountyId) external view returns (BountyInfo memory) {
        if (!migrationComplete && bountyId <= oldBountyCount) {
            return QuintyV1(quintyV1).getBountyInfo(bountyId);
        }
        return bounties[bountyId];
    }
}
```

### Pattern 4: Proxy Upgrade (Future)

**Best for**: Transparent upgrades

Consider implementing UUPS or Transparent Proxy pattern for future upgrades:

```solidity
// Implementation contract
contract QuintyImplementation {
    // Logic here
}

// Proxy delegates to implementation
// Upgrades change implementation address
// Storage layout preserved
```

## Frontend Integration

### Getting Current Addresses

```javascript
// Single source of truth
const registry = new ethers.Contract(REGISTRY_ADDRESS, RegistryABI, provider);

// Get all current addresses
const addresses = await registry.getAllContracts();
console.log("Quinty:", addresses.quinty);
console.log("Reputation:", addresses.reputation);
// ...

// Or get specific contract
const quintyAddress = await registry.getContract(QUINTY_TYPE);
```

### Handling Upgrades

```javascript
// Listen for upgrade events
registry.on("ContractRegistered", (contractType, newAddress, version, oldAddress) => {
    console.log(`Contract upgraded from ${oldAddress} to ${newAddress}`);
    console.log(`New version: ${version}`);

    // Refresh contract instances
    refreshContracts();
});

// Refresh function
async function refreshContracts() {
    const addresses = await registry.getAllContracts();
    quintyContract = new ethers.Contract(addresses.quinty, QuintyABI, signer);
    // ... refresh other contracts
}
```

### Version Awareness

```javascript
// Display current version to users
const QUINTY = ethers.keccak256(ethers.toUtf8Bytes("QUINTY"));
const info = await registry.getContractInfo(QUINTY);
console.log(`Using Quinty v${info.version}`);
console.log(`Deployed: ${new Date(info.deployedAt * 1000).toISOString()}`);
```

## Security Considerations

### Access Control

```solidity
// Registry roles
DEFAULT_ADMIN_ROLE   // Can grant/revoke roles, deprecate contracts, pause protocol
UPGRADER_ROLE        // Can register new contract versions
PAUSER_ROLE          // Can pause/unpause protocol

// Factory ownership
onlyOwner            // Can deploy contracts, setup connections
```

### Best Practices

1. **Test Upgrades on Testnet First**
   ```bash
   npx hardhat run scripts/deploy.ts --network baseSepolia
   ```

2. **Gradual Rollout**
   - Deploy to testnet
   - Deploy to mainnet (creates new version)
   - Monitor for 24-48 hours
   - Keep old version accessible for rollback

3. **State Migration Validation**
   - Verify migrated state matches old contract
   - Use events to track migration progress
   - Implement migration checkpoints

4. **Frontend Compatibility**
   - Maintain ABI compatibility when possible
   - Use semantic versioning
   - Provide migration guides for breaking changes

5. **Multi-Sig for Upgrades**
   - Use Gnosis Safe or similar for production
   - Require multiple signers for upgrades
   - Time-lock critical operations

## Example Upgrade Scenarios

### Scenario 1: Bug Fix in Quinty

```solidity
// 1. Fix bug in contract code
// contracts/Quinty.sol (modify existing code)

// 2. Deploy new version
await factory.deployQuinty(); // v2 deployed, v1 deprecated

// 3. Setup connections (if needed)
await factory.setupCoreConnections();

// 4. No state migration needed (bug fix only)

// 5. Frontend automatically uses v2
```

### Scenario 2: New Feature in GrantProgram

```solidity
// 1. Add new feature to contract
// contracts/GrantProgram.sol (add new functions)

// 2. Deploy new version
await factory.deployGrantProgram(); // v2 deployed

// 3. Setup NFT connection
await factory.setupFundingConnections();

// 4. No state migration (new feature, old grants unaffected)

// 5. Frontend can use new feature immediately
```

### Scenario 3: Breaking Change with State Migration

```solidity
// 1. Implement QuintyV2 with new storage layout
// contracts/QuintyV2.sol

// 2. Deploy new version
await factory.deployQuinty();

// 3. Migrate critical state
const oldQuinty = await registry.getContractByVersion(QUINTY, 1);
const newQuinty = await registry.getContract(QUINTY);

// Batch migrate bounties
for (let i = 0; i < batchSize; i++) {
    await newQuinty.migrateBounties(oldQuinty, startId, endId);
}

// 4. Setup connections
await factory.setupCoreConnections();

// 5. Update frontend ABI and UI for breaking changes
```

## Monitoring and Alerts

### Contract Registry Events

```javascript
// Monitor all contract registrations
registry.on("ContractRegistered", (contractType, address, version, previousAddress) => {
    alert(`New contract version deployed: v${version}`);
});

// Monitor deprecations
registry.on("ContractDeprecated", (contractType, version, address) => {
    alert(`Contract v${version} deprecated`);
});

// Monitor pause state
registry.on("ProtocolPaused", (paused) => {
    if (paused) {
        alert("Protocol paused - maintenance mode");
    } else {
        alert("Protocol resumed - operations normal");
    }
});
```

### Health Checks

```javascript
// Verify all contracts are registered
async function healthCheck() {
    const addresses = await registry.getAllContracts();

    for (const [name, address] of Object.entries(addresses)) {
        if (address === ethers.ZeroAddress) {
            console.error(`${name} not deployed!`);
        } else {
            const version = await registry.getLatestVersion(getTypeId(name));
            console.log(`${name}: v${version} at ${address}`);
        }
    }
}
```

## Deployment Checklist

- [ ] Test new contract on local hardhat network
- [ ] Deploy to Base Sepolia testnet
- [ ] Verify contract on block explorer
- [ ] Test all functions on testnet
- [ ] Test migration (if applicable) on testnet
- [ ] Verify frontend integration on testnet
- [ ] Deploy to Base Mainnet
- [ ] Grant factory UPGRADER_ROLE
- [ ] Use factory to deploy/register contract
- [ ] Setup connections via factory helpers
- [ ] Verify registration in registry
- [ ] Test frontend with mainnet contract
- [ ] Monitor for 24-48 hours
- [ ] Update documentation

## Troubleshooting

### Issue: Transaction Reverted - AccessControlUnauthorizedAccount

**Cause**: Factory doesn't have UPGRADER_ROLE

**Solution**:
```solidity
const UPGRADER_ROLE = await registry.UPGRADER_ROLE();
await registry.grantRole(UPGRADER_ROLE, factoryAddress);
```

### Issue: Contract Not Found

**Cause**: Contract not registered in registry

**Solution**:
```solidity
// Check if contract is registered
const isActive = await registry.isActive(CONTRACT_TYPE);
if (!isActive) {
    // Register manually
    await registry.registerContract(CONTRACT_TYPE, contractAddress);
}
```

### Issue: Old Contract Still Being Used

**Cause**: Frontend caching old address

**Solution**:
```javascript
// Clear cache and refresh
localStorage.clear();
await refreshContracts();
```

### Issue: State Migration Failed

**Cause**: Gas limit exceeded or invalid state

**Solution**:
```solidity
// Use batch migration with smaller batches
const batchSize = 50; // Reduce if still failing
await migrateInBatches(startId, endId, batchSize);
```

## Additional Resources

- [Aave v3 Technical Paper](https://github.com/aave/aave-v3-core) - Registry pattern reference
- [OpenZeppelin Upgrades](https://docs.openzeppelin.com/upgrades-plugins) - Proxy upgrade patterns
- [Hardhat Upgrades](https://hardhat.org/hardhat-runner/docs/guides/deploying) - Deployment best practices

## Support

For questions or issues:
- Check [CONTRACT_FLOWS.md](./CONTRACT_FLOWS.md) for contract interaction details
- Review [CLAUDE.md](./CLAUDE.md) for development patterns
- See [README.md](./README.md) for project overview
