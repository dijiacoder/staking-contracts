// test/ZeroStake.test.js
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ZeroStake", function () {
  let zeroToken;
  let zeroStake;
  let owner;
  let user1;
  let user2;
  let addrs;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const ZERO_TOKEN_PER_BLOCK = ethers.parseEther("10");
  const ETH_PID = 0;

  beforeEach(async function () {
    [owner, user1, user2, ...addrs] = await ethers.getSigners();

    // 部署 ZeroToken
    const ZeroToken = await ethers.getContractFactory("ZeroToken");
    zeroToken = await ZeroToken.deploy();
    await zeroToken.waitForDeployment();

    // 获取当前区块号
    const currentBlock = await ethers.provider.getBlockNumber();
    const startBlock = currentBlock + 10;
    const endBlock = currentBlock + 1000;

    // 部署 ZeroStake 升级合约
    const ZeroStake = await ethers.getContractFactory("ZeroStake");
    zeroStake = await upgrades.deployProxy(ZeroStake, [
      zeroToken.target,
      startBlock,
      endBlock,
      ZERO_TOKEN_PER_BLOCK,
    ]);
    await zeroStake.waitForDeployment();

    // 向 ZeroStake 合约转入 ZeroToken
    await zeroToken.transfer(zeroStake.target, INITIAL_SUPPLY);

    // 添加 ETH 池
    await zeroStake.addPool(ethers.ZeroAddress, 1000, 0, 100, true);
  });

  describe("Deployment", function () {
    it("应该正确初始化合约参数", async function () {
      const poolLength = await zeroStake.poolLength();
      expect(poolLength).to.equal(1);

      const totalPoolWeight = await zeroStake.totalPoolWeight();
      expect(totalPoolWeight).to.equal(1000);
    });
  });

  describe("Deposit ETH", function () {
    it("用户应该能够存入 ETH", async function () {
      const depositAmount = ethers.parseEther("1");

      // 获取初始余额
      const initialBalance = await zeroStake.stakingBalance(ETH_PID, user1.address);
      expect(initialBalance).to.equal(0);

      // 存入 ETH
      await expect(
        zeroStake.connect(user1).depositETH({ value: depositAmount })
      ).to.emit(zeroStake, "Deposit");

      // 检查用户余额更新
      const updatedBalance = await zeroStake.stakingBalance(ETH_PID, user1.address);
      expect(updatedBalance).to.equal(depositAmount);

      // 检查池状态更新
      const poolInfo = await zeroStake.pool(ETH_PID);
      expect(poolInfo.stTokenAmount).to.equal(depositAmount);
    });

    it("存入金额小于最小值应该失败", async function () {
      const minDeposit = ethers.parseEther("1");
      
      // 设置最小存款金额
      await zeroStake.updatePool(ETH_PID, minDeposit, 100);

      // 尝试存入较小金额
      const smallAmount = ethers.parseEther("0.5");
      await expect(
        zeroStake.connect(user1).depositETH({ value: smallAmount })
      ).to.be.revertedWith("deposit amount is too small");
    });
  });

  describe("Pending Rewards", function () {
    it("应该正确计算待领取奖励", async function () {
      const depositAmount = ethers.parseEther("1");

      // 用户存入 ETH
      await zeroStake.connect(user1).depositETH({ value: depositAmount });

      // 挖矿几个区块
      await ethers.provider.send("hardhat_mine", ["0x64"]); // 挖 100 个区块（"0x64" = 100）

      // 查询待领取奖励
      const pendingReward = await zeroStake.pendingZeroToken(ETH_PID, user1.address);

      console.log("Pending reward:", ethers.formatEther(pendingReward), "ZeroToken");
      
      // 奖励应该大于 0
      expect(pendingReward).to.be.gt(0);
    });
  });

  describe("Claim Rewards", function () {
    it("用户应该能够领取奖励", async function () {
      const depositAmount = ethers.parseEther("1");

      // 用户存入 ETH
      await zeroStake.connect(user1).depositETH({ value: depositAmount });

      // 挖矿几个区块
      await ethers.provider.send("hardhat_mine", ["0x64"]);

      // 获取初始 ZeroToken 余额
      const initialBalance = await zeroToken.balanceOf(user1.address);

      // 领取奖励
      await expect(
        zeroStake.connect(user1).claim(ETH_PID)
      ).to.emit(zeroStake, "Claim");

      // 检查用户 ZeroToken 余额增加
      const finalBalance = await zeroToken.balanceOf(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Unstake", function () {
    it("用户应该能够请求取消质押", async function () {
      const depositAmount = ethers.parseEther("1");

      // 用户存入 ETH
      await zeroStake.connect(user1).depositETH({ value: depositAmount });

      // 请求取消质押
      await expect(
        zeroStake.connect(user1).unstake(ETH_PID, depositAmount)
      ).to.emit(zeroStake, "RequestUnstake");

      // 检查用户质押余额
      const balance = await zeroStake.stakingBalance(ETH_PID, user1.address);
      expect(balance).to.equal(0);
    });

    it("取消质押金额不能超过质押金额", async function () {
      const depositAmount = ethers.parseEther("1");
      const excessAmount = ethers.parseEther("2");

      // 用户存入 ETH
      await zeroStake.connect(user1).depositETH({ value: depositAmount });

      // 尝试取消超额质押
      await expect(
        zeroStake.connect(user1).unstake(ETH_PID, excessAmount)
      ).to.be.revertedWith("Not enough staking token balance");
    });
  });

  describe("Withdraw", function () {
    it("用户应该能够在解锁后提取本金", async function () {
      const depositAmount = ethers.parseEther("1");
      const unstakeLockBlocks = 100;

      // 用户存入 ETH
      await zeroStake.connect(user1).depositETH({ value: depositAmount });

      // 请求取消质押
      await zeroStake.connect(user1).unstake(ETH_PID, depositAmount);

      // 挖矿超过解锁期
      await ethers.provider.send("hardhat_mine", [
        "0x" + (unstakeLockBlocks + 10).toString(16),
      ]);

      // 获取初始 ETH 余额
      const initialBalance = await ethers.provider.getBalance(user1.address);

      // 提取本金
      const tx = await zeroStake.connect(user1).withdraw(ETH_PID);
      const receipt = await tx.wait();

      // 计算实际接收金额（扣除 gas）
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const finalBalance = await ethers.provider.getBalance(user1.address);

      // 检查用户接收到本金
      expect(finalBalance + gasUsed).to.equal(initialBalance + depositAmount);
    });

    it("未解锁期间不能提取", async function () {
      const depositAmount = ethers.parseEther("1");

      // 用户存入 ETH
      await zeroStake.connect(user1).depositETH({ value: depositAmount });

      // 请求取消质押
      await zeroStake.connect(user1).unstake(ETH_PID, depositAmount);

      // 尝试提取（应该成功但金额为0，因为还在锁定期）
      const tx = await zeroStake.connect(user1).withdraw(ETH_PID);
      const receipt = await tx.wait();
      
      // 检查事件中提取金额为0
      const withdrawEvent = receipt.logs.map(log => {
        try {
          return zeroStake.interface.parseLog(log);
        } catch {
          return null;
        }
      }).find(e => e && e.name === "Withdraw");

      expect(withdrawEvent.args.amount).to.equal(0);
    });
  });

  describe("Multiple Users", function () {
    it("多个用户应该能够独立操作", async function () {
      const depositAmount1 = ethers.parseEther("1");
      const depositAmount2 = ethers.parseEther("2");

      // user1 存入 1 ETH
      await zeroStake.connect(user1).depositETH({ value: depositAmount1 });

      // user2 存入 2 ETH
      await zeroStake.connect(user2).depositETH({ value: depositAmount2 });

      // 检查池总质押量
      const poolInfo = await zeroStake.pool(ETH_PID);
      expect(poolInfo.stTokenAmount).to.equal(depositAmount1 + depositAmount2);

      // 挖矿几个区块
      await ethers.provider.send("hardhat_mine", ["0x64"]);

      // 两个用户都有奖励
      const reward1 = await zeroStake.pendingZeroToken(ETH_PID, user1.address);
      const reward2 = await zeroStake.pendingZeroToken(ETH_PID, user2.address);

      expect(reward1).to.be.gt(0);
      expect(reward2).to.be.gt(0);

      // user2 的奖励应该更多（质押更多）
      expect(reward2).to.be.gt(reward1);
    });
  });

  describe("Add Pool", function () {
    it("管理员应该能够添加新池", async function () {
      const initialPoolLength = await zeroStake.poolLength();

      // 添加新池
      await expect(
        zeroStake.addPool(user1.address, 500, 0, 50, true)
      ).to.emit(zeroStake, "AddPool");

      const finalPoolLength = await zeroStake.poolLength();
      expect(finalPoolLength).to.equal(initialPoolLength + 1n)
    });

    it("非管理员不能添加新池", async function () {
      await expect(
        zeroStake.connect(user1).addPool(user1.address, 500, 0, 50, true)
      ).to.be.reverted;
    });
  });
});