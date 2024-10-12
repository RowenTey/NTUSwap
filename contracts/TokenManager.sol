// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./Token.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenManager is Ownable {
    
    // Token ID -> Token
    mapping(uint8 => ERC20Token) internal tokens;
    
    // Map token symbol to whether it exists in the DEX or not 
    mapping(string => bool) internal isToken;

    // User Address -> [Token ID -> Balance]
    mapping(address => mapping(uint8 => uint256)) internal userBalances;

    uint8 internal tokenId = 1;
    
    event tokenIssueEvent(
        uint8 tokenId,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 timestamp
    );


    function issueToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) internal onlyOwner {
        require(isToken[_symbol], "Token already exists!");
        require(_initialSupply > 0, "Initial supply must be greater than 0");

        // Create a token
        ERC20Token newToken = new ERC20Token(
            _name,
            _symbol, 
            _initialSupply,
            msg.sender
        );

        tokens[tokenId] = newToken;
        isToken[_symbol] = true;

        emit tokenIssueEvent(tokenId, _name, _symbol, _initialSupply, block.timestamp);

        tokenId++;
    }

}