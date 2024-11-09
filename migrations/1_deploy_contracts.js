const MarketData = artifacts.require("MarketData");
const OrderBookManager = artifacts.require("OrderBookManager");
const MarketManager = artifacts.require("MarketManager");
const TokenManager = artifacts.require("TokenManager");
const Exchange = artifacts.require("Exchange");
const Token = artifacts.require("Token");

module.exports = async function (deployer, network, accounts) {
  try {
    console.log('Starting deployment...');
    console.log('Deployer account:', accounts[0]);

    // Deploy MarketData first
    console.log('Deploying MarketData...');
    await deployer.deploy(MarketData);
    const marketData = await MarketData.deployed();
    console.log('MarketData deployed at:', marketData.address);

    // Deploy OrderBookManager
    console.log('Deploying OrderBookManager...');
    await deployer.deploy(OrderBookManager);
    const orderBookManager = await OrderBookManager.deployed();
    console.log('OrderBookManager deployed at:', orderBookManager.address);

    // Deploy MarketManager
    console.log('Deploying MarketManager...');
    await deployer.deploy(MarketManager);
    const marketManager = await MarketManager.deployed();
    console.log('MarketManager deployed at:', marketManager.address);

    // Deploy TokenManager
    console.log('Deploying TokenManager...');
    await deployer.deploy(TokenManager);
    const tokenManager = await TokenManager.deployed();
    console.log('TokenManager deployed at:', tokenManager.address);

    // Initialize contracts in correct order
    console.log('\nInitializing contracts...');
    await tokenManager.initialize(marketManager.address);
    await marketData.initialize(marketManager.address);
    await marketManager.initialize(marketData.address, orderBookManager.address);
    await orderBookManager.initialize(tokenManager.address);
    console.log('Contracts initialized');

    // Deploy Exchange
    console.log('\nDeploying Exchange...');
    await deployer.deploy(
      Exchange,
      marketManager.address,
      orderBookManager.address,
      tokenManager.address
    );
    const exchange = await Exchange.deployed();
    console.log('Exchange deployed at:', exchange.address);

    // Issue tokens with proper supply formatting
    console.log('\nIssuing tokens...');
    const initialSupply = web3.utils.toWei('1000000', 'ether'); // This will be 1 million tokens with 18 decimals

    console.log('\nIssuing TokenA...');
    console.log('Initial supply:', initialSupply.toString());
    await tokenManager.issueToken(
      "Token A",  // Full name
      "TokA",     // Symbol
      initialSupply
    );

    console.log('\nIssuing TokenB...');
    await tokenManager.issueToken(
      "Token B",
      "TokB",
      initialSupply
    );

    console.log('\nIssuing TokenC...');
    await tokenManager.issueToken(
      "Token C",
      "TokC",
      initialSupply
    );

    // Verify tokens were created using token IDs
    console.log('\nVerifying tokens...');
    try {
        // Verify using getTokenId
        const tokenAId = await tokenManager.getTokenId("TokA");
        const tokenBId = await tokenManager.getTokenId("TokB");
        const tokenCId = await tokenManager.getTokenId("TokC");
        
        console.log('Token IDs:');
        console.log('TokA ID:', tokenAId.toString());
        console.log('TokB ID:', tokenBId.toString());
        console.log('TokC ID:', tokenCId.toString());

        // Get token addresses
        const tokenAAddr = await tokenManager.getToken(tokenAId);
        const tokenBAddr = await tokenManager.getToken(tokenBId);
        const tokenCAddr = await tokenManager.getToken(tokenCId);

        console.log('\nToken Addresses:');
        console.log('TokA:', tokenAAddr);
        console.log('TokB:', tokenBAddr);
        console.log('TokC:', tokenCAddr);

        // Check token supplies
        const tokenA = await Token.at(tokenAAddr);
        const tokenB = await Token.at(tokenBAddr);
        const tokenC = await Token.at(tokenCAddr);

        const supplyA = await tokenA.totalSupply();
        const supplyB = await tokenB.totalSupply();
        const supplyC = await tokenC.totalSupply();

        console.log('\nToken Supplies:');
        console.log('TokA Supply:', web3.utils.fromWei(supplyA.toString(), 'ether'), 'tokens');
        console.log('TokB Supply:', web3.utils.fromWei(supplyB.toString(), 'ether'), 'tokens');
        console.log('TokC Supply:', web3.utils.fromWei(supplyC.toString(), 'ether'), 'tokens');

    } catch (error) {
        console.error('Token verification failed:', error.message);
    }

    console.log('\nDeployment Summary:');
    console.log('==================');
    console.log('MarketData:', marketData.address);
    console.log('OrderBookManager:', orderBookManager.address);
    console.log('MarketManager:', marketManager.address);
    console.log('TokenManager:', tokenManager.address);
    console.log('Exchange:', exchange.address);

  } catch (error) {
    console.error('\nDeployment failed:', error);
    console.error('Error details:', error.message);
    throw error;
  }
};