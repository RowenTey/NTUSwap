const TokenA = artifacts.require("TokenA");
const TokenB = artifacts.require("TokenB");
const TokenC = artifacts.require("TokenC");

module.exports = async function (deployer) {
    const initialSupply = 1_000_000;
    deployer.deploy(TokenA, initialSupply);
    deployer.deploy(TokenB, initialSupply);
    deployer.deploy(TokenC, initialSupply);
};