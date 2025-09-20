import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    somniaTestnet: {
      url:
        process.env.SOMNIA_TESTNET_RPC || "https://dream-rpc.somnia.network/",
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : {
            mnemonic:
              "test test test test test test test test test test test junk",
            path: "m/44'/60'/0'/0",
            initialIndex: 0,
            count: 20,
          },
      chainId: 50312,
    },
  },
};

export default config;
