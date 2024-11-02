// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "contracts/OrderLibrary.sol";
import "contracts/MarketData.sol";
import "contracts/OrderBookManager.sol";

contract MarketManager {
    IMarketData public immutable marketData;
    OrderBookManager public immutable orderBookManager;

    event OrderPlacedEvent(
        uint16 indexed marketId,
        uint256 orderId,
        OrderLibrary.OrderType orderType,
        uint256 price,
        uint256 timestamp,
        address userAddress,
        OrderLibrary.OrderNature orderNature
    );

    event MarketOrderBooksCreated(
        bytes32 indexed marketId,
        uint8 token1,
        uint8 token2
    );

    constructor(address _marketDataAddr, address _orderBookManagerAddr) {
        marketData = IMarketData(_marketDataAddr);
        orderBookManager = OrderBookManager(_orderBookManagerAddr);
    }

    function createMarket(uint8 _tokenId) external {
        require(tokenId > 1, "Invalid token ID");
        marketData.addMarket(_tokenId);

        // Create orderbooks for each market pair
        for (uint8 i = 1; i < _tokenId; i++) {
            bytes32 marketId = marketData.getMarketId(i, _tokenId);

            // Only create orderbooks if they don't exist
            if (!orderBookManager.orderBookExists(marketId)) {
                orderBookManager.createMarketOrderBook(marketId);
                emit MarketOrderBooksCreated(marketId, i, _tokenId);
            }
        }
    }

    function placeOrder(
        uint8 tokenId1,
        uint8 tokenId2,
        uint256 price,
        uint256 amount,
        address userAddress,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature
    ) external returns (uint256 orderId) {
        bytes32 marketId = marketData.getMarketId(tokenId1, tokenId2);
        require(
            isMarketInitialized(tokenId1, tokenId2),
            "Market does not exist for these pairs of tokens"
        );
        require(
            orderBookManager.orderBookExists(marketId),
            "Order books not initialized"
        );
        orderId = orderBookManager.createOrder(
            marketId,
            amount,
            price,
            msg.sender,
            orderType,
            orderNatrue
        );
        emit OrderPlacedEvent(
            marketId,
            orderId,
            orderType,
            price,
            block.timestamp,
            msg.sender,
            userAddress,
            orderNature
        );
        return orderId;
    }

    // Helper function to check if a market is fully initialized
    function isMarketInitialized(
        uint8 tokenId1,
        uint8 tokenId2
    ) public view returns (bool) {
        bytes32 marketId = marketData.getMarketId(tokenId1, tokenId2);
        return
            marketData.isMarketPresent(marketId) &&
            orderBookManager.orderBookExists(marketId);
    }

    function getMarketId(
        uint8 tokenId1,
        uint8 tokenId2
    ) public view returns (bytes32) {
        return marketData.getMarketId(tokenId1, tokenId2);
    }
}
