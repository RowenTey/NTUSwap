// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Order.sol";
import "./TokenHandler.sol";
import "./MarketManager.sol";

contract Exchange is TokenHandler, MarketManager {
    function depositTokens(
        string memory symbol,
        uint256 amount
    ) external returns (uint256 tokenBalance) {
        return deposit(symbol, amount);
    }

    function withdrawTokens(
        string memory symbol,
        uint256 amount
    ) external returns (uint256 tokenBalance) {
        return withdraw(symbol, amount);
    }

    function issueToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external onlyOwner {
        uint8 createdTokenId = issue(name, symbol, initialSupply);

        if (createdTokenId > 1) {
            addMarket(createdTokenId);
        }
    }

    function placeOrder(
        string memory symbol1,
        string memory symbol2,
        uint256 price,
        uint256 amount,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature
    ) external returns (uint256 orderId) {
        require(hasToken(symbol1), "Token does not exist");
        require(hasToken(symbol2), "Token does not exist");

        uint8 tokenIndex1 = getTokenId(symbol1);
        uint8 tokenIndex2 = getTokenId(symbol2);

        // TODO: check logic on market vs limit order
        if (orderType == OrderLibrary.OrderType.Buy) {
            require(
                orderNature == OrderLibrary.OrderNature.Market ||
                    (orderNature == OrderLibrary.OrderNature.Limit &&
                        userBalances[msg.sender][tokenIndex1] >=
                        price * amount),
                "Insufficient balance"
            );
        } else {
            require(
                orderNature == OrderLibrary.OrderNature.Market ||
                    (orderNature == OrderLibrary.OrderNature.Limit &&
                        userBalances[msg.sender][tokenIndex2] >=
                        price * amount),
                "Insufficient balance"
            );
        }

        OrderLibrary.PlaceOrderParams memory params = OrderLibrary
            .PlaceOrderParams({
                tokenIndex1: tokenIndex1,
                tokenIndex2: tokenIndex2,
                price: price,
                amount: amount,
                userAddress: msg.sender,
                orderType: orderType,
                orderNature: orderNature
            });
        OrderLibrary.PlaceOrderResults memory result = _placeOrder(params);
        orderId = result.orderId;

        // Execute the transfers from the matched orders
        executeTransfers(tokenIndex1, tokenIndex2, result);
    }

    function cancelOrder(
        uint8 marketID,
        OrderLibrary.OrderType orderType,
        uint256 orderId
    ) external {
        require(
            exchangeMarkets[marketID].orderBookManager.getActiveOrderCount(
                orderType
            ) > 0,
            "Invalid market or order type"
        );

        _cancelOrder(marketID, orderId, msg.sender, orderType);
    }
}
