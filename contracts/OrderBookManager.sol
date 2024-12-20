// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";
import "./OrderBookData.sol";
import "./TokenManager.sol";
import "hardhat/console.sol";

contract OrderBookManager {
    event OrderBookCreatedEvent(
        bytes32 indexed marketId,
        address orderBookAddress
    );

    event OrderPlacedEvent(uint256 orderId);
    event OrderCancelledEvent(uint256 orderId);
    event OrderFilledEvent(OrderLibrary.OrderType orderType, uint256 orderId);
    event OrderPartiallyFilledEvent(
        OrderLibrary.OrderType orderType,
        uint256 orderId
    );

    mapping(bytes32 => IOrderBookData) public marketOrderBooks;
    TokenManager public tokenManager;
    bool private initialized;

    modifier onlyInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    constructor() {
        initialized = false;
    }

    function initialize(address _tokenManagerAddr) external {
        require(!initialized, "Already initialized");
        require(
            _tokenManagerAddr != address(0),
            "Invalid token manager address"
        );
        tokenManager = TokenManager(_tokenManagerAddr);
        initialized = true;
    }

    function orderBookExists(bytes32 marketId) public view returns (bool) {
        return address(marketOrderBooks[marketId]) != address(0);
    }

    function createMarketOrderBook(bytes32 _marketId) public {
        require(
            address(marketOrderBooks[_marketId]) == address(0),
            "Order Book already exists"
        );
        console.log("[OrderBookManager] Creating Order Book for Market...");

        // Deploy new OrderBookData contract for this market
        OrderBookData newOrderBook = new OrderBookData(address(this));
        marketOrderBooks[_marketId] = IOrderBookData(address(newOrderBook));

        emit OrderBookCreatedEvent(_marketId, address(newOrderBook));
        console.log("[OrderBookManager] Order Book created for Market...");
    }

    function createOrder(
        bytes32 _marketId,
        uint256 _amount,
        int256 _price,
        address _userAddress,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) external returns (uint256 _orderId) {
        require(orderBookExists(_marketId), "Order Book does not exist");
        uint256 orderId = marketOrderBooks[_marketId].addOrder(
            _amount,
            _price,
            _userAddress,
            _orderType,
            _orderNature
        );
        emit OrderPlacedEvent(orderId);
        return orderId;
    }

    function cancelOrder(
        bytes32 _marketId,
        uint256 _orderId,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) external returns (bool) {
        require(orderBookExists(_marketId), "Order Book does not exist");
        bool removed = marketOrderBooks[_marketId].removeOrder(
            _orderType,
            _orderNature,
            _orderId
        );
        if (removed) {
            emit OrderCancelledEvent(_orderId);
        }
        return removed;
    }

    function matchOrder(
        bytes32 _marketId,
        uint256 _pendingOrderId,
        uint8 _exchangeTokenId,
        OrderLibrary.OrderType _orderType
    )
        external
        onlyInitialized
        returns (
            uint256,
            address[] memory toBePaid,
            address[] memory toReceive,
            uint256[] memory tokenAmount,
            int256[] memory currencyAmount
        )
    {
        IOrderBookData marketOrderBook = marketOrderBooks[_marketId];
        OrderLibrary.Order memory pendingOrder = marketOrderBook.getOrderFromId(
            _orderType,
            _pendingOrderId
        );
        require(
            pendingOrder.remainingAmount > 0,
            "Pending order is fully filled"
        );
        OrderLibrary.OrderType oppositeOrderType = _orderType ==
            OrderLibrary.OrderType.Buy
            ? OrderLibrary.OrderType.Sell
            : OrderLibrary.OrderType.Buy;

        uint256 remainingAmount = pendingOrder.remainingAmount;

        // Initialize arrays with the correct size
        uint256 size = marketOrderBook.getTotalOrderCount(oppositeOrderType);
        toBePaid = new address[](size);
        toReceive = new address[](size);
        tokenAmount = new uint256[](size);
        currencyAmount = new int256[](size);

        uint256 count = 0;
        uint256 pendingOrderNewAmount = pendingOrder.remainingAmount;

        if (pendingOrder.nature == OrderLibrary.OrderNature.Market) {
            bool flag = true;
            uint256 availableBalance = tokenManager.getBalance(
                pendingOrder.userAddress,
                _exchangeTokenId
            );
            while (flag && pendingOrder.remainingAmount > 0) {
                console.log("Available Balance: ", availableBalance);
                uint256 bestOrderId = marketOrderBook.getBestOrderFromHeap(
                    oppositeOrderType
                );
                // No opposite order present in the orderbook
                if (bestOrderId == 0) {
                    break;
                }
                OrderLibrary.Order memory bestOrder = marketOrderBook
                    .getOrderFromId(oppositeOrderType, bestOrderId);

                require(availableBalance > 0, "User has insufficient balance");

                int256 settlingPrice = bestOrder.price;
                uint256 minimumAmount;
                if (pendingOrderNewAmount <= bestOrder.remainingAmount) {
                    minimumAmount = pendingOrderNewAmount;
                    if (
                        availableBalance >=
                        ((minimumAmount * uint256(settlingPrice)) / 1 ether)
                    ) {
                        flag = false; // Market Order will get fully satisfied so no reason to look for more orders
                    } else {
                        minimumAmount =
                            (minimumAmount * uint256(settlingPrice)) /
                            (availableBalance * 1 ether);
                        flag = false; // Market Order will get partially filled but Limit Order will also get partially filled. Thus, market order will not be able to satisfy any more limit orders because of lack of user balance
                    }
                } else {
                    minimumAmount = bestOrder.remainingAmount;
                    if (
                        (minimumAmount * uint256(settlingPrice)) / 1 ether >
                        availableBalance
                    ) {
                        minimumAmount =
                            (minimumAmount * uint256(settlingPrice)) /
                            (availableBalance * 1 ether);
                        flag = false; // Market Order will get partially filled but Limit Order will also get partially filled. Thus, market order will not be able to satisfy any more limit orders because of lack of user balance
                    } else {
                        availableBalance -=
                            (minimumAmount * uint256(settlingPrice)) /
                            1 ether; // Limit Order is fully satisfied but Market order is only partially filled and will continue to look for next best order, so user balance is updated
                    }
                }

                uint256 matchedAmount = (minimumAmount *
                    uint256(settlingPrice)) / 1 ether;
                toBePaid[count] = _orderType == OrderLibrary.OrderType.Buy
                    ? bestOrder.userAddress
                    : pendingOrder.userAddress;
                toReceive[count] = _orderType == OrderLibrary.OrderType.Buy
                    ? pendingOrder.userAddress
                    : bestOrder.userAddress;
                tokenAmount[count] = minimumAmount;
                currencyAmount[count] = int256(matchedAmount);

                pendingOrderNewAmount -= minimumAmount;
                uint256 bestOrderNewAmount = bestOrder.remainingAmount -
                    minimumAmount;

                // Update fills for both matched orders
                OrderLibrary.Fills memory pendingOrderNewReceipts = OrderLibrary
                    .Fills({
                        price: settlingPrice,
                        amount: minimumAmount,
                        timestamp: block.timestamp
                    });
                OrderLibrary.Fills memory bestOrderNewReceipts = OrderLibrary
                    .Fills({
                        price: settlingPrice,
                        amount: minimumAmount,
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
                    marketOrderBook.removeOrder(
                        oppositeOrderType,
                        OrderLibrary.OrderNature.Limit,
                        bestOrderId
                    );

                    emit OrderFilledEvent(oppositeOrderType, bestOrderId);
                } else {
                    emit OrderPartiallyFilledEvent(
                        oppositeOrderType,
                        bestOrderId
                    );
                }

                if (pendingOrderNewAmount == 0) {
                    marketOrderBook.removeOrder(
                        _orderType,
                        OrderLibrary.OrderNature.Market,
                        _pendingOrderId
                    );

                    emit OrderFilledEvent(_orderType, _pendingOrderId);
                } else {
                    emit OrderPartiallyFilledEvent(_orderType, _pendingOrderId);
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
        } else {
            uint256[] memory pendingMarketOrders = marketOrderBook
                .getAllPendingMarketOrders(oppositeOrderType);
            uint i = 0;
            while (pendingOrderNewAmount > 0) {
                if (i == 0) {
                    while (
                        i < pendingMarketOrders.length &&
                        pendingOrderNewAmount > 0
                    ) {
                        console.log("Market Order: ", pendingMarketOrders[i]);
                        console.log(
                            "Pending Amount of the order: ",
                            pendingOrderNewAmount
                        );
                        OrderLibrary.Order memory marketOrder = marketOrderBook
                            .getOrderFromId(
                                oppositeOrderType,
                                pendingMarketOrders[i]
                            );
                        uint256 userBalance = tokenManager.getBalance(
                            marketOrder.userAddress,
                            _exchangeTokenId
                        );
                        console.log("User balance: ", userBalance);
                        require(userBalance > 0, "User balance is zero!");

                        int256 settlingPrice = pendingOrder.price;
                        uint256 minimumAmount = pendingOrderNewAmount <
                            marketOrder.remainingAmount
                            ? pendingOrderNewAmount
                            : marketOrder.remainingAmount;
                        console.log("Minimum Amount = ", minimumAmount);
                        console.log(
                            "Initial Amount to match = ",
                            (minimumAmount * uint256(settlingPrice)) / 1 ether
                        );
                        if (
                            userBalance <
                            ((minimumAmount * uint256(settlingPrice)) / 1 ether)
                        ) {
                            console.log(
                                "Entering if condition: Reducing Balance"
                            );
                            minimumAmount =
                                (minimumAmount * uint256(settlingPrice)) /
                                (userBalance * 1 ether);
                        }
                        console.log("Minimum Amount = ", minimumAmount);

                        uint256 amountToMatch = (minimumAmount *
                            uint256(settlingPrice)) / 1 ether;

                        console.log("Final Amount to match = ", amountToMatch);

                        toBePaid[count] = _orderType ==
                            OrderLibrary.OrderType.Buy
                            ? marketOrder.userAddress
                            : pendingOrder.userAddress;
                        toReceive[count] = _orderType ==
                            OrderLibrary.OrderType.Buy
                            ? pendingOrder.userAddress
                            : marketOrder.userAddress;
                        tokenAmount[count] = minimumAmount;
                        currencyAmount[count] = int256(amountToMatch);

                        pendingOrderNewAmount -= minimumAmount;
                        uint256 marketOrderNewAmount = marketOrder
                            .remainingAmount - minimumAmount;

                        console.log(
                            "Market Order New Amount = ",
                            marketOrderNewAmount
                        );
                        // Update fills for both matched orders
                        OrderLibrary.Fills
                            memory newPendingOrderReceipts = OrderLibrary
                                .Fills({
                                    price: settlingPrice,
                                    amount: minimumAmount,
                                    timestamp: block.timestamp
                                });
                        OrderLibrary.Fills
                            memory marketOrderNewReceipts = OrderLibrary.Fills({
                                price: settlingPrice,
                                amount: minimumAmount,
                                timestamp: block.timestamp
                            });

                        // Update order statuses
                        OrderLibrary.OrderStatus marketOrderNewStatus = marketOrderNewAmount ==
                                0
                                ? OrderLibrary.OrderStatus.Filled
                                : OrderLibrary.OrderStatus.PartiallyFilled;

                        OrderLibrary.OrderStatus newPendingOrderStatus = pendingOrderNewAmount ==
                                0
                                ? OrderLibrary.OrderStatus.Filled
                                : OrderLibrary.OrderStatus.PartiallyFilled;

                        if (marketOrderNewAmount == 0) {
                            console.log("Removing Market Order");
                            marketOrderBook.removeOrder(
                                oppositeOrderType,
                                OrderLibrary.OrderNature.Market,
                                pendingMarketOrders[i]
                            );

                            emit OrderFilledEvent(
                                oppositeOrderType,
                                pendingMarketOrders[i]
                            );
                        } else {
                            emit OrderPartiallyFilledEvent(
                                oppositeOrderType,
                                pendingMarketOrders[i]
                            );
                        }

                        if (pendingOrderNewAmount == 0) {
                            console.log("Removing Pending Order");
                            marketOrderBook.removeOrder(
                                _orderType,
                                OrderLibrary.OrderNature.Limit,
                                _pendingOrderId
                            );

                            emit OrderFilledEvent(_orderType, _pendingOrderId);
                        } else {
                            emit OrderPartiallyFilledEvent(
                                _orderType,
                                _pendingOrderId
                            );
                        }

                        marketOrderBook.updateOrder(
                            _orderType,
                            _pendingOrderId,
                            pendingOrderNewAmount,
                            newPendingOrderStatus,
                            newPendingOrderReceipts
                        );

                        marketOrderBook.updateOrder(
                            oppositeOrderType,
                            pendingMarketOrders[i],
                            marketOrderNewAmount,
                            marketOrderNewStatus,
                            marketOrderNewReceipts
                        );

                        count++;
                        i++;
                    }
                }

                if (pendingOrderNewAmount == 0) {
                    break;
                }

                uint256 bestOrderId = marketOrderBook.getBestOrderFromHeap(
                    oppositeOrderType
                );
                if (bestOrderId == 0) break; // No more orders to match

                OrderLibrary.Order memory bestOrder = marketOrderBook
                    .getOrderFromId(oppositeOrderType, bestOrderId);

                bool orderMatched = _orderType == OrderLibrary.OrderType.Buy
                    ? pendingOrder.price >= bestOrder.price
                    : pendingOrder.price <= bestOrder.price;
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
                currencyAmount[count] = int256(
                    (matchedAmount * uint256(bestOrder.price)) / 1 ether
                );

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
                    marketOrderBook.removeOrder(
                        oppositeOrderType,
                        OrderLibrary.OrderNature.Limit,
                        bestOrderId
                    );

                    emit OrderFilledEvent(oppositeOrderType, bestOrderId);
                } else {
                    emit OrderPartiallyFilledEvent(
                        oppositeOrderType,
                        bestOrderId
                    );
                }

                if (pendingOrderNewAmount == 0) {
                    marketOrderBook.removeOrder(
                        _orderType,
                        OrderLibrary.OrderNature.Limit,
                        _pendingOrderId
                    );
                    emit OrderFilledEvent(_orderType, _pendingOrderId);
                } else {
                    emit OrderPartiallyFilledEvent(_orderType, _pendingOrderId);
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
        }

        return (
            pendingOrderNewAmount,
            toBePaid,
            toReceive,
            tokenAmount,
            currencyAmount
        );
    }

    function getAllOrdersForAMarket(
        bytes32 _marketId,
        OrderLibrary.AllOrdersQueryParams memory params
    )
        external
        view
        returns (
            uint256[] memory amount,
            int256[] memory price,
            uint256[] memory orderIds,
            OrderLibrary.OrderType[] memory orderType,
            OrderLibrary.OrderNature[] memory nature,
            int256[][] memory fillsPrice,
            uint256[][] memory fillsAmount,
            uint256[][] memory fillsTimestamp
        )
    {
        IOrderBookData orderBook = marketOrderBooks[_marketId];
        return orderBook.getAllOrdersWithFilters(params);
    }

    function getBestPriceInMarket(
        OrderLibrary.OrderType _orderType,
        bytes32 _marketId
    ) external view returns (int256) {
        IOrderBookData marketOrderBook = marketOrderBooks[_marketId];
        uint256 orderId = marketOrderBook.getBestOrderFromHeap(_orderType);
        return marketOrderBook.getOrderFromId(_orderType, orderId).price;
    }
}
