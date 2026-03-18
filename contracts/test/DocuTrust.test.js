const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocuTrust", function () {
  let contract;
  let owner;
  let issuer;
  let other;

  // Sample document hash (simulates a SHA-256 hash as bytes32)
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("sample-document-content"));

  beforeEach(async function () {
    [owner, issuer, other] = await ethers.getSigners();

    const DocuTrust = await ethers.getContractFactory("DocuTrust");
    contract = await DocuTrust.deploy();
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should authorize the owner as an issuer", async function () {
      expect(await contract.authorizedIssuers(owner.address)).to.be.true;
    });

    it("should start with zero documents", async function () {
      expect(await contract.totalDocuments()).to.equal(0);
    });
  });

  describe("issueDocument", function () {
    it("should issue a document as owner", async function () {
      await expect(contract.issueDocument(sampleHash))
        .to.emit(contract, "DocumentIssued")
        .withArgs(sampleHash, owner.address, (await ethers.provider.getBlock("latest")).timestamp + 1);

      expect(await contract.totalDocuments()).to.equal(1);
    });

    it("should reject duplicate hashes", async function () {
      await contract.issueDocument(sampleHash);
      await expect(contract.issueDocument(sampleHash)).to.be.revertedWith(
        "DocuTrust: document already issued"
      );
    });

    it("should reject empty hash", async function () {
      await expect(
        contract.issueDocument(ethers.ZeroHash)
      ).to.be.revertedWith("DocuTrust: empty hash");
    });

    it("should reject unauthorized callers", async function () {
      await expect(
        contract.connect(other).issueDocument(sampleHash)
      ).to.be.revertedWith("DocuTrust: caller is not authorized");
    });

    it("should allow authorized issuers", async function () {
      await contract.addIssuer(issuer.address);
      await contract.connect(issuer).issueDocument(sampleHash);
      expect(await contract.totalDocuments()).to.equal(1);
    });
  });

  describe("verifyDocument", function () {
    it("should return exists=false for unknown hash", async function () {
      const [exists, revoked, issuerAddr, timestamp] =
        await contract.verifyDocument(sampleHash);
      expect(exists).to.be.false;
      expect(revoked).to.be.false;
      expect(issuerAddr).to.equal(ethers.ZeroAddress);
      expect(timestamp).to.equal(0);
    });

    it("should return correct data for issued document", async function () {
      await contract.issueDocument(sampleHash);
      const [exists, revoked, issuerAddr, timestamp] =
        await contract.verifyDocument(sampleHash);
      expect(exists).to.be.true;
      expect(revoked).to.be.false;
      expect(issuerAddr).to.equal(owner.address);
      expect(timestamp).to.be.greaterThan(0);
    });
  });

  describe("revokeDocument", function () {
    beforeEach(async function () {
      await contract.issueDocument(sampleHash);
    });

    it("should revoke a document as the original issuer", async function () {
      await expect(contract.revokeDocument(sampleHash))
        .to.emit(contract, "DocumentRevoked");

      const [exists, revoked] = await contract.verifyDocument(sampleHash);
      expect(exists).to.be.true;
      expect(revoked).to.be.true;
    });

    it("should reject revoking non-existent document", async function () {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await expect(contract.revokeDocument(fakeHash)).to.be.revertedWith(
        "DocuTrust: document does not exist"
      );
    });

    it("should reject double revocation", async function () {
      await contract.revokeDocument(sampleHash);
      await expect(contract.revokeDocument(sampleHash)).to.be.revertedWith(
        "DocuTrust: document already revoked"
      );
    });

    it("should reject revocation by unauthorized user", async function () {
      await expect(
        contract.connect(other).revokeDocument(sampleHash)
      ).to.be.revertedWith("DocuTrust: only issuer or owner can revoke");
    });
  });

  describe("Admin: addIssuer / removeIssuer", function () {
    it("should add an issuer", async function () {
      await contract.addIssuer(issuer.address);
      expect(await contract.authorizedIssuers(issuer.address)).to.be.true;
    });

    it("should remove an issuer", async function () {
      await contract.addIssuer(issuer.address);
      await contract.removeIssuer(issuer.address);
      expect(await contract.authorizedIssuers(issuer.address)).to.be.false;
    });

    it("should reject non-owner from adding issuers", async function () {
      await expect(
        contract.connect(other).addIssuer(issuer.address)
      ).to.be.revertedWith("DocuTrust: caller is not the owner");
    });
  });
});
