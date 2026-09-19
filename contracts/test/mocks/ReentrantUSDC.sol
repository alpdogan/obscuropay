// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ObscurusPay} from "../../src/ObscurusPay.sol";

contract ReentrantUSDC is ERC20 {
    ObscurusPay public target;
    bytes32 public attackRef;
    address public attackMerchant;
    uint256 public attackAmount;
    bool public attack;

    constructor() ERC20("Reentrant USDC", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(ObscurusPay target_, bytes32 paymentRef, address merchant, uint256 amount) external {
        target = target_;
        attackRef = paymentRef;
        attackMerchant = merchant;
        attackAmount = amount;
        attack = true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (attack && address(target) != address(0)) {
            attack = false;
            target.pay(attackRef, attackMerchant, address(this), attackAmount);
        }
        return super.transferFrom(from, to, value);
    }
}
