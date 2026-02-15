const { ethers } = require("hardhat");

/**
 * 向 ZeroStake 合约存入 ETH
 *
 * 使用方法:
 * npx hardhat run scripts/testDepositETH.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址
  const zeroStakeAddress = "0xd07E97a3BFD5Bd3b5756f1711CB1F60035C7Cb79";
  
  const zeroStake = await ethers.getContractAt("ZeroStake", zeroStakeAddress);

  const [owner,test02,test03] = await ethers.getSigners();

  console.log("user(test02) address:", test02.address);
  
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
    
    // 获取 ETH 池信息
    const ethPoolInfo = await zeroStake.pool(0); // ETH_PID is 0
    console.log("ETH pool info:");
    console.log("- Token address:", ethPoolInfo.stTokenAddress);
    console.log("- Pool weight:", ethPoolInfo.poolWeight.toString());
    console.log("- Min deposit amount:", ethPoolInfo.minDepositAmount.toString(), "wei");
    console.log("- Current staked amount:", ethPoolInfo.stTokenAmount.toString(), "wei");
    console.log("- Last reward block:", ethPoolInfo.lastRewardBlock.toString());
    console.log("- Acc ZeroToken per ST:", ethPoolInfo.accZeroTokenPerST.toString());
    console.log("- Unstake locked blocks:", ethPoolInfo.unstakeLockedBlocks.toString());
    
    // 检查最小存款金额
    const minDeposit = ethPoolInfo.minDepositAmount;
    const depositAmount = minDeposit > 0 ? minDeposit : ethers.parseEther("0.01"); // 使用最小存款金额或0.001 ETH
    
    console.log("Depositing ETH:");
    console.log("- Amount:", ethers.formatEther(depositAmount), "ETH");
    console.log("- Pool ID: 0 (ETH pool)");
    
    // 存款交易
    const tx = await zeroStake.connect(test02).depositETH({
      value: depositAmount,
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
    
    // 查询更新后的池信息
    const updatedEthPoolInfo = await zeroStake.pool(0);
    console.log("Updated ETH pool info:");
    console.log("- Current staked amount:", updatedEthPoolInfo.stTokenAmount.toString(), "wei");
        
    // 查询用户信息
    const userInfo = await zeroStake.user(0, test02.address);
    console.log("User info after deposit:");
    console.log("- Staked amount:", ethers.formatEther(userInfo.stAmount), "ETH");
    console.log("- Finished ZeroToken:", userInfo.finishedZeroToken.toString());
    console.log("- Pending ZeroToken:", userInfo.pendingZeroToken.toString());
        
    console.log("- Deposited successfully!");
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