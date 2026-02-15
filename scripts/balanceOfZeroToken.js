const { ethers } = require("hardhat");

/**
 * 测试提取本金
 *
 * 使用方法:
 * npx hardhat run scripts/balanceOfZeroToken.js --network sepolia
 */
async function main() {
  // ZeroStake 合约地址
  const zeroTokenAddress = "0xcf638f2bC90221Fd4CCdF659C3447311Af01e793";
  const [owner,test02,test03] = await ethers.getSigners();

  console.log("user address:", test02.address);

  try {
    const zeroToken = await ethers.getContractAt("ZeroToken", zeroTokenAddress);
    
    const zeroTokenBalance1 = await zeroToken.balanceOf(owner.address);
    console.log("owner's ZeroToken 余额:", ethers.formatEther(zeroTokenBalance1), "ZeroToken");
    
    const zeroTokenBalance2 = await zeroToken.balanceOf(test02.address);
    console.log("test02's ZeroToken 余额:", ethers.formatEther(zeroTokenBalance2), "ZeroToken");
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
