const { ethers } = require("hardhat");

/**
 * 测试提取本金
 *
 * 使用方法:
 * npx hardhat run scripts/testWithdraw.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址
  const zeroStakeAddress = "0x2Ca55714a7F649E3295458D0709B452139f43A1c";

  const zeroStake = await ethers.getContractAt("ZeroStake", zeroStakeAddress);

  const [owner, test02, test03] = await ethers.getSigners();

  const nonce = await ethers.provider.getTransactionCount(test02.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(test02.address, "pending");

  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }

  console.log("=== 提取本金测试 ===");
  console.log("User:", test02.address);

  const ETH_PID = 0;

  try {
    // 1. 检查提取请求
    console.log("1. 检查提取请求...");
    const [requestAmount, pendingWithdrawAmount] = await zeroStake.withdrawAmount(ETH_PID, test02.address);
    console.log("   请求总额:", ethers.formatEther(requestAmount), "ETH");
    console.log("   待提取金额:", ethers.formatEther(pendingWithdrawAmount), "ETH");

    if (pendingWithdrawAmount === 0n) {
      console.log("   提示: 没有可提取的金额，请先进行unstake操作");
      return;
    }

    // 2. 提取本金
    console.log("2. 提取本金...");
    const beforeBalance = await ethers.provider.getBalance(test02.address);
    const tx = await zeroStake.connect(test02).withdraw(ETH_PID);
    const receipt = await tx.wait();
    const afterBalance = await ethers.provider.getBalance(test02.address);

    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const received = afterBalance + gasUsed - beforeBalance;

    console.log("   交易hash:", tx.hash);
    console.log("   Gas used:", receipt.gasUsed.toString());
    console.log("   提取金额:", ethers.formatEther(received), "ETH");

    // 3. 验证
    if (received > 0n) {
      console.log("=== 测试通过: 提取成功 ===");
    } else {
      console.log("=== 测试失败: 提取金额为0 ===");
      process.exit(1);
    }

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
