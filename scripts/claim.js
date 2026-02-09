const { ethers } = require("hardhat");

/**
 * 从 ZeroStake 合约领取质押奖励
 * 
 * 使用方法:
 * npx hardhat run scripts/claim.js --network sepolia
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
  
  try {
    console.log("Sending transaction...");
    
    // 要领取奖励的池ID（这里使用ETH池ID 0作为示例）
    const pid = 0; // ETH 池 ID
    
    // 获取池信息
    const poolInfo = await zeroStake.pool(pid);
    console.log("Pool info:");
    console.log("- Token address:", poolInfo.stTokenAddress);
    console.log("- Pool weight:", poolInfo.poolWeight.toString());
    
    // 获取用户的质押信息
    const userInfo = await zeroStake.userInfo(pid, deployer.address);
    console.log("\\nUser info for pool", pid, ":");
    console.log("- Amount staked:", ethers.formatEther(userInfo.amount), "tokens");
    console.log("- Reward debt:", userInfo.rewardDebt.toString());
    
    // 获取可领取的奖励金额
    const pendingRewards = await zeroStake.pendingZeroToken(pid, deployer.address);
    console.log("\\nPending rewards:", ethers.formatEther(pendingRewards), "ZeroTokens");
    
    if (pendingRewards === 0n) {
      console.log("\\nNo pending rewards to claim");
      return;
    }
    
    console.log("\\nClaiming rewards from pool:");
    console.log("- Pool ID:", pid);
    console.log("- Rewards amount:", ethers.formatEther(pendingRewards), "ZeroTokens");
    
    // 领取奖励交易
    const tx = await zeroStake.connect(deployer).claim(pid, {
      nonce: nonce,
      gasLimit: 500000,
    });
    
    console.log("\\nTransaction sent, hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    // 等待交易确认
    const receipt = await tx.wait(1);
    
    console.log("\\n=== Transaction Successful ===");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Block number:", receipt.blockNumber);
    
    // 等待状态更新
    await delay(3000);
    
    // 查询更新后的可领取奖励
    const updatedPendingRewards = await zeroStake.pendingZeroToken(pid, deployer.address);
    console.log("\\nUpdated pending rewards:", ethers.formatEther(updatedPendingRewards), "ZeroTokens");
    console.log("- Claim completed successfully!");
  } catch (error) {
    console.error("\\n=== Error ===");
    console.error(error.message);
    
    const msg = error.message;
    if (msg.includes("invalid pid")) console.log("\\nTip: Invalid pool ID");
    else if (msg.includes("claim paused")) console.log("\\nTip: Claiming is currently paused");
    else if (msg.includes("in-flight")) console.log("\\nTip: Wait 1-2 min or check https://sepolia.etherscan.io/address/" + deployer.address);
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });