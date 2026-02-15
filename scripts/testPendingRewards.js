const { ethers } = require("hardhat");

/**
 * 测试待领取奖励计算
 * 
 * 使用方法:
 * npx hardhat run scripts/testPendingRewards.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址 - 需要替换为实际部署的地址
  const zeroStakeAddress = "YOUR_ZERO_STAKE_ADDRESS";
  const zeroTokenAddress = "YOUR_ZERO_TOKEN_ADDRESS";

  const zeroStake = await ethers.getContractAt("ZeroStake", zeroStakeAddress);
  const zeroToken = await ethers.getContractAt("ZeroToken", zeroTokenAddress);

  const [owner, user1, user2] = await ethers.getSigners();

  const nonce = await ethers.provider.getTransactionCount(user1.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(user1.address, "pending");

  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }

  console.log("=== 待领取奖励测试 ===");
  console.log("User1:", user1.address);

  const ETH_PID = 0;
  const depositAmount = ethers.parseEther("1");

  try {
    // 1. 用户存入 ETH
    console.log("1. 用户存入 ETH:", ethers.formatEther(depositAmount), "ETH");
    const tx1 = await zeroStake.connect(user1).depositETH({ value: depositAmount });
    await tx1.wait();
    console.log("   存款成功");

    // 2. 挖矿几个区块
    console.log("2. 挖矿 100 个区块...");
    await ethers.provider.send("hardhat_mine", ["0x64"]);
    console.log("   挖矿完成");

    // 3. 查询待领取奖励
    console.log("3. 查询待领取奖励...");
    const pendingReward = await zeroStake.pendingZeroToken(ETH_PID, user1.address);
    console.log("   待领取奖励:", ethers.formatEther(pendingReward), "ZeroToken");

    // 4. 验证奖励大于 0
    if (pendingReward > 0n) {
      console.log("=== 测试通过: 待领取奖励计算正确 ===");
    } else {
      console.log("=== 测试失败: 待领取奖励为 0 ===");
      process.exit(1);
    }

    // 5. 显示池信息
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