const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ThaliumDEX and ThaliumBridge", function () {
  let owner;
  let dexAdmin;
  let liquidityManager;
  let validator1;
  let validator2;
  let validator3;
  let user;
  let recipient;
  let thalToken;
  let tokenA;
  let tokenB;
  let dex;
  let bridge;

  const initialSupply = ethers.parseEther("1000000");
  const bridgeAmount = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, dexAdmin, liquidityManager, validator1, validator2, validator3, user, recipient] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("ThaliumToken");
    thalToken = await Token.deploy(owner.address, owner.address, owner.address, owner.address, initialSupply);
    await thalToken.waitForDeployment();

    tokenA = await Token.deploy(owner.address, owner.address, owner.address, owner.address, initialSupply);
    await tokenA.waitForDeployment();

    tokenB = await Token.deploy(owner.address, owner.address, owner.address, owner.address, initialSupply);
    await tokenB.waitForDeployment();

    const DEX = await ethers.getContractFactory("ThaliumDEX");
    dex = await DEX.deploy(await thalToken.getAddress(), owner.address, dexAdmin.address, liquidityManager.address);
    await dex.waitForDeployment();

    const Bridge = await ethers.getContractFactory("ThaliumBridge");
    bridge = await Bridge.deploy(
      await thalToken.getAddress(),
      owner.address,
      owner.address,
      [validator1.address, validator2.address, validator3.address]
    );
    await bridge.waitForDeployment();

    await tokenA.connect(owner).transfer(user.address, ethers.parseEther("10000"));
    await tokenB.connect(owner).transfer(user.address, ethers.parseEther("10000"));
    await thalToken.connect(owner).transfer(user.address, ethers.parseEther("5000"));
  });

  it("tracks liquidity ownership and blocks over-withdrawal", async function () {
    await dex.connect(liquidityManager).createPool(await tokenA.getAddress(), await tokenB.getAddress(), 300);

    await tokenA.connect(user).approve(await dex.getAddress(), ethers.parseEther("1000"));
    await tokenB.connect(user).approve(await dex.getAddress(), ethers.parseEther("1000"));

    await dex.connect(user).addLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), ethers.parseEther("1000"), ethers.parseEther("1000"));

    const liquidityBalance = await dex.getLiquidityBalance(user.address, await tokenA.getAddress(), await tokenB.getAddress());
    expect(liquidityBalance).to.be.gt(0n);

    await expect(
      dex.connect(user).removeLiquidity(await tokenA.getAddress(), await tokenB.getAddress(), liquidityBalance + 1n)
    ).to.be.revertedWithCustomError(dex, "InsufficientLiquidityBalance");
  });

  it("uses live THAL balance for discount tiers", async function () {
    const [tierBefore] = await dex.getTHALDiscountTier(user.address);
    expect(tierBefore).to.equal(1n);

    await thalToken.connect(owner).transfer(user.address, ethers.parseEther("8000"));
    const [tierAfter] = await dex.getTHALDiscountTier(user.address);
    expect(tierAfter).to.equal(2n);
  });

  it("rejects mismatched destination-chain execution attempts", async function () {
    await thalToken.connect(user).approve(await bridge.getAddress(), bridgeAmount + ethers.parseEther("10"));
    const tx = await bridge.connect(user).initiateTransfer(recipient.address, bridgeAmount, 56);
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "TransferInitiated");
    const transferId = event.args.transferId;

    const request = await bridge.getTransferRequest(transferId);
    const executionChainId = await ethers.provider.getNetwork().then((network) => network.chainId);
    const transferDigest = await bridge.getTransferDigest(
      transferId,
      request.sender,
      request.recipient,
      request.amount,
      request.sourceChainId,
      request.targetChainId,
      request.nonce,
      request.deadline
    );

    const transferDigestBytes = ethers.getBytes(transferDigest);
    const sig1 = await validator1.signMessage(transferDigestBytes);
    const sig2 = await validator2.signMessage(transferDigestBytes);
    const sig3 = await validator3.signMessage(transferDigestBytes);

    const validProof = [sig1, sig2, sig3].sort();
    await expect(
      bridge.connect(user).completeTransfer(
        transferId,
        request.sender,
        request.recipient,
        request.amount,
        request.sourceChainId,
        executionChainId,
        request.nonce,
        request.deadline,
        validProof
      )
    ).to.be.revertedWithCustomError(bridge, "InvalidTransferData");
  });

  it("creates a cross-chain transfer request with signed execution proof material", async function () {
    await thalToken.connect(user).approve(await bridge.getAddress(), bridgeAmount + ethers.parseEther("10"));
    const tx = await bridge.connect(user).initiateTransfer(recipient.address, bridgeAmount, 56);
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "TransferInitiated");
    const transferId = event.args.transferId;

    const request = await bridge.getTransferRequest(transferId);
    const transferDigest = await bridge.getTransferDigest(
      transferId,
      request.sender,
      request.recipient,
      request.amount,
      request.sourceChainId,
      request.targetChainId,
      request.nonce,
      request.deadline
    );

    const transferDigestBytes = ethers.getBytes(transferDigest);
    const sig1 = await validator1.signMessage(transferDigestBytes);
    const sig2 = await validator2.signMessage(transferDigestBytes);
    const sig3 = await validator3.signMessage(transferDigestBytes);
    const validProof = [sig1, sig2, sig3].sort();

    expect(validProof).to.have.length(3);
    expect(request.targetChainId).to.equal(56n);
    expect(request.executed).to.equal(false);
  });
});
