// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";
import "./OrderBookData.sol";
import "hardhat/console.sol";

contract OrderBookManager {
    mapping(bytes32 => IOrderBookData) public marketOrderBooks;
    address public immutable marketManager;

    event OrderBookCreated(bytes32 indexed marketId, address orderBookAddress);

    constructor(address _marketManager) {
        marketManager = _marketManager;
    }

    function orderBookExists(bytes32 marketId) public view returns (bool) {
        return address(marketOrderBooks[marketId]) != address(0);
    }

    function createMarketOrderBook(bytes32 _marketId) public {
        require(
            address(marketOrderBooks[_marketId]) == address(0),
            "Order Book already exists"
        );
        // Deploy new OrderBookData contract for this market
        OrderBookData newOrderBook = new OrderBookData(address(this));
        marketOrderBooks[_marketId] = IOrderBookData(address(newOrderBook));

        emit OrderBookCreated(_marketId, address(newOrderBook));
    }

    function createOrder(
        bytes32 _marketId,
        uint256 _amount,
        uint256 _price,
        address _userAddress,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) public returns (uint256 _orderId) {
        require(orderBookExists(_marketId), "Order Book does not exist");
        uint256 orderId = marketOrderBooks[_marketId].addOrder(
            _amount,
            _price,
            _userAddress,
            _orderType,
            _orderNature
        );
        return orderId;
    }

    function cancelOrder(
        bytes32 _marketId,
        uint256 _orderId,
        OrderLibrary.OrderType _orderType
    ) public returns (bool) {
        require(orderBookExists(_marketId), "Order Book does not exist");
        bool removed = marketOrderBooks[_marketId].removeOrder(
            _orderType,
            _orderId
        );
        return removed;
    }

    // TODO: Check if this is the best way to do this
    function matchOrder(
        bytes32 _marketId,
        uint256 _pendingOrderId,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    )
        public
        returns (
            uint256,
            address[] memory toBePaid,
            address[] memory toReceive,
            uint256[] memory tokenAmount,
            uint256[] memory currencyAmount
        )
    {
        IOrderBookData marketOrderBook = marketOrderBooks[_marketId];
        OrderLibrary.Order memory pendingOrder = marketOrderBook.getOrderFromId(
            _orderType,
            _pendingOrderId
        );
        OrderLibrary.OrderType oppositeOrderType = _orderType ==
            OrderLibrary.OrderType.Buy
            ? OrderLibrary.OrderType.Sell
            : OrderLibrary.OrderType.Buy;

        uint256 matchCount = 0;
        uint256 remainingAmount = pendingOrder.remainingAmount;

        while (remainingAmount > 0) {
            uint256 tempBestOrderId = marketOrderBook.getBestOrderFromHeap(
                oppositeOrderType
            );
            if (tempBestOrderId == 0) break; // No more orders to match

            OrderLibrary.Order memory tempBestOrder = marketOrderBook
                .getOrderFromId(oppositeOrderType, tempBestOrderId);

            bool canMatch = _orderNature == OrderLibrary.OrderNature.Market ||
                (
                    _orderType == OrderLibrary.OrderType.Buy
                        ? pendingOrder.price >= tempBestOrder.price
                        : pendingOrder.price <= tempBestOrder.price
                );

            if (!canMatch) break;

            uint256 matchedAmount = remainingAmount <
                tempBestOrder.remainingAmount
                ? remainingAmount
                : tempBestOrder.remainingAmount;

            matchCount++;
            remainingAmount -= matchedAmount;
        }

        // Initialize arrays with the correct size
        toBePaid = new address[](matchCount);
        toReceive = new address[](matchCount);
        tokenAmount = new uint256[](matchCount);
        currencyAmount = new uint256[](matchCount);

        uint256 count = 0;
        uint256 pendingOrderNewAmount = pendingOrder.remainingAmount;

        while (pendingOrderNewAmount > 0 && count < matchCount) {
            uint256 bestOrderId = marketOrderBook.getBestOrderFromHeap(
                oppositeOrderType
            );
            if (bestOrderId == 0) break; // No more orders to match

            OrderLibrary.Order memory bestOrder = marketOrderBook
                .getOrderFromId(oppositeOrderType, bestOrderId);

            bool orderMatched = _orderNature ==
                OrderLibrary.OrderNature.Market ||
                (
                    _orderType == OrderLibrary.OrderType.Buy
                        ? pendingOrder.price >= bestOrder.price
                        : pendingOrder.price <= bestOrder.price
                );

            if (!orderMatched) break;

            uint256 matchedAmount = pendingOrderNewAmount <
                bestOrder.remainingAmount
                ? pendingOrderNewAmount
                : bestOrder.remainingAmount;

            // Safe array insertion since we pre-allocated the correct size
            if (_orderType == OrderLibrary.OrderType.Buy) {
                toBePaid[count] = bestOrder.userAddress;
                toReceive[count] = pendingOrder.userAddress;
            } else {
                toBePaid[count] = pendingOrder.userAddress;
                toReceive[count] = bestOrder.userAddress;
            }

            tokenAmount[count] = matchedAmount;
            currencyAmount[count] = matchedAmount * bestOrder.price;

            pendingOrderNewAmount -= matchedAmount;
            uint256 bestOrderNewAmount = bestOrder.remainingAmount -
                matchedAmount;

            // Update fills for both matched orders
            OrderLibrary.Fills memory pendingOrderNewReceipts = OrderLibrary
                .Fills({
                    price: bestOrder.price,
                    amount: matchedAmount,
                    timestamp: block.timestamp
                });
            OrderLibrary.Fills memory bestOrderNewReceipts = OrderLibrary
                .Fills({
                    price: bestOrder.price,
                    amount: matchedAmount,
                    timestamp: block.timestamp
                });

            // Update order statuses
            OrderLibrary.OrderStatus bestOrderNewStatus = bestOrderNewAmount ==
                0
                ? OrderLibrary.OrderStatus.Filled
                : OrderLibrary.OrderStatus.PartiallyFilled;

            OrderLibrary.OrderStatus pendingOrderNewStatus = pendingOrderNewAmount ==
                    0
                    ? OrderLibrary.OrderStatus.Filled
                    : OrderLibrary.OrderStatus.PartiallyFilled;

            if (bestOrderNewAmount == 0) {
                marketOrderBook.removeOrder(oppositeOrderType, bestOrderId);
            }

            if (pendingOrderNewAmount == 0) {
                marketOrderBook.removeOrder(_orderType, _pendingOrderId);
            }

            marketOrderBook.updateOrder(
                _orderType,
                _pendingOrderId,
                pendingOrderNewAmount,
                pendingOrderNewStatus,
                pendingOrderNewReceipts
            );

            marketOrderBook.updateOrder(
                oppositeOrderType,
                bestOrderId,
                bestOrderNewAmount,
                bestOrderNewStatus,
                bestOrderNewReceipts
            );

            count++;
        }

        return (
            pendingOrderNewAmount,
            toBePaid,
            toReceive,
            tokenAmount,
            currencyAmount
        );
    }

    function getAllOrdersForAMarketWithStatus(bytes32 _marketId, OrderLibrary.OrderStatus _orderStatus) external view {
        IOrderBookData orderBooks = marketOrderBooks[_marketId];

    }
}
