// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ObscurusPay} from "../src/ObscurusPay.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {ReentrantUSDC} from "./mocks/ReentrantUSDC.sol";

contract ObscurusPayTest is Test {
    uint16 internal constant FEE_BPS = 100;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal merchant = makeAddr("merchant");
    address internal payer = makeAddr("payer");
    MockUSDC internal usdc;
    ObscurusPay internal pay;

    function setUp() public {
        usdc = new MockUSDC();
        pay = new ObscurusPay(address(usdc), treasury, FEE_BPS, owner);
        usdc.mint(payer, 1_000_000e6);
        vm.prank(payer);
        usdc.approve(address(pay), type(uint256).max);
    }

    function test_splitsAmountAndFee() public {
        uint256 amount = 10_000e6;
        bytes32 paymentRef = keccak256("ref-1");

        vm.prank(payer);
        pay.pay(paymentRef, merchant, address(usdc), amount);

        uint256 fee = (amount * FEE_BPS) / 10_000;
        assertEq(usdc.balanceOf(merchant), amount - fee);
        assertEq(usdc.balanceOf(treasury), fee);
        assertEq(usdc.balanceOf(address(pay)), 0);
        assertTrue(pay.usedPaymentRefs(paymentRef));
    }

    function test_zeroFeeSendsAllToMerchant() public {
        vm.prank(owner);
        pay.setFeeBps(0);
        uint256 amount = 50e6;

        vm.prank(payer);
        pay.pay(keccak256("zero-fee"), merchant, address(usdc), amount);

        assertEq(usdc.balanceOf(merchant), amount);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_revertZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(ObscurusPay.InvalidAmount.selector);
        pay.pay(keccak256("zero"), merchant, address(usdc), 0);
    }

    function test_revertWrongAsset() public {
        MockUSDC other = new MockUSDC();
        vm.prank(payer);
        vm.expectRevert(ObscurusPay.InvalidAsset.selector);
        pay.pay(keccak256("asset"), merchant, address(other), 1e6);
    }

    function test_revertDuplicatePaymentRef() public {
        bytes32 paymentRef = keccak256("dup");
        vm.prank(payer);
        pay.pay(paymentRef, merchant, address(usdc), 1e6);

        vm.prank(payer);
        vm.expectRevert(ObscurusPay.DuplicatePaymentRef.selector);
        pay.pay(paymentRef, merchant, address(usdc), 1e6);
    }

    function test_revertInvalidMerchantAndRef() public {
        vm.prank(payer);
        vm.expectRevert(ObscurusPay.InvalidPaymentRef.selector);
        pay.pay(bytes32(0), merchant, address(usdc), 1e6);

        vm.prank(payer);
        vm.expectRevert(ObscurusPay.InvalidMerchant.selector);
        pay.pay(keccak256("no-merchant"), address(0), address(usdc), 1e6);

        vm.prank(payer);
        vm.expectRevert(ObscurusPay.InvalidMerchant.selector);
        pay.pay(keccak256("self"), address(pay), address(usdc), 1e6);
    }

    function test_reentrancyIsBlocked() public {
        ReentrantUSDC token = new ReentrantUSDC();
        ObscurusPay guarded = new ObscurusPay(address(token), treasury, FEE_BPS, owner);
        token.mint(payer, 100e6);
        vm.prank(payer);
        token.approve(address(guarded), type(uint256).max);

        bytes32 first = keccak256("reenter-1");
        bytes32 second = keccak256("reenter-2");
        token.arm(guarded, second, merchant, 10e6);

        vm.prank(payer);
        vm.expectRevert();
        guarded.pay(first, merchant, address(token), 20e6);

        assertFalse(guarded.usedPaymentRefs(second));
    }

    function test_ownerCannotSweepCustomerFunds() public {
        usdc.mint(address(pay), 999e6);
        vm.prank(owner);
        (bool withdrawn,) =
            address(pay).call(abi.encodeWithSignature("withdraw(address,uint256)", address(usdc), 999e6));
        vm.prank(owner);
        (bool rescued,) = address(pay).call(
            abi.encodeWithSignature("rescueTokens(address,address,uint256)", address(usdc), owner, uint256(1))
        );
        assertFalse(withdrawn);
        assertFalse(rescued);
        assertEq(usdc.balanceOf(address(pay)), 999e6);
        assertEq(usdc.balanceOf(owner), 0);
    }

    function test_feeBpsCappedAndOnlyOwner() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        pay.setFeeBps(10);

        vm.prank(owner);
        vm.expectRevert(ObscurusPay.InvalidFeeBps.selector);
        pay.setFeeBps(1_001);

        vm.prank(owner);
        pay.setFeeBps(1_000);
        assertEq(pay.feeBps(), 1_000);
    }

    function test_pauseBlocksPay() public {
        vm.prank(owner);
        pay.pause();
        vm.prank(payer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        pay.pay(keccak256("paused"), merchant, address(usdc), 1e6);

        vm.prank(owner);
        pay.unpause();
        vm.prank(payer);
        pay.pay(keccak256("unpaused"), merchant, address(usdc), 1e6);
    }

    function test_constructorRejectsWrongChain() public {
        vm.chainId(1);
        vm.expectRevert(ObscurusPay.WrongChain.selector);
        new ObscurusPay(address(usdc), treasury, FEE_BPS, owner);
    }
}
