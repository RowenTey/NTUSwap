// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";
import "./OrderBookData.sol";

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

        // OrderBook orderBook = marketOrderBook[oppositeOrderType];
        uint256 bestOrderId;
        uint256 pendingOrderNewAmount;

        toBePaid = new address[](
            marketOrderBook.getActiveOrderCount(oppositeOrderType)
        );
        toReceive = new address[](
            marketOrderBook.getActiveOrderCount(oppositeOrderType)
        );
        tokenAmount = new uint256[](
            marketOrderBook.getActiveOrderCount(oppositeOrderType)
        );
        currencyAmount = new uint256[](
            marketOrderBook.getActiveOrderCount(oppositeOrderType)
        );
        uint256 count = 0; // variable to track slot for the above arrays in which the current order's details are to be recorded

        if (_orderType == OrderLibrary.OrderType.Buy) {
            while (pendingOrder.remainingAmount > 0) {
                bestOrderId = marketOrderBook.getBestOrderFromHeap(
                    oppositeOrderType
                );
                OrderLibrary.Order memory bestOrder = marketOrderBook
                    .getOrderFromId(oppositeOrderType, bestOrderId);

                bool orderMatched = false;

                if (_orderNature == OrderLibrary.OrderNature.Market) {
                    // need to match immediately
                    orderMatched = true;
                } else {
                    // Limit: match at that price or lesser in sell order book
                    if (pendingOrder.price >= bestOrder.price) {
                        orderMatched = true;
                    } else {
                        break;
                    }
                }
                if (orderMatched) {
                    uint256 matchedAmount = pendingOrder.remainingAmount <
                        bestOrder.remainingAmount
                        ? pendingOrder.remainingAmount
                        : bestOrder.remainingAmount;
                    // TODO: Check if the meaning interpreted is correct here
                    toBePaid[count] = bestOrder.userAddress; // This user is the seller so he is paid the amount to buy a commodity
                    toReceive[count] = pendingOrder.userAddress; // This user is the buyer so he receives the commodity
                    tokenAmount[count] = matchedAmount;
                    currencyAmount[count] = matchedAmount * bestOrder.price;
                    count++;

                    // Update remaining amount
                    pendingOrderNewAmount =
                        pendingOrder.remainingAmount -
                        matchedAmount;
                    uint256 bestOrderNewAmount = bestOrder.remainingAmount -
                        matchedAmount;

                    // Update fills for both matched orders
                    OrderLibrary.Fills
                        memory pendingOrderNewReceipts = OrderLibrary.Fills({
                            price: bestOrder.price,
                            amount: matchedAmount,
                            timestamp: block.timestamp
                        });
                    OrderLibrary.Fills
                        memory bestOrderNewReceipts = OrderLibrary.Fills({
                            price: bestOrder.price,
                            amount: matchedAmount,
                            timestamp: block.timestamp
                        });

                    // Update order status for sell order that was either fully or partially matched
                    OrderLibrary.OrderStatus bestOrderNewStatus;
                    if (bestOrderNewAmount == 0) {
                        bestOrderNewStatus = OrderLibrary.OrderStatus.Filled;
                        marketOrderBook.removeOrder(
                            oppositeOrderType,
                            bestOrderId
                        );
                    } else {
                        bestOrderNewStatus = OrderLibrary
                            .OrderStatus
                            .PartiallyFilled;
                    }

                    // Update order status for the pending buy order that was either fully or partially matched
                    OrderLibrary.OrderStatus pendingOrderNewStatus;
                    if (pendingOrderNewAmount == 0) {
                        pendingOrderNewStatus = OrderLibrary.OrderStatus.Filled;
                        marketOrderBook.removeOrder(
                            _orderType,
                            _pendingOrderId
                        );
                    } else {
                        pendingOrderNewStatus = OrderLibrary
                            .OrderStatus
                            .PartiallyFilled;
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
                } else {
                    break;
                }
            }
        } else {
            while (pendingOrder.remainingAmount > 0) {
                bestOrderId = marketOrderBook.getBestOrderFromHeap(
                    oppositeOrderType
                );
                OrderLibrary.Order memory bestOrder = marketOrderBook
                    .getOrderFromId(oppositeOrderType, bestOrderId);

                bool orderMatched = false;

                if (_orderNature == OrderLibrary.OrderNature.Market) {
                    // order matched immediately order nature is market
                    orderMatched = true;
                } else {
                    // order matched only if price in buy order book is greater than or equal to the price in sell order
                    if (pendingOrder.price <= bestOrder.price) {
                        orderMatched = true;
                    } else {
                        break;
                    }
                }

                if (orderMatched) {
                    uint256 matchedAmount = pendingOrder.remainingAmount <
                        bestOrder.remainingAmount
                        ? pendingOrder.remainingAmount
                        : bestOrder.remainingAmount;
                    toBePaid[count] = pendingOrder.userAddress;
                    toReceive[count] = bestOrder.userAddress;
                    tokenAmount[count] = matchedAmount;
                    currencyAmount[count] = matchedAmount * bestOrder.price;
                    count++;

                    // Update the remaining amount
                    pendingOrderNewAmount =
                        pendingOrder.remainingAmount -
                        matchedAmount;
                    uint256 bestOrderNewAmount = bestOrder.remainingAmount -
                        matchedAmount;

                    // Update fills for both matched orders
                    OrderLibrary.Fills
                        memory pendingOrderNewReceipts = OrderLibrary.Fills({
                            price: bestOrder.price,
                            amount: matchedAmount,
                            timestamp: block.timestamp
                        });
                    OrderLibrary.Fills
                        memory bestOrderNewReceipts = OrderLibrary.Fills({
                            price: bestOrder.price,
                            amount: matchedAmount,
                            timestamp: block.timestamp
                        });

                    OrderLibrary.OrderStatus bestOrderNewStatus;
                    // Update order status for sell order that was either fully or partially matched
                    if (bestOrderNewAmount == 0) {
                        bestOrderNewStatus = OrderLibrary.OrderStatus.Filled;
                        marketOrderBook.removeOrder(
                            oppositeOrderType,
                            bestOrderId
                        );
                    } else {
                        bestOrderNewStatus = OrderLibrary
                            .OrderStatus
                            .PartiallyFilled;
                    }

                    // Update order status for the pending buy order that was either fully or partially matched
                    OrderLibrary.OrderStatus pendingOrderNewStatus;
                    if (pendingOrderNewAmount == 0) {
                        pendingOrderNewStatus = OrderLibrary.OrderStatus.Filled;
                        marketOrderBook.removeOrder(
                            _orderType,
                            _pendingOrderId
                        );
                    } else {
                        pendingOrderNewStatus = OrderLibrary
                            .OrderStatus
                            .PartiallyFilled;
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
                } else {
                    break;
                }
            }
        }
        return (
            pendingOrderNewAmount,
            toBePaid,
            toReceive,
            tokenAmount,
            currencyAmount
        );
    }
}
