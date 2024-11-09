const TokenManager = artifacts.require("TokenManager");
const Token = artifacts.require("Token");
const MarketManager = artifacts.require("MarketManager");
const { expect } = require("chai");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

contract("TokenManager", (accounts) => {
    const [deployer, user1, user2] = accounts;
    let tokenManager;
    let marketManager;
    let token;

    beforeEach(async () => {
        marketManager = await MarketManager.new();
        tokenManager = await TokenManager.new();
        await tokenManager.initialize(marketManager.address);
    });

    it("should issue a new token", async () => {
        const name = "TokenA";
        const symbol = "TKA";
        const initialSupply = new BN(1000000);

        const receipt = await tokenManager.issueToken(name, symbol, initialSupply, { from: deployer });

        expectEvent(receipt, "TokenIssueEvent", {
            tokenId: new BN(1),
            name: name,
            symbol: symbol,
            initialSupply: initialSupply,
        });

        const tokenAddress = await tokenManager.getToken(1);
        token = await Token.at(tokenAddress);

        const totalSupply = await token.totalSupply();
        expect(totalSupply).to.be.bignumber.equal(initialSupply);
    });

    it("should deposit tokens", async () => {
        const name = "TokenA";
        const symbol = "TKA";
        const initialSupply = new BN(1000000);

        await tokenManager.issueToken(name, symbol, initialSupply, { from: deployer });
        const tokenAddress = await tokenManager.getToken(1);
        token = await Token.at(tokenAddress);

        const depositAmount = new BN(100);
        await token.approve(tokenManager.address, depositAmount, { from: deployer });

        const receipt = await tokenManager.deposit(symbol, depositAmount, { from: deployer });

        expectEvent(receipt, "DepositEvent", {
            symbol: symbol,
            userAddress: deployer,
            amount: depositAmount,
        });

        const balance = await tokenManager.getUserTokenBalance(symbol);
        expect(balance).to.be.bignumber.equal(depositAmount);
    });

    it("should withdraw tokens", async () => {
        const name = "TokenA";
        const symbol = "TKA";
        const initialSupply = new BN(1000000);

        await tokenManager.issueToken(name, symbol, initialSupply, { from: deployer });
        const tokenAddress = await tokenManager.getToken(1);
        token = await Token.at(tokenAddress);

        const depositAmount = new BN(100);
        await token.approve(tokenManager.address, depositAmount, { from: deployer });
        await tokenManager.deposit(symbol, depositAmount, { from: deployer });

        const withdrawAmount = new BN(50);
        const receipt = await tokenManager.withdraw(symbol, withdrawAmount, { from: deployer });

        expectEvent(receipt, "WithdrawalEvent", {
            symbol: symbol,
            userAddress: deployer,
            amount: withdrawAmount,
        });

        const balance = await tokenManager.getUserTokenBalance(symbol);
        expect(balance).to.be.bignumber.equal(depositAmount.sub(withdrawAmount));
    });

    it("should transfer tokens internally", async () => {
        const name = "TokenA";
        const symbol = "TKA";
        const initialSupply = new BN(1000000);

        await tokenManager.issueToken(name, symbol, initialSupply, { from: deployer });
        const tokenAddress = await tokenManager.getToken(1);
        token = await Token.at(tokenAddress);

        const depositAmount = new BN(100);
        await token.approve(tokenManager.address, depositAmount, { from: deployer });
        await tokenManager.deposit(symbol, depositAmount, { from: deployer });

        const transferAmount = new BN(50);
        const receipt = await tokenManager.transferFrom(deployer, user1, 1, transferAmount, { from: deployer });

        expectEvent(receipt, "InternalTransferEvent", {
            tokenId: new BN(1),
            from: deployer,
            to: user1,
            amount: transferAmount,
        });

        const balanceDeployer = await tokenManager.getBalance(deployer, 1);
        const balanceUser1 = await tokenManager.getBalance(user1, 1);

        expect(balanceDeployer).to.be.bignumber.equal(depositAmount.sub(transferAmount));
        expect(balanceUser1).to.be.bignumber.equal(transferAmount);
    });

    // NOTE: Issuing 2 tokens will fail due to dependency on marketManager not being initialized yet
    it("should get all tokens", async () => {
        const name1 = "TokenA";
        const symbol1 = "TKA";
        const initialSupply1 = new BN(1000000);

        await tokenManager.issueToken(name1, symbol1, initialSupply1, { from: deployer });

        const { tokenNames, tokenSymbols } = await tokenManager.getAllTokens();

        expect(tokenNames).to.deep.equal([name1]);
        expect(tokenSymbols).to.deep.equal([symbol1]);
    });
});