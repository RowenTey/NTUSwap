const MarketData = artifacts.require("MarketData");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("MarketData", (accounts) => {
    const [deployer, marketManager, other] = accounts;
    let marketData;

    beforeEach(async () => {
        marketData = await MarketData.new();
        await marketData.initialize(marketManager);
    });

    it("should add a new market", async () => {
        const tokenId = 2;

        const receipt = await marketData.addMarket(tokenId, { from: marketManager });

        for (let i = 1; i < tokenId; i++) {
            const marketId = await marketData.getMarketId(i, tokenId);
            const marketExists = await marketData.isMarketPresent(marketId);
            expect(marketExists).to.be.true;

            expectEvent(receipt, "MarketCreatedEvent", {
                marketId: marketId,
                token1: new BN(i),
                token2: new BN(tokenId),
            });
        }
    });

    it("should get tokens from market ID", async () => {
        const tokenId = 2;
        await marketData.addMarket(tokenId, { from: marketManager });

        const marketId = await marketData.getMarketId(1, tokenId);
        const tokens = await marketData.getTokensFromMarketId(marketId);

        expect(tokens[0]).to.be.bignumber.equal(new BN(1));
        expect(tokens[1]).to.be.bignumber.equal(new BN(tokenId));
    });

    it("should return correct market ID", async () => {
        const token1 = 1;
        const token2 = 2;

        const marketId1 = await marketData.getMarketId(token1, token2);
        const marketId2 = await marketData.getMarketId(token2, token1);

        expect(marketId1).to.equal(marketId2);
    });

    it("should check if market is present", async () => {
        const tokenId = 2;
        await marketData.addMarket(tokenId, { from: marketManager });

        const marketId = await marketData.getMarketId(1, tokenId);
        const marketExists = await marketData.isMarketPresent(marketId);

        expect(marketExists).to.be.true;
    });

    it("should revert if non-market manager tries to add market", async () => {
        const tokenId = 2;
        await expectRevert(
            marketData.addMarket(tokenId, { from: other }),
            "Caller is not the market manager"
        );
    });
});