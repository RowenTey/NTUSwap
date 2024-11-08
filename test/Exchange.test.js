const Exchange = artifacts.require("Exchange");
const OrderBookManager = artifacts.require("OrderBookManager");
const OrderBookData = artifacts.require("OrderBookData");
const TokenManager = artifacts.require("TokenManager");
const OrderLibrary = artifacts.require("OrderLibrary");
const MarketManager = artifacts.require("MarketManager");
const MarketData = artifacts.require("MarketData");
const Token = artifacts.require("Token");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("Exchange", (accounts) => {
  const [deployer, user1, user2] = accounts;
  let exchange, orderBookManager, tokenManager, marketManager;

  beforeEach(async () => {
    tokenManager = await TokenManager.new();
    marketData = await MarketData.new();
    orderBookManager = await OrderBookManager.new();
    marketManager = await MarketManager.new();
    await orderBookManager.initialize(tokenManager.address);
    await marketManager.initialize(
      marketData.address,
      orderBookManager.address
    );
    await tokenManager.initialize(marketManager.address);
    await marketData.initialize(marketManager.address);
    exchange = await Exchange.new(
      marketManager.address,
      orderBookManager.address,
      tokenManager.address
    );
  });

  async function setupMarketAndTokens() {
    // Issue tokens (market created)
    await tokenManager.issueToken(
      "Ether",
      "ETH",
      new BN(web3.utils.toWei("10000", "ether")),
      { from: deployer }
    );
    await tokenManager.issueToken(
      "USD",
      "USD",
      new BN(web3.utils.toWei("10000", "ether")),
      { from: deployer }
    );

    // Approve and transfer tokens to user1
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

    // Approve tokens for TokenManager contract for deposits
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

    // Get marketId
    const marketId = await marketManager.getMarketId(ethTokenId, usdTokenId);
    console.log("Created market:", marketId);

    return { marketId, ethTokenId, usdTokenId };
  }

  it("should deposit and withdraw tokens", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();
    // Deposit tokens through the exchange contract
    const ethDepositReceipt = await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    const usdDepositReceipt = await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    // Verify deposit events
    expectEvent(ethDepositReceipt, "DepositReceived", {
      user: user1,
      tokenId: ethTokenId,
      amount: new BN(web3.utils.toWei("500", "ether")),
    });
    expectEvent(usdDepositReceipt, "DepositReceived", {
      user: user2,
      tokenId: usdTokenId,
      amount: new BN(web3.utils.toWei("600", "ether")),
    });

    // Withdraw tokens through the exchange contract
    const ethWithdrawAmount = new BN(web3.utils.toWei("100", "ether"));
    const usdWithdrawAmount = new BN(web3.utils.toWei("200", "ether"));

    console.log("ETH Withdrawal Amount - ", ethWithdrawAmount);
    console.log("USD Withdrawal Amount - ", usdWithdrawAmount);

    const ethWithdrawReceipt = await exchange.withdrawTokens(
      "ETH",
      ethWithdrawAmount,
      {
        from: user1,
      }
    );
    const usdWithdrawReceipt = await exchange.withdrawTokens(
      "USD",
      usdWithdrawAmount,
      {
        from: user2,
      }
    );

    // Verify withdrawal events
    expectEvent(ethWithdrawReceipt, "WithdrawalProcessed", {
      user: user1,
      tokenId: ethTokenId,
      amount: ethWithdrawAmount,
    });
    expectEvent(usdWithdrawReceipt, "WithdrawalProcessed", {
      user: user2,
      tokenId: usdTokenId,
      amount: usdWithdrawAmount,
    });
  });

  it("should place and match a buy limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens through the exchange contract
    const ethDepositReceipt = await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    const usdDepositReceipt = await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    // Verify deposit events
    expectEvent(ethDepositReceipt, "DepositReceived", {
      user: user1,
      tokenId: ethTokenId,
      amount: new BN(web3.utils.toWei("500", "ether")),
    });
    expectEvent(usdDepositReceipt, "DepositReceived", {
      user: user2,
      tokenId: usdTokenId,
      amount: new BN(web3.utils.toWei("600", "ether")),
    });

    const token1 = "ETH";
    const token2 = "USD";
    const price = new BN(web3.utils.toWei("2", "ether"));
    const amount = new BN(web3.utils.toWei("20", "ether"));

    const user1BalanceETH = await exchange.getUserTokenBalance(user1, token1);
    const user1BalanceUSD = await exchange.getUserTokenBalance(user1, token2);
    const user2BalanceETH = await exchange.getUserTokenBalance(user2, token1);
    const user2BalanceUSD = await exchange.getUserTokenBalance(user2, token2);

    console.log("user1BalanceETH - ", user1BalanceETH);
    console.log("user1BalanceUSD - ", user1BalanceUSD);
    console.log("user2BalanceETH - ", user2BalanceETH);
    console.log("user2BalanceUSD - ", user2BalanceUSD);

    await exchange.placeLimitOrder(
      token2, // want
      token1, // give
      new BN(web3.utils.toWei("1", "ether")), // User 1 wants to sell 10 ETH at a price of 1 USD per unit
      new BN(web3.utils.toWei("10", "ether")),
      OrderLibrary.OrderType.Sell,
      { from: user1 }
    );

    await exchange.placeLimitOrder(
      token1, // want
      token2, // give
      price, // User 2 wants to buy 20 ETH at the price of 2 USD per unit
      amount,
      OrderLibrary.OrderType.Buy,
      { from: user2 }
    );

    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(
      OrderLibrary.OrderType.Sell,
      new BN(1)
    );
    const order2 = await orderBook.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      new BN(1)
    );

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("10", "ether"))
    );
    expect(Number(order1.status)).to.equal(OrderLibrary.OrderStatus.Filled);
    expect(Number(order2.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
  });

  it("should place and match a sell limit order with market buy order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens through the exchange contract
    const ethDepositReceipt = await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    const usdDepositReceipt = await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    // Verify deposit events
    expectEvent(ethDepositReceipt, "DepositReceived", {
      user: user1,
      tokenId: ethTokenId,
      amount: new BN(web3.utils.toWei("500", "ether")),
    });
    expectEvent(usdDepositReceipt, "DepositReceived", {
      user: user2,
      tokenId: usdTokenId,
      amount: new BN(web3.utils.toWei("600", "ether")),
    });

    const token1 = "ETH";
    const token2 = "USD";
    const price = new BN(web3.utils.toWei("2", "ether"));
    const amount = new BN(web3.utils.toWei("20", "ether"));

    await exchange.placeMarketOrder(
      token1, // want
      token2, // give
      amount,
      OrderLibrary.OrderType.Buy,
      { from: user2 }
    );
    await exchange.placeLimitOrder(
      token1, // want
      token2, // give
      new BN(web3.utils.toWei("2", "ether")),
      amount,
      OrderLibrary.OrderType.Buy,
      { from: user2 }
    );

    await exchange.placeLimitOrder(
      token2, // want
      token1, // give
      new BN(web3.utils.toWei("1", "ether")), // User 1 wants to sell 10 ETH at a price of 1 USD per unit
      new BN(web3.utils.toWei("30", "ether")),
      OrderLibrary.OrderType.Sell,
      { from: user1 }
    );

    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      new BN(1)
    );
    const order2 = await orderBook.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      new BN(2)
    );
    const order3 = await orderBook.getOrderFromId(
      OrderLibrary.OrderType.Sell,
      new BN(1)
    );

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("10", "ether"))
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

  it("should match a buy market order with a sell limit order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens through the exchange contract
    const ethDepositReceipt = await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    const usdDepositReceipt = await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user2 }
    );

    // Verify deposit events
    expectEvent(ethDepositReceipt, "DepositReceived", {
      user: user1,
      tokenId: ethTokenId,
      amount: new BN(web3.utils.toWei("500", "ether")),
    });
    expectEvent(usdDepositReceipt, "DepositReceived", {
      user: user2,
      tokenId: usdTokenId,
      amount: new BN(web3.utils.toWei("500", "ether")),
    });

    const token1 = "ETH";
    const token2 = "USD";
    const price = new BN(web3.utils.toWei("1", "ether"));
    const amount = new BN(web3.utils.toWei("20", "ether"));

    await exchange.placeLimitOrder(
      token2,
      token1,
      price,
      amount,
      OrderLibrary.OrderType.Sell,
      { from: user1 }
    );
    await exchange.placeMarketOrder(
      token1,
      token2,
      new BN(web3.utils.toWei("30", "ether")),
      OrderLibrary.OrderType.Buy,
      { from: user2 }
    );

    const orderBookAddress = await orderBookManager.marketOrderBooks(marketId);
    const orderBook = await OrderBookData.at(orderBookAddress);
    const order1 = await orderBook.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      new BN(1)
    );
    const order2 = await orderBook.getOrderFromId(
      OrderLibrary.OrderType.Sell,
      new BN(1)
    );

    expect(order1.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("10", "ether"))
    );
    expect(order2.remainingAmount).to.be.bignumber.equal(
      new BN(web3.utils.toWei("0", "ether"))
    );
    expect(Number(order1.status)).to.equal(
      OrderLibrary.OrderStatus.PartiallyFilled
    );
    expect(Number(order2.status)).to.equal(OrderLibrary.OrderStatus.Filled);
  });

  it("should cancel an order", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens through the exchange contract
    const ethDepositReceipt = await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    const usdDepositReceipt = await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    // Verify deposit events
    expectEvent(ethDepositReceipt, "DepositReceived", {
      user: user1,
      tokenId: ethTokenId,
      amount: new BN(web3.utils.toWei("500", "ether")),
    });
    expectEvent(usdDepositReceipt, "DepositReceived", {
      user: user2,
      tokenId: usdTokenId,
      amount: new BN(web3.utils.toWei("600", "ether")),
    });

    const token1 = "ETH";
    const token2 = "USD";
    const amount = new BN(web3.utils.toWei("50", "ether"));
    const price = new BN(web3.utils.toWei("1", "ether"));

    await exchange.placeLimitOrder(
      token1,
      token2,
      price,
      amount,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    const receipt = await exchange.cancelOrder(
      ethTokenId,
      usdTokenId,
      new BN(1),
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: user2 }
    );

    expectEvent(receipt, "OrderCancelled", {
      marketId: marketId,
      orderId: new BN(1),
      userAddress: user2,
    });
  });

  it("should retrieve all active orders for a market", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens through the exchange contract
    const ethDepositReceipt = await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    const usdDepositReceipt = await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    // Verify deposit events
    expectEvent(ethDepositReceipt, "DepositReceived", {
      user: user1,
      tokenId: ethTokenId,
      amount: new BN(web3.utils.toWei("500", "ether")),
    });
    expectEvent(usdDepositReceipt, "DepositReceived", {
      user: user2,
      tokenId: usdTokenId,
      amount: new BN(web3.utils.toWei("600", "ether")),
    });

    const token1 = "ETH";
    const token2 = "USD";
    const price = new BN(web3.utils.toWei("2", "ether"));
    const amount = new BN(web3.utils.toWei("20", "ether"));
    const price2 = new BN(web3.utils.toWei("1", "ether")); // User 1 wants to sell 10 ETH at a price of 1 USD per unit
    const amount2 = new BN(web3.utils.toWei("10", "ether"));

    await exchange.placeLimitOrder(
      token2,
      token1,
      price,
      amount,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );
    await exchange.placeLimitOrder(
      token1,
      token2,
      price2,
      amount2,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    const activeOrders = await exchange.getAllActiveOrdersForAMarket(
      token1,
      token2
    );

    expect(activeOrders.amount.length).to.equal(1);
    expect(activeOrders.price[0].toString()).to.equal(price.toString());
    expect(activeOrders.orderType[0].toString()).to.equal(
      OrderLibrary.OrderType.Buy.toString()
    );
  });

  it("should retrieve all active orders for a specific user after matching", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens for both users
    await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    const token1 = "ETH";
    const token2 = "USD";
    const buyPrice1 = new BN(web3.utils.toWei("3", "ether"));
    const buyAmount1 = new BN(web3.utils.toWei("20", "ether"));
    const buyPrice2 = new BN(web3.utils.toWei("2", "ether"));
    const buyAmount2 = new BN(web3.utils.toWei("20", "ether"));
    const sellPrice1 = new BN(web3.utils.toWei("1", "ether"));
    const sellAmount1 = new BN(web3.utils.toWei("10", "ether"));
    const sellPrice2 = new BN(web3.utils.toWei("1", "ether"));
    const sellAmount2 = new BN(web3.utils.toWei("25", "ether"));

    // User 1 places two buy orders
    await exchange.placeLimitOrder(
      token2,
      token1,
      buyPrice1,
      buyAmount1,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );
    await exchange.placeLimitOrder(
      token2,
      token1,
      buyPrice2,
      buyAmount2,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );

    // User 2 places two sell orders to trigger matching
    await exchange.placeLimitOrder(
      token1,
      token2,
      sellPrice1,
      sellAmount1,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );
    await exchange.placeLimitOrder(
      token1,
      token2,
      sellPrice2,
      sellAmount2,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    // Retrieve all active orders for user1 in the market
    const activeOrdersUser1 = await exchange.getAllActiveUserOrdersForAMarket(
      token1,
      token2,
      user1
    );

    // Assertions
    expect(activeOrdersUser1.amount.length).to.equal(1); // Only one active order left for user1
    expect(activeOrdersUser1.price[0].toString()).to.equal(
      buyPrice2.toString()
    ); // Buy Order 2 is active
    expect(activeOrdersUser1.amount[0].toString()).to.equal(
      new BN(web3.utils.toWei("5", "ether")).toString()
    );
    expect(activeOrdersUser1.orderType[0].toString()).to.equal(
      OrderLibrary.OrderType.Buy.toString()
    );
  });
  it("should retrieve all fulfilled orders after matching", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens for both users
    await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    const token1 = "ETH";
    const token2 = "USD";
    const buyPrice1 = new BN(web3.utils.toWei("3", "ether"));
    const buyAmount1 = new BN(web3.utils.toWei("20", "ether"));
    const buyPrice2 = new BN(web3.utils.toWei("2", "ether"));
    const buyAmount2 = new BN(web3.utils.toWei("20", "ether"));
    const sellPrice1 = new BN(web3.utils.toWei("1", "ether"));
    const sellAmount1 = new BN(web3.utils.toWei("10", "ether"));
    const sellPrice2 = new BN(web3.utils.toWei("1", "ether"));
    const sellAmount2 = new BN(web3.utils.toWei("25", "ether"));

    // User 1 places two buy orders
    await exchange.placeLimitOrder(
      token2,
      token1,
      buyPrice1,
      buyAmount1,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );
    await exchange.placeLimitOrder(
      token2,
      token1,
      buyPrice2,
      buyAmount2,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );

    // User 2 places two sell orders to trigger matching
    await exchange.placeLimitOrder(
      token1,
      token2,
      sellPrice1,
      sellAmount1,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );
    await exchange.placeLimitOrder(
      token1,
      token2,
      sellPrice2,
      sellAmount2,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    // Retrieve all filled orders in the market
    const filledOrders = await exchange.getAllFulfilledOrdersOfAMarket(
      token1,
      token2
    );

    // Assertions
    expect(filledOrders.amount.length).to.equal(3); // 3 filled orders
    expect(filledOrders.amount[0].toString()).to.equal(
      new BN(web3.utils.toWei("0", "ether")).toString()
    );
    expect(filledOrders.orderType[0].toString()).to.equal(
      OrderLibrary.OrderType.Buy.toString()
    );
  });
  it("should retrieve all fulfilled orders for a user after matching", async () => {
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Deposit tokens for both users
    await exchange.depositTokens(
      "ETH",
      new BN(web3.utils.toWei("500", "ether")),
      { from: user1 }
    );
    await exchange.depositTokens(
      "USD",
      new BN(web3.utils.toWei("600", "ether")),
      { from: user2 }
    );

    const token1 = "ETH";
    const token2 = "USD";
    const buyPrice1 = new BN(web3.utils.toWei("3", "ether"));
    const buyAmount1 = new BN(web3.utils.toWei("20", "ether"));
    const buyPrice2 = new BN(web3.utils.toWei("2", "ether"));
    const buyAmount2 = new BN(web3.utils.toWei("20", "ether"));
    const sellPrice1 = new BN(web3.utils.toWei("1", "ether"));
    const sellAmount1 = new BN(web3.utils.toWei("10", "ether"));
    const sellPrice2 = new BN(web3.utils.toWei("1", "ether"));
    const sellAmount2 = new BN(web3.utils.toWei("25", "ether"));

    // User 1 places two buy orders
    await exchange.placeLimitOrder(
      token2,
      token1,
      buyPrice1,
      buyAmount1,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );
    await exchange.placeLimitOrder(
      token2,
      token1,
      buyPrice2,
      buyAmount2,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );

    // User 2 places two sell orders to trigger matching
    await exchange.placeLimitOrder(
      token1,
      token2,
      sellPrice1,
      sellAmount1,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );
    await exchange.placeLimitOrder(
      token1,
      token2,
      sellPrice2,
      sellAmount2,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    // Retrieve all filled orders in the market
    const filledOrders = await exchange.getAllFulfilledUserOrdersForAMarket(
      token1,
      token2,
      user2
    );

    // Assertions
    expect(filledOrders.amount.length).to.equal(2); // 2 filled orders for user2
    expect(filledOrders.amount[0].toString()).to.equal(
      new BN(web3.utils.toWei("0", "ether")).toString()
    );
    expect(filledOrders.orderType[0].toString()).to.equal(
      OrderLibrary.OrderType.Sell.toString()
    );
  });
});
