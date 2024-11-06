const OrderBookData = artifacts.require("OrderBookData");
const OrderLibrary = artifacts.require("OrderLibrary");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("OrderBookData", (accounts) => {
  const [deployer, user1, user2, user3] = accounts;
  let orderBookData;

  beforeEach(async () => {
    orderBookData = await OrderBookData.new(deployer);
    await orderBookData.initializeOrderBooks({ from: deployer });
  });
  // Original Tests
  it("should initialize order books", async () => {
    const totalBuyOrders = await orderBookData.getTotalOrderCount(
      OrderLibrary.OrderType.Buy
    );
    const totalSellOrders = await orderBookData.getTotalOrderCount(
      OrderLibrary.OrderType.Sell
    );

    expect(totalBuyOrders).to.be.bignumber.equal(new BN(0));
    expect(totalSellOrders).to.be.bignumber.equal(new BN(0));
  });

  it("should add a new order", async () => {
    const amount = new BN(100);
    const price = new BN(50);
    const orderType = OrderLibrary.OrderType.Buy;
    const orderNature = OrderLibrary.OrderNature.Limit;

    const receipt = await orderBookData.addOrder(
      amount,
      price,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    expectEvent(receipt, "OrderAddedEvent", {
      orderId: new BN(1),
      amount: amount,
      price: price,
      userAddress: user1,
      orderType: new BN(orderType),
      orderNature: new BN(orderNature),
    });
  });

  it("should update an order", async () => {
    const amount = new BN(100);
    const price = new BN(50);
    const orderType = OrderLibrary.OrderType.Buy;
    const orderNature = OrderLibrary.OrderNature.Limit;

    const addReceipt = await orderBookData.addOrder(
      amount,
      price,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const orderId = addReceipt.logs[0].args.orderId;
    const newAmount = new BN(50);
    const newStatus = OrderLibrary.OrderStatus.PartiallyFilled;
    const fillsReceipt = {
      price: 45,
      amount: 50,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const updateReceipt = await orderBookData.updateOrder(
      orderType,
      orderId,
      newAmount,
      newStatus,
      fillsReceipt,
      { from: deployer }
    );
    expectEvent(updateReceipt, "OrderUpdatedEvent", {
      orderId: orderId,
      remainingAmount: newAmount,
      status: new BN(newStatus),
      price: new BN(fillsReceipt.price),
      amount: new BN(fillsReceipt.amount),
      timestamp: new BN(fillsReceipt.timestamp),
    });
  });

  // --- Buy Order Tests ---

  it("should add and retrieve the highest priority limit buy order (max-heap)", async () => {
    const amount = new BN(100);
    const price1 = new BN(50);
    const price2 = new BN(60);
    const price3 = new BN(55);

    await orderBookData.addOrder(
      amount,
      price1,
      user1,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price2,
      user2,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price3,
      user3,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );

    const bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Buy
    );
    const bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      bestOrderId
    );

    expect(bestOrder.price).to.be.bignumber.equal(price2);
    expect(bestOrder.userAddress).to.equal(user2);
  });

  it("should prioritize older limit buy orders at the same price", async () => {
    const amount = new BN(100);
    const price = new BN(50);

    await orderBookData.addOrder(
      amount,
      price,
      user1,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await orderBookData.addOrder(
      amount,
      price,
      user2,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );

    const bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Buy
    );
    const bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      bestOrderId
    );

    expect(bestOrder.userAddress).to.equal(user1);
  });

  it("should correctly handle add and remove in the buy limit order heap", async () => {
    const amount = new BN(100);
    const price1 = new BN(50); // Lowest priority
    const price2 = new BN(60); // Highest priority
    const price3 = new BN(55); // Mid priority

    // Add three orders with different prices
    await orderBookData.addOrder(
      amount,
      price1,
      user1,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price2,
      user2,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price3,
      user3,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );

    // Retrieve the highest priority order before removal
    let bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Buy
    );
    let bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      bestOrderId
    );
    expect(bestOrder.price).to.be.bignumber.equal(price2); // Check that the highest price is prioritized

    // Remove the highest priority order and check the next best
    await orderBookData.removeOrder(
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      bestOrderId,
      { from: deployer }
    );
    bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Buy
    );
    bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      bestOrderId
    );
    expect(bestOrder.price).to.be.bignumber.equal(price3); // Now the mid priority should be on top
  });

  it("should add and remove a market buy order", async () => {
    const amount = new BN(100);
    const orderType = OrderLibrary.OrderType.Buy;
    const orderNature = OrderLibrary.OrderNature.Market;

    const addReceipt = await orderBookData.addOrder(
      amount,
      0,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const orderId = addReceipt.logs[0].args.orderId;

    const removeReceipt = await orderBookData.removeOrder(
      orderType,
      orderNature,
      orderId,
      { from: deployer }
    );

    expectEvent(removeReceipt, "OrderStatusUpdatedEvent", {
      orderId: orderId,
      status: new BN(OrderLibrary.OrderStatus.Cancelled),
    });

    expectEvent(removeReceipt, "OrderRemovedEvent", {
      orderId: orderId,
      orderType: new BN(orderType),
      orderNature: new BN(orderNature),
    });
  });

  // --- Sell Order Tests ---

  it("should add and retrieve the lowest priority limit sell order (min-heap)", async () => {
    const amount = new BN(100);
    const price1 = new BN(30);
    const price2 = new BN(40);
    const price3 = new BN(35);

    await orderBookData.addOrder(
      amount,
      price1,
      user1,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price2,
      user2,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price3,
      user3,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );

    const bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Sell
    );
    const bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Sell,
      bestOrderId
    );

    expect(bestOrder.price).to.be.bignumber.equal(price1);
    expect(bestOrder.userAddress).to.equal(user1);
  });

  it("should prioritize older limit sell orders at the same price", async () => {
    const amount = new BN(100);
    const price = new BN(40);

    await orderBookData.addOrder(
      amount,
      price,
      user1,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await orderBookData.addOrder(
      amount,
      price,
      user2,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );

    const bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Sell
    );
    const bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Sell,
      bestOrderId
    );

    expect(bestOrder.userAddress).to.equal(user1);
  });

  it("should add and remove a market sell order", async () => {
    const amount = new BN(100);
    const orderType = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Market;

    const addReceipt = await orderBookData.addOrder(
      amount,
      0,
      user2,
      orderType,
      orderNature,
      { from: deployer }
    );
    const orderId = addReceipt.logs[0].args.orderId;

    const removeReceipt = await orderBookData.removeOrder(
      orderType,
      orderNature,
      orderId,
      { from: deployer }
    );

    expectEvent(removeReceipt, "OrderStatusUpdatedEvent", {
      orderId: orderId,
      status: new BN(OrderLibrary.OrderStatus.Cancelled),
    });

    expectEvent(removeReceipt, "OrderRemovedEvent", {
      orderId: orderId,
      orderType: new BN(orderType),
      orderNature: new BN(orderNature),
    });
  });

  it("should correctly handle add and remove in the sell limit order heap", async () => {
    const amount = new BN(100);
    const price1 = new BN(30); // Highest priority for sell (min-heap)
    const price2 = new BN(40); // Lowest priority for sell
    const price3 = new BN(35); // Mid priority for sell

    // Add three orders with different prices
    await orderBookData.addOrder(
      amount,
      price1,
      user1,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price2,
      user2,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      price3,
      user3,
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );

    // Retrieve the lowest priority order before removal
    let bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Sell
    );
    let bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Sell,
      bestOrderId
    );
    expect(bestOrder.price).to.be.bignumber.equal(price1); // Check that the lowest price is prioritized

    // Remove the highest priority order and check the next best
    await orderBookData.removeOrder(
      OrderLibrary.OrderType.Sell,
      OrderLibrary.OrderNature.Limit,
      bestOrderId,
      { from: deployer }
    );
    bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Sell
    );
    bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Sell,
      bestOrderId
    );
    expect(bestOrder.price).to.be.bignumber.equal(price3); // Now the mid priority should be on top
  });

  // --- General Heap Tests ---

  it("should correctly prioritize limit orders by price and timestamp", async () => {
    const amount = new BN(100);
    const highPrice = new BN(60);
    const midPrice = new BN(50);
    const lowPrice = new BN(40);

    await orderBookData.addOrder(
      amount,
      midPrice,
      user1,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      highPrice,
      user2,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      lowPrice,
      user3,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );

    const bestOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Buy
    );
    const bestOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      bestOrderId
    );

    expect(bestOrder.price).to.be.bignumber.equal(highPrice);
    expect(bestOrder.userAddress).to.equal(user2);
  });

  it("should handle simultaneous limit and market orders in the heap", async () => {
    const amount = new BN(100);
    const price = new BN(50);

    await orderBookData.addOrder(
      amount,
      price,
      user1,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Limit,
      { from: deployer }
    );
    await orderBookData.addOrder(
      amount,
      0,
      user2,
      OrderLibrary.OrderType.Buy,
      OrderLibrary.OrderNature.Market,
      { from: deployer }
    );

    const bestLimitOrderId = await orderBookData.getBestOrderFromHeap(
      OrderLibrary.OrderType.Buy
    );
    const bestLimitOrder = await orderBookData.getOrderFromId(
      OrderLibrary.OrderType.Buy,
      bestLimitOrderId
    );

    expect(bestLimitOrder.price).to.be.bignumber.equal(price);
    expect(bestLimitOrder.userAddress).to.equal(user1);

    const allMarketOrders = await orderBookData.getAllPendingMarketOrders(
      OrderLibrary.OrderType.Buy
    );
    expect(allMarketOrders.length).to.equal(1);
    expect(allMarketOrders[0].toNumber()).to.equal(2);
  });

  //Market Order Handling

  it("should handle adding and removing multiple market orders, then remove a specific one", async () => {
    const amount = new BN(100);
    const price = new BN(0); // Price is not relevant for market orders
    const orderType = OrderLibrary.OrderType.Sell;
    const orderNature = OrderLibrary.OrderNature.Market;

    // Add multiple market orders
    const receipt1 = await orderBookData.addOrder(
      amount,
      price,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt2 = await orderBookData.addOrder(
      amount,
      price,
      user2,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt3 = await orderBookData.addOrder(
      amount,
      price,
      user3,
      orderType,
      orderNature,
      { from: deployer }
    );

    const orderId1 = receipt1.logs[0].args.orderId;
    const orderId2 = receipt2.logs[0].args.orderId;
    const orderId3 = receipt3.logs[0].args.orderId;

    // Verify that all orders were added
    let marketOrders = await orderBookData.getAllPendingMarketOrders(orderType);
    expect(marketOrders.map((id) => id.toString())).to.include.members([
      orderId1.toString(),
      orderId2.toString(),
      orderId3.toString(),
    ]);

    // Remove the second market order (orderId2)
    const removeReceipt = await orderBookData.removeOrder(
      orderType,
      orderNature,
      orderId2,
      { from: deployer }
    );
    expectEvent(removeReceipt, "OrderRemovedEvent", {
      orderId: orderId2,
      orderType: new BN(orderType),
      orderNature: new BN(orderNature),
    });

    // Verify that the order has been removed
    marketOrders = await orderBookData.getAllPendingMarketOrders(orderType);
    expect(marketOrders.map((id) => id.toString())).to.not.include(
      orderId2.toString()
    );

    // Check the remaining market orders
    expect(marketOrders.map((id) => id.toString())).to.include.members([
      orderId1.toString(),
      orderId3.toString(),
    ]);
  });

  //Retrieving Orders - Testing All filters- based on user, status etc
  it("should retrieve all active orders (both status Active or PartiallyFilled) overall", async () => {
    // Define order details
    const amount1 = 100;
    const price1 = web3.utils.toBN(200);
    const amount2 = 150;
    const price2 = web3.utils.toBN(250);
    const amount3 = 120;
    const price3 = web3.utils.toBN(300);
    const amount4 = 130;
    const price4 = web3.utils.toBN(400);

    const user1 = accounts[1];
    const user2 = accounts[2];
    const orderType = OrderLibrary.OrderType.Buy; // Example order type
    const orderNature = OrderLibrary.OrderNature.Limit; // Example order nature

    // Add orders for different users; by default, these will be set to Active
    const receipt1 = await orderBookData.addOrder(
      amount1,
      price1,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt2 = await orderBookData.addOrder(
      amount2,
      price2,
      user2,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt3 = await orderBookData.addOrder(
      amount3,
      price3,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt4 = await orderBookData.addOrder(
      amount4,
      price4,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );

    // Extract order IDs from transaction logs
    const orderId1 = receipt1.logs[0].args.orderId;
    const orderId2 = receipt2.logs[0].args.orderId;
    const orderId4 = receipt4.logs[0].args.orderId;

    // Update orderId2 to PartiallyFilled to test retrieval of both statuses
    await orderBookData.updateOrderStatus(
      orderType,
      orderId2,
      OrderLibrary.OrderStatus.PartiallyFilled,
      { from: deployer }
    );
    await orderBookData.updateOrderStatus(
      orderType,
      orderId4,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );

    // Set up filter to retrieve all "active" orders (Active or PartiallyFilled) regardless of user
    const filters = {
      status: OrderLibrary.OrderStatus.Active, // Filtering for "Active" implicitly includes PartiallyFilled
      filterByUser: false, // Ignore user filter
      userAddress: user1,
    };

    // Retrieve filtered orders
    const result = await orderBookData.getAllOrdersWithFilters(filters);

    // Destructure the result
    const { 0: amounts, 1: prices } = result;

    // Verify that only orders with statuses Active or PartiallyFilled are returned
    expect(amounts.length).to.equal(3); // Expected active orders count
    expect(prices[0]).to.be.bignumber.equal(price1);
    expect(prices[1]).to.be.bignumber.equal(price2);
    expect(prices[2]).to.be.bignumber.equal(price3);
  });

  // it("should retrieve all active orders for a specific user", async () => {
  //     // Define order details
  //     const amount1 = 100;
  //     const price1 = web3.utils.toBN(200);
  //     const amount2 = 150;
  //     const price2 = web3.utils.toBN(250);
  //     const amount3 = 120;
  //     const price3 = web3.utils.toBN(300);

  //     const user1 = accounts[1];
  //     const user2 = accounts[2];
  //     const orderType = OrderLibrary.OrderType.Buy; // Assuming a Buy order type
  //     const orderNature = OrderLibrary.OrderNature.Limit; // Assuming Limit order nature

  //     // Add orders for different users and initial statuses
  //     const receipt1 = await orderBookData.addOrder(
  //         amount1,
  //         price1,
  //         user1,
  //         orderType,
  //         orderNature,
  //         { from: deployer }
  //     );
  //     const receipt2 = await orderBookData.addOrder(
  //         amount2,
  //         price2,
  //         user2,
  //         orderType,
  //         orderNature,
  //         { from: deployer }
  //     );
  //     const receipt3 = await orderBookData.addOrder(
  //         amount3,
  //         price3,
  //         user1,
  //         orderType,
  //         orderNature,
  //         { from: deployer }
  //     );

  //     // Extract order IDs
  //     const orderId1 = receipt1.logs[0].args.orderId;
  //     const orderId2 = receipt2.logs[0].args.orderId;
  //     const orderId3 = receipt3.logs[0].args.orderId;

  //     // Set statuses - making only user1's orders active
  //     await orderBookData.updateOrderStatus(orderType, orderId1, OrderLibrary.OrderStatus.Active, { from: deployer });
  //     await orderBookData.updateOrderStatus(orderType, orderId2, OrderLibrary.OrderStatus.Filled, { from: deployer });
  //     await orderBookData.updateOrderStatus(orderType, orderId3, OrderLibrary.OrderStatus.Active, { from: deployer });

  //     // Set up filter for active orders for user1
  //     const filters = {
  //         status: OrderLibrary.OrderStatus.Active,
  //         filterByUser: true,
  //         userAddress: user1,
  //     };

  //     // Retrieve filtered orders
  //     const result = await orderBookData.getAllOrdersWithFilters(filters);

  //     // Verify the returned orders for user1 with Active status
  //     const { 0: amounts, 1: prices, 2: orderTypes, 3: natures } = result;
  //     expect(amounts.length).to.equal(2);
  //     expect(prices[0]).to.be.bignumber.equal(price1);
  //     expect(prices[1]).to.be.bignumber.equal(price3);
  //     expect(orderTypes[0]).to.equal(orderType);
  //     expect(orderTypes[1]).to.equal(orderType);
  //     expect(natures[0]).to.equal(orderNature);
  //     expect(natures[1]).to.equal(orderNature);
  // });
  it("should retrieve all active orders (Active or PartiallyFilled) for a specific user", async () => {
    const amount1 = web3.utils.toBN(100);
    const price1 = web3.utils.toBN(200);
    const amount2 = web3.utils.toBN(150);
    const price2 = web3.utils.toBN(250);
    const amount3 = web3.utils.toBN(120);
    const price3 = web3.utils.toBN(300);
    const amount4 = web3.utils.toBN(130);
    const price4 = web3.utils.toBN(400);

    const user1 = accounts[1];
    const user2 = accounts[2];
    const orderType = OrderLibrary.OrderType.Buy;
    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add orders for different users; by default, these will be set to Active
    const receipt1 = await orderBookData.addOrder(
      amount1,
      price1,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt2 = await orderBookData.addOrder(
      amount2,
      price2,
      user2,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt3 = await orderBookData.addOrder(
      amount3,
      price3,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt4 = await orderBookData.addOrder(
      amount4,
      price4,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );

    // Update statuses to PartiallyFilled and Filled
    const orderId2 = receipt2.logs[0].args.orderId;
    const orderId4 = receipt4.logs[0].args.orderId;
    const orderId3 = receipt3.logs[0].args.orderId;

    await orderBookData.updateOrderStatus(
      orderType,
      orderId2,
      OrderLibrary.OrderStatus.PartiallyFilled,
      { from: deployer }
    );
    await orderBookData.updateOrderStatus(
      orderType,
      orderId4,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );
    await orderBookData.updateOrderStatus(
      orderType,
      orderId3,
      OrderLibrary.OrderStatus.PartiallyFilled,
      { from: deployer }
    );

    // Set up filter to retrieve all active orders for user1
    const filters = {
      status: OrderLibrary.OrderStatus.Active,
      filterByUser: true,
      userAddress: user1,
    };

    // Retrieve filtered orders
    const result = await orderBookData.getAllOrdersWithFilters(filters);

    // Destructure the result with explicit BN handling
    const { 0: amounts, 1: prices } = result;

    // Verify that the correct number of orders is returned for user1 with Active or PartiallyFilled status
    expect(amounts.length).to.equal(2);

    // Check each price with BN assertions
    expect(prices[0].toString()).to.equal(price1.toString());
    expect(prices[1].toString()).to.equal(price3.toString());

    // Check each amount with BN assertions
    expect(amounts[0].toString()).to.equal(amount1.toString());
    expect(amounts[1].toString()).to.equal(amount3.toString());
  });

  it("should retrieve all fulfilled orders (status Filled) regardless of user", async () => {
    // Define order details
    const amount1 = web3.utils.toBN(100);
    const price1 = web3.utils.toBN(200);
    const amount2 = web3.utils.toBN(150);
    const price2 = web3.utils.toBN(250);
    const amount3 = web3.utils.toBN(120);
    const price3 = web3.utils.toBN(300);
    const amount4 = web3.utils.toBN(130);
    const price4 = web3.utils.toBN(400);

    const user1 = accounts[1];
    const user2 = accounts[2];
    const orderType = OrderLibrary.OrderType.Buy;
    const orderType2 = OrderLibrary.OrderType.Sell;

    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add orders for different users; by default, these will be set to Active
    const receipt1 = await orderBookData.addOrder(
      amount1,
      price1,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt2 = await orderBookData.addOrder(
      amount2,
      price2,
      user2,
      orderType2,
      orderNature,
      { from: deployer }
    );
    const receipt3 = await orderBookData.addOrder(
      amount3,
      price3,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt4 = await orderBookData.addOrder(
      amount4,
      price4,
      user2,
      orderType2,
      orderNature,
      { from: deployer }
    );

    // Extract order IDs
    const orderId1 = receipt1.logs[0].args.orderId;
    const orderId2 = receipt2.logs[0].args.orderId;
    const orderId4 = receipt4.logs[0].args.orderId;

    // Update statuses to Filled
    await orderBookData.updateOrderStatus(
      orderType,
      orderId1,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );
    await orderBookData.updateOrderStatus(
      orderType2,
      orderId2,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );
    await orderBookData.updateOrderStatus(
      orderType2,
      orderId4,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );

    // Set up filter to retrieve all fulfilled orders regardless of user
    const filters = {
      status: OrderLibrary.OrderStatus.Filled,
      filterByUser: false,
      userAddress: user1,
    };

    // Retrieve filtered orders
    const result = await orderBookData.getAllOrdersWithFilters(filters);

    // Destructure the result
    const amounts = result[0];
    const prices = result[1];

    // Verify that three orders with Filled status are returned
    expect(amounts.length).to.equal(3);

    // Check each price and amount with BN assertions
    expect(prices[0].toString()).to.equal(price1.toString());
    expect(prices[1].toString()).to.equal(price2.toString());
    expect(prices[2].toString()).to.equal(price4.toString());

    expect(amounts[0].toString()).to.equal(amount1.toString());
    expect(amounts[1].toString()).to.equal(amount2.toString());
    expect(amounts[2].toString()).to.equal(amount4.toString());
  });

  it("should retrieve fulfilled orders (status Filled) for a specific user", async () => {
    // Define order details
    const amount1 = web3.utils.toBN(100);
    const price1 = web3.utils.toBN(200);
    const amount2 = web3.utils.toBN(150);
    const price2 = web3.utils.toBN(250);
    const amount3 = web3.utils.toBN(120);
    const price3 = web3.utils.toBN(300);
    const amount4 = web3.utils.toBN(130);
    const price4 = web3.utils.toBN(400);

    const user1 = accounts[1];
    const user2 = accounts[2];
    const orderType = OrderLibrary.OrderType.Buy;
    const orderType2 = OrderLibrary.OrderType.Sell;

    const orderNature = OrderLibrary.OrderNature.Limit;

    // Add orders for different users; by default, these will be set to Active
    const receipt1 = await orderBookData.addOrder(
      amount1,
      price1,
      user1,
      orderType,
      orderNature,
      { from: deployer }
    );
    const receipt2 = await orderBookData.addOrder(
      amount2,
      price2,
      user2,
      orderType2,
      orderNature,
      { from: deployer }
    );
    const receipt3 = await orderBookData.addOrder(
      amount3,
      price3,
      user1,
      orderType2,
      orderNature,
      { from: deployer }
    );
    const receipt4 = await orderBookData.addOrder(
      amount4,
      price4,
      user2,
      orderType,
      orderNature,
      { from: deployer }
    );

    // Extract order IDs
    const orderId1 = receipt1.logs[0].args.orderId;
    // console.log("ORDER 1 ID: ", orderId1);
    const orderId2 = receipt2.logs[0].args.orderId;
    const orderId3 = receipt3.logs[0].args.orderId;
    const orderId4 = receipt4.logs[0].args.orderId;

    // console.log("ORDER 3 ID: ", orderId3);

    // Update statuses to Filled for user1's orders
    await orderBookData.updateOrderStatus(
      orderType,
      orderId1,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );
    await orderBookData.updateOrderStatus(
      orderType2,
      orderId2,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );

    await orderBookData.updateOrderStatus(
      orderType2,
      orderId3,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );
    await orderBookData.updateOrderStatus(
      orderType,
      orderId4,
      OrderLibrary.OrderStatus.Filled,
      { from: deployer }
    );

    // Set up filter to retrieve all fulfilled orders for user1
    const filters = {
      status: OrderLibrary.OrderStatus.Filled,
      filterByUser: true,
      userAddress: user1,
    };

    // Retrieve filtered orders
    const result = await orderBookData.getAllOrdersWithFilters(filters);

    const amounts = result[0];
    const prices = result[1];

    // console.log("Amounts = ", amounts);
    // console.log("Prices = ", prices);

    // Verify that two fulfilled orders for user1 are returned
    expect(amounts.length).to.equal(2);

    // Check each price and amount with BN assertions
    expect(prices[0].toString()).to.equal(price1.toString());
    expect(prices[1].toString()).to.equal(price3.toString());

    expect(amounts[0].toString()).to.equal(amount1.toString());
    expect(amounts[1].toString()).to.equal(amount3.toString());
  });
});
