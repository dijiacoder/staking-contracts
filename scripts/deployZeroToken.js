const { ethers } = require("hardhat");

/**
 * 
 * 部署 ZeroToken
 * 
 * 使用方法:
 * npx hardhat run scripts/deployZeroToken.js --network sepolia
 * 
 * 打印：
 * 
 * ZeroToken deployed to: 0xcf638f2bC90221Fd4CCdF659C3447311Af01e793
 */
async function main() {
  const [owner] = await ethers.getSigners();

  const nonce = await ethers.provider.getTransactionCount(owner.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(owner.address, "pending");

  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }

  console.log("Deploying contracts with the account:", owner.address);
  console.log("Account balance:", (await owner.provider.getBalance(owner.address)).toString());

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