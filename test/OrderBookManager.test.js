const OrderBookManager = artifacts.require("OrderBookManager");
const OrderBookData = artifacts.require("OrderBookData");
const TokenManager = artifacts.require("TokenManager");
const OrderLibrary = artifacts.require("OrderLibrary");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("OrderBookManager", (accounts) => {
  const [deployer, user1, user2] = accounts;
  let orderBookManager;
  let tokenManager;

  beforeEach(async () => {
    tokenManager = await TokenManager.new();
    orderBookManager = await OrderBookManager.new();
    await orderBookManager.initialize(tokenManager.address);
  });

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

  it("match 2 limit orders", async () => {
    const marketId = web3.utils.keccak256("ETH/USD");
    await orderBookManager.createMarketOrderBook(marketId, { from: deployer });

    const amount1 = new BN(100);
    const price1 = new BN(50);
    const amount2 = new BN(100);
    const price2 = new BN(50);
    const orderTypeBuy = OrderLibrary.OrderType.Buy;
    const orderTypeSell = OrderLibrary.OrderType.Sell;
    const orderNatureLimit = OrderLibrary.OrderNature.Limit;

    const buyOrderReceipt = await orderBookManager.createOrder(
      marketId,
      amount1,
      price1,
      user1,
      orderTypeBuy,
      orderNatureLimit,
      { from: deployer }
    );

    const sellOrderReceipt = await orderBookManager.createOrder(
      marketId,
      amount2,
      price2,
      user2,
      orderTypeSell,
      orderNatureLimit,
      { from: deployer }
    );

    const result = await orderBookManager.matchOrder(
      marketId,
      new BN(1),
      0,
      orderTypeBuy,
      { from: deployer }
    );

    const buyOrderId = new BN(1);
    const sellOrderId = new BN(2);
    

    expect(result.pendingOrderNewAmount).to.be.bignumber.equal(new BN(0));

  });
});
