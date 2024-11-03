// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Token.sol";

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

    event InternalTransferEvent(
        uint8 tokenId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    function getToken(uint8 _tokenId) external view returns (address) {
        require(
            address(tokens[_tokenId]) != address(0),
            "Token does not exist"
        );
        return address(tokens[_tokenId]);
    }

    function issueToken(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) external onlyOwner {
        require(isToken[_symbol] == 0, "Token already exists!");
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
    ) external returns (uint256 tokenBalance) {
        require(isToken[_symbol] > 0, "Token hasn't been issued");
        require(_amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getUserTokenBalance(_symbol);
        require(userBalance + _amount > userBalance, "User balance overflow");

        uint8 _tokenId = isToken[_symbol];
        IERC20 token = tokens[_tokenId];

        // Deposit "amount" number of a particular token from sender to contract
        require(
            token.transferFrom(msg.sender, address(this), _amount),
            "Failed to transfer amount"
        );

        // Ledger update
        userBalances[msg.sender][_tokenId] += _amount;

        emit DepositEvent(_symbol, msg.sender, _amount, block.timestamp);

        return userBalances[msg.sender][_tokenId];
    }

    function withdraw(
        string memory _symbol,
        uint256 _amount
    ) external returns (uint256 tokenBalance) {
        require(isToken[_symbol] > 0, "Token hasn't been issued");
        require(_amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getUserTokenBalance(_symbol);
        require(userBalance >= _amount, "Insufficient balance");

        uint8 _tokenId = isToken[_symbol];
        IERC20 token = tokens[_tokenId];

        // Send "amount" number of a particular token from contract to sender
        require(
            token.transfer(msg.sender, _amount),
            "Failed to transfer amount"
        );

        // Update ledger
        userBalances[msg.sender][_tokenId] -= _amount;

        emit WithdrawalEvent(_symbol, msg.sender, _amount, block.timestamp);

        return userBalances[msg.sender][_tokenId];
    }

    function getUserTokenBalance(
        string memory _symbol
    ) public view returns (uint256 tokenBalance) {
        uint8 _tokenId = isToken[_symbol];
        return userBalances[msg.sender][_tokenId];
    }

    function transferFrom(
        address _from,
        address _to,
        uint8 _tokenId,
        uint256 _amount
    ) external returns (bool) {
        require(_from != address(0), "Invalid from address");
        require(_to != address(0), "Invalid to address");
        require(_amount > 0, "Amount must be greater than zero");
        require(tokens[_tokenId] != Token(address(0)), "Token does not exist");

        // Check if sender has sufficient balance
        require(
            userBalances[_from][_tokenId] >= _amount,
            "Insufficient balance"
        );

        // Update balances
        userBalances[_from][_tokenId] -= _amount;
        userBalances[_to][_tokenId] += _amount;

        emit InternalTransferEvent(
            _tokenId,
            _from,
            _to,
            _amount,
            block.timestamp
        );

        return true;
    }

    // Helper function to get token ID from symbol
    function getTokenId(string memory _symbol) external view returns (uint8) {
        require(isToken[_symbol] > 0, "Token doesn't exist");
        return isToken[_symbol];
    }

    // Helper function to get balance for any user (not just msg.sender)
    function getBalance(
        address _user,
        uint8 _tokenId
    ) external view returns (uint256) {
        return userBalances[_user][_tokenId];
    }

    function getAllTokens()
        external
        view
        returns (string[] memory tokenNames, string[] memory tokenSymbols)
    {
        tokenNames = new string[](tokenId);
        tokenSymbols = new string[](tokenId);

        for (uint8 i = 1; i < tokenId; i++) {
            Token t = tokens[i];
            tokenNames[i - 1] = t.name();
            tokenSymbols[i - 1] = t.symbol();
        }

        return (tokenNames, tokenSymbols);
    }
}
