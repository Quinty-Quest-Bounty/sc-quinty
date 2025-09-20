// Contract addresses and ABIs for Quinty V2
import quintyABI from "./abi/quinty.json";
import reputationABI from "./abi/reputation.json";
import disputeABI from "./abi/dispute.json";
import airdropABI from "./abi/airdrop.json";

export const SOMNIA_TESTNET_ID = 50312;

export const CONTRACT_ADDRESSES = {
  [SOMNIA_TESTNET_ID]: {
    Quinty: "0x6346E848150FEb4145C7207376603Ad07F45470B",
    QuintyReputation: "0x99f3B28E5B43B5B0222Da2398c8A8df18D090830",
    DisputeResolver: "0x0c9Ac987B575A8cED12A215749e5c212Ac8A874e",
    AirdropBounty: "0x180711d16f2CF583511F1846B5FF449ccC1e79fE",
  },
};

// Export ABIs from JSON files
export const QUINTY_ABI = quintyABI;
export const REPUTATION_ABI = reputationABI;
export const DISPUTE_ABI = disputeABI;
export const AIRDROP_ABI = airdropABI;

// Constants
export const MIN_VOTING_STAKE = "0.0001";
