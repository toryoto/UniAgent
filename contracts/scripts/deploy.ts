import { ethers } from 'hardhat';

async function main() {
  console.log('Starting deployment...');

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  // Deploy AgentRegistry
  console.log('\nDeploying AgentRegistry...');
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = await AgentRegistry.deploy();

  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();

  console.log('✅ AgentRegistry deployed to:', agentRegistryAddress);

  // Display deployment info
  console.log('\n==================================================');
  console.log('📝 Deployment Summary');
  console.log('==================================================');
  console.log('Network:', (await ethers.provider.getNetwork()).name);
  console.log('Chain ID:', (await ethers.provider.getNetwork()).chainId);
  console.log('Deployer:', deployer.address);
  console.log('AgentRegistry:', agentRegistryAddress);
  console.log('==================================================');

  // Save deployment info to file
  const fs = require('fs');
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    agentRegistry: agentRegistryAddress,
    timestamp: new Date().toISOString(),
  };

  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `${deploymentsDir}/deployment-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${filename}`);

  // Wait for block confirmations on live networks
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 31337n) {
    // Not localhost
    console.log('\n⏳ Waiting for block confirmations...');
    await agentRegistry.deploymentTransaction()?.wait(2);
    console.log('✅ Confirmed!');

    console.log('\n📋 To verify the contract on Basescan, run:');
    const network = await ethers.provider.getNetwork();
    if (network.chainId === 84532n) {
      console.log(`npx hardhat verify --network base-sepolia ${agentRegistryAddress}`);
    } else if (network.chainId === 11155111n) {
      console.log(`npx hardhat verify --network sepolia ${agentRegistryAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
