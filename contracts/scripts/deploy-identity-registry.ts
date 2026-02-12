import { ethers } from 'hardhat';

async function main() {
  console.log('Starting AgentIdentityRegistry deployment...');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  // Deploy AgentIdentityRegistry
  console.log('\nDeploying AgentIdentityRegistry...');
  const Factory = await ethers.getContractFactory('AgentIdentityRegistry');
  const registry = await Factory.deploy();

  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  console.log('AgentIdentityRegistry deployed to:', registryAddress);

  // Display deployment info
  const network = await ethers.provider.getNetwork();
  console.log('\n==================================================');
  console.log('Deployment Summary');
  console.log('==================================================');
  console.log('Network:', network.name);
  console.log('Chain ID:', network.chainId);
  console.log('Deployer:', deployer.address);
  console.log('AgentIdentityRegistry:', registryAddress);
  console.log('==================================================');

  // Save deployment info
  const fs = require('fs');
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentInfo = {
    contract: 'AgentIdentityRegistry',
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    address: registryAddress,
    timestamp: new Date().toISOString(),
  };

  const filename = `${deploymentsDir}/identity-registry-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${filename}`);

  // Wait for confirmations on live networks
  if (network.chainId !== 31337n) {
    console.log('\nWaiting for block confirmations...');
    await registry.deploymentTransaction()?.wait(2);
    console.log('Confirmed!');

    console.log('\nTo verify the contract on Basescan, run:');
    if (network.chainId === 84532n) {
      console.log(`npx hardhat verify --network base-sepolia ${registryAddress}`);
    } else if (network.chainId === 11155111n) {
      console.log(`npx hardhat verify --network sepolia ${registryAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
