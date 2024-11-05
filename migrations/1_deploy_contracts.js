const MarketData = artifacts.require("MarketData");
const OrderBookManager = artifacts.require("OrderBookManager");
const MarketManager = artifacts.require("MarketManager");
const TokenManager = artifacts.require("TokenManager");
const Exchange = artifacts.require("Exchange");
const TokenA = artifacts.require("TokenA");
const TokenB = artifacts.require("TokenB");
const TokenC = artifacts.require("TokenC");

module.exports = async function (deployer, network, accounts) {
  try {
    console.log('Starting deployment...');
    console.log('Deployer account:', accounts[0]);

    console.log('Deploying MarketData...');
    await deployer.deploy(MarketData);
    const marketData = await MarketData.deployed();
    console.log('MarketData deployed at:', marketData.address);

    
    console.log('Deploying OrderBookManager...');
    await deployer.deploy(OrderBookManager);
    const orderBookManager = await OrderBookManager.deployed();
    console.log('OrderBookManager deployed at:', orderBookManager.address);

    console.log('Deploying MarketManager...');
    await deployer.deploy(MarketManager);
    const marketManager = await MarketManager.deployed();
    console.log('MarketManager deployed at:', marketManager.address);
    
    console.log('Deploying TokenManager...');
    await deployer.deploy(TokenManager);
    const tokenManager = await TokenManager.deployed();
    console.log('TokenManager deployed at:', tokenManager.address);

    console.log('Initializing TokenManager, MarketManager, MarketData and OrderBookManager...');
    await tokenManager.initialize(marketManager.address);
    await marketData.initialize(marketManager.address);
    await marketManager.initialize(marketData.address, orderBookManager.address);
    await orderBookManager.initialize(tokenManager.address);
    console.log('Initialization complete');
    

    console.log('Deploying Exchange...');
    await deployer.deploy(
      Exchange,
      marketManager.address,
      orderBookManager.address,
      tokenManager.address
    );
    const exchange = await Exchange.deployed();
    console.log('Exchange deployed at:', exchange.address);

    console.log('Deploying Tokens...');
    const oneMillionTokens = web3.utils.toWei("1000000", "ether");
    await deployer.deploy(TokenA, oneMillionTokens);
    const tokenA = await TokenA.deployed();
    await deployer.deploy(TokenB, oneMillionTokens);
    const tokenB = await TokenB.deployed();
    await deployer.deploy(TokenC, oneMillionTokens);
    const tokenC = await TokenC.deployed();

    console.log('Tokens deployed at:');
    console.log('TokenA:', tokenA.address);
    console.log('TokenB:', tokenB.address);
    console.log('TokenC:', tokenC.address);

    console.log('Registering tokens...');
    await tokenManager.issueToken("TokenA", "TokA", oneMillionTokens);
    await tokenManager.issueToken("TokenB", "TokB", oneMillionTokens);
    await tokenManager.issueToken("TokenC", "TokC", oneMillionTokens);
    console.log('Token registration complete');

    console.log('\nDeployment Summary:');
    console.log('==================');
    console.log('MarketData:', marketData.address);
    console.log('OrderBookManager:', orderBookManager.address);
    console.log('MarketManager:', marketManager.address);
    console.log('TokenManager:', tokenManager.address);
    console.log('Exchange:', exchange.address);
    console.log('TokenA:', tokenA.address);
    console.log('TokenB:', tokenB.address);
    console.log('TokenC:', tokenC.address);
  } catch (error) {
    console.error('\nDeployment failed:', error);
    throw error;
  }
};