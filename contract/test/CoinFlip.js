const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("CoinFlip", function () {
  // Deploy fixture for reuse
  async function deployCoinFlipFixture() {
    const INITIAL_FUNDING = ethers.parseEther("15"); // 10 ETH

    // Get signers
    const [owner, player1, player2] = await ethers.getSigners();

    // Deploy contract
    const CoinFlip = await ethers.getContractFactory("CoinFlip");
    const coinFlip = await CoinFlip.deploy();

    // Fund the contract
    await coinFlip.addFunds({ value: INITIAL_FUNDING });

    return { coinFlip, owner, player1, player2, INITIAL_FUNDING };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { coinFlip, owner } = await loadFixture(deployCoinFlipFixture);
      expect(await coinFlip.owner()).to.equal(owner.address);
    });

    it("Should have initial funding", async function () {
      const { coinFlip, INITIAL_FUNDING } = await loadFixture(deployCoinFlipFixture);
      expect(await coinFlip.getBalance()).to.equal(INITIAL_FUNDING);
    });
  });

  describe("Game Play", function () {
    it("Should allow players to bet", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);
      const betAmount = ethers.parseEther("1");

      await expect(
        coinFlip.connect(player1).flipCoin(true, { value: betAmount })
      ).not.to.be.reverted;
    });

    it("Should fail if bet is zero", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);

      await expect(
        coinFlip.connect(player1).flipCoin(true, { value: 0 })
      ).to.be.revertedWith("Must bet something");
    });

    it("Should fail if contract doesn't have enough funds", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);
      const hugeBet = ethers.parseEther("100"); // More than contract has

      await expect(
        coinFlip.connect(player1).flipCoin(true, { value: hugeBet })
      ).to.be.revertedWith("Not enough funds in contract");
    });

    it("Should emit GameResult event", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);
      const betAmount = ethers.parseEther("1");

      await expect(
        coinFlip.connect(player1).flipCoin(true, { value: betAmount })
      ).to.emit(coinFlip, "GameResult");
    });

    it("Should handle winning correctly", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);
      const betAmount = ethers.parseEther("1");
      const expectedPayout = (betAmount * 3n) / 2n; // 1.5x

      const initialBalance = await ethers.provider.getBalance(player1.address);

      // Keep trying until we get a win (since randomness is based on timestamp)
      let won = false;
      let attempts = 0;
      while (!won && attempts < 10) {
        const tx = await coinFlip.connect(player1).flipCoin(true, { value: betAmount });
        const receipt = await tx.wait();

        // Check if won by looking at balance change
        const newBalance = await ethers.provider.getBalance(player1.address);
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        const balanceChange = newBalance - initialBalance + gasUsed;

        if (balanceChange > 0) {
          won = true;
          expect(balanceChange).to.be.closeTo(betAmount / 2n, ethers.parseEther("0.01")); // ~0.5 ETH profit
        }
        attempts++;
      }
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to add funds", async function () {
      const { coinFlip, owner } = await loadFixture(deployCoinFlipFixture);
      const additionalFunds = ethers.parseEther("5");
      const initialBalance = await coinFlip.getBalance();

      await coinFlip.connect(owner).addFunds({ value: additionalFunds });

      expect(await coinFlip.getBalance()).to.equal(initialBalance + additionalFunds);
    });

    it("Should not allow non-owner to add funds", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);
      const additionalFunds = ethers.parseEther("5");

      await expect(
        coinFlip.connect(player1).addFunds({ value: additionalFunds })
      ).to.be.revertedWith("Only owner");
    });

    it("Should allow owner to withdraw", async function () {
      const { coinFlip, owner } = await loadFixture(deployCoinFlipFixture);
      const withdrawAmount = ethers.parseEther("2");

      await expect(
        coinFlip.connect(owner).withdraw(withdrawAmount)
      ).not.to.be.reverted;
    });

    it("Should not allow non-owner to withdraw", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);
      const withdrawAmount = ethers.parseEther("2");

      await expect(
        coinFlip.connect(player1).withdraw(withdrawAmount)
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("Balance Tracking", function () {
    it("Should track contract balance correctly", async function () {
      const { coinFlip, player1 } = await loadFixture(deployCoinFlipFixture);
      const betAmount = ethers.parseEther("1");
      const initialContractBalance = await coinFlip.getBalance();

      // Place a losing bet (balance should increase)
      await coinFlip.connect(player1).flipCoin(true, { value: betAmount });

      const newBalance = await coinFlip.getBalance();
      // Balance should be either same (if won) or increased by bet (if lost)
      expect(newBalance).to.be.gte(initialContractBalance);
    });
  });
});