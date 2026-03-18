const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying DocuTrust contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("  Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("  Deployer balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  const DocuTrust = await ethers.getContractFactory("DocuTrust");
  const contract = await DocuTrust.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log("✅ DocuTrust deployed successfully!");
  console.log("   Contract address:", contractAddress);
  console.log("   Transaction hash:", contract.deploymentTransaction().hash);
  console.log("\n──────────────────────────────────────────");
  console.log("IMPORTANT: Copy this address to your .env file:");
  console.log(`   DOCTRUST_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("──────────────────────────────────────────\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
