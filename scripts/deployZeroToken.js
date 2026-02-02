const { ethers } = require("hardhat");

/**
 * 
 * 部署 ZeroToken
 * 
 * 使用方法:
 * npx hardhat run scripts/deployZeroToken.js --network sepolia
 * 
 * 打印：
 * Deploying contracts with the account: 0x7779a76dEfb9F998c15463E286056E0aBE054180
 * Account balance: 183713370678994940
 * Deploying ZeroToken...
 * ZeroToken deployed to: 0xEAcfDAC9DC788a38Df4369a91adc3890D6478615
 * 
 */
async function main() {
  const [deployer] = await ethers.getSigners();
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
    console.error("Error deploying ZeroToken:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });