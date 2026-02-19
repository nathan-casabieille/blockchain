import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      accounts: PRIVATE_KEY ? [{ privateKey: PRIVATE_KEY, balance: "10000000000000000000000" }] : undefined,
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined,
    },
    sepolia: {
      url: SEPOLIA_RPC,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
      // Configuration EIP-1559 pour éviter les erreurs de prix
      // On définit des limites hautes pour être sûr que le mineur accepte
      maxFeePerGas: 50000000000,      // 50 gwei
      maxPriorityFeePerGas: 2000000000, // 2 gwei
    }
  },
};

export default config;
