// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";

// import "hardhat/console.sol";

interface IOrderBookData {
    function initializeOrderBooks() external;

    function addOrder(
        uint256 _amount,
        int256 _price,
        address _userAddress,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) external returns (uint256);

    function removeOrder(
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature,
        uint256 _orderId
    ) external returns (bool);

    function getBestOrderFromHeap(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256);

    function getOrderFromId(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId
    ) external view returns (OrderLibrary.Order memory);

    function getTotalOrderCount(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256);

    function updateOrder(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId,
        uint256 _remainingAmount,
        OrderLibrary.OrderStatus _status,
        OrderLibrary.Fills memory _orderReceipts
    ) external;


    function getAllPendingMarketOrders(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256[] memory);

    function getAllOrdersWithFilters(
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
        );
}

contract OrderBookData is IOrderBookData {
    address public immutable orderBookManager;

    struct OrderBook {
        uint256 totalOrders;
        mapping(uint256 => OrderLibrary.Order) orders;
        uint256 activeCount;
        Data heap;
        uint256[] marketOrderIds;
    }

    mapping(OrderLibrary.OrderType => OrderBook) internal orderBooks;

    modifier onlyManager() {
        require(
            msg.sender == orderBookManager,
            "Caller is not the order book manager"
        );
        _;
    }

    constructor(address _orderBookManager) {
        orderBookManager = _orderBookManager;
        initializeOrderBooks();
    }

    function initializeOrderBooks() public override onlyManager {
        initOrderBook(OrderLibrary.OrderType.Buy);
        initOrderBook(OrderLibrary.OrderType.Sell);
    }

    // Initialize the heap for a specific order book
    function initOrderBook(OrderLibrary.OrderType _orderType) private {
        heapInit(orderBooks[_orderType].heap);
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
    ) public override onlyManager returns (uint256 orderId) {
        OrderBook storage book = orderBooks[_orderType];
        book.totalOrders++;
        orderId = book.totalOrders;

        book.orders[orderId] = OrderLibrary.Order({
            totalAmount: _amount,
            remainingAmount: _amount,
            price: _price,
            timestamp: block.timestamp,
            userAddress: _userAddress,
            status: OrderLibrary.OrderStatus.Active,
            nature: _orderNature,
            fillsPrice: new int256[](0),
            fillsAmount: new uint256[](0),
            fillsTimestamp: new uint256[](0)
        });
        book.activeCount++;

        // insert only limit orders into the heap
        if (_orderNature == OrderLibrary.OrderNature.Limit) {
            // To emulate a min-heap for sell orders to always get the cheapest sell order as the root
            int256 price = _orderType == OrderLibrary.OrderType.Sell
                ? -_price
                : int256(_price);
            insertHeap(book.heap, orderId, price, book.orders[orderId].timestamp);
        } else {
            book.marketOrderIds.push(orderId);
        }
        return orderId;
    }

    function updateOrder(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId,
        uint256 _remainingAmount,
        OrderLibrary.OrderStatus _status,
        OrderLibrary.Fills memory _orderReceipt
    ) public {
        OrderLibrary.Order storage order = orderBooks[_orderType].orders[
            _orderId
        ];
        order.remainingAmount = _remainingAmount;
        order.status = _status;
        order.fillsPrice.push(_orderReceipt.price);
        order.fillsAmount.push(_orderReceipt.amount);
        order.fillsTimestamp.push(_orderReceipt.timestamp);
    }

    // Update Order Status (used for cancelling an order as this is just a status change)
    function updateOrderStatus(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId,
        OrderLibrary.OrderStatus _newOrderStatus
    ) public {
        OrderLibrary.Order storage order = orderBooks[_orderType].orders[
            _orderId
        ];
        require(
            _newOrderStatus != order.status,
            "Order is already in this status "
        );
        order.status = _newOrderStatus;
    }

    // Remove order
    function removeOrder(
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature,
        uint256 _orderId
    ) external returns (bool) {
        // Check if order exists
        require(
            orderBooks[_orderType].orders[_orderId].status ==
                OrderLibrary.OrderStatus.Active ||
                orderBooks[_orderType].orders[_orderId].status ==
                OrderLibrary.OrderStatus.PartiallyFilled,
            "Order is not Active"
        );
        if (_orderNature == OrderLibrary.OrderNature.Limit) {
            // Get Node from heap
            Node memory deletedNode = extractById(
                orderBooks[_orderType].heap,
                _orderId
            );
            if (deletedNode.id != _orderId) {
                return false; //Order not in heap
            }
        } else {
            require(
                orderBooks[_orderType].marketOrderIds.length > 0,
                "Array is empty"
            );
            uint idx;
            for(uint i = 0; i < orderBooks[_orderType].marketOrderIds.length; i++) {
                if(orderBooks[_orderType].marketOrderIds[i] == _orderId) {
                    idx = i;
                    break;
                }
            }
            for (
                uint i = idx;
                i < orderBooks[_orderType].marketOrderIds.length - 1;
                i++
            ) {
                orderBooks[_orderType].marketOrderIds[i] = orderBooks[
                    _orderType
                ].marketOrderIds[i + 1];
            }

            orderBooks[_orderType].marketOrderIds.pop();
        }

        // Cancel order and reduce active order count
        updateOrderStatus(
            _orderType,
            _orderId,
            OrderLibrary.OrderStatus.Cancelled
        );
        orderBooks[_orderType].activeCount--;

        return true; // Order removed successfully
    }

    // Retrieve the best order from the heap (top of the heap, based on price)
    function getBestOrderFromHeap(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256) {
        Node memory rootNode = getMax(orderBooks[_orderType].heap); // Get the top node
        return uint256(rootNode.id);
    }

    function getAllPendingMarketOrders(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256[] memory) {
        return orderBooks[_orderType].marketOrderIds;
    }

    function getOrderFromId(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId
    ) external view returns (OrderLibrary.Order memory) {
        OrderBook storage book = orderBooks[_orderType];
        return book.orders[_orderId];
    }

    function getTotalOrderCount(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256) {
        return orderBooks[_orderType].totalOrders;
    }

    function getAllOrdersWithFilters(
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
        OrderLibrary.OrderStatus status2 = params.status;
        if (params.status == OrderLibrary.OrderStatus.Active) {
            status2 = OrderLibrary.OrderStatus.PartiallyFilled;
        }

        uint256 matchingOrders = 0;
        for (
            uint256 i = 1;
            i <= orderBooks[OrderLibrary.OrderType.Buy].totalOrders;
            i++
        ) {
            OrderLibrary.Order memory order = orderBooks[
                OrderLibrary.OrderType.Buy
            ].orders[i];
            if (
                (order.status == params.status || order.status == status2) &&
                (!params.filterByUser ||
                    params.userAddress == order.userAddress)
            ) {
                matchingOrders++;
            }
        }
        for (
            uint256 i = 1;
            i <= orderBooks[OrderLibrary.OrderType.Sell].totalOrders;
            i++
        ) {
            OrderLibrary.Order memory order = orderBooks[
                OrderLibrary.OrderType.Sell
            ].orders[i];
            if (
                (order.status == params.status || order.status == status2) &&
                (!params.filterByUser ||
                    params.userAddress == order.userAddress)
            ) {
                matchingOrders++;
            }
        }

        amount = new uint256[](matchingOrders);
        price = new int256[](matchingOrders);
        orderType = new OrderLibrary.OrderType[](matchingOrders);
        nature = new OrderLibrary.OrderNature[](matchingOrders);
        fillsPrice = new int256[][](matchingOrders);
        fillsAmount = new uint256[][](matchingOrders);
        fillsTimestamp = new uint256[][](matchingOrders);

        uint256 currentIndex = 0;

        // Process buy orders
        for (
            uint256 i = 1;
            i <= orderBooks[OrderLibrary.OrderType.Buy].totalOrders;
            i++
        ) {
            OrderLibrary.Order memory order = orderBooks[
                OrderLibrary.OrderType.Buy
            ].orders[i];
            if (
                (order.status == params.status || order.status == status2) &&
                (!params.filterByUser ||
                    params.userAddress == order.userAddress)
            ) {
                amount[currentIndex] = order.remainingAmount;
                price[currentIndex] = order.price;
                orderType[currentIndex] = OrderLibrary.OrderType.Buy;
                nature[currentIndex] = order.nature;

                fillsPrice[currentIndex] = new int256[](
                    order.fillsPrice.length
                );
                fillsAmount[currentIndex] = new uint256[](
                    order.fillsAmount.length
                );
                fillsTimestamp[currentIndex] = new uint256[](
                    order.fillsTimestamp.length
                );

                for (uint256 j = 0; j < order.fillsPrice.length; j++) {
                    fillsPrice[currentIndex][j] = order.fillsPrice[j];
                    fillsAmount[currentIndex][j] = order.fillsAmount[j];
                    fillsTimestamp[currentIndex][j] = order.fillsTimestamp[j];
                }

                currentIndex++;
            }
        }

        // Process sell orders
        for (
            uint256 i = 1;
            i <= orderBooks[OrderLibrary.OrderType.Sell].totalOrders;
            i++
        ) {
            OrderLibrary.Order memory order = orderBooks[
                OrderLibrary.OrderType.Sell
            ].orders[i];
            if (
                (order.status == params.status || order.status == status2) &&
                (!params.filterByUser ||
                    params.userAddress == order.userAddress)
            ) {
                amount[currentIndex] = order.remainingAmount;
                price[currentIndex] = order.price;
                orderType[currentIndex] = OrderLibrary.OrderType.Sell;
                nature[currentIndex] = order.nature;

                fillsPrice[currentIndex] = new int256[](
                    order.fillsPrice.length
                );
                fillsAmount[currentIndex] = new uint256[](
                    order.fillsAmount.length
                );
                fillsTimestamp[currentIndex] = new uint256[](
                    order.fillsTimestamp.length
                );

                for (uint256 j = 0; j < order.fillsPrice.length; j++) {
                    fillsPrice[currentIndex][j] = order.fillsPrice[j];
                    fillsAmount[currentIndex][j] = order.fillsAmount[j];
                    fillsTimestamp[currentIndex][j] = order.fillsTimestamp[j];
                }

                currentIndex++;
            }
        }

        return (
            amount,
            price,
            orderType,
            nature,
            fillsPrice,
            fillsAmount,
            fillsTimestamp
        );
    }

    // Custom Heap Implementation
    uint constant ROOT_INDEX = 1;

    struct Data {
        uint256 idCount;
        Node[] nodes; // root is index 1; index 0 not used
        mapping(uint256 => uint) indices; // unique id => node index
    }   

    struct Node {
        uint256 id; // use with another mapping to store arbitrary object types
        int256 price;
        uint256 timestamp; //timestamp to decide priority of older unfulfilled orders in the heap 
    }

    // Call init before anything else
    function heapInit(Data storage data) private {
        if (data.nodes.length == 0) data.nodes.push(Node(0, 0, 0));
    }

    function insertHeap(
        Data storage data,
        uint256 orderId,
        int256 price,
        uint256 timestamp
    ) private returns (Node memory) {
        if (data.nodes.length == 0) heapInit(data);
        data.idCount++;
        Node memory n = Node(orderId, price, timestamp);
        data.nodes.push(n);
        _bubbleUp(data, n, data.nodes.length - 1);
        return n;
    }


    function extractMax(Data storage data) private returns (Node memory) {
        return _extract(data, ROOT_INDEX);
    }

    function extractById(
        Data storage data,
        uint256 id
    ) private returns (Node memory) {
        return _extract(data, data.indices[id]);
    }

    // View functions
    function dump(Data storage data) private view returns (Node[] memory) {
        return data.nodes;
    }

    function getById(
        Data storage data,
        uint256 id
    ) private view returns (Node memory) {
        return getByIndex(data, data.indices[id]);
    }

    function getByIndex(
        Data storage data,
        uint256 i
    ) private view returns (Node memory) {
        return data.nodes.length > i ? data.nodes[i] : Node(0, 0 , 0);
    }

    function getMax(Data storage data) private view returns (Node memory) {
        return getByIndex(data, ROOT_INDEX);
    }

    function size(Data storage data) private view returns (uint) {
        return data.nodes.length > 0 ? data.nodes.length - 1 : 0;
    }

    function isNode(Node memory n) private pure returns (bool) {
        return n.id > 0;
    }

    function _extract(
        Data storage data,
        uint256 i
    ) private returns (Node memory) {
        if (data.nodes.length <= i || i <= 0) return Node(0, 0, 0);

        Node memory extractedNode = data.nodes[i];
        delete data.indices[extractedNode.id];

        Node memory tailNode = data.nodes[data.nodes.length - 1];
        data.nodes.pop(); // Replaces `data.nodes.length--`

        if (i < data.nodes.length) {
            // if extracted node was not tail
            _bubbleUp(data, tailNode, i);
            _bubbleDown(data, data.nodes[i], i); // then try bubbling down
        }
        return extractedNode;
    }

    function _bubbleUp(Data storage data, Node memory n, uint i) private {
        if (
            i == ROOT_INDEX || 
            (n.price < data.nodes[i / 2].price || 
            (n.price == data.nodes[i / 2].price && n.timestamp >= data.nodes[i / 2].timestamp))
        ) {
            _insertHeap(data, n, i);
        } else {
            _insertHeap(data, data.nodes[i / 2], i);
            _bubbleUp(data, n, i / 2);
        }
    }


    function _bubbleDown(Data storage data, Node memory n, uint i) private {
        uint length = data.nodes.length;
        uint cIndex = i * 2; // left child index

        if (length <= cIndex) {
            _insertHeap(data, n, i);
        } else {
            Node memory highestPriorityChild = data.nodes[cIndex];

            if (
                length > cIndex + 1 &&
                (data.nodes[cIndex + 1].price > highestPriorityChild.price || 
                (data.nodes[cIndex + 1].price == highestPriorityChild.price &&
                data.nodes[cIndex + 1].timestamp < highestPriorityChild.timestamp))
            ) {
                highestPriorityChild = data.nodes[++cIndex];
            }

            if (
                highestPriorityChild.price < n.price ||
                (highestPriorityChild.price == n.price && highestPriorityChild.timestamp >= n.timestamp)
            ) {
                _insertHeap(data, n, i);
            } else {
                _insertHeap(data, highestPriorityChild, i);
                _bubbleDown(data, n, cIndex);
            }
        }
    }


    function _insertHeap(Data storage data, Node memory n, uint i) private {
        data.nodes[i] = n;
        data.indices[n.id] = i;
    }

}
