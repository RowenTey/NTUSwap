const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const Exchange = artifacts.require("Exchange");
const MarketManager = artifacts.require("MarketManager");
const OrderBookManager = artifacts.require("OrderBookManager");
const TokenManager = artifacts.require("TokenManager");
const MarketData = artifacts.require("MarketData");
const TestToken = artifacts.require("Token");
const BN = web3.utils.BN;

contract("Exchange", (accounts) => {
  const [owner, trader1, trader2] = accounts;
  let exchange, marketManager, orderBookManager, tokenManager, marketData;
  let token1, token2;
  const TOKEN1_SYMBOL = "TK1";
  const TOKEN2_SYMBOL = "TK2";
  let marketId;

  before(async () => {
    // Deploy mock tokens
    token1 = await TestToken.new("Token1", TOKEN1_SYMBOL, web3.utils.toWei("10000"), owner);
    token2 = await TestToken.new("Token2", TOKEN2_SYMBOL, web3.utils.toWei("10000"), owner);

    // Deploy Market and Order Managers
    marketData = await MarketData.new();
    orderBookManager = await OrderBookManager.new(marketData.address);
    marketManager = await MarketManager.new(orderBookManager.address);
    await marketData.initialize(marketManager.address);
    await marketManager.initialize(marketData.address);
    tokenManager = await TokenManager.new();

    exchange = await Exchange.new(marketManager.address, orderBookManager.address, tokenManager.address);

    // Issue Tokens
    await tokenManager.issueToken("Token1", TOKEN1_SYMBOL, web3.utils.toWei("10000"), { from: owner });
    await tokenManager.issueToken("Token2", TOKEN2_SYMBOL, web3.utils.toWei("10000"), { from: owner });

    const token1Id = await tokenManager.getTokenId(TOKEN1_SYMBOL);
    const token2Id = await tokenManager.getTokenId(TOKEN2_SYMBOL);

    // Create market
    await marketManager.createMarket(token2Id);
    marketId = await marketManager.getMarketId(token1Id, token2Id);

    const token1Contract = await tokenManager.getToken(token1Id);
    const token2Contract = await tokenManager.getToken(token2Id);

    token1 = await TestToken.at(token1Contract);
    token2 = await TestToken.at(token2Contract);

    // Transfer initial balances
    await token1.transfer(trader1, web3.utils.toWei("1000"), { from: owner });
    await token2.transfer(trader2, web3.utils.toWei("1000"), { from: owner });
  });

  describe("Market Setup and Verification", () => {
    it("should verify market creation and order book initialization", async () => {
      const exists = await orderBookManager.orderBookExists(marketId);
      assert.isTrue(exists, "Order book should exist for the market");
    });
  });

  describe("Token Deposits and Withdrawals", () => {
    it("should allow token deposit to token manager", async () => {
      await token1.approve(tokenManager.address, web3.utils.toWei("100"), { from: trader1 });
      const depositTx = await tokenManager.deposit(TOKEN1_SYMBOL, web3.utils.toWei("100"), { from: trader1 });

      expectEvent(depositTx, "DepositEvent", {
        symbol: TOKEN1_SYMBOL,
        userAddress: trader1,
        amount: new BN(web3.utils.toWei("100")),
      });
    });

    it("should allow token withdrawal from token manager", async () => {
      const withdrawTx = await tokenManager.withdraw(TOKEN1_SYMBOL, web3.utils.toWei("50"), { from: trader1 });

      expectEvent(withdrawTx, "WithdrawalEvent", {
        symbol: TOKEN1_SYMBOL,
        userAddress: trader1,
        amount: new BN(web3.utils.toWei("50")),
      });
    });
  });

  describe("Order Management", () => {
    beforeEach(async () => {
      await token1.approve(tokenManager.address, 0, { from: trader1 });
      await token2.approve(tokenManager.address, 0, { from: trader2 });

      await token1.transfer(trader1, web3.utils.toWei("1000"), { from: owner });
      await token2.transfer(trader2, web3.utils.toWei("1000"), { from: owner });

      await token1.approve(tokenManager.address, web3.utils.toWei("1000"), { from: trader1 });
      await token2.approve(tokenManager.address, web3.utils.toWei("1000"), { from: trader2 });

      await tokenManager.deposit(TOKEN1_SYMBOL, web3.utils.toWei("100"), { from: trader1 });
      await tokenManager.deposit(TOKEN2_SYMBOL, web3.utils.toWei("100"), { from: trader2 });
    });

    it("should place limit buy order successfully", async () => {
      const token1Id = await tokenManager.getTokenId(TOKEN1_SYMBOL);
      const token2Id = await tokenManager.getTokenId(TOKEN2_SYMBOL);
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      const receipt = await exchange.placeBuyOrder(token1Id, token2Id, price, amount, 1, { from: trader2 });
    //   expectEvent(receipt, "OrderPlacedEvent", {
    //     marketId: marketId,
    //     orderType: new BN(0), // Buy
    //     price: new BN(price),
    //     userAddress: trader2,
    //   });
      // Capture `OrderPlacedEvent` emitted by `MarketManager` using `receipt.tx` to get the transaction hash
      await expectEvent.inTransaction(receipt.tx, marketManager, "OrderPlacedEvent", {
                marketId: marketId,
                orderType: new BN(0), // Buy
                price: new BN(price),
                userAddress: trader2,
                orderNature: new BN(1) // Limit
            });
    });

    it("should place limit sell order successfully", async () => {
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      const receipt = await exchange.placeSellOrder(marketId, amount, price, 0, { from: trader1 });
    //   expectEvent(receipt, "OrderPlacedEvent", {
    //     marketId: marketId,
    //     orderType: new BN(1), // Sell
    //     price: new BN(price),
    //     userAddress: trader1,
    //   });
       // Capture `OrderPlacedEvent` emitted by `MarketManager` using `receipt.tx` to get the transaction hash
      await expectEvent.inTransaction(receipt.tx, marketManager, "OrderPlacedEvent", {
            marketId: marketId,
            orderType: new BN(0), // Buy
            price: new BN(price),
            userAddress: trader2,
            orderNature: new BN(1) // Limit
        });
    });

    it("should not allow placing orders with insufficient balance", async () => {
      const price = web3.utils.toWei("2");
      const excessAmount = web3.utils.toWei("1000");

      await expectRevert(
        exchange.placeBuyOrder(marketId, excessAmount, price, 0, { from: trader2 }),
        "Insufficient balance"
      );
    });

    it("should cancel an order successfully", async () => {
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      const placeReceipt = await exchange.placeSellOrder(marketId, amount, price, 0, { from: trader1 });
      const orderId = placeReceipt.logs[0].args.orderId;

      const cancelReceipt = await exchange.cancelOrder(marketId, orderId, 1, { from: trader1 });
      expectEvent(cancelReceipt, "OrderCancelledEvent", {
        marketId: marketId,
        orderId: new BN(orderId),
        userAddress: trader1,
      });
    });
  });

  describe("Order Matching", () => {
    beforeEach(async () => {
      await tokenManager.deposit(TOKEN1_SYMBOL, web3.utils.toWei("100"), { from: trader1 });
      await tokenManager.deposit(TOKEN2_SYMBOL, web3.utils.toWei("100"), { from: trader2 });
    });

    it("should match compatible buy and sell orders", async () => {
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      await exchange.placeSellOrder(marketId, amount, price, 0, { from: trader1 });

      const buyReceipt = await exchange.placeBuyOrder(marketId, amount, price, 0, { from: trader2 });
      expectEvent(buyReceipt, "TradeExecutedEvent", {
        marketId: marketId,
        price: new BN(price),
        amount: new BN(amount),
      });
    });

    it("should handle partial fills correctly", async () => {
      const price = web3.utils.toWei("2");
      const sellAmount = web3.utils.toWei("20");
      const buyAmount = web3.utils.toWei("10");

      await exchange.placeSellOrder(marketId, sellAmount, price, 0, { from: trader1 });

      const buyReceipt = await exchange.placeBuyOrder(marketId, buyAmount, price, 0, { from: trader2 });
      expectEvent(buyReceipt, "TradeExecutedEvent", {
        marketId: marketId,
        price: new BN(price),
        amount: new BN(buyAmount),
      });
    });
  });
});