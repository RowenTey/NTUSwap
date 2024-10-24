// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "contracts/OrderLibrary.sol";
import "contracts/OrderBookData.sol";

contract OrderBookManager {
    
    mapping(bytes32 => OrderBookData) internal marketOrderBooks;

    function createOrder(
        bytes32 _marketId,
        uint256 _amount,
        uint256 _price,
        address _userAddress,
        OrderLibrary.OrderType _orderType,
        OrderLibrary.OrderNature _orderNature
    ) public returns (uint256 _orderId) {
        OrderBookData marketOrderBook = marketOrderBooks[_marketId];
        orderId = marketOrderBook.addOrder(
            _amount,
            _price,
            _userAddress,
            _orderType,
            _orderNature
        );
        return orderId;
    }

    function cancelOrder(uint256 _orderId, OrderLibrary.OrderType _orderType) public returns(bool){
        bool removed = OrderBookData.removeOrder(_orderType, _orderId);
        return removed;
    }
    

    function matchOrder(
        bytes32 _marketId,
        uint256 _pendingOrderId,
        OrderLibrary.OrderType _orderType,   
        OrderLibrary.OrderNature _orderNature
    )
        public
        returns (
            uint256 balance,
            address[] memory toBePaid,
            address[] memory toReceive,
            uint256[] memory tokenAmount,
            uint256[] memory currencyAmount
        )
    {
        OrderBookData marketOrderBook = marketOrderBooks[_marketId];
        OrderLibrary.Order storage pendingOrder = marketOrderBook.orderBooks[_orderType].orders[_pendingOrderId];
        OrderLibrary.OrderType oppositeOrderType = _orderType == OrderLibrary.OrderType.Buy ? OrderLibrary.OrderType.Sell : OrderLibrary.OrderType.Buy;
        
        OrderBook orderBook = marketOrderBook[oppositeOrderType];
        // if()
        
    }
}
