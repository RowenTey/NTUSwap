const MarketManager = artifacts.require("MarketManager");
const MarketData = artifacts.require("MarketData");
const OrderBookManager = artifacts.require("OrderBookManager");
const TokenManager = artifacts.require("TokenManager");
const OrderLibrary = artifacts.require("OrderLibrary");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("MarketManager", (accounts) => {
    const [deployer, user1, user2] = accounts;
    let marketManager;
    let marketData;
    let orderBookManager;
    let tokenManager;

    beforeEach(async () => {
        tokenManager = await TokenManager.new();
        marketData = await MarketData.new();
        orderBookManager = await OrderBookManager.new();
        marketManager = await MarketManager.new();
        await marketData.initialize(marketManager.address);
        await tokenManager.initialize(marketManager.address);
        await orderBookManager.initialize(tokenManager.address);
        await marketManager.initialize(marketData.address, orderBookManager.address);
    });

    it("should create a market", async () => {
        const tokenId = 2;

        const receipt = await marketManager.createMarket(tokenId, { from: deployer });

        for (let i = 1; i < tokenId; i++) {
            const marketId = await marketManager.getMarketId(i, tokenId);
            const marketExists = await marketData.isMarketPresent(marketId);
            expect(marketExists).to.be.true;

            expectEvent(receipt, "MarketOrderBooksCreatedEvent", {
                marketId: marketId,
                token1: new BN(i),
                token2: new BN(tokenId),
            });
        }
    });

    it("should place an order", async () => {
        const tokenId1 = 1;
        const tokenId2 = 2;
        const price = new BN(50);
        const amount = new BN(100);
        const orderType = OrderLibrary.OrderType.Buy;
        const orderNature = OrderLibrary.OrderNature.Limit;

        await marketManager.createMarket(tokenId2, { from: deployer });

        const receipt = await marketManager.placeOrder(
            tokenId1,
            tokenId2,
            price,
            amount,
            user1,
            orderType,
            orderNature,
            { from: deployer }
        );

        const marketId = await marketManager.getMarketId(tokenId1, tokenId2);

        expectEvent(receipt, "OrderPlacedEvent", {
            marketId: marketId,
            orderId: new BN(1),
            orderType: new BN(orderType),
            price: price,
            timestamp: new BN(Math.floor(Date.now() / 1000)),
            userAddress: user1,
            orderNature: new BN(orderNature),
        });
    });

    it("should cancel an order", async () => {
        const tokenId1 = 1;
        const tokenId2 = 2;
        const price = new BN(50);
        const amount = new BN(100);
        const orderType = OrderLibrary.OrderType.Buy;
        const orderNature = OrderLibrary.OrderNature.Limit;

        await marketManager.createMarket(tokenId2, { from: deployer });

        const placeReceipt = await marketManager.placeOrder(
            tokenId1,
            tokenId2,
            price,
            amount,
            user1,
            orderType,
            orderNature,
            { from: deployer }
        );

        const orderId = placeReceipt.logs[0].args.orderId;
        const marketId = await marketManager.getMarketId(tokenId1, tokenId2);

        const cancelReceipt = await marketManager.cancelOrder(
            marketId,
            orderId,
            user1,
            orderType,
            orderNature,
            { from: deployer }
        );

        expectEvent(cancelReceipt, "OrderCancelledEvent", {
            marketId: marketId,
            orderId: orderId,
            userAddress: user1,
            orderType: new BN(orderType),
            timestamp: new BN(Math.floor(Date.now() / 1000)),
        });
    });

    it("should get market tokens", async () => {
        const tokenId1 = 1;
        const tokenId2 = 2;

        await marketManager.createMarket(tokenId2, { from: deployer });

        const marketId = await marketManager.getMarketId(tokenId1, tokenId2);
        const tokens = await marketManager.getMarketTokens(marketId);

        expect(tokens[0]).to.be.bignumber.equal(new BN(tokenId1));
        expect(tokens[1]).to.be.bignumber.equal(new BN(tokenId2));
    });

    it("should check if a market is initialized", async () => {
        const tokenId1 = 1;
        const tokenId2 = 2;

        await marketManager.createMarket(tokenId2, { from: deployer });

        const isInitialized = await marketManager.isMarketInitialized(tokenId1, tokenId2);
        expect(isInitialized).to.be.true;
    });

    it("should return correct market ID", async () => {
        const tokenId1 = 1;
        const tokenId2 = 2;

        const marketId1 = await marketManager.getMarketId(tokenId1, tokenId2);
        const marketId2 = await marketManager.getMarketId(tokenId2, tokenId1);

        expect(marketId1).to.equal(marketId2);
    });
});