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

#### 部署到本地网络

```bash

# 仅部署代币合约
npx hardhat run scripts/deployZeroToken.js --network localhost
```

#### 部署到测试网

```bash
# 部署到 Sepolia 测试网
npx hardhat run scripts/deployZeroToken.js --network sepolia
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

## 配置说明

### Hardhat 配置

在 `hardhat.config.js` 中配置网络参数：

```javascript
module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: "YOUR_INFURA_URL",
      accounts: ["YOUR_PRIVATE_KEY"]
    }
  }
};
```

## 开发工具

- **Hardhat**: 以太坊开发环境
- **Ethers.js**: 与智能合约交互
- **Solidity**: 智能合约编程语言

## 常用命令

```bash
# 编译合约
npx hardhat compile

# 运行测试
npx hardhat test

# 启动本地节点
npx hardhat node

# 部署合约
npx hardhat run scripts/deploy.js

# 获取账户信息
npx hardhat accounts
```