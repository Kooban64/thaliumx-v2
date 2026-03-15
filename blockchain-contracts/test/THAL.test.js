const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("THAL Token", function () {
  let thal;
  let owner;
  let user1;
  let user2;

  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 100M THAL
  const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1B THAL

  async function expectCustomError(txPromise, contract, errorName) {
    await expect(txPromise).to.be.revertedWithCustomError(contract, errorName);
  }

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const THAL = await ethers.getContractFactory("ThaliumToken");
    thal = await THAL.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      INITIAL_SUPPLY
    );
    await thal.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await thal.name()).to.equal("Thalium");
      expect(await thal.symbol()).to.equal("THAL");
      expect(await thal.decimals()).to.equal(18);
      expect(await thal.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await thal.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the correct roles", async function () {
      expect(await thal.hasRole(await thal.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await thal.hasRole(await thal.MINTER_ROLE(), owner.address)).to.be.true;
      expect(await thal.hasRole(await thal.BURNER_ROLE(), owner.address)).to.be.true;
      expect(await thal.hasRole(await thal.PAUSER_ROLE(), owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await thal.connect(owner).mint(user1.address, mintAmount);
      
      expect(await thal.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await thal.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
    });

    it("Should allow minter to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await thal.connect(owner).mint(user1.address, mintAmount);
      
      expect(await thal.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await thal.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
    });

    it("Should not allow unauthorized users to mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        thal.connect(user1).mint(user2.address, mintAmount)
      ).to.be.reverted;
    });

    it("Should not allow minting beyond max supply", async function () {
      const mintAmount = MAX_SUPPLY - INITIAL_SUPPLY + ethers.parseEther("1");
      await expectCustomError(
        thal.connect(owner).mint(user1.address, mintAmount),
        thal,
        "MaxSupplyExceeded"
      );
    });

    it("Should not allow minting zero amount", async function () {
      await expectCustomError(
        thal.connect(owner).mint(user1.address, 0),
        thal,
        "AmountMustBePositive"
      );
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      // Transfer some tokens to user1 for burning tests
      await thal.connect(owner).transfer(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow owner to burn tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await thal.balanceOf(user1.address);
      const initialSupply = await thal.totalSupply();
      
      await thal.connect(owner).burn(user1.address, burnAmount);
      
      expect(await thal.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await thal.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should allow burner to burn tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await thal.balanceOf(user1.address);
      const initialSupply = await thal.totalSupply();
      
      await thal.connect(owner).burn(user1.address, burnAmount);
      
      expect(await thal.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await thal.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should not allow unauthorized users to burn", async function () {
      const burnAmount = ethers.parseEther("100");
      await expect(
        thal.connect(user1).burn(user1.address, burnAmount)
      ).to.be.reverted;
    });

    it("Should not allow burning zero amount", async function () {
      await expectCustomError(
        thal.connect(owner).burn(user1.address, 0),
        thal,
        "AmountMustBePositive"
      );
    });
  });

  describe("Pausable", function () {
    it("Should allow pauser to pause the contract", async function () {
      await thal.connect(owner).pause();
      expect(await thal.paused()).to.be.true;
    });

    it("Should allow pauser to unpause the contract", async function () {
      await thal.connect(owner).pause();
      await thal.connect(owner).unpause();
      expect(await thal.paused()).to.be.false;
    });

    it("Should not allow transfers when paused", async function () {
      await thal.connect(owner).pause();
      await expect(
        thal.connect(owner).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should not allow minting when paused", async function () {
      await thal.connect(owner).pause();
      await expect(
        thal.connect(owner).mint(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  describe("Standard ERC20", function () {
    it("Should allow transfers", async function () {
      const transferAmount = ethers.parseEther("100");
      await thal.connect(owner).transfer(user1.address, transferAmount);
      
      expect(await thal.balanceOf(user1.address)).to.equal(transferAmount);
      expect(await thal.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY - transferAmount);
    });

    it("Should allow approvals and transfers from", async function () {
      const transferAmount = ethers.parseEther("100");
      await thal.connect(owner).transfer(user1.address, transferAmount);
      
      await thal.connect(user1).approve(user2.address, transferAmount);
      expect(await thal.allowance(user1.address, user2.address)).to.equal(transferAmount);
      
      await thal.connect(user2).transferFrom(user1.address, user2.address, transferAmount);
      expect(await thal.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await thal.balanceOf(user1.address)).to.equal(0);
    });

    it("Should not allow transfers exceeding balance", async function () {
      const transferAmount = INITIAL_SUPPLY + ethers.parseEther("1");
      await expect(
        thal.connect(owner).transfer(user1.address, transferAmount)
      ).to.be.reverted;
    });

    it("Should not allow transfers exceeding allowance", async function () {
      const transferAmount = ethers.parseEther("100");
      await thal.connect(owner).transfer(user1.address, transferAmount);
      
      await thal.connect(user1).approve(user2.address, transferAmount - ethers.parseEther("1"));
      await expect(
        thal.connect(user2).transferFrom(user1.address, user2.address, transferAmount)
      ).to.be.reverted;
    });
  });
});
