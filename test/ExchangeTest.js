const Exchange = artifacts.require("Exchange");
const MarketManager = artifacts.require("MarketManager");
const OrderBookManager = artifacts.require("OrderBookManager");
const TokenManager = artifacts.require("TokenManager");
const MarketData = artifacts.require("MarketData");
const TestToken = artifacts.require("Token");

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const BN = web3.utils.BN;

contract("Exchange", (accounts) => {
  const [owner, trader1, trader2] = accounts;
  let exchange, marketManager, orderBookManager, tokenManager, marketData;
  let token1, token2; // Test ERC20 tokens
  const TOKEN1_SYMBOL = "TK1";
  const TOKEN2_SYMBOL = "TK2";
  let marketId;

  before(async () => {
    // Deploy mock tokens
    token1 = await TestToken.new(
      "Token1",
      TOKEN1_SYMBOL,
      web3.utils.toWei("10000"),
      owner
    );
    token2 = await TestToken.new(
      "Token2",
      TOKEN2_SYMBOL,
      web3.utils.toWei("10000"),
      owner
    );

    // Deploy core contracts
    marketData = await MarketData.new();
    orderBookManager = await OrderBookManager.new(marketData.address);
    marketManager = await MarketManager.new(orderBookManager.address);
    await marketData.initialize(marketManager.address);
    await marketManager.initialize(marketData.address);
    tokenManager = await TokenManager.new();

    // Deploy Exchange contract
    exchange = await Exchange.new(
      marketManager.address,
      orderBookManager.address,
      tokenManager.address
    );

    // Issue tokens in TokenManager
    await tokenManager.issueToken(
      "Token1",
      TOKEN1_SYMBOL,
      web3.utils.toWei("10000"),
      { from: owner }
    );
    await tokenManager.issueToken(
      "Token2",
      TOKEN2_SYMBOL,
      web3.utils.toWei("10000"),
      { from: owner }
    );

    // Get token IDs
    const token1Id = await tokenManager.getTokenId(TOKEN1_SYMBOL);
    const token2Id = await tokenManager.getTokenId(TOKEN2_SYMBOL);

    // Create market and get market ID
    await marketManager.createMarket(token2Id);
    marketId = await marketManager.getMarketId(token1Id, token2Id);

    // Get token instances from TokenManager
    const token1Contract = await tokenManager.getToken(token1Id);
    const token2Contract = await tokenManager.getToken(token2Id);

    token1 = await TestToken.at(token1Contract);
    token2 = await TestToken.at(token2Contract);

    // Transfer initial amounts to traders
    await token1.transfer(trader1, web3.utils.toWei("1000"), { from: owner });
    await token2.transfer(trader2, web3.utils.toWei("1000"), { from: owner });
  });

  describe("Market Setup", () => {
    it("should verify market creation and order book initialization", async () => {
      const exists = await orderBookManager.orderBookExists(marketId);
      assert.isTrue(exists, "Order book should exist for the market");
    });
  });

  describe("Order Management", () => {
    beforeEach(async () => {
      // Clear previous approvals
      await token1.approve(tokenManager.address, 0, { from: trader1 });
      await token2.approve(tokenManager.address, 0, { from: trader2 });

      // Transfer fresh tokens from owner to traders for each test
      await token1.transfer(trader1, web3.utils.toWei("1000"), { from: owner });
      await token2.transfer(trader2, web3.utils.toWei("1000"), { from: owner });

      // Approve TokenManager to spend tokens
      await token1.approve(tokenManager.address, web3.utils.toWei("1000"), {
        from: trader1,
      });
      await token2.approve(tokenManager.address, web3.utils.toWei("1000"), {
        from: trader2,
      });

      // Now deposit tokens into TokenManager
      await tokenManager.deposit(TOKEN1_SYMBOL, web3.utils.toWei("100"), {
        from: trader1,
      });
      await tokenManager.deposit(TOKEN2_SYMBOL, web3.utils.toWei("100"), {
        from: trader2,
      });
    });

    it("should place limit buy order successfully", async () => {
      const token1Id = await tokenManager.getTokenId(TOKEN1_SYMBOL);
      const token2Id = await tokenManager.getTokenId(TOKEN2_SYMBOL);
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");
      const receipt = await exchange.placeBuyOrder(
        token1Id,
        token2Id,
        price,
        amount,
        1, // OrderNature.LIMIT
        { from: trader2 }
      );

      expectEvent(receipt, "OrderPlacedEvent", {
        marketId: marketId,
        orderType: new BN(0), // Buy
        price: new BN(price),
        userAddress: trader2,
      });
    });

    it("should place limit sell order successfully", async () => {
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      const receipt = await exchange.placeSellOrder(
        marketId,
        amount,
        price,
        0, // OrderNature.LIMIT
        { from: trader1 }
      );

      expectEvent(receipt, "OrderPlacedEvent", {
        marketId: marketId,
        orderType: new BN(1), // Sell
        price: new BN(price),
        userAddress: trader1,
      });
    });

    it("should not allow placing orders with insufficient balance", async () => {
      const price = web3.utils.toWei("2");
      const excessAmount = web3.utils.toWei("1000");

      await expectRevert(
        exchange.placeBuyOrder(
          marketId,
          excessAmount,
          price,
          0, // OrderNature.LIMIT
          { from: trader2 }
        ),
        "Insufficient balance"
      );
    });

    it("should cancel order successfully", async () => {
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      // Place order first
      const placeReceipt = await exchange.placeSellOrder(
        marketId,
        amount,
        price,
        0, // OrderNature.LIMIT
        { from: trader1 }
      );

      const orderId = placeReceipt.logs[0].args.orderId;

      // Cancel order
      const cancelReceipt = await exchange.cancelOrder(
        marketId,
        orderId,
        1, // OrderType.Sell
        { from: trader1 }
      );

      expectEvent(cancelReceipt, "OrderCancelledEvent", {
        marketId: marketId,
        orderId: new BN(orderId),
        userAddress: trader1,
      });
    });
  });

  describe("Order Matching", () => {
    beforeEach(async () => {
      // Setup fresh balances
      await tokenManager.deposit(TOKEN1_SYMBOL, web3.utils.toWei("100"), {
        from: trader1,
      });
      await tokenManager.deposit(TOKEN2_SYMBOL, web3.utils.toWei("100"), {
        from: trader2,
      });
    });

    it("should match compatible buy and sell orders", async () => {
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      // Place sell order
      await exchange.placeSellOrder(
        marketId,
        amount,
        price,
        0, // OrderNature.LIMIT
        { from: trader1 }
      );

      // Place matching buy order
      const buyReceipt = await exchange.placeBuyOrder(
        marketId,
        amount,
        price,
        0, // OrderNature.LIMIT
        { from: trader2 }
      );

      expectEvent(buyReceipt, "TradeExecutedEvent", {
        marketId: marketId,
        price: new BN(price),
        amount: new BN(amount),
      });

      // Verify balances after trade
      const trader1Balance2 = await tokenManager.getBalance(trader1, 2); // Token2 balance
      const trader2Balance1 = await tokenManager.getBalance(trader2, 1); // Token1 balance

      assert.equal(
        trader1Balance2.toString(),
        web3.utils.toWei("20"), // Initial 100 + 20 from trade
        "Seller should receive payment"
      );

      assert.equal(
        trader2Balance1.toString(),
        web3.utils.toWei("10"), // Received from trade
        "Buyer should receive tokens"
      );
    });

    it("should handle partial fills correctly", async () => {
      const price = web3.utils.toWei("2");
      const sellAmount = web3.utils.toWei("20");
      const buyAmount = web3.utils.toWei("10");

      // Place larger sell order
      await exchange.placeSellOrder(
        marketId,
        sellAmount,
        price,
        0, // OrderNature.LIMIT
        { from: trader1 }
      );

      // Place smaller buy order
      const buyReceipt = await exchange.placeBuyOrder(
        marketId,
        buyAmount,
        price,
        0, // OrderNature.LIMIT
        { from: trader2 }
      );

      expectEvent(buyReceipt, "TradeExecutedEvent", {
        marketId: marketId,
        price: new BN(price),
        amount: new BN(buyAmount),
      });

      // Check remaining sell order amount
      const orderBook = await orderBookManager.getOrderBook(marketId, 1); // OrderType.Sell
      const remainingAmount = orderBook[0].remainingAmount;
      assert.equal(
        remainingAmount.toString(),
        web3.utils.toWei("10"), // Initial 20 - 10 matched
        "Remaining amount should be correct"
      );
    });
  });

  describe("Market Orders", () => {
    beforeEach(async () => {
      await tokenManager.deposit(TOKEN1_SYMBOL, web3.utils.toWei("100"), {
        from: trader1,
      });
      await tokenManager.deposit(TOKEN2_SYMBOL, web3.utils.toWei("100"), {
        from: trader2,
      });
    });

    it("should execute market buy order against existing sell orders", async () => {
      const sellPrice = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      // Place limit sell order
      await exchange.placeSellOrder(
        marketId,
        amount,
        sellPrice,
        0, // OrderNature.LIMIT
        { from: trader1 }
      );

      // Place market buy order
      const buyReceipt = await exchange.placeBuyOrder(
        marketId,
        amount,
        0, // Price 0 for market order
        1, // OrderNature.MARKET
        { from: trader2 }
      );

      expectEvent(buyReceipt, "TradeExecutedEvent", {
        marketId: marketId,
        amount: new BN(amount),
      });
    });

    it("should execute market sell order against existing buy orders", async () => {
      const buyPrice = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      // Place limit buy order
      await exchange.placeBuyOrder(
        marketId,
        amount,
        buyPrice,
        0, // OrderNature.LIMIT
        { from: trader2 }
      );

      // Place market sell order
      const sellReceipt = await exchange.placeSellOrder(
        marketId,
        amount,
        0, // Price 0 for market order
        1, // OrderNature.MARKET
        { from: trader1 }
      );

      expectEvent(sellReceipt, "TradeExecutedEvent", {
        marketId: marketId,
        amount: new BN(amount),
      });
    });
  });
});
