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
  
  // Add delay function
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Get the ZeroToken address from the stake contract
  const zeroTokenAddress = await zeroStake.ZeroToken();
  console.log("ZeroToken address in stake contract:", zeroTokenAddress);
  
  try {
    console.log("Sending transaction...");
    
    // Check if the deployer has ADMIN_ROLE
    const adminRole = await zeroStake.ADMIN_ROLE();
    const deployerIsAdmin = await zeroStake.hasRole(adminRole, deployer.address);
    
    // Also check DEFAULT_ADMIN_ROLE
    const defaultAdminRole = await zeroStake.DEFAULT_ADMIN_ROLE();
    const deployerIsDefaultAdmin = await zeroStake.hasRole(defaultAdminRole, deployer.address);
    
    console.log("Deployer is ADMIN_ROLE:", deployerIsAdmin);
    console.log("Deployer is DEFAULT_ADMIN_ROLE:", deployerIsDefaultAdmin);
    
    if (!deployerIsAdmin && !deployerIsDefaultAdmin) {
      console.log("Warning: Deployer does not have ADMIN_ROLE. This transaction might fail.");
    }
    
    // Send transaction with explicit nonce
    const tx = await zeroStake.connect(deployer).addPool(
      ethers.ZeroAddress,   // 质押代币的地址, 如果是第一个池，则必须是 0x0, 代表ETH池
      500,                  // 质押池的权重
      1000,                  // 最小存款金额, 如果是ETH, 单位wei
      2160,                 // 取消质押锁定的区块数
      true,                 // 是否批量更新所有池
      {
        nonce: nonce,
        gasLimit: 500000, // Explicitly set gas limit
      }
    );
    
    console.log("Transaction sent, hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    // Wait for transaction confirmation
    let receipt = await tx.wait(1); // Wait for 1 block confirmation
    
    console.log("Transaction successful! Gas used:", receipt.gasUsed.toString());
    console.log("Block number:", receipt.blockNumber);
    
    // Wait a bit more and then query, to ensure the state is updated
    await delay(3000);
    
    // Query the added pool
    const finalPoolLength = await zeroStake.poolLength();
    console.log("Current pool count:", finalPoolLength.toString());

  } catch (error) {
    console.error("错误详情:", error.message);
    
    if (error.message.includes("in-flight transaction limit")) {
      console.log("\n解决方案:");
      console.log("1. 等待 1-2 分钟让待处理的交易完成");
      console.log("2. 在 Etherscan 上检查你的地址是否有待处理交易: https://sepolia.etherscan.io/address/" + deployer.address);
      console.log("3. 考虑升级到付费的 Alchemy 计划以获得更高的速率限制");
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });