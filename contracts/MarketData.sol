// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

struct Market {
    uint8 token1;
    uint8 token2;
}

contract MarketData {
    // Maps market index to the market
    mapping(uint16 => Market) internal exchangeMarkets;
    uint16 internal marketId = 1;

    event MarketCreatedEvent(
        uint16 marketId,
        uint8 token1,
        uint8 token2,
        uint256 timestamp
    );

    function addMarket(uint8 _tokenId) internal {
        require(marketId + 1 > marketId, "Market index overflow");

        for (uint8 i = 1; i < _tokenId; i++) {
            exchangeMarkets[marketId] = Market({token1: i, token2: _tokenId});
            marketId++;
            emit MarketCreatedEvent(marketId, _tokenId, i, block.timestamp);
        }
    }

    function getTokensFromMarketId(uint16 _marketId) internal view returns (uint8, uint8) {
        Market memory market = exchangeMarkets[_marketId];
        return (market.token1, market.token2);
    }
}
