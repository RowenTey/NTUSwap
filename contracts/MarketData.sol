// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract MarketData {
    mapping(uint8 => Market) internal exchangeMarkets;
    // Map market index to token index
    mapping(bytes32 => uint8[]) internal marketTokens;
    bytes32 internal marketIndex = 0;
}