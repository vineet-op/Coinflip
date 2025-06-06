require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // Required to read .env variables

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};


// 0x5B36E238d823e01B0363Ee128F59d2d4d9c60668