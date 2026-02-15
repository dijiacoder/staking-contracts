const { ethers } = require("hardhat");

/**
 * 测试取消质押和提取流程
 * 
 * 使用方法:
 * npx hardhat run scripts/testUnstake.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址
  const zeroStakeAddress = "0x2Ca55714a7F649E3295458D0709B452139f43A1c";

  const zeroStake = await ethers.getContractAt("ZeroStake", zeroStakeAddress);

  const [owner,test02,test03] = await ethers.getSigners();

  const nonce = await ethers.provider.getTransactionCount(test02.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(test02.address, "pending");

  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions, please wait for them to complete.");
    console.log("Suggestion: Wait 1-2 minutes before running the script again");
    return;
  }

  console.log("=== 取消质押和提取测试 ===");
  console.log("User1:", test02.address);

  const ETH_PID = 0;
  const depositAmount = ethers.parseEther("0.001");
  const unstakeLockBlocks = 100;

  try {
    // 1. 用户存入 ETH
    console.log("1. 用户存入 ETH:", ethers.formatEther(depositAmount), "ETH");
    const tx1 = await zeroStake.connect(test02).depositETH({ value: depositAmount });
    await tx1.wait();
    console.log("   存款成功");

    // 检查质押余额
    let balance = await zeroStake.stakingBalance(ETH_PID, test02.address);
    console.log("   当前质押余额:", ethers.formatEther(balance), "ETH");

    // 2. 请求取消质押
    console.log("2. 请求取消质押...");
    const tx2 = await zeroStake.connect(test02).unstake(ETH_PID, depositAmount);
    await tx2.wait();
    console.log("   取消质押请求成功");

    // 检查质押余额
    balance = await zeroStake.stakingBalance(ETH_PID, test02.address);
    console.log("   当前质押余额:", ethers.formatEther(balance), "ETH");

    // 3. 检查提取请求
    console.log("3. 检查提取请求...");
    const [requestAmount, pendingWithdrawAmount] = await zeroStake.withdrawAmount(ETH_PID, test02.address);
    console.log("   请求总额:", ethers.formatEther(requestAmount), "ETH");
    console.log("   待提取金额:", ethers.formatEther(pendingWithdrawAmount), "ETH");

    // 4. 尝试立即提取（应该失败或金额为0）
    console.log("4. 尝试立即提取...");
    const beforeBalance = await ethers.provider.getBalance(test02.address);
    const tx3 = await zeroStake.connect(test02).withdraw(ETH_PID);
    const receipt = await tx3.wait();
    const afterBalance = await ethers.provider.getBalance(test02.address);
    
    // 计算实际收到的金额（扣除 gas）
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const received = afterBalance + gasUsed - beforeBalance;
    console.log("   提取金额:", ethers.formatEther(received), "ETH");

    // 5. 等待解锁（Sepolia网络需要等待真实区块）
    console.log("5. 等待解锁...（Sepolia网络需要等待）");
    console.log("   提示: 等待约2分钟后继续...");

    // 5. 挖矿超过解锁期
    console.log("5. 挖矿超过解锁期...");
    const mineBlocks = "0x" + (unstakeLockBlocks + 10).toString(16);
    await ethers.provider.send("hardhat_mine", [mineBlocks]);
    console.log("   挖矿完成");

    // 6. 再次检查提取请求
    console.log("6. 检查解锁后的提取请求...");
    const [requestAmount2, pendingWithdrawAmount2] = await zeroStake.withdrawAmount(ETH_PID, user1.address);
    console.log("   请求总额:", ethers.formatEther(requestAmount2), "ETH");
    console.log("   可提取金额:", ethers.formatEther(pendingWithdrawAmount2), "ETH");

    // 7. 提取本金
    console.log("7. 提取本金...");
    const beforeBalance2 = await ethers.provider.getBalance(user1.address);
    const tx4 = await zeroStake.connect(user1).withdraw(ETH_PID);
    const receipt2 = await tx4.wait();
    const afterBalance2 = await ethers.provider.getBalance(user1.address);
    
    const gasUsed2 = receipt2.gasUsed * receipt2.gasPrice;
    const received2 = afterBalance2 + gasUsed2 - beforeBalance2;
    console.log("   提取金额:", ethers.formatEther(received2), "ETH");

    // 8. 验证
    if (received2 >= depositAmount) {
      console.log("=== 测试通过: 取消质押和提取流程正常 ===");
    } else {
      console.log("=== 测试失败: 提取金额不正确 ===");
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