// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "truffle/console.sol";
import "./OrderBookManager.sol";

struct Market {
    OrderBookManager orderBookManager;
}

contract MarketManager {
    mapping(uint8 => Market) internal exchangeMarkets;
    // Map market index to token index
    mapping(uint8 => uint8[]) internal marketTokens;
    uint8 internal marketIndex = 0;

    event MarketCreatedEvent(
        uint256 marketId,
        uint8 tokenId1,
        uint8 tokenId2,
        uint256 timestamp
    );

    event OrderCreatedEvent(
        uint8 tokenId1,
        uint8 tokenId2,
        uint256 price,
        uint256 amount,
        address userAddress,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature,
        uint256 timestamp
    );

    event OrderFilledEvent(
        uint8 tokenId1,
        uint8 tokenId2,
        uint256 price,
        uint256 amount,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature,
        uint256 timestamp
    );

    event OrderCancelledEvent(
        uint256 orderId,
        uint8 tokenId1,
        uint8 tokenId2,
        OrderLibrary.OrderType orderType,
        address userAddress,
        uint256 timestamp
    );

    function addMarket(uint8 tokenIndex) internal {
        require(marketIndex + 1 > marketIndex, "Market index overflow");

        for (uint8 i = 1; i < tokenIndex; i++) {
            // console.log("Adding market: %s and %s", i, tokenIndex);

            marketIndex++;
            marketTokens[marketIndex] = [tokenIndex, i];

            emit MarketCreatedEvent(
                marketIndex,
                i,
                tokenIndex,
                block.timestamp
            );

            Market memory newMarket = Market({
                orderBookManager: new OrderBookManager()
            });

            // Create a new order book
            exchangeMarkets[marketIndex] = newMarket;
        }

        // console.log("Total markets after adding: ", marketIndex);
    }

    function _placeOrder(
        OrderLibrary.PlaceOrderParams memory params
    ) internal returns (OrderLibrary.PlaceOrderResults memory result) {
        require(params.price > 0, "Price must be greater than zero");
        require(params.amount > 0, "Amount must be greater than zero");

        uint8 marketId = getMarketIdByTokens(
            params.tokenIndex1,
            params.tokenIndex2
        );
        Market storage market = exchangeMarkets[marketId];

        result.orderId = _createInitialOrder(market, params);

        uint256 balance;
        (
            balance,
            result.toPay,
            result.toReceive,
            result.tokenAmount,
            result.currencyAmount
        ) = market.orderBookManager.matchOrder(
            result.orderId,
            params.orderType,
            params.orderNature
        );

        result.orderId = _handleRemainingBalance(
            market,
            params,
            result.orderId,
            balance
        );

        for (uint256 i = 0; i < result.tokenAmount.length; i++) {
            emit OrderFilledEvent(
                params.tokenIndex1,
                params.tokenIndex2,
                params.price,
                result.tokenAmount[i],
                params.orderType,
                params.orderNature,
                block.timestamp
            );
        }

        return result;
    }

    function _createInitialOrder(
        Market storage market,
        OrderLibrary.PlaceOrderParams memory params
    ) private returns (uint256) {
        uint256 orderId = market.orderBookManager.addOrder(
            params.amount,
            params.price,
            params.userAddress,
            params.orderType,
            params.orderNature,
            false
        );

        emit OrderCreatedEvent(
            params.tokenIndex1,
            params.tokenIndex2,
            params.price,
            params.amount,
            params.userAddress,
            params.orderType,
            params.orderNature,
            block.timestamp
        );

        return orderId;
    }

    function _handleRemainingBalance(
        Market storage market,
        OrderLibrary.PlaceOrderParams memory params,
        uint256 orderId,
        uint256 balance
    ) private returns (uint256) {
        if (balance > 0 && balance < params.amount) {
            market.orderBookManager.updateOrder(
                orderId,
                params.orderType,
                OrderLibrary.OrderStatus.PartiallyFilled
            );

            uint256 remainingAmount = params.amount - balance;
            orderId = market.orderBookManager.addOrder(
                remainingAmount,
                params.price,
                params.userAddress,
                params.orderType,
                params.orderNature,
                true
            );

            emit OrderCreatedEvent(
                params.tokenIndex1,
                params.tokenIndex2,
                params.price,
                remainingAmount,
                params.userAddress,
                params.orderType,
                params.orderNature,
                block.timestamp
            );
        } else if (balance == 0) {
            market.orderBookManager.updateOrder(
                orderId,
                params.orderType,
                OrderLibrary.OrderStatus.Filled
            );
        } else {
            market.orderBookManager.pushToQueue(orderId, params.orderType);
        }

        return orderId;
    }

    function _cancelOrder(
        uint8 marketId,
        uint256 orderId,
        address userAddress,
        OrderLibrary.OrderType orderType
    ) internal {
        uint8 tokenIndex1;
        uint8 tokenIndex2;
        (tokenIndex1, tokenIndex2) = getTokensByMarketId(marketId);
        Market storage market = exchangeMarkets[marketId];

        bool isCancelled = market.orderBookManager.cancelOrder(
            orderId,
            orderType
        );

        // TODO: Do I need to refund to user?

        if (isCancelled) {
            emit OrderCancelledEvent(
                orderId,
                tokenIndex1,
                tokenIndex2,
                orderType,
                userAddress,
                block.timestamp
            );
        }
    }

    function getTokensByMarketId(
        uint8 marketId
    ) internal view returns (uint8 tokenId1, uint8 tokenId2) {
        return (marketTokens[marketId][0], marketTokens[marketId][1]);
    }

    function getMarketIdByTokens(
        uint8 tokenId1,
        uint8 tokenId2
    ) internal view returns (uint8 marketId) {
        for (uint8 i = 0; i <= marketIndex; i++) {
            if (
                marketTokens[i][0] == tokenId1 && marketTokens[i][1] == tokenId2
            ) {
                return i;
            } else if (
                marketTokens[i][0] == tokenId2 && marketTokens[i][1] == tokenId1
            ) {
                return i;
            }
        }
        return 0;
    }
}
