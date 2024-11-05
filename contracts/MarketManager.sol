// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
// import "hardhat/console.sol";
import "./OrderLibrary.sol";
import "./MarketData.sol";
import "./OrderBookManager.sol";

contract MarketManager {
    IMarketData public marketData;
    OrderBookManager public immutable orderBookManager;
    bool private initialized;

    event OrderPlacedEvent(
        bytes32 indexed marketId,
        uint256 orderId,
        OrderLibrary.OrderType orderType,
        uint256 price,
        uint256 timestamp,
        address userAddress,
        OrderLibrary.OrderNature orderNature
    );

    event OrderCancelledEvent(
        bytes32 indexed marketID,
        uint256 orderId,
        address userAddress,
        OrderLibrary.OrderType orderType,
        uint256 timestamp
    );

    event MarketOrderBooksCreated(
        bytes32 indexed marketId,
        uint8 token1,
        uint8 token2
    );

    modifier onlyInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    constructor(address _orderBookManagerAddr) {
        orderBookManager = OrderBookManager(_orderBookManagerAddr);
        initialized = false;
    }

    function initialize(address _marketDataAddr) external {
        require(!initialized, "Already initialized");
        require(_marketDataAddr != address(0), "Invalid market data address");
        marketData = IMarketData(_marketDataAddr);
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
            msg.sender,
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
        OrderLibrary.OrderType orderType
    ) external returns (bool) {
        require(marketData.isMarketPresent(marketId), "Market does not exist");

        // Forward cancellation request to OrderBookManager
        bool success = orderBookManager.cancelOrder(
            marketId,
            orderId,
            orderType
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
    ) external view returns (uint8, uint8) {
        return marketData.getTokensFromMarketId(_marketId);
    }

    // Helper function to check if a market is fully initialized
    function isMarketInitialized(
        uint8 tokenId1,
        uint8 tokenId2
    ) public view returns (bool) {
        bytes32 marketId = getMarketId(tokenId1, tokenId2);
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
