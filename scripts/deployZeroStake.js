const { ethers, upgrades } = require("hardhat");

/**
 * 
 * 部署 ZeroStake 升级合约
 * 
 * 使用方法:
 * npx hardhat run scripts/deployZeroStake.js --network sepolia
 * 
 * 打印：
 * Deploying ZeroStake contract with the account: 0x248b56aa46fA791ef70a217FE2AE631049eF9472
 * ...
 * ZeroStake deployed to: 0xC9d008AA1Dee7467b203B7Eb2a0b5F5be0344706
 * 
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ZeroStake contract with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // ZeroToken 合约地址
  const zeroTokenAddress = "0x36d7166ba5D1e1576e3121E77F844547B80c4D30";
  
  // 质押起始区块高度,可以去sepolia上面读取最新的区块高度
  const startBlock = 10229064;
  
  // 质押结束的区块高度,sepolia 出块时间是12s,想要质押合约运行x秒,那么endBlock = startBlock + x/12
  const endBlock = 10229164;
  
  // 每个区块奖励的ZeroToken数量 (0.02 tokens per block)
  const rewardPerBlock = "20000000000000000";
  
  console.log("Deploying ZeroStake with parameters:");
  console.log("- ZeroToken address:", zeroTokenAddress);
  console.log("- Start block:", startBlock);
  console.log("- End block:", endBlock);
  console.log("- Reward per block:", rewardPerBlock);
  
  try {
    const ZeroStake = await ethers.getContractFactory("ZeroStake");
    console.log("Deploying ZeroStake proxy...");
    
    const zeroStake = await upgrades.deployProxy(
      ZeroStake,
      [zeroTokenAddress, startBlock, endBlock, rewardPerBlock],
      { initializer: "initialize" }
    );
    
    await zeroStake.waitForDeployment();
    
    const deployedAddress = await zeroStake.getAddress();
    console.log("ZeroStake deployed to:", deployedAddress);
    
    // 验证代理合约
    console.log("Verifying proxy implementation...");
    const implAddress = await upgrades.erc1967.getImplementationAddress(deployedAddress);
    console.log("Implementation address:", implAddress);
    
  } catch (error) {
    console.error("Error deploying ZeroStake:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });