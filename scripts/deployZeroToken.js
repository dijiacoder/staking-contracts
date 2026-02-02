const { ethers } = require("hardhat");

/**
 * npx hardhat run scripts/deployZeroToken.js --network sepolia
 * 
 * Deploying contracts with the account: 0x248b56aa46fA791ef70a217FE2AE631049eF9472
 * Account balance: 183713370678994940
 * Deploying ZeroToken...
 * ZeroToken deployed to: 0x40Ccfb3A900EB744fCC5f810dD321E6Dc3010D74  
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