// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Interface for MarketData contract
interface IMarketData {
    struct Market {
        uint8 token1;
        uint8 token2;
    }
    
    event MarketCreatedEvent(
        uint16 marketId,
        uint8 token1,
        uint8 token2,
        uint256 timestamp
    );
    
    function addMarket(uint8 _tokenId) external;
    function getTokensFromMarketId(uint16 _marketId) external view returns (uint8, uint8);
}

// MarketData contract
contract MarketData is IMarketData {
    // Maps market index to the market
    mapping(uint16 => Market) private exchangeMarkets;
    uint16 private marketId = 1;
    address public marketManager;
    
    modifier onlyMarketManager() {
        require(msg.sender == marketManager, "Caller is not the market manager");
        _;
    }
    
    constructor(address _marketManager) {
        marketManager = _marketManager;
    }
    
    function addMarket(uint8 _tokenId) external override onlyMarketManager {
        require(marketId + 1 > marketId, "Market index overflow");

        for (uint8 i = 1; i < _tokenId; i++) {
            exchangeMarkets[marketId] = Market({token1: i, token2: _tokenId});
            emit MarketCreatedEvent(marketId, _tokenId, i, block.timestamp);
            marketId++;
        }
    }
    
    function getTokensFromMarketId(uint16 _marketId) external view override returns (uint8, uint8) {
        Market memory market = exchangeMarkets[_marketId];
        require(market.token1 != 0, "Market does not exist");
        return (market.token1, market.token2);
    }
}