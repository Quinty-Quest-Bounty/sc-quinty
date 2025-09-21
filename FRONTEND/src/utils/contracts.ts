// Contract addresses and ABIs for Quinty V2
import quintyABI from "./abi/quinty.json";
import reputationABI from "./abi/reputation.json";
import disputeABI from "./abi/dispute.json";
import airdropABI from "./abi/airdrop.json";

export const SOMNIA_TESTNET_ID = 50312;

export const CONTRACT_ADDRESSES = {
  [SOMNIA_TESTNET_ID]: {
    Quinty: "0x5110CE4c643923CA05f3c48aDb5a0f7718Ddfd15",
    QuintyReputation: "0x347B1EEE3Fb806EE1aF1D02Bd1781CF1523d8A3F",
    DisputeResolver: "0x25e505A0E77BAc255bEA230e2Ad1b93c1490d7F2",
    AirdropBounty: "0xaa00D6519d7bbECb27a5e0cF07dC5Bc0f75F46Df",
  },
};

// Export ABIs from JSON files
export const QUINTY_ABI = quintyABI;
export const REPUTATION_ABI = reputationABI;
export const DISPUTE_ABI = disputeABI;
export const AIRDROP_ABI = airdropABI;

// Constants
export const MIN_VOTING_STAKE = "0.0001";
