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
    const totalBuyOrders = await orderBookData.getTotalOrderCount(OrderLibrary.OrderType.Buy);
    const totalSellOrders = await orderBookData.getTotalOrderCount(OrderLibrary.OrderType.Sell);

    expect(totalBuyOrders).to.be.bignumber.equal(new BN(0));
    expect(totalSellOrders).to.be.bignumber.equal(new BN(0));
    });


   it("should add a new order", async () => {
        const amount = new BN(100);
        const price = new BN(50);
        const orderType = OrderLibrary.OrderType.Buy;
        const orderNature = OrderLibrary.OrderNature.Limit;

        const receipt = await orderBookData.addOrder(amount, price, user1, orderType, orderNature, { from: deployer });
        expectEvent(receipt, "OrderAddedEvent", {
            orderId: new BN(1),
            amount: amount,
            price: price,
            userAddress: user1,
            orderType: new BN(orderType),
            orderNature: new BN(orderNature),
        });

        const order = await orderBookData.getOrderFromId(orderType, receipt.orderId);
        expect(order.status).to.be.bignumber.equal(new BN(OrderLibrary.OrderStatus.Active));
    });

    it("should update an order", async () => {
        const amount = new BN(100);
        const price = new BN(50);
        const orderType = OrderLibrary.OrderType.Buy;
        const orderNature = OrderLibrary.OrderNature.Limit;

        const addReceipt = await orderBookData.addOrder(amount, price, user1, orderType, orderNature, { from: deployer });
        const orderId = addReceipt.logs[0].args.orderId;
        const newAmount = new BN(50);
        const newStatus = OrderLibrary.OrderStatus.PartiallyFilled;
        const fillsReceipt = {
            price: 45,
            amount: 50,
            timestamp: Math.floor(Date.now() / 1000),
        };

        const updateReceipt = await orderBookData.updateOrder(orderType, orderId, newAmount, newStatus, fillsReceipt, { from: deployer });
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

        await orderBookData.addOrder(amount, price1, user1, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price2, user2, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price3, user3, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });

        const bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Buy);
        const bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Buy, bestOrderId);

        expect(bestOrder.price).to.be.bignumber.equal(price2);
        expect(bestOrder.userAddress).to.equal(user2);
    });

    it("should prioritize older limit buy orders at the same price", async () => {
        const amount = new BN(100);
        const price = new BN(50);

        await orderBookData.addOrder(amount, price, user1, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await new Promise(resolve => setTimeout(resolve, 1000)); 
        await orderBookData.addOrder(amount, price, user2, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });

        const bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Buy);
        const bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Buy, bestOrderId);

        expect(bestOrder.userAddress).to.equal(user1);
    });

    it("should correctly handle add and remove in the buy limit order heap", async () => {
        const amount = new BN(100);
        const price1 = new BN(50);  // Lowest priority
        const price2 = new BN(60);  // Highest priority
        const price3 = new BN(55);  // Mid priority

        // Add three orders with different prices
        await orderBookData.addOrder(amount, price1, user1, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price2, user2, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price3, user3, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });

        // Retrieve the highest priority order before removal
        let bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Buy);
        let bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Buy, bestOrderId);
        expect(bestOrder.price).to.be.bignumber.equal(price2);  // Check that the highest price is prioritized

        // Remove the highest priority order and check the next best
        await orderBookData.removeOrder(OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, bestOrderId, { from: deployer });
        bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Buy);
        bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Buy, bestOrderId);
        expect(bestOrder.price).to.be.bignumber.equal(price3);  // Now the mid priority should be on top
    });

    it("should add and remove a market buy order", async () => {
        const amount = new BN(100);
        const orderType = OrderLibrary.OrderType.Buy;
        const orderNature = OrderLibrary.OrderNature.Market;

        const addReceipt = await orderBookData.addOrder(amount, 0, user1, orderType, orderNature, { from: deployer });
        const orderId = addReceipt.logs[0].args.orderId;

        const removeReceipt = await orderBookData.removeOrder(orderType, orderNature, orderId, { from: deployer });

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

        await orderBookData.addOrder(amount, price1, user1, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price2, user2, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price3, user3, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });

        const bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Sell);
        const bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Sell, bestOrderId);

        expect(bestOrder.price).to.be.bignumber.equal(price1);
        expect(bestOrder.userAddress).to.equal(user1);
    });

    it("should prioritize older limit sell orders at the same price", async () => {
        const amount = new BN(100);
        const price = new BN(40);

        await orderBookData.addOrder(amount, price, user1, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await orderBookData.addOrder(amount, price, user2, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });

        const bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Sell);
        const bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Sell, bestOrderId);

        expect(bestOrder.userAddress).to.equal(user1);
    });

    it("should add and remove a market sell order", async () => {
        const amount = new BN(100);
        const orderType = OrderLibrary.OrderType.Sell;
        const orderNature = OrderLibrary.OrderNature.Market;

        const addReceipt = await orderBookData.addOrder(amount, 0, user2, orderType, orderNature, { from: deployer });
        const orderId = addReceipt.logs[0].args.orderId;

        const removeReceipt = await orderBookData.removeOrder(orderType, orderNature, orderId, { from: deployer });

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
        const price1 = new BN(30);  // Highest priority for sell (min-heap)
        const price2 = new BN(40);  // Lowest priority for sell
        const price3 = new BN(35);  // Mid priority for sell

        // Add three orders with different prices
        await orderBookData.addOrder(amount, price1, user1, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price2, user2, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, price3, user3, OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, { from: deployer });

        // Retrieve the lowest priority order before removal
        let bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Sell);
        let bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Sell, bestOrderId);
        expect(bestOrder.price).to.be.bignumber.equal(price1);  // Check that the lowest price is prioritized

        // Remove the highest priority order and check the next best
        await orderBookData.removeOrder(OrderLibrary.OrderType.Sell, OrderLibrary.OrderNature.Limit, bestOrderId, { from: deployer });
        bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Sell);
        bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Sell, bestOrderId);
        expect(bestOrder.price).to.be.bignumber.equal(price3);  // Now the mid priority should be on top
    });

    // --- General Heap Tests ---

    it("should correctly prioritize limit orders by price and timestamp", async () => {
        const amount = new BN(100);
        const highPrice = new BN(60);
        const midPrice = new BN(50);
        const lowPrice = new BN(40);

        await orderBookData.addOrder(amount, midPrice, user1, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, highPrice, user2, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, lowPrice, user3, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });

        const bestOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Buy);
        const bestOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Buy, bestOrderId);

        expect(bestOrder.price).to.be.bignumber.equal(highPrice);
        expect(bestOrder.userAddress).to.equal(user2);
    });

    it("should handle simultaneous limit and market orders in the heap", async () => {
        const amount = new BN(100);
        const price = new BN(50);

        await orderBookData.addOrder(amount, price, user1, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Limit, { from: deployer });
        await orderBookData.addOrder(amount, 0, user2, OrderLibrary.OrderType.Buy, OrderLibrary.OrderNature.Market, { from: deployer });

        const bestLimitOrderId = await orderBookData.getBestOrderFromHeap(OrderLibrary.OrderType.Buy);
        const bestLimitOrder = await orderBookData.getOrderFromId(OrderLibrary.OrderType.Buy, bestLimitOrderId);

        expect(bestLimitOrder.price).to.be.bignumber.equal(price);
        expect(bestLimitOrder.userAddress).to.equal(user1);

        const allMarketOrders = await orderBookData.getAllPendingMarketOrders(OrderLibrary.OrderType.Buy);
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
        const receipt1 = await orderBookData.addOrder(amount, price, user1, orderType, orderNature, { from: deployer });
        const receipt2 = await orderBookData.addOrder(amount, price, user2, orderType, orderNature, { from: deployer });
        const receipt3 = await orderBookData.addOrder(amount, price, user3, orderType, orderNature, { from: deployer });

        const orderId1 = receipt1.logs[0].args.orderId;
        const orderId2 = receipt2.logs[0].args.orderId;
        const orderId3 = receipt3.logs[0].args.orderId;

        // Verify that all orders were added
        let marketOrders = await orderBookData.getAllPendingMarketOrders(orderType);
        expect(marketOrders.map(id => id.toString())).to.include.members([orderId1.toString(), orderId2.toString(), orderId3.toString()]);

        // Remove the second market order (orderId2)
        const removeReceipt = await orderBookData.removeOrder(orderType, orderNature, orderId2, { from: deployer });
        expectEvent(removeReceipt, "OrderRemovedEvent", {
            orderId: orderId2,
            orderType: new BN(orderType),
            orderNature: new BN(orderNature),
        });

        // Verify that the order has been removed
        marketOrders = await orderBookData.getAllPendingMarketOrders(orderType);
        expect(marketOrders.map(id => id.toString())).to.not.include(orderId2.toString());

        // Check the remaining market orders
        expect(marketOrders.map(id => id.toString())).to.include.members([orderId1.toString(), orderId3.toString()]);
    });

    //Retrieving Orders - Testing All filters- based on user, status etc 
    // Common variables for orders
    const amount1 = new BN(100);
    const amount2 = new BN(200);
    const amount3 = new BN(300);
    const price1 = new BN(30);
    const price2 = new BN(40);
    const price3 = new BN(50);
    const orderType = OrderLibrary.OrderType.Buy;
    const orderNature = OrderLibrary.OrderNature.Limit;
    const statusActive = OrderLibrary.OrderStatus.Active;
    const statusFilled = OrderLibrary.OrderStatus.Filled;
    const statusPartiallyFilled = OrderLibrary.OrderStatus.PartiallyFilled;

    // Test Case 1: Retrieve All Active Orders for a Specific User
    it("should retrieve all active orders for a specific user", async () => {
        // Add orders with different users and statuses
        const receipt1 = await orderBookData.addOrder(amount1, price1, user1, orderType, orderNature, { from: deployer });
        const receipt2 = await orderBookData.addOrder(amount2, price2, user2, orderType, orderNature, { from: deployer });
        const receipt3 = await orderBookData.addOrder(amount3, price3, user1, orderType, orderNature, { from: deployer });

        const orderId1 = receipt1.logs[0].args.orderId;
        const orderId2 = receipt2.logs[0].args.orderId;
        const orderId3 = receipt3.logs[0].args.orderId;

        // Set statuses
        await orderBookData.updateOrderStatus(orderType, orderId1, statusActive, { from: deployer });
        await orderBookData.updateOrderStatus(orderType, orderId2, statusFilled, { from: deployer });
        await orderBookData.updateOrderStatus(orderType, orderId3, statusActive, { from: deployer });

        // Set up filter parameters
        const filters = {
            status: statusActive,
            filterByUser: true,
            userAddress: user1,
        };

        // Retrieve filtered orders
        const result = await orderBookData.getAllOrdersWithFilters(filters);

        // Verify the returned orders
        const { 0: amounts, 1: prices } = result;
        expect(amounts.length).to.equal(2);
        expect(prices[0]).to.be.bignumber.equal(price1);
        expect(prices[1]).to.be.bignumber.equal(price3);

    

    });




});

