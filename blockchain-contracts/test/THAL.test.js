const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("THAL Token", function () {
  let thal;
  let owner;
  let backend;
  let user1;
  let user2;

  const INITIAL_SUPPLY = ethers.parseEther("100000000"); // 100M THAL
  const MAX_SUPPLY = ethers.parseEther("1000000000"); // 1B THAL

  beforeEach(async function () {
    [owner, backend, user1, user2] = await ethers.getSigners();

    const THAL = await ethers.getContractFactory("THAL");
    thal = await upgrades.deployProxy(THAL, [
      owner.address,
      backend.address,
    ], {
      initializer: "initialize",
      kind: "uups",
    });
    await thal.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await thal.name()).to.equal("ThaliumX Token");
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
      expect(await thal.hasRole(await thal.BACKEND_ROLE(), backend.address)).to.be.true;
    });

    it("Should set the correct backend address", async function () {
      expect(await thal.backendAddress()).to.equal(backend.address);
      expect(await thal.backendApproved(backend.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await thal.connect(owner).mint(user1.address, mintAmount, "Test mint");
      
      expect(await thal.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await thal.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
    });

    it("Should allow backend to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await thal.connect(backend).mint(user1.address, mintAmount, "Backend mint");
      
      expect(await thal.balanceOf(user1.address)).to.equal(mintAmount);
      expect(await thal.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
    });

    it("Should not allow unauthorized users to mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        thal.connect(user1).mint(user2.address, mintAmount, "Unauthorized mint")
      ).to.be.revertedWith("BackendNotApproved");
    });

    it("Should not allow minting beyond max supply", async function () {
      const mintAmount = MAX_SUPPLY - INITIAL_SUPPLY + ethers.parseEther("1");
      await expect(
        thal.connect(owner).mint(user1.address, mintAmount, "Exceeds max supply")
      ).to.be.revertedWith("ExceedsMaxSupply");
    });

    it("Should not allow minting zero amount", async function () {
      await expect(
        thal.connect(owner).mint(user1.address, 0, "Zero mint")
      ).to.be.revertedWith("InvalidAmount");
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
      
      await thal.connect(owner).burn(user1.address, burnAmount, "Test burn");
      
      expect(await thal.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await thal.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should allow backend to burn tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await thal.balanceOf(user1.address);
      const initialSupply = await thal.totalSupply();
      
      await thal.connect(backend).burn(user1.address, burnAmount, "Backend burn");
      
      expect(await thal.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await thal.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should not allow unauthorized users to burn", async function () {
      const burnAmount = ethers.parseEther("100");
      await expect(
        thal.connect(user1).burn(user1.address, burnAmount, "Unauthorized burn")
      ).to.be.revertedWith("BackendNotApproved");
    });

    it("Should not allow burning zero amount", async function () {
      await expect(
        thal.connect(owner).burn(user1.address, 0, "Zero burn")
      ).to.be.revertedWith("InvalidAmount");
    });
  });

  describe("Backend Management", function () {
    it("Should allow admin to update backend address", async function () {
      await thal.connect(owner).updateBackendAddress(user1.address);
      
      expect(await thal.backendAddress()).to.equal(user1.address);
      expect(await thal.backendApproved(user1.address)).to.be.true;
      expect(await thal.hasRole(await thal.BACKEND_ROLE(), user1.address)).to.be.true;
    });

    it("Should allow admin to approve/revoke backend access", async function () {
      await thal.connect(owner).setBackendApproval(user1.address, true);
      expect(await thal.backendApproved(user1.address)).to.be.true;
      
      await thal.connect(owner).setBackendApproval(user1.address, false);
      expect(await thal.backendApproved(user1.address)).to.be.false;
    });

    it("Should not allow non-admin to update backend address", async function () {
      await expect(
        thal.connect(user1).updateBackendAddress(user2.address)
      ).to.be.revertedWith("AccessControl: account " + user1.address.toLowerCase() + " is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
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
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow minting when paused", async function () {
      await thal.connect(owner).pause();
      await expect(
        thal.connect(owner).mint(user1.address, ethers.parseEther("100"), "Paused mint")
      ).to.be.revertedWith("Pausable: paused");
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
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should not allow transfers exceeding allowance", async function () {
      const transferAmount = ethers.parseEther("100");
      await thal.connect(owner).transfer(user1.address, transferAmount);
      
      await thal.connect(user1).approve(user2.address, transferAmount - ethers.parseEther("1"));
      await expect(
        thal.connect(user2).transferFrom(user1.address, user2.address, transferAmount)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("Contract Info", function () {
    it("Should return correct contract info", async function () {
      const info = await thal.getContractInfo();
      
      expect(info.owner).to.equal(owner.address);
      expect(info.backend).to.equal(backend.address);
      expect(info.totalSupply_).to.equal(INITIAL_SUPPLY);
      expect(info.maxSupply_).to.equal(MAX_SUPPLY);
      expect(info.paused_).to.be.false;
    });

    it("Should return correct version", async function () {
      expect(await thal.version()).to.equal("1.0.0");
    });
  });
});
