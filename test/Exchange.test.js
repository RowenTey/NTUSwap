const Exchange = artifacts.require("Exchange");
const OrderBookManager = artifacts.require("OrderBookManager");
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
    await usdToken.transfer(user1, new BN(web3.utils.toWei("600", "ether")), {
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
      { from: user1 }
    );
    await ethToken.transfer(user2, new BN(web3.utils.toWei("500", "ether")), {
      from: deployer,
    });
    await usdToken.transfer(user2, new BN(web3.utils.toWei("600", "ether")), {
      from: deployer,
    });

    // Approve tokens for TokenManager contract for deposits
    await ethToken.approve(
      tokenManager.address,
      new BN(web3.utils.toWei("500", "ether")),
      { from: user2 }
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

    const token1 = "ETH";
    const token2 = "USD";
    const price = new BN(web3.utils.toWei("2", "ether"));
    const amount = new BN(web3.utils.toWei("20", "ether"));

    await exchange.placeLimitOrder(
        token1, // give
        token2, // want
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
    const orderBook = await OrderBookManager.at(orderBookAddress);
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

    const user1BalanceETH = await exchange.getTokenBalance(user1, token1);
    const user1BalanceUSD = await exchange.getTokenBalance(user1, token2);
    const user2BalanceETH = await exchange.getTokenBalance(user2, token1);
    const user2BalanceUSD = await exchange.getTokenBalance(user2, token2);

    console.log("user1BalanceETH - ", user1BalanceETH);
    console.log("user1BalanceUSD - ", user1BalanceUSD);
    console.log("user2BalanceETH - ", user2BalanceETH);
    console.log("user2BalanceUSD - ", user2BalanceUSD);
  });

  it("should cancel an order", async () => {
    const token1 = "BTC";
    const token2 = "USD";
    const amount = new BN(50);
    const price = new BN(30);

    await tokenManager.issueToken(
      token1,
      token1,
      new BN(web3.utils.toWei("500", "ether")),
      { from: deployer }
    );
    await tokenManager.issueToken(
      token2,
      token2,
      new BN(web3.utils.toWei("500", "ether")),
      { from: deployer }
    );
    const orderId = await exchange.placeLimitOrder(
      token1,
      token2,
      price,
      amount,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    const marketId = await marketManager.getMarketId(
      await tokenManager.getTokenId(token1),
      await tokenManager.getTokenId(token2)
    );
    const receipt = await exchange.cancelOrder(
      marketId,
      orderId,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: user2 }
    );

    expectEvent(receipt, "OrderCancelled", {
      marketId: marketId,
      orderId: orderId,
      userAddress: user2,
    });
  });

  it("should match buy and sell limit orders", async () => {
    const token1 = "ETH";
    const token2 = "USD";
    const buyAmount = new BN(100);
    const sellAmount = new BN(100);
    const price = new BN(50);

    await tokenManager.issueToken(
      token1,
      token1,
      new BN(web3.utils.toWei("1000", "ether")),
      { from: deployer }
    );
    await tokenManager.issueToken(
      token2,
      token2,
      new BN(web3.utils.toWei("1000", "ether")),
      { from: deployer }
    );

    await tokenManager.transfer(
      user1,
      new BN(web3.utils.toWei("500", "ether")),
      { from: deployer }
    );
    await tokenManager.transfer(
      user2,
      new BN(web3.utils.toWei("500", "ether")),
      { from: deployer }
    );

    await exchange.placeLimitOrder(
      token1,
      token2,
      price,
      buyAmount,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );
    const receipt = await exchange.placeLimitOrder(
      token2,
      token1,
      price,
      sellAmount,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    expectEvent(receipt, "OrderMatched", {
      matchedAmount: sellAmount,
      executionPrice: price,
    });
  });

  it("should retrieve all active orders for a market", async () => {

    const token1 = "ETH";
    const token2 = "USD";
    const buyAmount = new BN(100);
    const sellAmount = new BN(100);
    const price = new BN(50);

    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    console.log("token id: ", ethTokenId);

    await exchange.placeLimitOrder(
      token2,
      token1,
      price,
      buyAmount,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );
    await exchange.placeLimitOrder(
      token1,
      token2,
      price,
      sellAmount,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    const [amounts, prices, orderIds, orderTypes, nature, fillsamt, fillsprice, fillstimestamp] =
      await exchange.getAllActiveOrdersForAMarket(token1, token2);

    expect(amounts.length).to.equal(2);
    expect(prices[0].toString()).to.equal(price.toString());
    expect(orderTypes[0].toString()).to.equal(
      OrderLibrary.OrderType.Buy.toString()
    );
  });

  it("should retrieve all fulfilled orders for a market", async () => {
    const amount = new BN(100);
    const price = new BN(50);
    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // Place initial buy and sell orders
    const buyOrderId = await exchange.placeLimitOrder(
      usdTokenId,
      ethTokenId,
      price,
      amount,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );

    const sellOrderId = await exchange.placeLimitOrder(
      ethTokenId,
      usdTokenId,
      price,
      amount,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    // Assuming the OrderBookManager contract has a function to update order status:
    await orderBookManager.updateOrderStatus(
      buyOrderId,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );

    await orderBookManager.updateOrderStatus(
      sellOrderId,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );

    // Retrieve fulfilled orders
    const [amounts, prices, orderIds, orderTypes] =
      await exchange.getAllFulfilledOrdersOfAMarket(token1Symbol, token2Symbol);

    // Assertions for fulfilled orders
    expect(amounts.length).to.equal(2); // Expect both orders to be fulfilled
    expect(prices[0].toString()).to.equal(price.toString());
    expect(prices[1].toString()).to.equal(price.toString());
    expect(orderTypes[0].toString()).to.equal(
      OrderLibrary.OrderType.Buy.toString()
    );
    expect(orderTypes[1].toString()).to.equal(
      OrderLibrary.OrderType.Sell.toString()
    );
  });

  it("should retrieve all active orders for a specific user in a market with multiple orders for each user", async () => {
    const amount1 = new BN(100);
    const price1 = new BN(50);
    const amount2 = new BN(150);
    const price2 = new BN(60);
    const amount3 = new BN(200);
    const price3 = new BN(55);
    const amount4 = new BN(250);
    const price4 = new BN(65);

    const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

    // User1 places  buy  and sell orders
    await exchange.placeLimitOrder(
      usdTokenId,
      ethTokenId,
      price1,
      amount1,
      OrderLibrary.OrderType.Buy,
      { from: user1 }
    );
    await exchange.placeLimitOrder(
      usdTokenId,
      ethTokenId,
      price3,
      amount3,
      OrderLibrary.OrderType.Sell,
      { from: user1 }
    );

    // User2 places two sell orders
    await exchange.placeLimitOrder(
      ethTokenId,
      usdTokenId,
      price2,
      amount2,
      OrderLibrary.OrderType.Buy,
      { from: user2 }
    );
    await exchange.placeLimitOrder(
      ethTokenId,
      usdTokenId,
      price4,
      amount4,
      OrderLibrary.OrderType.Sell,
      { from: user2 }
    );

    // Retrieve active orders for user1
    const [amountsUser1, pricesUser1, orderIdsUser1, orderTypesUser1] =
      await exchange.getAllActiveUserOrdersForAMarket(
        token1Symbol,
        token2Symbol,
        user1
      );

    // Assertions for user1's active orders
    expect(amountsUser1.length).to.equal(2);
    expect(amountsUser1[0].toString()).to.equal(amount1.toString());
    expect(pricesUser1[0].toString()).to.equal(price1.toString());
    expect(orderTypesUser1[0].toString()).to.equal(
      OrderLibrary.OrderType.Buy.toString()
    );

    expect(amountsUser1[1].toString()).to.equal(amount3.toString());
    expect(pricesUser1[1].toString()).to.equal(price3.toString());
    expect(orderTypesUser1[1].toString()).to.equal(
      OrderLibrary.OrderType.Buy.toString()
    );

    // Retrieve active orders for user2
    const [amountsUser2, pricesUser2, orderIdsUser2, orderTypesUser2] =
      await exchange.getAllActiveUserOrdersForAMarket(
        token1Symbol,
        token2Symbol,
        user2
      );

    // Assertions for user2's active orders
    expect(amountsUser2.length).to.equal(2);
    expect(amountsUser2[0].toString()).to.equal(amount2.toString());
    expect(pricesUser2[0].toString()).to.equal(price2.toString());
    expect(orderTypesUser2[0].toString()).to.equal(
      OrderLibrary.OrderType.Sell.toString()
    );

    expect(amountsUser2[1].toString()).to.equal(amount4.toString());
    expect(pricesUser2[1].toString()).to.equal(price4.toString());
    expect(orderTypesUser2[1].toString()).to.equal(
      OrderLibrary.OrderType.Sell.toString()
    );
  });

  //   it("should retrieve all fulfilled orders for a specific user", async () => {
  //     const amount = new BN(100);
  //     const price = new BN(50);

  //     const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

  //     // Issue tokens and set up user balances
  //     await tokenManager.issueToken(
  //       "ETH",
  //       "ETH",
  //       new BN(web3.utils.toWei("1000", "ether")),
  //       { from: deployer }
  //     );
  //     await tokenManager.issueToken(
  //       "USD",
  //       "USD",
  //       new BN(web3.utils.toWei("1000", "ether")),
  //       { from: deployer }
  //     );
  //     await tokenManager.transfer(
  //       user1,
  //       new BN(web3.utils.toWei("500", "ether")),
  //       { from: deployer }
  //     );
  //     await tokenManager.transfer(
  //       user2,
  //       new BN(web3.utils.toWei("500", "ether")),
  //       { from: deployer }
  //     );

  //     // Approve tokens and deposit into exchange for both users
  //     await tokenManager.approve(
  //       exchange.address,
  //       new BN(web3.utils.toWei("500", "ether")),
  //       { from: user1 }
  //     );
  //     await tokenManager.approve(
  //       exchange.address,
  //       new BN(web3.utils.toWei("500", "ether")),
  //       { from: user2 }
  //     );
  //     await exchange.depositTokens(
  //       "ETH",
  //       new BN(web3.utils.toWei("500", "ether")),
  //       { from: user1 }
  //     );
  //     await exchange.depositTokens(
  //       "USD",
  //       new BN(web3.utils.toWei("500", "ether")),
  //       { from: user2 }
  //     );

  //     // Place a buy order for user1 and a sell order for user2
  //     const buyOrderId = await exchange.placeLimitOrder(
  //       "ETH",
  //       "USD",
  //       price,
  //       amount,
  //       OrderLibrary.OrderType.Buy,
  //       { from: user1 }
  //     );

  //     const sellOrderId = await exchange.placeLimitOrder(
  //       "USD",
  //       "ETH",
  //       price,
  //       amount,
  //       OrderLibrary.OrderType.Sell,
  //       { from: user2 }
  //     );

  //     // Manually set both orders to 'Filled' status for testing retrieval
  //     await orderBookManager.updateOrderStatus(
  //       buyOrderId,
  //       OrderLibrary.OrderStatus.Filled,
  //       { from: deployer }
  //     );

  //     await orderBookManager.updateOrderStatus(
  //       sellOrderId,
  //       OrderLibrary.OrderStatus.Filled,
  //       { from: deployer }
  //     );

  //     // Retrieve fulfilled orders for user1
  //     const [amounts, prices, orderIds, orderTypes] =
  //       await exchange.getAllFulfilledUserOrdersForAMarket("ETH", "USD", user1);

  //     // Assertions
  //     expect(amounts.length).to.equal(1); // Only user1's order should appear
  //     expect(prices[0].toString()).to.equal(price.toString());
  //     expect(orderIds[0].toString()).to.equal(buyOrderId.toString());
  //     expect(orderTypes[0].toString()).to.equal(
  //       OrderLibrary.OrderType.Buy.toString()
  //     );
  //   });

  //   it("should retrieve all canceled orders for a specific user in a market", async () => {
  //     const amount = new BN(100);
  //     const price = new BN(50);

  //     const { marketId, ethTokenId, usdTokenId } = await setupMarketAndTokens();

  //     const orderId = await exchange.placeLimitOrder(
  //       token1Symbol,
  //       token2Symbol,
  //       price,
  //       amount,
  //       OrderLibrary.OrderType.Buy,
  //       { from: user1 }
  //     );

  //     await exchange.cancelOrder(
  //       marketId,
  //       orderId,
  //       OrderLibrary.OrderType.Buy,
  //       OrderLibrary.OrderNature.Limit,
  //       { from: user1 }
  //     );

  //     const [amounts, prices, orderIds, orderTypes] =
  //       await exchange.getAllCancelledUserOrdersForAMarket(
  //         token1Symbol,
  //         token2Symbol,
  //         user1
  //       );

  //     expect(amounts.length).to.equal(1);
  //     expect(prices[0].toString()).to.equal(price.toString());
  //     expect(orderTypes[0].toString()).to.equal(
  //       OrderLibrary.OrderType.Buy.toString()
  //     );
  //   });
});
