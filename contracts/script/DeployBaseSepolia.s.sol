// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ObscurusPay} from "../src/ObscurusPay.sol";

/// @dev Base Sepolia only. Do not point this script at mainnet.
contract DeployBaseSepolia is Script {
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run(address treasury, uint16 feeBps, address owner) external returns (ObscurusPay pay) {
        require(block.chainid == 84_532, "Base Sepolia only");
        require(treasury != address(0) && owner != address(0), "missing addresses");
        vm.startBroadcast();
        pay = new ObscurusPay(BASE_SEPOLIA_USDC, treasury, feeBps, owner);
        vm.stopBroadcast();
    }
}
