const { ethers } = require("hardhat");

/**
 * 向质押合约转入 ZeroToken
 *
 * 使用方法:
 * npx hardhat run scripts/transferTokenToStake.js --network sepolia
 */
async function main() {
  const zeroStakeAddress = "0xd07E97a3BFD5Bd3b5756f1711CB1F60035C7Cb79";
  const zeroTokenAddress = "0xcf638f2bC90221Fd4CCdF659C3447311Af01e793";

  const [owner] = await ethers.getSigners();

  const nonce = await ethers.provider.getTransactionCount(owner.address, "latest");
  const pendingNonce = await ethers.provider.getTransactionCount(owner.address, "pending");

  console.log("Owner address:", owner.address);
  console.log("Current nonce:", nonce);
  console.log("Pending nonce:", pendingNonce);

  if (pendingNonce > nonce) {
    console.log("Warning: There are", pendingNonce - nonce, "pending transactions");
    return;
  }

  const zeroToken = await ethers.getContractAt("ZeroToken", zeroTokenAddress);

  try {
    // 查询当前余额
    const stakeBalance = await zeroToken.balanceOf(zeroStakeAddress);
    console.log("\n质押合约当前余额:", ethers.formatEther(stakeBalance), "ZeroToken");

    // 转入数量
    const amount = ethers.parseEther("10000");
    console.log("转入数量:", ethers.formatEther(amount), "ZeroToken");

    // 执行转账
    const tx = await zeroToken.transfer(zeroStakeAddress, amount, { nonce });
    console.log("\nTransaction sent, hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait(1);

    console.log("\n=== Transaction Successful ===");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Block number:", receipt.blockNumber);

    // 查询转入后余额
    const newStakeBalance = await zeroToken.balanceOf(zeroStakeAddress);
    console.log("\n质押合约新余额:", ethers.formatEther(newStakeBalance), "ZeroToken");

  } catch (error) {
    console.error("\n=== Error ===");
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