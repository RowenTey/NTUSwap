// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Alpha is ERC20 {
    constructor(uint256 initialSupply) ERC20("Alpha", "ALP") {
        _mint(msg.sender, initialSupply);
    }
}
