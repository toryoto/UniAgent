import { ethers } from 'hardhat';

const KNOWN_ADDRESSES: Record<string, { usdc: string; registry: string }> = {
  // Base Sepolia
  '84532': {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    registry: '0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92',
  },
};

async function main() {
  console.log('Starting AgentStaking deployment...');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  const known = KNOWN_ADDRESSES[chainId];
  const usdcAddress = process.env.USDC_ADDRESS || known?.usdc;
  const registryAddress = process.env.REGISTRY_ADDRESS || known?.registry;
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

  if (!usdcAddress) {
    throw new Error('USDC_ADDRESS not set and no known address for this chain');
  }
  if (!registryAddress) {
    throw new Error('REGISTRY_ADDRESS not set and no known address for this chain');
  }

  console.log('\nConstructor args:');
  console.log('  USDC:', usdcAddress);
  console.log('  Registry:', registryAddress);
  console.log('  Treasury:', treasuryAddress);

  console.log('\nDeploying AgentStaking...');
  const Factory = await ethers.getContractFactory('AgentStaking');
  const staking = await Factory.deploy(usdcAddress, registryAddress, treasuryAddress);

  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();

  console.log('AgentStaking deployed to:', stakingAddress);

  console.log('\n--- Post-deploy ---');
  console.log('Set AGENT_STAKING / NEXT_PUBLIC_AGENT_STAKING =', stakingAddress);
  console.log('If the registry was redeployed, ensure REGISTRY_ADDRESS above matches the new AgentIdentityRegistry.');
  console.log('---\n');

  console.log('\n==================================================');
  console.log('Deployment Summary');
  console.log('==================================================');
  console.log('Network:', network.name);
  console.log('Chain ID:', chainId);
  console.log('Deployer:', deployer.address);
  console.log('AgentStaking:', stakingAddress);
  console.log('  USDC:', usdcAddress);
  console.log('  Registry:', registryAddress);
  console.log('  Treasury:', treasuryAddress);
  console.log('==================================================');

  const fs = require('fs');
  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentInfo = {
    contract: 'AgentStaking',
    network: network.name,
    chainId,
    deployer: deployer.address,
    address: stakingAddress,
    constructorArgs: {
      usdc: usdcAddress,
      registry: registryAddress,
      treasury: treasuryAddress,
    },
    timestamp: new Date().toISOString(),
  };

  const filename = `${deploymentsDir}/staking-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${filename}`);

  if (network.chainId !== 31337n) {
    console.log('\nWaiting for block confirmations...');
    await staking.deploymentTransaction()?.wait(2);
    console.log('Confirmed!');

    console.log('\nTo verify the contract on Basescan, run:');
    if (network.chainId === 84532n) {
      console.log(
        `npx hardhat verify --network base-sepolia ${stakingAddress} "${usdcAddress}" "${registryAddress}" "${treasuryAddress}"`
      );
    } else if (network.chainId === 11155111n) {
      console.log(
        `npx hardhat verify --network sepolia ${stakingAddress} "${usdcAddress}" "${registryAddress}" "${treasuryAddress}"`
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
