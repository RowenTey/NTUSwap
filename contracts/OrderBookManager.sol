// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";
import "./OrderBookData.sol";
import "./TokenManager.sol";

// import "hardhat/console.sol";

contract OrderBookManager {
    event OrderBookCreated(bytes32 indexed marketId, address orderBookAddress);

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
        require(_tokenManagerAddr != address(0), "Invalid token manager address");
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
        // Deploy new OrderBookData contract for this market
        OrderBookData newOrderBook = new OrderBookData(address(this));
        marketOrderBooks[_marketId] = IOrderBookData(address(newOrderBook));

        emit OrderBookCreated(_marketId, address(newOrderBook));
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
        return removed;
    }

    function matchOrder(
        bytes32 _marketId,
        uint256 _pendingOrderId,
        uint8 _exchangeTokenId,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
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

        if (pendingOrder.nature == OrderLibrary.OrderNature.Market){
            // get opposite order type's orderbook
            // go through all the limit orders in the heap, for each order, check if the user has that much balance
            // satisfy however much is possible and then update the status of all orders involved
            // For market order, its only executed once, however much it can be executed.

            while(tokenManager.getBalance(pendingOrder.userAddress, _exchangeTokenId) > 0){
                uint256 bestOrderId = marketOrderBook.getBestOrderFromHeap(oppositeOrderType);
                //deal with no orders of opposite type
                if (bestOrderId == 0) break;
                // if a opposite  order found in heap, use this price and amount to settle current pending market order 
                OrderLibrary.Order memory bestOrder = marketOrderBook.getOrderFromId(oppositeOrderType, bestOrderId);
                uint256 availableBalance = tokenManager.getBalance(pendingOrder.userAddress, _exchangeTokenId);
                int256 settlingPrice = bestOrder.price;

                int256 minAmount = pendingOrderNewAmount < bestOrder.remainingAmount ? int256(pendingOrderNewAmount) : int256(bestOrder.remainingAmount);

                // Insufficient balance 
                if (int256(availableBalance) < (minAmount * settlingPrice)) {
                    minAmount = int256(availableBalance) / settlingPrice;
                }



            }
            


        }

        while (pendingOrderNewAmount > 0) {
            // uint256[] memory pendingMarketOrders = marketOrderBook.getAllPendingMarketOrders(oppositeOrderType);
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

    function getAllOrdersForAMarket(
        bytes32 _marketId,
        OrderLibrary.AllOrdersQueryParams memory params
    )
        external
        view
        returns (
            uint256[] memory amount,
            int256[] memory price,
            OrderLibrary.OrderType[] memory orderType,
            OrderLibrary.OrderNature[] memory nature,
            int256[][] memory fillsPrice,
            uint256[][] memory fillsAmount,
            uint256[][] memory fillsTimestamp
        )
    {
        return marketOrderBooks[_marketId].getAllOrdersWithFilters(params);
    }
}
