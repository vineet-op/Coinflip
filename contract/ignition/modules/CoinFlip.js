// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const CoinFlipModule = buildModule("CoinFlipModule", (m) => {
  // Deploy the CoinFlip contract
  const coinFlip = m.contract("CoinFlip");

  return { coinFlip };
});


module.exports = CoinFlipModule