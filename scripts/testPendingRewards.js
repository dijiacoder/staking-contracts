const { ethers } = require("hardhat");

/**
 * 测试待领取奖励计算
 * 
 * 使用方法:
 * npx hardhat run scripts/testPendingRewards.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址
  const zeroStakeAddress = "0x2Ca55714a7F649E3295458D0709B452139f43A1c";

  const zeroStake = await ethers.getContractAt("ZeroStake", zeroStakeAddress);

  const [deployer,test02,test03] = await ethers.getSigners();

  const nonce = await ethers.provider.getTransactionCount(test02.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(test02.address, "pending");

  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }

  console.log("=== 待领取奖励测试 ===");
  console.log("User Test02:", test02.address);

  const ETH_PID = 0;
  const depositAmount = ethers.parseEther("1");

  try {
    // 1. 查询待领取奖励
    console.log("1. 查询待领取奖励...");
    const pendingReward = await zeroStake.pendingZeroToken(ETH_PID, test02.address);
    console.log("   待领取奖励:", ethers.formatEther(pendingReward), "ZeroToken");

    // 2. 验证奖励大于 0
    if (pendingReward > 0n) {
      console.log("=== 测试通过: 待领取奖励计算正确 ===");
    } else {
      console.log("=== 测试失败: 待领取奖励为 0 ===");
      process.exit(1);
    }

    // 3. 显示池信息
    console.log("池信息:");
    const poolInfo = await zeroStake.pool(ETH_PID);
    console.log("   stTokenAmount:", ethers.formatEther(poolInfo.stTokenAmount), "ETH");
    console.log("   poolWeight:", poolInfo.poolWeight.toString());
    console.log("   lastRewardBlock:", poolInfo.lastRewardBlock.toString());

  } catch (error) {
    console.error("=== 测试失败 ===");
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