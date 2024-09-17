const Aura = artifacts.require("Aura");

module.exports = function (deployer) {
    const initialSupply = 1000000;
    deployer.deploy(Aura, initialSupply);
};
