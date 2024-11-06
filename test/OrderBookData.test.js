const OrderBookData = artifacts.require("OrderBookData");
const OrderLibrary = artifacts.require("OrderLibrary");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("OrderBookData", (accounts) => {
    const [deployer, user1, user2] = accounts;
    let orderBookData;

    beforeEach(async () => {
        orderBookData = await OrderBookData.new(deployer);
    });

    it("should initialize order books", async () => {
        await orderBookData.initializeOrderBooks({ from: deployer });
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
    });

    it("should update an order", async () => {
        const amount = new BN(100);
        const price = new BN(50);
        const orderType = OrderLibrary.OrderType.Buy;
        const orderNature = OrderLibrary.OrderNature.Limit;

        const addReceipt = await orderBookData.addOrder(amount, price, user1, orderType, orderNature, { from: deployer });

        const orderId = addReceipt.logs[0].args.orderId; // already a BN
        const newAmount = new BN(50);
        const newStatus = OrderLibrary.OrderStatus.PartiallyFilled;
        // Don't use BN here else it will autoconvert to HEX when passed to the contract and fail
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

    it("should remove an order", async () => {
        const amount = new BN(100);
        const price = new BN(50);
        const orderType = OrderLibrary.OrderType.Buy;
        const orderNature = OrderLibrary.OrderNature.Limit;

        const addReceipt = await orderBookData.addOrder(amount, price, user1, orderType, orderNature, { from: deployer });
        const orderId = addReceipt.logs[0].args.orderId; // already a BN

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

    it("should get the best order from the heap", async () => {
        // sell orders -> lowest on top
        const amount1 = new BN(100);
        const price1 = new BN(50);
        const amount2 = new BN(200);
        const price2 = new BN(40);
        const orderType1 = OrderLibrary.OrderType.Sell;
        const orderNature1 = OrderLibrary.OrderNature.Limit;

        await orderBookData.addOrder(amount1, price1, user1, orderType1, orderNature1, { from: deployer });
        await orderBookData.addOrder(amount2, price2, user2, orderType1, orderNature1, { from: deployer });

        const bestOrderId1 = await orderBookData.getBestOrderFromHeap(orderType1);
        const bestOrder1 = await orderBookData.getOrderFromId(orderType1, bestOrderId1);

        expect(bestOrder1.price).to.be.bignumber.equal(price2);

        // buy orders -> highest on top
        const amount3 = new BN(100);
        const price3 = new BN(50);
        const amount4 = new BN(200);
        const price4 = new BN(40);
        const orderType2 = OrderLibrary.OrderType.Buy;
        const orderNature2 = OrderLibrary.OrderNature.Limit;

        await orderBookData.addOrder(amount3, price3, user1, orderType2, orderNature2, { from: deployer });
        await orderBookData.addOrder(amount4, price4, user2, orderType2, orderNature2, { from: deployer });

        const bestOrderId2 = await orderBookData.getBestOrderFromHeap(orderType2);
        const bestOrder2 = await orderBookData.getOrderFromId(orderType2, bestOrderId2);

        expect(bestOrder2.price).to.be.bignumber.equal(price3);
    });
});

