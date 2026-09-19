// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ObscurusPay
/// @notice Pulls one configured USDC, splits a protocol fee, and records an opaque paymentRef.
/// @dev No PII, no upgrade proxy, no owner sweep of customer funds. Testnet only.
contract ObscurusPay is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 1_000;
    uint256 public constant BASE_SEPOLIA_CHAIN_ID = 84_532;
    uint256 public constant ANVIL_CHAIN_ID = 31_337;

    IERC20 public immutable usdc;
    address public treasury;
    uint16 public feeBps;
    mapping(bytes32 paymentRef => bool used) public usedPaymentRefs;

    event PaymentReceived(
        bytes32 indexed paymentRef,
        address indexed merchant,
        address indexed asset,
        uint256 amount,
        uint256 fee
    );
    event TreasuryUpdated(address indexed treasury);
    event FeeBpsUpdated(uint16 feeBps);

    error WrongChain();
    error InvalidAsset();
    error InvalidAmount();
    error InvalidMerchant();
    error InvalidTreasury();
    error InvalidOwner();
    error InvalidFeeBps();
    error InvalidPaymentRef();
    error DuplicatePaymentRef();

    constructor(address usdc_, address treasury_, uint16 feeBps_, address owner_) Ownable(owner_) {
        if (block.chainid != BASE_SEPOLIA_CHAIN_ID && block.chainid != ANVIL_CHAIN_ID) {
            revert WrongChain();
        }
        if (usdc_ == address(0)) revert InvalidAsset();
        if (treasury_ == address(0)) revert InvalidTreasury();
        if (owner_ == address(0)) revert InvalidOwner();
        if (feeBps_ > MAX_FEE_BPS) revert InvalidFeeBps();
        usdc = IERC20(usdc_);
        treasury = treasury_;
        feeBps = feeBps_;
    }

    /// @notice Pays `amount` of the configured USDC. `asset` must be that token.
    /// @dev Calldata is settlement only: paymentRef, merchant, asset, amount. Never PII.
    function pay(bytes32 paymentRef, address merchant, address asset, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        if (paymentRef == bytes32(0)) revert InvalidPaymentRef();
        if (usedPaymentRefs[paymentRef]) revert DuplicatePaymentRef();
        if (merchant == address(0) || merchant == address(this)) revert InvalidMerchant();
        if (asset != address(usdc)) revert InvalidAsset();
        if (amount == 0) revert InvalidAmount();

        usedPaymentRefs[paymentRef] = true;

        uint256 fee = (amount * uint256(feeBps)) / 10_000;
        uint256 toMerchant = amount - fee;

        if (toMerchant > 0) {
            usdc.safeTransferFrom(msg.sender, merchant, toMerchant);
        }
        if (fee > 0) {
            usdc.safeTransferFrom(msg.sender, treasury, fee);
        }

        emit PaymentReceived(paymentRef, merchant, asset, amount, fee);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert InvalidTreasury();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setFeeBps(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert InvalidFeeBps();
        feeBps = feeBps_;
        emit FeeBpsUpdated(feeBps_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
