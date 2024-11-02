// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "contracts/OrderLibrary.sol";

interface IOrderBookData {
    function initializeOrderBooks() external;
    function addOrder(
        uint256 _amount,
        uint256 _price,
        address _userAddress,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) external returns (uint256);
    function removeOrder(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId
    ) external returns (bool);
    function getBestOrderFromHeap(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256);
    function getOrderFromId(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId
    ) external view returns (OrderLibrary.Order memory);
    function getActiveOrderCount(
        OrderLibrary.OrderType _orderType
    ) external view returns (uint256);
    function updateOrder(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId,
        uint256 _remainingAmount,
        OrderLibrary.OrderStatus _status,
        OrderLibrary.Fills memory _orderReceipts
    ) external;
}

contract OrderBookData is IOrderBookData {

    address public immutable orderBookManager;

    struct OrderBook {
        uint256 totalOrders;
        mapping(uint256 => OrderLibrary.Order) orders;
        uint256 activeCount;
        Data heap;
    }

    mapping(OrderLibrary.OrderType => OrderBook) internal orderBooks;

    modifier onlyManager() {
        require(msg.sender == orderBookManager, "Caller is not the order book manager");
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
        uint256 _price,
        address _userAddress,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) public override onlyManager returns (uint256 orderId) {
        OrderBook storage book = orderBooks[_orderType];
        orderId = book.totalOrders++;

        book.orders[orderId] = OrderLibrary.Order({
            totalAmount: _amount,
            remainingAmount: _amount,
            price: _price,
            timestamp: block.timestamp,
            userAddress: _userAddress,
            status: OrderLibrary.OrderStatus.Active,
            nature: _orderNature,
            fills: new OrderLibrary.Fills[](0)
        });
        book.activeCount++;

        // To emulate a min-heap for sell orders to always get the cheapest sell order as the root
        int256 price;
        if (_orderType == OrderLibrary.OrderType.Sell) {
            price = -1 * int256(_price);
        }
        insertHeap(book.heap, orderId, price);
        return orderId;
    }

    function updateOrder(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId,
        uint256 _remainingAmount,
        OrderLibrary.OrderStatus _status,
        OrderLibrary.Fills memory _orderReceipts
    ) public {
        OrderLibrary.Order storage order = orderBooks[_orderType].orders[
            _orderId
        ];
        order.remainingAmount = _remainingAmount;
        order.status = _status;
        order.fills.push(_orderReceipts);
    }

    // Update Order Status (used for cancelling an order as this is just a status change)
    function updateOrderStatus(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId,
        OrderLibrary.OrderStatus _neworderStatus
    ) public {
        OrderLibrary.Order storage order = orderBooks[_orderType].orders[
            _orderId
        ];
        require(
            _neworderStatus != order.status,
            "Order is already in this status "
        );
        order.status = _neworderStatus;
    }

    // // Update Fills struct to note transactions done on the order
    // function updateOrderReceipts(
    //     OrderLibrary.OrderType _orderType,
    //     uint256 _orderId,
    //     OrderLibrary.Fills memory _orderReceipts
    // ) public {
    //     OrderLibrary.Order storage order = orderBooks[_orderType].orders[
    //         _orderId
    //     ];
    //     order.fills.push(_orderReceipts);
    // }

    // Remove order from heap
    function removeOrder(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId
    ) public returns (bool) {
        OrderBook storage book = orderBooks[_orderType];

        // Check if order exists
        require(
            book.orders[_orderId].status == OrderLibrary.OrderStatus.Active,
            "Order is not Active"
        );

        // Get Node from heap
        Node memory deletedNode = extractById(book.heap, _orderId);
        if (deletedNode.id != _orderId) {
            return false; //Order not in heap
        }

        // Cancel order and reduce active order count
        updateOrderStatus(
            _orderType,
            _orderId,
            OrderLibrary.OrderStatus.Cancelled
        );
        book.activeCount--;

        return true; // Order removed successfully
    }

    // Retrieve the best order from the heap (top of the heap, based on price)
    function getBestOrderFromHeap(
        OrderLibrary.OrderType _orderType
    ) public view returns (uint256) {
        OrderBook storage book = orderBooks[_orderType];
        Node memory rootNode = getMax(book.heap); // Get the top node
        return uint256(rootNode.id);
    }

    function getOrderFromId(
        OrderLibrary.OrderType _orderType,
        uint256 _orderId
    ) public view returns (OrderLibrary.Order memory) {
        OrderBook storage book = orderBooks[_orderType];
        return book.orders[_orderId];
    }

    // Retrieve buy/sell orders for a particular token pair

    // Retrieve active orders?
    function getActiveOrderCount(
        OrderLibrary.OrderType _orderType
    ) public view returns (uint256) {
        return orderBooks[_orderType].activeCount;
    }

    //FIXME: Check if needed at the end

    // Custom Heap Implementation
    uint constant ROOT_INDEX = 1;

    struct Data {
        uint256 idCount;
        Node[] nodes; // root is index 1; index 0 not used
        mapping(uint256 => uint) indices; // unique id => node index
    }

    struct Node {
        uint256 id; // use with another mapping to store arbitrary object types
        int256 priority;
    }

    // Call init before anything else
    function heapInit(Data storage data) private {
        if (data.nodes.length == 0) data.nodes.push(Node(0, 0));
    }

    function insertHeap(
        Data storage data,
        uint256 orderId,
        int256 priority
    ) private returns (Node memory) {
        if (data.nodes.length == 0) heapInit(data);
        data.idCount++;
        Node memory n = Node(orderId, priority);
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
        return data.nodes.length > i ? data.nodes[i] : Node(0, 0);
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
        if (data.nodes.length <= i || i <= 0) return Node(0, 0);

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
        if (i == ROOT_INDEX || n.priority <= data.nodes[i / 2].priority) {
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
            Node memory largestChild = data.nodes[cIndex];

            if (
                length > cIndex + 1 &&
                data.nodes[cIndex + 1].priority > largestChild.priority
            ) {
                largestChild = data.nodes[++cIndex];
            }

            if (largestChild.priority <= n.priority) {
                _insertHeap(data, n, i);
            } else {
                _insertHeap(data, largestChild, i);
                _bubbleDown(data, n, cIndex);
            }
        }
    }

    function _insertHeap(Data storage data, Node memory n, uint i) private {
        data.nodes[i] = n;
        data.indices[n.id] = i;
    }
}
