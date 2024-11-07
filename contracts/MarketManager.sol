// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./OrderLibrary.sol";
import "./MarketData.sol";
import "./OrderBookManager.sol";

// import "hardhat/console.sol";

contract MarketManager {
    IMarketData public marketData;
    OrderBookManager public orderBookManager;
    bool private initialized;

    event MarketOrderBooksCreatedEvent(
        bytes32 indexed marketId,
        uint8 token1,
        uint8 token2
    );

    event OrderPlacedEvent(
        bytes32 indexed marketId,
        uint256 orderId,
        OrderLibrary.OrderType orderType,
        int256 price,
        uint256 timestamp,
        address userAddress,
        OrderLibrary.OrderNature orderNature
    );

    event OrderCancelledEvent(
        bytes32 indexed marketId,
        uint256 orderId,
        address userAddress,
        OrderLibrary.OrderType orderType,
        uint256 timestamp
    );

    modifier onlyInitialized() {
        require(initialized, "Market manager not initialized");
        _;
    }

    constructor() {
        initialized = false;
    }

    function initialize(
        address _marketDataAddr,
        address _orderBookManagerAddr
    ) external {
        require(!initialized, "Already initialized");
        require(_marketDataAddr != address(0), "Invalid market data address");
        require(
            _orderBookManagerAddr != address(0),
            "Invalid orderbook manager address"
        );

        marketData = IMarketData(_marketDataAddr);
        orderBookManager = OrderBookManager(_orderBookManagerAddr);
        initialized = true;
    }

    function createMarket(uint8 _tokenId) external onlyInitialized {
        require(_tokenId > 1, "Invalid token ID");
        marketData.addMarket(_tokenId);

        // Create orderbooks for each market pair
        for (uint8 i = 1; i < _tokenId; i++) {
            bytes32 marketId = getMarketId(i, _tokenId);

            // Only create orderbooks if they don't exist
            if (!orderBookManager.orderBookExists(marketId)) {
                orderBookManager.createMarketOrderBook(marketId);
                emit MarketOrderBooksCreatedEvent(marketId, i, _tokenId);
            }
        }
    }

    function placeOrder(
        uint8 tokenId1,
        uint8 tokenId2,
        int256 price,
        uint256 amount,
        address userAddress,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature
    ) external onlyInitialized returns (uint256 orderId) {
        bytes32 marketId = getMarketId(tokenId1, tokenId2);
        require(
            isMarketInitialized(tokenId1, tokenId2),
            "Market does not exist for these pairs of tokens"
        );

        orderId = orderBookManager.createOrder(
            marketId,
            amount,
            price,
            userAddress,
            orderType,
            orderNature
        );
        emit OrderPlacedEvent(
            marketId,
            orderId,
            orderType,
            price,
            block.timestamp,
            userAddress,
            orderNature
        );

        return orderId;
    }

    function cancelOrder(
        bytes32 marketId,
        uint256 orderId,
        address userAddress,
        OrderLibrary.OrderType orderType,
        OrderLibrary.OrderNature orderNature
    ) external onlyInitialized returns (bool) {
        require(marketData.isMarketPresent(marketId), "Market does not exist");

        // Forward cancellation request to OrderBookManager
        bool success = orderBookManager.cancelOrder(
            marketId,
            orderId,
            orderType,
            orderNature
        );
        if (success) {
            emit OrderCancelledEvent(
                marketId,
                orderId,
                userAddress,
                orderType,
                block.timestamp
            );
        }
        return success;
    }

    function getMarketTokens(
        bytes32 _marketId
    ) external view onlyInitialized returns (uint8, uint8) {
        return marketData.getTokensFromMarketId(_marketId);
    }

    // Helper function to check if a market is fully initialized
    function isMarketInitialized(
        uint8 tokenId1,
        uint8 tokenId2
    ) public view onlyInitialized returns (bool) {
        bytes32 marketId = getMarketId(tokenId1, tokenId2);
        return
            marketData.isMarketPresent(marketId) &&
            orderBookManager.orderBookExists(marketId);
    }

    function getMarketId(
        uint8 tokenId1,
        uint8 tokenId2
    ) public view onlyInitialized returns (bytes32) {
        return marketData.getMarketId(tokenId1, tokenId2);
    }
}
