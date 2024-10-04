// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "truffle/Console.sol";
import "./ERC20Token.sol";
import "./Order.sol";

contract TokenHandler is Ownable {
    // Map token index to ERC20 token
    mapping(uint8 => ERC20Token) internal tokens;
    // Map user address to user balances per token
    mapping(address => mapping(uint8 => uint256)) internal userBalances;
    // Track number of tokens
    uint8 internal tokenIndex = 0;

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

    event IssueTokenEvent(
        uint8 tokenIndex,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 timestamp
    );

    function deposit(
        string memory symbol,
        uint256 amount
    ) internal returns (uint256 tokenBalance) {
        require(hasToken(symbol), "Token does not exist");
        require(amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getTokenBalanceForUser(symbol);
        require(userBalance + amount > userBalance, "User balance overflow");

        uint8 _tokenId = getTokenId(symbol);

        // Transfer from user wallet to token balance in contract
        require(
            tokens[_tokenId].transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // Update ledger
        userBalances[msg.sender][_tokenId] += amount;
        emit DepositEvent(
            tokens[_tokenId].symbol(),
            msg.sender,
            amount,
            block.timestamp
        );
        return userBalances[msg.sender][_tokenId];
    }

    function withdraw(
        string memory symbol,
        uint256 amount
    ) internal returns (uint256 tokenBalance) {
        require(hasToken(symbol), "Token does not exist");
        require(amount > 0, "Amount must be greater than zero");

        uint256 userBalance = getTokenBalanceForUser(symbol);
        require(userBalance - amount >= 0, "Insufficient balance");

        uint8 _tokenId = getTokenId(symbol);

        // Transfer from token balance in contract to user wallet
        IERC20 token = tokens[_tokenId];
        require(token.transfer(msg.sender, amount) == true, "Transfer failed");

        // Update ledger
        userBalances[msg.sender][_tokenId] -= amount;

        emit WithdrawalEvent(symbol, msg.sender, amount, block.timestamp);
        return userBalances[msg.sender][_tokenId];
    }

    function executeTransfers(
        uint8 tokenIndex1,
        uint8 tokenIndex2,
        OrderLibrary.PlaceOrderResults memory results
    ) internal {
        for (uint256 i = 0; i < results.toPay.length; i++) {
            userBalances[results.toPay[i]][tokenIndex1] += results.tokenAmount[
                i
            ];
            userBalances[results.toReceive[i]][tokenIndex1] -= results
                .tokenAmount[i];
            console.log(
                "Transfering %s from %s to %s",
                results.tokenAmount[i],
                tokenIndex1,
                tokenIndex2
            );

            userBalances[results.toPay[i]][tokenIndex2] -= results
                .currencyAmount[i];
            userBalances[results.toReceive[i]][tokenIndex2] += results
                .currencyAmount[i];
            console.log(
                "Transfering %s from %s to %s",
                results.tokenAmount[i],
                tokenIndex1,
                tokenIndex2
            );
        }
    }

    function issue(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) internal onlyOwner returns (uint8 tokenId) {
        require(!hasToken(symbol), "Token already exists");
        require(tokenIndex + 1 > tokenIndex, "Token index overflow");

        tokenIndex++;
        tokens[tokenIndex] = new ERC20Token(
            name,
            symbol,
            initialSupply,
            msg.sender
        );

        emit IssueTokenEvent(
            tokenIndex,
            name,
            symbol,
            initialSupply,
            block.timestamp
        );

        return tokenIndex;
    }

    function hasToken(string memory symbol) internal view returns (bool) {
        for (uint8 i = 0; i <= tokenIndex; i++) {
            if (
                keccak256(abi.encodePacked(tokens[i].symbol)) ==
                keccak256(abi.encodePacked(symbol))
            ) {
                return true;
            }
        }
        return false;
    }

    function getTokenIndex() internal view returns (uint8) {
        return tokenIndex;
    }

    function getTokenId(
        string memory symbol
    ) internal view returns (uint8 foundTokenIndex) {
        for (uint8 i = 0; i <= tokenIndex; i++) {
            if (
                keccak256(bytes(tokens[i].symbol())) == keccak256(bytes(symbol))
            ) {
                return i;
            }
        }
        return 0;
    }

    function getTokenBalanceForUser(
        string memory symbol
    ) internal view returns (uint256 tokenBalance) {
        return userBalances[msg.sender][getTokenId(symbol)];
    }
}
