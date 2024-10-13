// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "contracts/Token.sol";

contract TokenManager is Ownable {
    // Token ID -> Token
    mapping(uint8 => Token) internal tokens;

    // Map token symbol to whether it exists in the DEX or not
    mapping(string => uint8) internal isToken;

    // User Address -> [Token ID -> Balance]
    mapping(address => mapping(uint8 => uint256)) internal userBalances;

    uint8 internal tokenId = 1;

    event TokenIssueEvent(
        uint8 tokenId,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 timestamp
    );

    event DepositEvent(
        string symbol,
        address indexed userAddress,
        uint256 amount,
        uint256 timestamp
    );

    event WithdrawalEvent(
        string symbol,
        address indexed userAddress,
        uint256 amount,
        uint256 timestamp
    );

    function issueToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) internal onlyOwner {
        require(isToken[_symbol] > 0, "Token already exists!");
        require(_initialSupply > 0, "Initial supply must be greater than 0");

        // Create a token
        Token newToken = new Token(_name, _symbol, _initialSupply, msg.sender);

        tokens[tokenId] = newToken;
        isToken[_symbol] = tokenId;

        emit TokenIssueEvent(
            tokenId,
            _name,
            _symbol,
            _initialSupply,
            block.timestamp
        );

        tokenId++;
    }

    function deposit(
        string memory _symbol,
        uint256 _amount
    ) internal returns (uint256 tokenBalance) {
        require(isToken[_symbol] > 0, "Token hasn't been issued");
        require(amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getUserTokenBalance(_symbol);
        require(userBalance + _amount > userBalance, "User balance overflow");

        uint8 tokenId = isToken[_symbol];
        IERC20 token = tokens[tokenId];

        // Deposit "amount" number of a particular token from sender to contract
        require(
            token.transferFrom(msg.sender, address(this), _amount),
            "Failed to transfer amount"
        );

        // Ledger update
        userBalances[msg.sender][tokenId] += _amount;

        emit DepositEvent(_symbol, msg.sender, _amount, block.timestamp);

        return userBalances[msg.sender][tokenId];
    }       

    function withdraw(
        string memory _symbol,
        uint256 _amount
    ) internal returns (uint256 tokenBalance) {
        require(isToken[_symbol] > 0, "Token hasn't been issued");
        require(_amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getUserTokenBalance(_symbol);
        require(userBalance >= amount, "Insufficient balance");

        uint8 tokenId = isToken[_symbol];
        IERC20 token = tokens[tokenId];

        // Send "amount" number of a particular token from contract to sender
        require(token.transfer(msg.sender, _amount), "Failed to transfer amount");

        // Update ledger
        userBalances[msg.sender][_tokenId] -= _amount;

        emit WithdrawalEvent(symbol, msg.sender, _amount, block.timestamp);

        return userBalances[msg.sender][_tokenId];
    }

    function getUserTokenBalance(
        string memory _symbol
    ) internal view returns (uint256 tokenBalance) {
        uint8 tokenId = isToken[_symbol];
        return userBalances[msg.sender][tokenId];
    }
}
