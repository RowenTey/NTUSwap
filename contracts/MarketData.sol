// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "hardhat/console.sol";

// Interface for MarketData contract
interface IMarketData {
    struct Market {
        uint8 token1;
        uint8 token2;
        bool exists;
    }

    event MarketCreatedEvent(
        bytes32 indexed marketId,
        uint8 token1,
        uint8 token2,
        uint256 timestamp
    );

    function addMarket(uint8 _tokenId) external;

    function getTokensFromMarketId(
        bytes32 _marketId
    ) external view returns (uint8, uint8);

    function isMarketPresent(bytes32 marketId) external view returns (bool);

    function getMarketId(
        uint8 token1,
        uint8 token2
    ) external pure returns (bytes32);
}

// MarketData contract
contract MarketData is IMarketData {
    // Maps market index to the market
    mapping(bytes32 => Market) private exchangeMarkets;
    address public marketManager;
    bool private initialized;

    modifier onlyMarketManager() {
        require(
            msg.sender == marketManager,
            "Caller is not the market manager"
        );
        _;
    }

    constructor() {
        initialized = false;
    }

    function initialize(address _marketManager) external {
        require(!initialized, "Already initialized");
        require(_marketManager != address(0), "Invalid market manager address");
        marketManager = _marketManager;
        initialized = true;
    }

    function addMarket(uint8 _tokenId) external override onlyMarketManager {
        console.log("[MarketData] Adding market for token:", _tokenId);
        for (uint8 i = 1; i < _tokenId; i++) {
            bytes32 marketId = getMarketId(i, _tokenId);
            require(!exchangeMarkets[marketId].exists, "Market already exists");
            exchangeMarkets[marketId] = Market({
                token1: i,
                token2: _tokenId,
                exists: true
            });
            emit MarketCreatedEvent(marketId, i, _tokenId, block.timestamp);
            console.log("[MarketData] Market created for tokens:", i, _tokenId);
        }
    }

    function getTokensFromMarketId(
        bytes32 _marketId
    ) external view override returns (uint8, uint8) {
        Market memory market = exchangeMarkets[_marketId];
        require(market.exists, "Market does not exist");
        return (market.token1, market.token2);
    }

    function getMarketId(
        uint8 token1,
        uint8 token2
    ) public pure returns (bytes32) {
        // Ensures consistent ordering
        if (token1 > token2) {
            (token1, token2) = (token2, token1);
        }
        console.log(
            "[MarketData] Getting market ID for tokens:",
            token1,
            token2
        );
        return keccak256(abi.encodePacked(token1, token2));
    }

    function isMarketPresent(bytes32 marketId) external view returns (bool) {
        return exchangeMarkets[marketId].exists;
    }
}
