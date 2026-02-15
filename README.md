# Staking Contracts

基于 Solidity 的质押合约项目，包含代币合约和质押功能。

## 项目结构

```
staking-contracts/
├── contracts/
│   ├── ZeroToken.sol      # ERC20 代币合约
│   └── ZeroStake.sol      # 质押合约
├── scripts/
│   └── deployZeroToken.js # 代币部署脚本
├── test/
│   └── (测试文件)
├── hardhat.config.js      # Hardhat 配置
└── package.json
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 编译合约

```bash
npx hardhat compile
```

### 部署合约

```bash
# 部署代币合约
npx hardhat run scripts/deployZeroToken.js --network sepolia
```

```bash
# 部署质押合约
npx hardhat run scripts/deployZeroStake.js --network sepolia
```

### 运行测试

```bash
npx hardhat test
```

## 合约功能

### ZeroToken.sol
- 标准 ERC20 代币实现
- 可增发代币功能
- 支持代币转账和授权

### ZeroStake.sol
- 质押 ZeroToken 代币
- 支持多种质押期限
- 自动计算质押奖励
- 可提取质押本金和奖励

## 时序图

```mermaid
sequenceDiagram
    participant 管理员 as 管理员账户
    participant 用户 as 用户账户
    participant Token as ZeroToken
    participant Stake as ZeroStake合约
    participant Chain as 区块链

    Note over 管理员,Chain: 1. 部署阶段

    管理员->>Token: 部署 ZeroToken
    Token-->>Chain: Token 合约部署
    Token-->>管理员: 返回 Token 地址

    管理员->>Stake: 部署 ZeroStake (传入 Token 地址)
    Stake-->>Chain: 代理合约部署
    Stake-->>管理员: 返回 Stake 地址

    管理员->>Token: transfer(Stake, 奖励代币)
    Token-->>Stake: 转入奖励代币

    Note over 管理员,Chain: 2. 添加质押池

    管理员->>Stake: addPool()
    Stake-->>Chain: 创建池 #0 (ETH池)
    Stake->>管理员: AddPool 事件

    Note over 用户,Chain: 3. 用户存款

    用户->>Stake: depositETH({value: 1 ETH})
    Stake->>Stake: updatePool() 更新奖励
    Stake->>Stake: _deposit() 记录存款
    Stake-->>Chain: Deposit 事件
    Stake-->>用户: 交易确认

    Note over 用户,Chain: 4. 奖励累积 (等待区块)

    Chain->>Stake: 区块增加
    Note over Stake: pendingZeroToken = stAmount * accZeroTokenPerST

    Note over 用户,Chain: 5. 领取奖励

    用户->>Stake: claim(0)
    Stake->>Stake: updatePool() 更新奖励
    Stake->>Token: transfer(用户, 奖励)
    Stake-->>Chain: Claim 事件
    Stake-->>用户: 交易确认

    Note over 用户,Chain: 6. 取消质押

    用户->>Stake: unstake(0, 1 ETH)
    Stake->>Stake: 创建 UnstakeRequest
    Stake->>Stake: 设置 unlockBlock
    Stake-->>Chain: RequestUnstake 事件
    Stake-->>用户: 交易确认

    Note over 用户,Chain: 7. 等待解锁 (unstakeLockedBlocks)

    Chain->>Stake: 区块增加
    Note over Stake: block.number >= unlockBlock

    Note over 用户,Chain: 8. 提取本金

    用户->>Stake: withdraw(0)
    Stake->>Stake: 检查解锁状态
    Stake->>Stake: 删除已解锁请求
    Stake-->>用户: transfer(1 ETH)
    Stake-->>Chain: Withdraw 事件
    Stake-->>用户: 交易确认