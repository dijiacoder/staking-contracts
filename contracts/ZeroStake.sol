// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract ZeroStake is
    Initializable,
    UUPSUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    using SafeERC20 for IERC20;
    using Address for address;
    using Math for uint256;

    // ************************************** INVARIANT **************************************

    bytes32 public constant ADMIN_ROLE = keccak256("admin_role");
    bytes32 public constant UPGRADE_ROLE = keccak256("upgrade_role");

    uint256 public constant ETH_PID = 0;

    // ************************************** DATA STRUCTURE **************************************
    /*
    Basically, any point in time, the amount of ZeroTokens entitled to a user but is pending to be distributed is:

    pending ZeroToken = (user.stAmount * pool.accZeroTokenPerST) - user.finishedZeroToken

    Whenever a user deposits or withdraws staking tokens to a pool. Here's what happens:
    1. The pool's `accZeroTokenPerST` (and `lastRewardBlock`) gets updated.
    2. User receives the pending ZeroToken sent to his/her address.
    3. User's `stAmount` gets updated.
    4. User's `finishedZeroToken` gets updated.
    */
    struct Pool {
        // Address of staking token
        // 质押代币的地址
        address stTokenAddress;
        // Weight of pool
        // 不同资金池所占的权重
        uint256 poolWeight;
        // Last block number that ZeroTokens distribution occurs for pool
        // 池最后一次分配奖励的区块号
        uint256 lastRewardBlock;
        // Accumulated ZeroTokens per staking token of pool
        // 质押 1个ETH经过1个区块高度，能拿到 n 个ZeroToken
        uint256 accZeroTokenPerST;
        // Staking token amount
        // 质押的代币数量
        uint256 stTokenAmount;
        // Min staking amount
        // 最小质押数量
        uint256 minDepositAmount;
        // Withdraw locked blocks
        // Unstake locked blocks 解质押锁定的区块高度
        uint256 unstakeLockedBlocks;
    }

    struct UnstakeRequest {
        // Request withdraw amount
        uint256 amount; // 用户取消质押的代币数量，要取出多少个 token
        // The blocks when the request withdraw amount can be released
        uint256 unlockBlocks; // 解质押的区块高度
    }

    struct User {
        // 记录用户相对每个资金池 的质押记录
        // Staking token amount that user provided
        // 用户在当前资金池，质押的代币数量
        uint256 stAmount;
        // Finished distributed ZeroTokens to user 最终 ZeroToken 得到的数量
        // 用户在当前资金池，已经领取的 ZeroToken 数量
        uint256 finishedZeroToken;
        // Pending to claim ZeroTokens 当前可取数量
        // 用户在当前资金池，当前可领取的 ZeroToken 数量
        uint256 pendingZeroToken;
        // Withdraw request list
        // 用户在当前资金池，取消质押的记录
        UnstakeRequest[] requests;
    }

    // ************************************** STATE VARIABLES **************************************
    // First block that ZeroTokenStake will start from
    uint256 public startBlock; // 质押开始区块高度
    // First block that ZeroTokenStake will end from
    uint256 public endBlock; // 质押结束区块高度
    // ZeroToken token reward per block
    uint256 public ZeroTokenPerBlock; // 每个区块高度，ZeroToken 的奖励数量

    // Pause the withdraw function
    bool public withdrawPaused; // 是否暂停提现
    // Pause the claim function
    bool public claimPaused; // 是否暂停领取

    // ZeroToken token
    IERC20 public ZeroToken; // ZeroToken 代币地址

    // Total pool weight / Sum of all pool weights
    uint256 public totalPoolWeight; // 所有资金池的权重总和
    Pool[] public pool; // 资金池列表

    // pool id => user address => user info
    mapping(uint256 => mapping(address => User)) public user; // 资金池 id => 用户地址 => 用户信息

    // ************************************** EVENT **************************************

    event SetZeroToken(IERC20 indexed ZeroToken);

    event PauseWithdraw();

    event UnpauseWithdraw();

    event PauseClaim();

    event UnpauseClaim();

    event SetStartBlock(uint256 indexed startBlock);

    event SetEndBlock(uint256 indexed endBlock);

    event SetZeroTokenPerBlock(uint256 indexed ZeroTokenPerBlock);

    event AddPool(
        uint256 indexed poolId,
        address indexed stTokenAddress,
        uint256 indexed poolWeight,
        uint256 lastRewardBlock,
        uint256 minDepositAmount,
        uint256 unstakeLockedBlocks
    );

    event UpdatePoolInfo(
        uint256 indexed poolId,
        uint256 indexed minDepositAmount,
        uint256 indexed unstakeLockedBlocks
    );

    event SetPoolWeight(
        uint256 indexed poolId,
        uint256 indexed poolWeight,
        uint256 totalPoolWeight
    );

    event UpdatePool(
        uint256 indexed poolId,
        uint256 indexed lastRewardBlock,
        uint256 totalZeroToken
    );

    event Deposit(address indexed user, uint256 indexed poolId, uint256 amount);

    event RequestUnstake(
        address indexed user,
        uint256 indexed poolId,
        uint256 amount
    );

    event Withdraw(
        address indexed user,
        uint256 indexed poolId,
        uint256 amount,
        uint256 indexed blockNumber
    );

    event Claim(
        address indexed user,
        uint256 indexed poolId,
        uint256 ZeroTokenReward
    );

    // ************************************** MODIFIER **************************************

    modifier checkPid(uint256 _pid) {
        require(_pid < pool.length, "invalid pid");
        _;
    }

    modifier whenNotClaimPaused() {
        require(!claimPaused, "claim is paused");
        _;
    }

    modifier whenNotWithdrawPaused() {
        require(!withdrawPaused, "withdraw is paused");
        _;
    }

    /**
     * @notice Set ZeroToken token address. Set basic info when deploying.
     */
    function initialize(
        IERC20 _ZeroToken,
        uint256 _startBlock,
        uint256 _endBlock,
        uint256 _ZeroTokenPerBlock
    ) public initializer {
        require(
            _startBlock <= _endBlock && _ZeroTokenPerBlock > 0,
            "invalid parameters"
        );

        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADE_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        setZeroToken(_ZeroToken);

        startBlock = _startBlock;
        endBlock = _endBlock;
        ZeroTokenPerBlock = _ZeroTokenPerBlock;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADE_ROLE) {}

    // ************************************** ADMIN FUNCTION **************************************

    /**
     * @notice Set ZeroToken token address. Can only be called by admin
     */
    function setZeroToken(IERC20 _ZeroToken) public onlyRole(ADMIN_ROLE) {
        ZeroToken = _ZeroToken;

        emit SetZeroToken(ZeroToken);
    }

    /**
     * @notice Pause withdraw. Can only be called by admin.
     */
    function pauseWithdraw() public onlyRole(ADMIN_ROLE) {
        require(!withdrawPaused, "withdraw has been already paused");

        withdrawPaused = true;

        emit PauseWithdraw();
    }

    /**
     * @notice Unpause withdraw. Can only be called by admin.
     */
    function unpauseWithdraw() public onlyRole(ADMIN_ROLE) {
        require(withdrawPaused, "withdraw has been already unpaused");

        withdrawPaused = false;

        emit UnpauseWithdraw();
    }

    /**
     * @notice Pause claim. Can only be called by admin.
     */
    function pauseClaim() public onlyRole(ADMIN_ROLE) {
        require(!claimPaused, "claim has been already paused");

        claimPaused = true;

        emit PauseClaim();
    }

    /**
     * @notice Unpause claim. Can only be called by admin.
     */
    function unpauseClaim() public onlyRole(ADMIN_ROLE) {
        require(claimPaused, "claim has been already unpaused");

        claimPaused = false;

        emit UnpauseClaim();
    }

    /**
     * @notice Update staking start block. Can only be called by admin.
     */
    function setStartBlock(uint256 _startBlock) public onlyRole(ADMIN_ROLE) {
        require(
            _startBlock <= endBlock,
            "start block must be smaller than end block"
        );

        startBlock = _startBlock;

        emit SetStartBlock(_startBlock);
    }

    /**
     * @notice Update staking end block. Can only be called by admin.
     */
    function setEndBlock(uint256 _endBlock) public onlyRole(ADMIN_ROLE) {
        require(
            startBlock <= _endBlock,
            "start block must be smaller than end block"
        );

        endBlock = _endBlock;

        emit SetEndBlock(_endBlock);
    }

    /**
     * @notice Update the ZeroToken reward amount per block. Can only be called by admin.
     */
    function setZeroTokenPerBlock(
        uint256 _ZeroTokenPerBlock
    ) public onlyRole(ADMIN_ROLE) {
        require(_ZeroTokenPerBlock > 0, "invalid parameter");

        ZeroTokenPerBlock = _ZeroTokenPerBlock;

        emit SetZeroTokenPerBlock(_ZeroTokenPerBlock);
    }

    /**
     * @notice Add a new staking to pool. Can only be called by admin
     * DO NOT add the same staking token more than once. ZeroToken rewards will be messed up if you do
     */
    function addPool(
        address _stTokenAddress,
        uint256 _poolWeight,
        uint256 _minDepositAmount,
        uint256 _unstakeLockedBlocks,
        bool _withUpdate
    ) public onlyRole(ADMIN_ROLE) {
        // Default the first pool to be ETH pool, so the first pool must be added with stTokenAddress = address(0x0)
        if (pool.length > 0) {
            require(
                _stTokenAddress != address(0x0),
                "invalid staking token address"
            );
        } else {
            require(
                _stTokenAddress == address(0x0),
                "invalid staking token address"
            );
        }
        // allow the min deposit amount equal to 0
        //require(_minDepositAmount > 0, "invalid min deposit amount");
        require(_unstakeLockedBlocks > 0, "invalid withdraw locked blocks");
        require(block.number < endBlock, "Already ended");

        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;
        totalPoolWeight = totalPoolWeight + _poolWeight;

        pool.push(
            Pool({
                stTokenAddress: _stTokenAddress,
                poolWeight: _poolWeight,
                lastRewardBlock: lastRewardBlock,
                accZeroTokenPerST: 0,
                stTokenAmount: 0,
                minDepositAmount: _minDepositAmount,
                unstakeLockedBlocks: _unstakeLockedBlocks
            })
        );

        uint256 newPoolId = pool.length - 1;
        emit AddPool(
            newPoolId,
            _stTokenAddress,
            _poolWeight,
            lastRewardBlock,
            _minDepositAmount,
            _unstakeLockedBlocks
        );
    }

    /**
     * @notice Update the given pool's info (minDepositAmount and unstakeLockedBlocks). Can only be called by admin.
     */
    function updatePool(
        uint256 _pid,
        uint256 _minDepositAmount,
        uint256 _unstakeLockedBlocks
    ) public onlyRole(ADMIN_ROLE) checkPid(_pid) {
        pool[_pid].minDepositAmount = _minDepositAmount;
        pool[_pid].unstakeLockedBlocks = _unstakeLockedBlocks;

        emit UpdatePoolInfo(_pid, _minDepositAmount, _unstakeLockedBlocks);
    }

    /**
     * @notice Update the given pool's weight. Can only be called by admin.
     */
    function setPoolWeight(
        uint256 _pid,
        uint256 _poolWeight,
        bool _withUpdate
    ) public onlyRole(ADMIN_ROLE) checkPid(_pid) {
        require(_poolWeight > 0, "invalid pool weight");

        if (_withUpdate) {
            massUpdatePools();
        }

        totalPoolWeight = totalPoolWeight - pool[_pid].poolWeight + _poolWeight;
        pool[_pid].poolWeight = _poolWeight;

        emit SetPoolWeight(_pid, _poolWeight, totalPoolWeight);
    }

    // ************************************** QUERY FUNCTION **************************************

    /**
     * @notice Get the length/amount of pool
     */
    function poolLength() external view returns (uint256) {
        return pool.length;
    }

    /**
     * @notice Return reward multiplier over given _from to _to block. [_from, _to)
     *
     * @param _from    From block number (included)
     * @param _to      To block number (exluded)
     * getMultiplier(pool_.lastRewardBlock, block.number).tryMul(pool_.poolWeight);
     */
    function getMultiplier(
        uint256 _from,
        uint256 _to
    ) public view returns (uint256 multiplier) {
        require(_from <= _to, "invalid block");
        if (_from < startBlock) {
            _from = startBlock;
        }
        if (_to > endBlock) {
            _to = endBlock;
        }
        require(_from <= _to, "end block must be greater than start block");
        bool success;
        (success, multiplier) = (_to - _from).tryMul(ZeroTokenPerBlock);
        require(success, "multiplier overflow");
    }

    /**
     * @notice Get pending ZeroToken amount of user in pool
     */
    function pendingZeroToken(
        uint256 _pid,
        address _user
    ) external view checkPid(_pid) returns (uint256) {
        return pendingZeroTokenByBlockNumber(_pid, _user, block.number);
    }

    /**
     * @notice Get pending ZeroToken amount of user by block number in pool
     */
    function pendingZeroTokenByBlockNumber(
        uint256 _pid,
        address _user,
        uint256 _blockNumber
    ) public view checkPid(_pid) returns (uint256) {
        Pool storage pool_ = pool[_pid];
        User storage user_ = user[_pid][_user];
        uint256 accZeroTokenPerST = pool_.accZeroTokenPerST;
        uint256 stSupply = pool_.stTokenAmount;

        if (_blockNumber > pool_.lastRewardBlock && stSupply != 0) {
            uint256 multiplier = getMultiplier(
                pool_.lastRewardBlock,
                _blockNumber
            );
            uint256 ZeroTokenForPool = (multiplier * pool_.poolWeight) /
                totalPoolWeight;
            accZeroTokenPerST =
                accZeroTokenPerST +
                (ZeroTokenForPool * (1 ether)) /
                stSupply;
        }

        return
            (user_.stAmount * accZeroTokenPerST) /
            (1 ether) -
            user_.finishedZeroToken +
            user_.pendingZeroToken;
    }

    /**
     * @notice Get the staking amount of user
     */
    function stakingBalance(
        uint256 _pid,
        address _user
    ) external view checkPid(_pid) returns (uint256) {
        return user[_pid][_user].stAmount;
    }

    /**
     * @notice Get the withdraw amount info, including the locked unstake amount and the unlocked unstake amount
     */
    function withdrawAmount(
        uint256 _pid,
        address _user
    )
        public
        view
        checkPid(_pid)
        returns (uint256 requestAmount, uint256 pendingWithdrawAmount)
    {
        User storage user_ = user[_pid][_user];

        for (uint256 i = 0; i < user_.requests.length; i++) {
            if (user_.requests[i].unlockBlocks <= block.number) {
                pendingWithdrawAmount =
                    pendingWithdrawAmount +
                    user_.requests[i].amount;
            }
            requestAmount = requestAmount + user_.requests[i].amount;
        }
    }

    // ************************************** PUBLIC FUNCTION **************************************

    /**
     * @notice Update reward variables of the given pool to be up-to-date.
     */
    function updatePool(uint256 _pid) public checkPid(_pid) {
        Pool storage pool_ = pool[_pid];

        if (block.number <= pool_.lastRewardBlock) {
            return;
        }

        (bool success1, uint256 totalZeroToken) = getMultiplier(
            pool_.lastRewardBlock,
            block.number
        ).tryMul(pool_.poolWeight);
        require(success1, "overflow");

        (success1, totalZeroToken) = totalZeroToken.tryDiv(totalPoolWeight);
        require(success1, "overflow");

        uint256 stSupply = pool_.stTokenAmount;
        if (stSupply > 0) {
            (bool success2, uint256 totalZeroToken_) = totalZeroToken.tryMul(
                1 ether
            );
            require(success2, "overflow");

            (success2, totalZeroToken_) = totalZeroToken_.tryDiv(stSupply);
            require(success2, "overflow");

            (bool success3, uint256 accZeroTokenPerST) = pool_
                .accZeroTokenPerST
                .tryAdd(totalZeroToken_);
            require(success3, "overflow");
            pool_.accZeroTokenPerST = accZeroTokenPerST;
        }

        pool_.lastRewardBlock = block.number;

        emit UpdatePool(_pid, pool_.lastRewardBlock, totalZeroToken);
    }

    /**
     * @notice Update reward variables for all pools. Be careful of gas spending!
     */
    function massUpdatePools() public {
        uint256 length = pool.length;
        for (uint256 pid = 0; pid < length; pid++) {
            updatePool(pid);
        }
    }

    /**
     * @notice Deposit staking ETH for ZeroToken rewards
     */
    function depositETH() public payable whenNotPaused {
        Pool storage pool_ = pool[ETH_PID];
        require(
            pool_.stTokenAddress == address(0x0),
            "invalid staking token address"
        );

        uint256 _amount = msg.value;
        require(
            _amount >= pool_.minDepositAmount,
            "deposit amount is too small"
        );

        _deposit(ETH_PID, _amount);
    }

    /**
     * @notice Deposit staking token for ZeroToken rewards
     * Before depositing, user needs approve this contract to be able to spend or transfer their staking tokens
     *
     * @param _pid       Id of the pool to be deposited to
     * @param _amount    Amount of staking tokens to be deposited
     */
    function deposit(
        uint256 _pid,
        uint256 _amount
    ) public whenNotPaused checkPid(_pid) {
        require(_pid != 0, "deposit not support ETH staking");
        Pool storage pool_ = pool[_pid];
        require(
            _amount > pool_.minDepositAmount,
            "deposit amount is too small"
        );

        if (_amount > 0) {
            // 需要用户提前执行 approve
            IERC20(pool_.stTokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
        }

        _deposit(_pid, _amount);
    }

    /**
     * @notice Unstake staking tokens
     *
     * @param _pid       Id of the pool to be withdrawn from
     * @param _amount    amount of staking tokens to be withdrawn
     */
    function unstake(
        uint256 _pid,
        uint256 _amount
    ) public whenNotPaused checkPid(_pid) whenNotWithdrawPaused {
        Pool storage pool_ = pool[_pid];
        User storage user_ = user[_pid][msg.sender];

        require(user_.stAmount >= _amount, "Not enough staking token balance");

        updatePool(_pid);

        uint256 pendingZeroToken_ = (user_.stAmount * pool_.accZeroTokenPerST) /
            (1 ether) -
            user_.finishedZeroToken;

        if (pendingZeroToken_ > 0) {
            user_.pendingZeroToken = user_.pendingZeroToken + pendingZeroToken_;
        }

        if (_amount > 0) {
            user_.stAmount = user_.stAmount - _amount;
            user_.requests.push(
                UnstakeRequest({
                    amount: _amount,
                    unlockBlocks: block.number + pool_.unstakeLockedBlocks
                })
            );
        }

        pool_.stTokenAmount = pool_.stTokenAmount - _amount;
        user_.finishedZeroToken =
            (user_.stAmount * pool_.accZeroTokenPerST) /
            (1 ether);

        emit RequestUnstake(msg.sender, _pid, _amount);
    }

    /**
     * @notice Withdraw the unlock unstake amount
     *
     * @param _pid       Id of the pool to be withdrawn from
     */
    function withdraw(
        uint256 _pid
    ) public whenNotPaused checkPid(_pid) whenNotWithdrawPaused {
        Pool storage pool_ = pool[_pid];
        User storage user_ = user[_pid][msg.sender];

        uint256 pendingWithdraw_;
        uint256 popNum_;
        for (uint256 i = 0; i < user_.requests.length; i++) {
            if (user_.requests[i].unlockBlocks > block.number) {
                break;
            }
            pendingWithdraw_ = pendingWithdraw_ + user_.requests[i].amount;
            popNum_++;
        }

        for (uint256 i = 0; i < user_.requests.length - popNum_; i++) {
            user_.requests[i] = user_.requests[i + popNum_];
        }

        for (uint256 i = 0; i < popNum_; i++) {
            user_.requests.pop();
        }

        if (pendingWithdraw_ > 0) {
            if (pool_.stTokenAddress == address(0x0)) {
                _safeETHTransfer(msg.sender, pendingWithdraw_);
            } else {
                IERC20(pool_.stTokenAddress).safeTransfer(
                    msg.sender,
                    pendingWithdraw_
                );
            }
        }

        emit Withdraw(msg.sender, _pid, pendingWithdraw_, block.number);
    }

    /**
     * @notice Claim ZeroToken tokens reward
     *
     * @param _pid       Id of the pool to be claimed from
     */
    function claim(
        uint256 _pid
    ) public whenNotPaused checkPid(_pid) whenNotClaimPaused {
        Pool storage pool_ = pool[_pid];
        User storage user_ = user[_pid][msg.sender];

        updatePool(_pid);

        uint256 pendingZeroToken_ = (user_.stAmount * pool_.accZeroTokenPerST) /
            (1 ether) -
            user_.finishedZeroToken +
            user_.pendingZeroToken;

        if (pendingZeroToken_ > 0) {
            user_.pendingZeroToken = 0;
            _safeZeroTokenTransfer(msg.sender, pendingZeroToken_);
        }

        user_.finishedZeroToken =
            (user_.stAmount * pool_.accZeroTokenPerST) /
            (1 ether);

        emit Claim(msg.sender, _pid, pendingZeroToken_);
    }

    // ************************************** INTERNAL FUNCTION **************************************

    /**
     * @notice Deposit staking token for ZeroToken rewards
     *
     * @param _pid       Id of the pool to be deposited to
     * @param _amount    Amount of staking tokens to be deposited
     */
    function _deposit(uint256 _pid, uint256 _amount) internal {
        Pool storage pool_ = pool[_pid];
        User storage user_ = user[_pid][msg.sender];

        updatePool(_pid);

        if (user_.stAmount > 0) {
            // uint256 accST = user_.stAmount.mulDiv(pool_.accZeroTokenPerST, 1 ether);
            (bool success1, uint256 accST) = user_.stAmount.tryMul(
                pool_.accZeroTokenPerST
            );
            require(success1, "user stAmount mul accZeroTokenPerST overflow");
            (success1, accST) = accST.tryDiv(1 ether);
            require(success1, "accST div 1 ether overflow");

            (bool success2, uint256 pendingZeroToken_) = accST.trySub(
                user_.finishedZeroToken
            );
            require(success2, "accST sub finishedZeroToken overflow");

            if (pendingZeroToken_ > 0) {
                (bool success3, uint256 _pendingZeroToken) = user_
                    .pendingZeroToken
                    .tryAdd(pendingZeroToken_);
                require(success3, "user pendingZeroToken overflow");
                user_.pendingZeroToken = _pendingZeroToken;
            }
        }

        if (_amount > 0) {
            (bool success4, uint256 stAmount) = user_.stAmount.tryAdd(_amount);
            require(success4, "user stAmount overflow");
            user_.stAmount = stAmount;
        }

        (bool success5, uint256 stTokenAmount) = pool_.stTokenAmount.tryAdd(
            _amount
        );
        require(success5, "pool stTokenAmount overflow");
        pool_.stTokenAmount = stTokenAmount;

        // user_.finishedZeroToken = user_.stAmount.mulDiv(pool_.accZeroTokenPerST, 1 ether);
        (bool success6, uint256 finishedZeroToken) = user_.stAmount.tryMul(
            pool_.accZeroTokenPerST
        );
        require(success6, "user stAmount mul accZeroTokenPerST overflow");

        (success6, finishedZeroToken) = finishedZeroToken.tryDiv(1 ether);
        require(success6, "finishedZeroToken div 1 ether overflow");

        user_.finishedZeroToken = finishedZeroToken;

        emit Deposit(msg.sender, _pid, _amount);
    }

    /**
     * @notice Safe ZeroToken transfer function, just in case if rounding error causes pool to not have enough ZeroTokens
     *
     * @param _to        Address to get transferred ZeroTokens
     * @param _amount    Amount of ZeroToken to be transferred
     */
    function _safeZeroTokenTransfer(address _to, uint256 _amount) internal {
        uint256 ZeroTokenBal = ZeroToken.balanceOf(address(this));

        if (_amount > ZeroTokenBal) {
            ZeroToken.transfer(_to, ZeroTokenBal);
        } else {
            ZeroToken.transfer(_to, _amount);
        }
    }

    /**
     * @notice Safe ETH transfer function
     *
     * @param _to        Address to get transferred ETH
     * @param _amount    Amount of ETH to be transferred
     */
    function _safeETHTransfer(address _to, uint256 _amount) internal {
        (bool success, bytes memory data) = address(_to).call{value: _amount}(
            ""
        );

        require(success, "ETH transfer call failed");
        if (data.length > 0) {
            require(
                abi.decode(data, (bool)),
                "ETH transfer operation did not succeed"
            );
        }
    }
}
