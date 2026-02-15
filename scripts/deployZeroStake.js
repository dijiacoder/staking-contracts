const { ethers, upgrades } = require("hardhat");

/**
 * 
 * 部署 ZeroStake 升级合约
 * 
 * 使用方法:
 * npx hardhat run scripts/deployZeroStake.js --network sepolia
 * 
 * 打印：
 * ...
 * ZeroStake deployed to: 0x2Ca55714a7F649E3295458D0709B452139f43A1c
 * ...
 * 
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

  console.log("Deploying ZeroStake contract with the account:", owner.address);
  console.log("Account balance:", (await owner.provider.getBalance(owner.address)).toString());

  // ZeroToken 合约地址
  const zeroTokenAddress = "0x36d7166ba5D1e1576e3121E77F844547B80c4D30";
  
  // 质押起始区块高度,可以去sepolia上面读取最新的区块高度
  const startBlock = 10263823;
  
  // 质押结束的区块高度,sepolia 出块时间是12s,想要质押合约运行x秒,那么endBlock = startBlock + x/12
  const endBlock = 10265823;
  
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