const { ethers } = require("hardhat");

/**
 * 从 ZeroStake 合约领取质押奖励
 *
 * 使用方法:
 * npx hardhat run scripts/testClaim.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址
  const zeroStakeAddress = "0xd07E97a3BFD5Bd3b5756f1711CB1F60035C7Cb79";
  
  const zeroStake = await ethers.getContractAt("ZeroStake", zeroStakeAddress);

  const [owner,test02,test03] = await ethers.getSigners();

  console.log("user address:", test02.address);
  
  const nonce = await ethers.provider.getTransactionCount(test02.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(test02.address, "pending");
  
  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);
  
  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }
  
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
    const userInfo = await zeroStake.user(pid, test02.address);
    console.log("User info for pool", pid, ":");
    console.log("- Amount staked:", ethers.formatEther(userInfo.stAmount), "ETH");
    console.log("- Finished ZeroToken:", userInfo.finishedZeroToken.toString());
    console.log("- Pending ZeroToken:", userInfo.pendingZeroToken.toString());
    
    // 获取可领取的奖励金额
    const pendingRewards = await zeroStake.pendingZeroToken(pid, test02.address);
    console.log("Pending rewards:", ethers.formatEther(pendingRewards), "ZeroTokens");
    
    if (pendingRewards === 0n) {
      console.log("No pending rewards to claim");
      return;
    }
    
    console.log("Claiming rewards from pool:");
    console.log("- Pool ID:", pid);
    console.log("- Rewards amount:", ethers.formatEther(pendingRewards), "ZeroTokens");
    
    // 领取奖励交易
    const tx = await zeroStake.connect(test02).claim(pid, {
      nonce: nonce,
      gasLimit: 500000,
    });
    
    console.log("Transaction sent, hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    // 等待交易确认
    const receipt = await tx.wait(1);
    
    console.log("=== Transaction Successful ===");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Block number:", receipt.blockNumber);
    
    // 查询更新后的可领取奖励
    const updatedPendingRewards = await zeroStake.pendingZeroToken(pid, test02.address);
    console.log("Updated pending rewards:", ethers.formatEther(updatedPendingRewards), "ZeroTokens");
    console.log("- Claim completed successfully!");

    // 查询正确的 ZeroToken 地址
    const zeroTokenAddress = await zeroStake.ZeroToken();
    console.log("Stake合约中的Token地址:", zeroTokenAddress);

    // 获取 ZeroToken 合约
    const zeroToken = await ethers.getContractAt("ZeroToken", zeroTokenAddress);

    // 查询质押合约余额
    const stakeBalance = await zeroToken.balanceOf(zeroStakeAddress);
    console.log("质押合约余额:", ethers.formatEther(stakeBalance));

    // 查询用户余额
    const userBalance = await zeroToken.balanceOf(test02.address);
    console.log("test02 余额:", ethers.formatEther(userBalance));
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