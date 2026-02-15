require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@openzeppelin/hardhat-upgrades");
require("solidity-coverage");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // 本地测试网络配置
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: process.env.RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID",
      accounts: [
        ...(process.env.PRIVATE_KEY_1 ? [process.env.PRIVATE_KEY_1] : []),
        ...(process.env.PRIVATE_KEY_2 ? [process.env.PRIVATE_KEY_2] : []),
        ...(process.env.PRIVATE_KEY_3 ? [process.env.PRIVATE_KEY_3] : [])
      ],
      gasPrice: 30000000000, // 30 Gwei
    },
  },
  etherscan: {
    // apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
