// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Token.sol";
import "./MarketManager.sol";
import "hardhat/console.sol";

contract TokenManager is Ownable {
    // Token ID -> Token
    mapping(uint8 => Token) internal tokens;

    // Map token symbol to whether it exists in the DEX or not
    mapping(string => uint8) internal isToken;

    // User Address -> [Token ID -> Balance]
    mapping(address => mapping(uint8 => uint256)) internal userBalances;

    MarketManager public marketManager;

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

    bool private initialized;

    modifier onlyInitialized() {
        require(initialized, "Token manager not initialized");
        _;
    }

    constructor() Ownable() {
        initialized = false;
    }

    function initialize(address _marketManagerAddr) external {
        require(!initialized, "Already initialized");
        require(
            _marketManagerAddr != address(0),
            "Invalid market manager address"
        );
        marketManager = MarketManager(_marketManagerAddr);
        initialized = true;
    }

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
    ) external onlyOwner onlyInitialized {
        // Log each parameter explicitly
        console.log("[TokenManager] Token Name:", _name);
        console.log("[TokenManager] Token Symbol:", _symbol);
        console.log("[TokenManager] Initial Supply:", _initialSupply);
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
        console.log("[TokenManager] Emitted TokenIssueEvent");

        if (tokenId > 1) {
            marketManager.createMarket(tokenId);
            console.log("[TokenManager] Market created for token:", tokenId);
        }

        tokenId++;
    }

    function deposit(
        string memory _symbol,
        uint256 _amount,
        address _userAddress
    ) external returns (uint256 tokenBalance) {
        require(isToken[_symbol] > 0, "Token hasn't been issued");
        require(_amount > 0, "Amount must be greater than zero");
        console.log("Message sender - ", _userAddress);

        uint256 userBalance = getUserTokenBalance(_userAddress, _symbol);
        require(userBalance + _amount > userBalance, "User balance overflow");

        uint8 _tokenId = isToken[_symbol];
        IERC20 token = tokens[_tokenId];

        // Deposit "amount" number of a particular token from sender to contract
        require(
            token.transferFrom(_userAddress, address(this), _amount),
            "Failed to transfer amount"
        );

        // Ledger update
        userBalances[_userAddress][_tokenId] += _amount;

        emit DepositEvent(_symbol, _userAddress, _amount, block.timestamp);

        console.log("Updated balance - ", userBalances[_userAddress][_tokenId]);
        return userBalances[_userAddress][_tokenId];
    }

    function withdraw(
        string memory _symbol,
        uint256 _amount,
        address _userAddress
    ) external returns (uint256 tokenBalance) {
        require(isToken[_symbol] > 0, "Token hasn't been issued");
        require(_amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getUserTokenBalance(_userAddress, _symbol);
        console.log("User balance - ", userBalance);
        require(userBalance >= _amount, "Insufficient balance");

        uint8 _tokenId = isToken[_symbol];
        IERC20 token = tokens[_tokenId];

        // Send "amount" number of a particular token from contract to sender
        require(
            token.transfer(_userAddress, _amount),
            "Failed to transfer amount"
        );

        // Update ledger
        userBalances[_userAddress][_tokenId] -= _amount;

        emit WithdrawalEvent(_symbol, _userAddress, _amount, block.timestamp);

        return userBalances[_userAddress][_tokenId];
    }

    function getUserTokenBalance(
        address _userAddress,
        string memory _symbol
    ) public view returns (uint256 tokenBalance) {
        uint8 _tokenId = isToken[_symbol];
        return userBalances[_userAddress][_tokenId];
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
        console.log("Transferring - ", _from, _tokenId, _amount);
        require(
            userBalances[_from][_tokenId] >= _amount,
            "[TokenManager] Insufficient balance"
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
        tokenNames = new string[](tokenId - 1);
        tokenSymbols = new string[](tokenId - 1);

        for (uint8 i = 1; i < tokenId; i++) {
            Token t = tokens[i];
            tokenNames[i - 1] = t.name();
            tokenSymbols[i - 1] = t.symbol();
        }

        return (tokenNames, tokenSymbols);
    }
}
