const { ethers } = require("hardhat");

/**
 * 为 ZeroStake 合约添加新的质押池
 * 
 * 使用方法:
 * npx hardhat run scripts/addPool.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址
  const zeroStakeAddress = "0x915C4B26C6440e101066CF946f7eb6BF3784B77E";
  
  const zeroStake = await ethers.getContractAt("ZeroStake", zeroStakeAddress);

  const [deployer] = await ethers.getSigners();

  console.log("Deployer address:", deployer.address);
  
  const nonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  
  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);
  
  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }
  
  // 延时函数
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // 获取 ZeroToken 地址
  const zeroTokenAddress = await zeroStake.ZeroToken();
  console.log("ZeroToken address in stake contract:", zeroTokenAddress);
  
  try {
    console.log("Sending transaction...");
    
    // 检查部署者是否具有 ADMIN_ROLE
    const adminRole = await zeroStake.ADMIN_ROLE();
    const deployerIsAdmin = await zeroStake.hasRole(adminRole, deployer.address);
    
    // 检查 DEFAULT_ADMIN_ROLE
    const defaultAdminRole = await zeroStake.DEFAULT_ADMIN_ROLE();
    const deployerIsDefaultAdmin = await zeroStake.hasRole(defaultAdminRole, deployer.address);
    
    console.log("Deployer is ADMIN_ROLE:", deployerIsAdmin);
    console.log("Deployer is DEFAULT_ADMIN_ROLE:", deployerIsDefaultAdmin);
    
    if (!deployerIsAdmin && !deployerIsDefaultAdmin) {
      console.log("Warning: Deployer does not have ADMIN_ROLE. This transaction might fail.");
    }
    
    // 显示即将添加的池信息
    const currentPoolLength = await zeroStake.poolLength();
    console.log("\nAdding new pool:");
    console.log("- Pool index:", currentPoolLength.toString());
    console.log("- Staking token:", ethers.ZeroAddress, "(ETH pool)");
    console.log("- Pool weight:", 500);
    console.log("- Min deposit amount:", 1000, "wei");
    console.log("- Unstake locked blocks:", 2160);
    
    // 发送交易
    const tx = await zeroStake.connect(deployer).addPool(
      ethers.ZeroAddress,   // 质押代币地址 (0x0 = ETH池)
      500,                  // 质押池权重
      1000,                 // 最小存款金额 (wei)
      2160,                 // 取消质押锁定区块数
      true,                 // 是否批量更新池
      {
        nonce: nonce,
        gasLimit: 500000,
      }
    );
    
    console.log("\nTransaction sent, hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    // 等待交易确认
    const receipt = await tx.wait(1);
    
    console.log("\n=== Transaction Successful ===");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Block number:", receipt.blockNumber);
    
    // 等待状态更新
    await delay(3000);
    
    // 查询更新后的池数量
    const finalPoolLength = await zeroStake.poolLength();
    console.log("\nCurrent pool count:", finalPoolLength.toString());
    
    // 如果有新的池，显示其信息
    if (finalPoolLength > 0) {
      const newPool = await zeroStake.pool(finalPoolLength - 1n);
      console.log("\nNew pool details:");
      console.log("- Token address:", newPool.stTokenAddress);
      console.log("- Pool weight:", newPool.poolWeight.toString());
      console.log("- Min deposit:", newPool.minDepositAmount.toString(), "wei");
      console.log("- Locked blocks:", newPool.unstakeLockedBlocks.toString());
    }

  } catch (error) {
    console.error("\n=== Error ===");
    console.error(error.message);
    
    const msg = error.message;
    if (msg.includes("AccessControl")) console.log("\nTip: Grant ADMIN_ROLE to deployer address");
    else if (msg.includes("in-flight")) console.log("\nTip: Wait 1-2 min or check https://sepolia.etherscan.io/address/" + deployer.address);
    else if (msg.includes("invalid staking token")) console.log("\nTip: Use ethers.ZeroAddress for first ETH pool");
    else if (msg.includes("Already ended")) console.log("\nTip: Staking period ended, update endBlock in contract");
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });