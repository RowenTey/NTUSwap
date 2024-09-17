const LimitOrderExchange = artifacts.require("LimitOrderExchange");

module.exports = function (deployer) {
    deployer.deploy(LimitOrderExchange);
};
