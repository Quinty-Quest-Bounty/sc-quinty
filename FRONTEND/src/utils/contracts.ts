// Contract addresses and ABIs for Quinty V2
import quintyABI from './abi/quinty.json';
import reputationABI from './abi/reputation.json';
import disputeABI from './abi/dispute.json';
import airdropABI from './abi/airdrop.json';

export const SOMNIA_TESTNET_ID = 50312;

export const CONTRACT_ADDRESSES = {
  [SOMNIA_TESTNET_ID]: {
    Quinty: "0xaADFD9B300114f72bd31d16Dd4D11Eb869EAb95d",
    QuintyReputation: "0xCADB86A9cE64301685aD9b829E69CBd72B4ad2d2",
    DisputeResolver: "0xEd442388D78B1107ecbed12DbDb175d4B64BcBe1",
    AirdropBounty: "0xef5fC4354B1108e49DfB17be8836A66C46D6420b"
  }
};

// Export ABIs from JSON files
export const QUINTY_ABI = quintyABI;
export const REPUTATION_ABI = reputationABI;
export const DISPUTE_ABI = disputeABI;
export const AIRDROP_ABI = airdropABI;

// Constants
export const MIN_VOTING_STAKE = "0.0001";