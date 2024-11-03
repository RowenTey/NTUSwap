const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const MarketManager = artifacts.require("MarketManager");
const OrderBookManager = artifacts.require("OrderBookManager");
const MarketData = artifacts.require("MarketData");
const TokenManager = artifacts.require("TokenManager");
const TestToken = artifacts.require("Token");
const BN = web3.utils.BN;

contract("MarketManager", (accounts) => {
  const [owner, trader1] = accounts;
  let marketManager, orderBookManager, marketData, tokenManager;
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

    // Issue Tokens
    await tokenManager.issueToken("Token1", TOKEN1_SYMBOL, web3.utils.toWei("10000"), { from: owner });
    await tokenManager.issueToken("Token2", TOKEN2_SYMBOL, web3.utils.toWei("10000"), { from: owner });

    const token1Id = await tokenManager.getTokenId(TOKEN1_SYMBOL);
    const token2Id = await tokenManager.getTokenId(TOKEN2_SYMBOL);

    // Create market
    await marketManager.createMarket(token2Id);
    marketId = await marketManager.getMarketId(token1Id, token2Id);
  });

  describe("Order Placement", () => {
    it.only("should place an order and emit OrderPlacedEvent", async () => {
      const token1Id = await tokenManager.getTokenId(TOKEN1_SYMBOL);
      const token2Id = await tokenManager.getTokenId(TOKEN2_SYMBOL);
      const price = web3.utils.toWei("2");
      const amount = web3.utils.toWei("10");

      // Call placeOrder directly
      const receipt = await marketManager.placeOrder(
        token1Id,
        token2Id,
        price,
        amount,
        trader1,
        0, // OrderType.Buy
        1  // OrderNature.Limit
      );

      // Check the OrderPlacedEvent
      expectEvent(receipt, "OrderPlacedEvent", {
        marketId: marketId,
        orderType: new BN(0), // Buy
        price: new BN(price),
        userAddress: trader1,
        orderNature: new BN(1) // Limit
      });
    });
  });
});
