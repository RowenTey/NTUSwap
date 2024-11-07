const OrderBookManager = artifacts.require("OrderBookManager");
const OrderBookData = artifacts.require("OrderBookData");
const TokenManager = artifacts.require("TokenManager");
const Token = artifacts.require("Token");
const OrderLibrary = artifacts.require("OrderLibrary");
const MarketData = artifacts.require("MarketData");
const MarketManager = artifacts.require("MarketManager");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("OrderBookManager", (accounts) => {
  const [deployer, user1, user2, user3] = accounts;
  let orderBookManager;
  let tokenManager;

  beforeEach(async () => {
    tokenManager = await TokenManager.new();
    orderBookManager = await OrderBookManager.new();
    await orderBookManager.initialize(tokenManager.address);
  });

  async function setupMarketAndTokens() {
    // Instantiate MarketManager
    const marketData = await MarketData.new();
    const marketManager = await MarketManager.new();
    await marketData.initialize(marketManager.address);
    await marketManager.initialize(
      marketData.address,
      orderBookManager.address
    );
    await tokenManager.initialize(marketManager.address);

    // Issue tokens (market created)
    await tokenManager.issueToken(
      "Ether",
      "ETH",
      new BN(web3.utils.toWei("1000", "ether")),
      { from: deployer }
    );
    await tokenManager.issueToken(
      "USD",
      "USD",
      new BN(web3.utils.toWei("1000", "ether")),
      { from: deployer }
    );

    // Approve and transfer tokens to user1 and user2
    const ethTokenId = await tokenManager.getTokenId("ETH");
    const usdTokenId = await tokenManager.getTokenId("USD");

    const ethTokenAddr = await tokenManager.getToken(ethTokenId);
    const usdTokenAddr = await tokenManager.getToken(usdTokenId);

    const ethToken = await Token.at(ethTokenAddr);
    const usdToken = await Token.at(usdTokenAddr);

    await ethToken.transfer(user1, new BN(web3.utils.toWei("500", "ether")), {
      from: deployer,
    });
    await usdToken.transfer(user2, new BN(web3.utils.toWei("600", "ether")), {
      from: deployer,
    });

    // Approve tokens from user1 and user2 end
    await ethToken.approve(
      tokenManager.address,
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    await usdToken.approve(
      tokenManager.address,
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    // User deposits token to tokenManager
    await tokenManager.deposit(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    await tokenManager.deposit(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    // Get marketId
    const marketId = await marketManager.getMarketId(ethTokenId, usdTokenId);
    console.log("Created market:", marketId);

    return { marketId, ethTokenId, usdTokenId };
  }

  it("should create a market order book", async () => {
    const marketId = web3.utils.keccak256("ETH/USD");
    const receipt = await orderBookManager.createMarketOrderBook(marketId, {
      from: deployer,
    });

    expectEvent(receipt, "OrderBookCreated", {
      marketId: marketId,
      orderBookAddress: receipt.logs[0].args.orderBookAddress,
    });

    const orderBookExists = await orderBookManager.orderBookExists(marketId);
    expect(orderBookExists).to.be.true;

    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    expect(orderBookAddress).to.not.equal(
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("should create an order", async () => {
    const marketId = web3.utils.keccak256("ETH/USD");
    await orderBookManager.createMarketOrderBook(marketId, { from: deployer });

    const amount = new BN(100);
    const price = new BN(50);
    const orderType = OrderLibrary.OrderType.Buy;
    const orderNature = OrderLibrary.OrderNature.Limit;

    const receipt = await orderBookManager.createOrder(
      marketId,
      amount,
      price,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );

    // Retrieve the OrderBookData contract for the specific market
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);

    expectEvent.inTransaction(receipt.tx, orderBook, "OrderAddedEvent", {
      orderId: new BN(1),
    });

    const order = await orderBook.getOrderFromId(orderType, new BN(1));

    console.log(
      "Retrieved Order:",
      order.totalAmount.toString(),
      order.price.toString(),
      order.userAddress,
      order.status
    );

    expect(order.totalAmount).to.be.bignumber.equal(amount);
    expect(order.price).to.be.bignumber.equal(price);
    expect(order.userAddress).to.equal(user1);
    expect(Number(order.status)).to.equal(OrderLibrary.OrderStatus.Active);
  });

  it("should cancel an order", async () => {
    const marketId = web3.utils.keccak256("ETH/USD");
    await orderBookManager.createMarketOrderBook(marketId, { from: deployer });

    const amount = new BN(100);
    const price = new BN(50);
    const orderType = OrderLibrary.OrderType.Buy;
    const orderNature = OrderLibrary.OrderNature.Limit;

    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);

    const createReceipt = await orderBookManager.createOrder(
      marketId,
      amount,
      price,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const orderId = new BN(1);
    const cancelReceipt = await orderBookManager.cancelOrder(
      marketId,
      orderId,
      orderType,
      orderNature,
      { from: deployer }
    );

    expectEvent.inTransaction(
      cancelReceipt.tx,
      orderBook,
      "OrderRemovedEvent",
      {
        orderId: orderId,
      }
    );

    const order = await orderBook.getOrderFromId(orderType, orderId);

    expect(Number(order.status)).to.equal(OrderLibrary.OrderStatus.Cancelled);
  });

  it("should match 1 sell limit order to 1 buy market order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("100", "ether"));
    const price1 = new BN(1);
    const amount2 = new BN(web3.utils.toWei("50", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add buy market order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      0, // Price doesn't matter for market order
      user2, // User 1 is buying 100 USD
      orderTypeBuy,
      OrderLibrary.OrderNature.Market,
      { from: deployer }
    );

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 ETH
      user1, // User 2 is selling 50 USD
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      usdTokenId,
      orderTypeSell,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeSell, 1);
    console.log("Order 1 (Buy):", order1);
    console.log("Order 2 (sell):", order2);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("50", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );

    expect(Number(order1.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
  });

  it("buy limit order matches 2 market order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    console.log("Created market:", marketId);

    // Create orders
    const amount1 = new BN(web3.utils.toWei("50", "ether"));
    const price1 = new BN(web3.utils.toWei("2", "ether"));

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const limitOrderNature = OrderLibrary.OrderNature.Limit;
    const marketOrderNature = OrderLibrary.OrderNature.Market;

    // Add buy limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      price1, // Price is 2 ETH
      user1, // User 1 is buying 50 USD (Total 100 USD)
      orderTypeBuy,
      limitOrderNature,
      { from: deployer }
    );

    // Add sell market order (id 1)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("10", "ether")),
      0,
      user2, // User 2 is selling 10 USD
      orderTypeSell,
      marketOrderNature,
      { from: deployer }
    );

    // Add sell market order (id 2)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("50", "ether")),
      0,
      user2, // User 2 is selling another 50 USD
      orderTypeSell,
      marketOrderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      new BN(1), // Assuming the pending order ID is 1
      usdTokenId,
      orderTypeBuy,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeSell, 1);
    const order3 = await orderBook.getOrderFromId(orderTypeSell, 2);
    console.log("Order 1 (Buy):", order1);
    console.log("Order 2 (Sell):", order2);
    console.log("Order 3 (Sell):", order3);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order3.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("10", "ether"))
    );

    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order3.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
  });

  it("buy market order matches sell limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    console.log("Created market:", marketId);

    // Create orders
    const amount1 = new BN(web3.utils.toWei("50", "ether"));
    const price1 = new BN(web3.utils.toWei("2", "ether"));

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const limitOrderNature = OrderLibrary.OrderNature.Limit;
    const marketOrderNature = OrderLibrary.OrderNature.Market;

    // Add buy market order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      0,
      user1, // User 1 is buying 50 USD (Total 100 USD)
      orderTypeBuy,
      marketOrderNature,
      { from: deployer }
    );

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("10", "ether")),
      price1, // Price is 2 ETH
      user2, // User 2 is selling 10 USD
      orderTypeSell,
      limitOrderNature,
      { from: deployer }
    );

    // Add sell limit order (id 2)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("30", "ether")),
      price1, // Price is 2 ETH
      user2, // User 2 is selling another 30 USD
      orderTypeSell,
      limitOrderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      new BN(1), // Assuming the pending order ID is 1
      ethTokenId,
      orderTypeBuy,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeSell, 1);
    const order3 = await orderBook.getOrderFromId(orderTypeSell, 2);
    console.log("Order 1 (Buy):", order1);
    console.log("Order 2 (Sell):", order2);
    console.log("Order 3 (Sell):", order3);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("10", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order3.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );

    expect(Number(order1.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order3.status)).to.equal(OrderLibrary.OrderStatus.Filled);
  });

  it("sell market order matches buy limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    console.log("Created market:", marketId);

    // Create orders
    const amount1 = new BN(web3.utils.toWei("50", "ether"));
    const price1 = new BN(web3.utils.toWei("2", "ether"));

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const limitOrderNature = OrderLibrary.OrderNature.Limit;
    const marketOrderNature = OrderLibrary.OrderNature.Market;

    // Add sell market order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      0,
      user1, // User 1 is selling 50 ETH
      orderTypeSell,
      marketOrderNature,
      { from: deployer }
    );

    // Add buy limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("40", "ether")),
      price1, // Price is 2 USD
      user2, // User 2 is buying 40 ETH
      orderTypeBuy,
      limitOrderNature,
      { from: deployer }
    );

    // Add sell limit order (id 2)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("30", "ether")),
      price1, // Price is 2 USD
      user2, // User 2 is buying 30 ETH
      orderTypeBuy,
      limitOrderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      new BN(1), // Assuming the pending order ID is 1
      ethTokenId,
      orderTypeSell,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeSell, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order3 = await orderBook.getOrderFromId(orderTypeBuy, 2);
    console.log("Order 1 (Sell):", order1);
    console.log("Order 2 (Buy):", order2);
    console.log("Order 3 (Buy):", order3);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order3.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("20", "ether"))
    );

    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order3.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
  });

  it("should get all orders for a market with filters", async () => {
    const marketId = web3.utils.keccak256("ETH/USD");
    await orderBookManager.createMarketOrderBook(marketId, { from: deployer });

    const amount1 = new BN(100);
    const price1 = new BN(50);
    const amount2 = new BN(200);
    const price2 = new BN(60);
    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add buy order
    await orderBookManager.createOrder(
      marketId,
      amount1,
      price1,
      user1,
      orderTypeBuy,
      orderNature,
      { from: deployer }
    );

    // Add sell order
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2,
      user2,
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    const params = {
      status: OrderLibrary.OrderStatus.Active,
      filterByUser: false, // Don't filter by user
      userAddress: user1,
    };

    const result = await orderBookManager.getAllOrdersForAMarket(
      marketId,
      params
    );

    expect(result.amount.length).to.equal(2);
    expect(result.price.length).to.equal(2);
    expect(result.orderType.length).to.equal(2);
    expect(result.nature.length).to.equal(2);

    expect(result.amount[0]).to.be.bignumber.equal(amount1);
    expect(result.price[0]).to.be.bignumber.equal(price1);
    expect(result.orderType[0]).to.be.bignumber.equal(new BN(orderTypeBuy));
    expect(result.nature[0]).to.be.bignumber.equal(new BN(orderNature));

    expect(result.amount[1]).to.be.bignumber.equal(amount2);
    expect(result.price[1]).to.be.bignumber.equal(price2);
    expect(result.orderType[1]).to.be.bignumber.equal(new BN(orderTypeSell));
    expect(result.nature[1]).to.be.bignumber.equal(new BN(orderNature));
  });

  it("should not match 1 sell limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("100", "ether"));
    const price1 = new BN(1);
    const amount2 = new BN(web3.utils.toWei("50", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 USD
      user2, // User 2 is selling 50 ETH
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      usdTokenId,
      orderTypeSell,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeSell, 1);
    // console.log("Order 1 (Buy):", order1);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("50", "ether"))
    );

    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Active);
  });

  it("should match 1 sell limit order to 1 buy limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("100", "ether"));
    const price1 = new BN(1);
    const amount2 = new BN(web3.utils.toWei("50", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add buy limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      price1, // Price is 1 USD
      user1, // User 1 is buying 100 ETH
      orderTypeBuy,
      orderNature,
      { from: deployer }
    );

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 USD
      user2, // User 2 is selling 50 ETH
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      usdTokenId,
      orderTypeSell,
      { from: deployer }
    );

    // Listen for events
    expectEvent(matchReceipt, "OrderFilledEvent", {
      orderId: new BN(1), // sell order is filled
      orderType: new BN(orderTypeSell),
    });
    expectEvent(matchReceipt, "OrderPartiallyFilledEvent", {
      orderId: new BN(1), // buy order is partially filled
      orderType: new BN(orderTypeBuy),
    });

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeSell, 1);
    // console.log("Order 1 (Buy):", order1);
    // console.log("Order 2 (sell):", order2);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("50", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );

    expect(Number(order1.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
  });

  it("should match 1 sell limit order to 2 buy limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("50", "ether"));
    const price1 = new BN(2);
    const amount2 = new BN(web3.utils.toWei("120", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add buy limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      price1, // Price is 2 USD
      user1, // User 1 is buying 50 ETH (Total 100 ETH)
      orderTypeBuy,
      orderNature,
      { from: deployer }
    );

    // Add buy limit order (id 2)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("50", "ether")),
      new BN(1), // Price is 1 USD
      user1, // User 1 is buying another 50 ETH
      orderTypeBuy,
      orderNature,
      { from: deployer }
    );

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 USD
      user2, // User 2 is selling 120 ETH
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      usdTokenId,
      orderTypeSell,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeBuy, 2);
    const order3 = await orderBook.getOrderFromId(orderTypeSell, 1);
    // console.log("Order 1 (Buy):", order1);
    // console.log("Order 2 (Buy):", order2);
    // console.log("Order 3 (sell):", order3);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order3.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("20", "ether"))
    );

    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order3.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
  });

  it("should not match 1 buy limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("100", "ether"));
    const price1 = new BN(1);
    const amount2 = new BN(web3.utils.toWei("50", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add buy limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 ETH
      user1, // User 1 is buying 50 USD
      orderTypeBuy,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      usdTokenId,
      orderTypeBuy,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    // console.log("Order 1 (Buy):", order1);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("50", "ether"))
    );

    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Active);
  });

  it("should match 1 buy limit order to 1 sell limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("100", "ether"));
    const price1 = new BN(1);
    const amount2 = new BN(web3.utils.toWei("50", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      price1, // Price is 1 USD
      user1, // User 1 is selling 100 ETH
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Add buy limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 USD
      user2, // User 2 is buying 50 ETH
      orderTypeBuy,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      ethTokenId,
      orderTypeBuy,
      { from: deployer }
    );

    // Listen for events
    expectEvent(matchReceipt, "OrderFilledEvent", {
      orderId: new BN(1), // buy order is filled
      orderType: new BN(orderTypeBuy),
    });
    expectEvent(matchReceipt, "OrderPartiallyFilledEvent", {
      orderId: new BN(1), // sell order is partially filled
      orderType: new BN(orderTypeSell),
    });

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeSell, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    // console.log("Order 1 (Sell):", order1);
    // console.log("Order 2 (Buy):", order2);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("50", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );

    expect(Number(order1.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
  });

  it("should match 1 buy limit order to 2 sell limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("50", "ether"));
    const price1 = new BN(2);
    const amount2 = new BN(web3.utils.toWei("120", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      price1, // Price is 2 USD
      user1, // User 1 is selling 50 ETH (Total 100 ETH)
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Add sell limit order (id 2)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("50", "ether")),
      new BN(1), // Price is 1 USD
      user1, // User 1 is selling another 50 ETH
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Add buy limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 USD
      user2, // User 2 is buying 120 ETH
      orderTypeBuy,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      ethTokenId,
      orderTypeBuy,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeSell, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeSell, 2);
    const order3 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    // console.log("Order 1 (Sell):", order1);
    // console.log("Order 2 (Sell):", order2);
    // console.log("Order 3 (Buy):", order3);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("50", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order3.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("70", "ether"))
    );

    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Active);
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order3.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
  });

  it("should match 1 sell limit order to 1 buy market order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("100", "ether"));
    const price1 = new BN(1);
    const amount2 = new BN(web3.utils.toWei("50", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add buy market order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      0, // Price doesn't matter for market order
      user1, // User 1 is buying 100 USD
      orderTypeBuy,
      OrderLibrary.OrderNature.Market,
      { from: deployer }
    );

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 ETH
      user2, // User 2 is selling 50 USD
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      ethTokenId,
      orderTypeSell,
      { from: deployer }
    );

    // Listen for events
    expectEvent(matchReceipt, "OrderFilledEvent", {
      orderId: new BN(1), // sell order is filled
      orderType: new BN(orderTypeSell),
    });
    expectEvent(matchReceipt, "OrderPartiallyFilledEvent", {
      orderId: new BN(1), // buy order is partially filled
      orderType: new BN(orderTypeBuy),
    });

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeSell, 1);
    // console.log("Order 1 (Buy):", order1);
    // console.log("Order 2 (Sell):", order2);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("50", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );

    expect(Number(order1.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
  });

  it("should match 1 sell limit order to 2 buy market order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Create orders
    const amount1 = new BN(web3.utils.toWei("100", "ether"));
    const price1 = new BN(1);
    const amount2 = new BN(web3.utils.toWei("120", "ether"));
    const price2 = new BN(1);

    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add buy market order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount1,
      0, // Price doesn't matter for market order
      user1, // User 1 is buying 100 USD
      orderTypeBuy,
      OrderLibrary.OrderNature.Market,
      { from: deployer }
    );

    // Add buy market order (id 2)
    await orderBookManager.createOrder(
      marketId,
      new BN(web3.utils.toWei("50", "ether")),
      0, // Price doesn't matter for market order
      user1, // User 1 is buying another 50 USD
      orderTypeBuy,
      OrderLibrary.OrderNature.Market,
      { from: deployer }
    );

    // Add sell limit order (id 1)
    await orderBookManager.createOrder(
      marketId,
      amount2,
      price2, // Price is 1 ETH
      user2, // User 2 is selling 120 USD
      orderTypeSell,
      orderNature,
      { from: deployer }
    );

    // Match orders
    const matchReceipt = await orderBookManager.matchOrder(
      marketId,
      1, // Assuming the pending order ID is 1
      ethTokenId,
      orderTypeSell,
      { from: deployer }
    );

    // Check created orders
    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(orderTypeBuy, 1);
    const order2 = await orderBook.getOrderFromId(orderTypeBuy, 2);
    const order3 = await orderBook.getOrderFromId(orderTypeSell, 1);
    // console.log("Order 1 (Buy):", order1);
    // console.log("Order 2 (Buy):", order2);
    // console.log("Order 3 (Sell):", order3);

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("30", "ether"))
    );
    expect(order3.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );

    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order2.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
    expect(Number(order3.status)).to.equal(OrderLibrary.OrderStatus.Filled);
  });
});
