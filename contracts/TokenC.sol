// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenC is ERC20 {
    constructor(uint256 initialSupply) ERC20("TokenC", "TokC") {
        _mint(msg.sender, initialSupply);
    }
}