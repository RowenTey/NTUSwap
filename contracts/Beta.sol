// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Beta is ERC20 {
    constructor(uint256 initialSupply) ERC20("Beta", "BET") {
        _mint(msg.sender, initialSupply);
    }
}
