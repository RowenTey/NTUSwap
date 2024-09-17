const AssetIssuer = artifacts.require("AssetIssuer");

module.exports = function (deployer) {
    deployer.deploy(AssetIssuer);
};
