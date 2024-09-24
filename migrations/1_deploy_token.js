const Alpha = artifacts.require("Alpha");
const Beta = artifacts.require("Beta");
const Gamma = artifacts.require("Gamma");

module.exports = function (deployer) {
    const initialSupply = 1_000_000;
    deployer.deploy(Alpha, initialSupply);
    deployer.deploy(Beta, initialSupply);
    deployer.deploy(Gamma, initialSupply);
};
