// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Order.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract OrderBookManager {
    struct OrderBook {
        uint256 totalOrders;
        mapping(uint256 => OrderLibrary.Order) orders;
        uint256 activeCount;
        uint256[] queue;
    }

    mapping(OrderLibrary.OrderType => OrderBook) internal orderBooks;

    constructor() {
        OrderBook storage buyOrderBook = orderBooks[OrderLibrary.OrderType.Buy];
        OrderBook storage sellOrderBook = orderBooks[
            OrderLibrary.OrderType.Sell
        ];

        buyOrderBook.activeCount = 0;
        buyOrderBook.totalOrders = 0;

        sellOrderBook.activeCount = 0;
        sellOrderBook.totalOrders = 0;
    }

    function addOrder(
        uint256 amount,
        uint256 price,
        address userAddress,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature,
        bool shouldPushToActiveQueue
    ) public returns (uint256 orderId) {
        OrderBook storage book = orderBooks[orderType];
        orderId = book.totalOrders++;

        book.orders[orderId] = OrderLibrary.Order({
            totalAmount: amount,
            remainingAmount: amount,
            price: price,
            timestamp: block.timestamp,
            userAddress: userAddress,
            nature: orderNature,
            status: OrderLibrary.OrderStatus.Active
        });

        if (!shouldPushToActiveQueue) {
            return orderId;
        }

        pushToQueue(orderId, orderType);
        return orderId;
    }

    function pushToQueue(
        uint256 orderId,
        OrderLibrary.OrderType orderType
    ) public {
        OrderBook storage book = orderBooks[orderType];

        bool isOrderAdded = false;
        uint256 newOrdersCount = ++book.activeCount;
        uint256[] memory updatedOrdersQueue = new uint256[](newOrdersCount);

        if (newOrdersCount == 1) {
            updatedOrdersQueue[0] = orderId;
            isOrderAdded = true;
        } else {
            // Insert in sorted position
            uint256 newOrdersQueueIndex = 0;
            for (uint256 i = 0; i < newOrdersCount - 1; i++) {
                if (
                    book.orders[orderId].price <
                    book.orders[book.queue[i]].price
                ) {
                    updatedOrdersQueue[newOrdersQueueIndex++] = orderId;
                }
                updatedOrdersQueue[newOrdersQueueIndex++] = book.queue[i];
            }

            if (!isOrderAdded) {
                updatedOrdersQueue[newOrdersQueueIndex] = orderId;
                isOrderAdded = true;
            }
        }

        book.activeCount++;
        book.queue = updatedOrdersQueue;
    }

    // TODO: Test functionality of this function
    function matchOrder(
        uint256 pendingOrderId,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature
    )
        public
        returns (
            uint256 balance,
            address[] memory toPay,
            address[] memory toReceive,
            uint256[] memory tokenAmount,
            uint256[] memory currencyAmount
        )
    {
        OrderLibrary.OrderType oppositeOrderType = orderType ==
            OrderLibrary.OrderType.Buy
            ? OrderLibrary.OrderType.Sell
            : OrderLibrary.OrderType.Buy;
        OrderBook storage book = orderBooks[oppositeOrderType];
        OrderLibrary.Order storage pendingOrder = book.orders[pendingOrderId];

        uint256 fulfilledOrdersCount = 0;

        uint256 j = 0;
        toPay = new address[](book.activeCount);
        toReceive = new address[](book.activeCount);
        tokenAmount = new uint256[](book.activeCount);
        currencyAmount = new uint256[](book.activeCount);

        if (orderType == OrderLibrary.OrderType.Buy) {
            // Buy -> Match from lowest price
            for (uint256 i = 0; i < book.activeCount; i++) {
                if (pendingOrder.remainingAmount == 0) break;

                // Array is sorted by price
                // -> smaller means we have matched all possible orders for a LIMIT order
                // -> we only want to buy at this price or less
                if (
                    orderNature == OrderLibrary.OrderNature.Limit &&
                    pendingOrder.price < book.orders[book.queue[i]].price
                ) break;

                uint256 matchedAmount = Math.min(
                    pendingOrder.remainingAmount,
                    book.orders[book.queue[i]].remainingAmount
                );

                pendingOrder.remainingAmount -= matchedAmount;
                book.orders[book.queue[i]].remainingAmount -= matchedAmount;

                toPay[j] = pendingOrder.userAddress;
                toReceive[j] = book.orders[book.queue[i]].userAddress;
                tokenAmount[j] = matchedAmount;
                currencyAmount[j] =
                    matchedAmount *
                    book.orders[book.queue[i]].price;
                j++;

                if (book.orders[book.queue[i]].remainingAmount == 0) {
                    book.orders[book.queue[i]].status = OrderLibrary
                        .OrderStatus
                        .Filled;
                    fulfilledOrdersCount++;
                }
            }
        } else {
            // Sell -> Match from highest price
            for (uint256 i = book.activeCount; i >= 0; i--) {
                if (pendingOrder.remainingAmount == 0) break;

                // Array is sorted by price
                // -> bigger means we have matched all possible orders for a LIMIT order
                // -> we only want to sell at this price or more
                if (
                    orderNature == OrderLibrary.OrderNature.Limit &&
                    pendingOrder.price > book.orders[book.queue[i]].price
                ) break;

                uint256 matchedAmount = Math.min(
                    pendingOrder.remainingAmount,
                    book.orders[book.queue[i]].remainingAmount
                );

                pendingOrder.remainingAmount -= matchedAmount;
                book.orders[book.queue[i]].remainingAmount -= matchedAmount;

                toPay[j] = book.orders[book.queue[i]].userAddress;
                toReceive[j] = pendingOrder.userAddress;
                tokenAmount[j] = matchedAmount;
                currencyAmount[j] =
                    matchedAmount *
                    book.orders[book.queue[i]].price;
                j++;

                if (book.orders[book.queue[i]].remainingAmount == 0) {
                    book.orders[book.queue[i]].status = OrderLibrary
                        .OrderStatus
                        .Filled;
                    fulfilledOrdersCount++;
                }
            }
        }

        updateOrderBook(oppositeOrderType, fulfilledOrdersCount);

        return (
            pendingOrder.remainingAmount,
            toPay,
            toReceive,
            tokenAmount,
            currencyAmount
        );
    }

    function updateOrder(
        uint256 orderId,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderStatus status
    ) public {
        OrderLibrary.Order storage order = orderBooks[orderType].orders[
            orderId
        ];

        require(
            status == OrderLibrary.OrderStatus.PartiallyFilled ||
                status == OrderLibrary.OrderStatus.Filled,
            "Invalid status"
        );

        order.status = status;
    }

    function cancelOrder(
        uint256 orderId,
        OrderLibrary.OrderType orderType
    ) public returns (bool) {
        OrderLibrary.Order storage order = orderBooks[orderType].orders[
            orderId
        ];

        require(order.userAddress == msg.sender, "Not order owner");
        require(
            order.status == OrderLibrary.OrderStatus.Active,
            "Order not active"
        );

        // Remove from active queue
        uint256 newQueueIndex = 0;
        uint256[] memory updatedQueue = new uint256[](
            orderBooks[orderType].activeCount - 1
        );
        for (uint256 i = 0; i < orderBooks[orderType].activeCount; i++) {
            if (orderBooks[orderType].queue[i] == orderId) {
                continue;
            }
            updatedQueue[newQueueIndex++] = orderBooks[orderType].queue[i];
        }

        order.status = OrderLibrary.OrderStatus.Cancelled;
        orderBooks[orderType].queue = updatedQueue;
        orderBooks[orderType].activeCount--;
        return true;
    }

    function getOrder(
        OrderLibrary.OrderType orderType,
        uint256 orderId
    ) internal view returns (OrderLibrary.Order memory) {
        return orderBooks[orderType].orders[orderId];
    }

    function getActiveOrderCount(
        OrderLibrary.OrderType orderType
    ) public view returns (uint256) {
        return orderBooks[orderType].activeCount;
    }

    function updateOrderBook(
        OrderLibrary.OrderType orderType,
        uint256 fulfilledOrderCount
    ) private {
        OrderBook storage book = orderBooks[orderType];
        uint256 updatedOrderCount = book.activeCount - fulfilledOrderCount;
        uint256[] memory updatedOrdersQueue = new uint256[](updatedOrderCount);
        for (uint256 i = 0; i < book.activeCount; i++) {
            updatedOrdersQueue[i] = book.queue[i + fulfilledOrderCount];
        }

        book.activeCount = updatedOrderCount;
        book.queue = updatedOrdersQueue;
    }
}
