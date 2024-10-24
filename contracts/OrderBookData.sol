// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "contracts/OrderLibrary.sol";
import "eth-heap/contracts/Heap.sol";

contract OrderBookData {
    using Heap for Heap.Data;

    struct OrderBook {
        uint256 totalOrders;
        mapping(uint256 => OrderLibrary.Order) orders;
        uint256 activeCount;
        Heap.Data heap;
    }

    mapping(OrderLibrary.OrderType => OrderBook) internal orderBooks;

    constructor() {
        initOrderBook(OrderLibrary.OrderType.Buy);
        initOrderBook(OrderLibrary.OrderType.Sell);
    }

    // Initialize the heap for a specific order book
    function initOrderBook(OrderLibrary.OrderType _orderType) internal {
        orderBooks[_orderType].heap.init();
        orderBooks[_orderType].totalOrders = 0;
        orderBooks[_orderType].activeCount = 0;
    }

    // Adds a new order to the order book
    // NOTE: Use negative values of price to emulate a min-heap (for buy orderbook)
    function addOrder(
        uint256 _amount,
        int256 _price,
        address _userAddress,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) public returns (uint256 orderId) {
        OrderBook storage book = orderBooks[_orderType];
        orderId = book.totalOrders++;
        book.orders[orderId] = OrderLibrary.Order({
            totalAmount: _amount,
            remainingAmount: _amount,
            price: _price,
            timestamp: block.timestamp,
            userAddress: _userAddress,
            status: OrderLibrary.OrderStatus.Active,
            nature: _orderNature
        });
        book.activeCount++;

        // To emulate a min-heap for sell orders to always get the cheapest sell order as the root
        if(_orderType == OrderLibrary.OrderType.Sell){
            _price = -1 * _price;
        }
        book.heap.insert(orderId, _price);
        return orderId;
    }
    
    // Update Order Status (used for cancelling an order as this is just a status change)
    function updateOrderStatus(OrderLibrary.OrderType _orderType, uint256 _orderId, OrderLibrary.OrderStatus _neworderStatus) public{
        OrderLibrary.Order storage order = orderBooks[_orderType].orders[_orderId];
        require(newStatus != order.status, "Order is already in this status ");
        order.status = newStatus;
    }

    // Remove order from heap 
    function removeOrder(OrderLibrary.OrderType _orderType, uint256 _orderId) public{
        OrderBook storage book = orderBooks[_orderType];

        //Get Node from heap 
        Heap.Node memory deletedNode = book.heap.extractById(int128(_orderId));
        require(deletedNode.id == int128(_orderId), "Order not found in heap");

        //Cancel order and reduce active order count
        book.orders[_orderId].status = OrderLibrary.OrderStatus.Cancelled;
        book.activeCount--; 

    }

    // Retrieve the best order from the heap (top of the heap, based on price)
    function getBestOrderFromHeap(OrderLibrary.OrderType _orderType) public view returns (uint256) {
        OrderBook storage book = orderBooks[_orderType];
        Heap.Node memory rootNode = book.heap.getMax(); // Get the top node
        return uint256(rootNode.id);
    }
        
    // Retrieve buy/sell orders for a particular token pair 

    // Retrieve active orders?
    //FIXME: Check if needed at the end
}