const { ethers } = require("hardhat");

/**
 * 
 * 部署 ZeroToken
 * 
 * 使用方法:
 * npx hardhat run scripts/deployZeroToken.js --network sepolia
 * 
 * 打印：
 * Deploying contracts with the account: 0x248b56aa46fA791ef70a217FE2AE631049eF9472
 * Account balance: 1293566960678994940
 * Deploying ZeroToken...
 * ZeroToken deployed to: 0x36d7166ba5D1e1576e3121E77F844547B80c4D30
 * 
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const nonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");

  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  try {
    const ZeroToken = await ethers.getContractFactory('ZeroToken');
    console.log("Deploying ZeroToken...");
    
    const zeroToken = await ZeroToken.deploy();
    await zeroToken.waitForDeployment();
    
    const zeroTokenAddress = await zeroToken.getAddress();
    console.log("ZeroToken deployed to:", zeroTokenAddress);

  } catch (error) {
    console.error("=== Error ===");
    console.error(error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });