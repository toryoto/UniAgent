import { ethers } from 'hardhat';

/**
 * Verify contract interaction after deployment
 *
 * Usage:
 * AGENT_REGISTRY_ADDRESS=0x... npx hardhat run scripts/verify-deployment.ts --network base-sepolia
 */

async function main() {
  const AGENT_REGISTRY_ADDRESS = process.env.AGENT_REGISTRY_ADDRESS || '';

  if (!AGENT_REGISTRY_ADDRESS) {
    console.error('❌ Please set AGENT_REGISTRY_ADDRESS environment variable');
    process.exit(1);
  }

  console.log('Verifying deployment...');
  console.log('AgentRegistry address:', AGENT_REGISTRY_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log('Using account:', deployer.address);

  // Get AgentRegistry contract
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = AgentRegistry.attach(AGENT_REGISTRY_ADDRESS);

  console.log('\n✅ Contract is accessible');

  // Check total agents
  try {
    const totalAgents = await agentRegistry.getTotalAgentCount();
    console.log('\n📊 Registry Statistics:');
    console.log('- Total agents:', totalAgents.toString());

    const totalTxs = await agentRegistry.getTotalTransactionCount();
    console.log('- Total transactions:', totalTxs.toString());

    // Get all agent IDs
    const allAgentIds = await agentRegistry.getAllAgentIds();
    console.log('\n📋 Registered Agents:');

    if (allAgentIds.length === 0) {
      console.log('No agents registered yet.');
      console.log('\nTo register sample agents, run:');
      console.log(
        `AGENT_REGISTRY_ADDRESS=${AGENT_REGISTRY_ADDRESS} npx hardhat run scripts/register-sample-agents.ts --network base-sepolia`
      );
    } else {
      for (let i = 0; i < allAgentIds.length; i++) {
        const agentId = allAgentIds[i];
        const agent = await agentRegistry.getAgentCard(agentId);
        const avgRating = await agentRegistry.getAverageRating(agentId);

        console.log(`\n${i + 1}. ${agent.name}`);
        console.log(`   ID: ${agentId}`);
        console.log(`   Owner: ${agent.owner}`);
        console.log(`   Category: ${agent.category}`);
        console.log(`   URL: ${agent.url}`);
        console.log(`   Active: ${agent.isActive}`);
        console.log(`   Price: ${ethers.formatUnits(agent.payment.pricePerCall, 6)} USDC`);
        console.log(
          `   Rating: ${(Number(avgRating) / 100).toFixed(2)} (${agent.ratingCount} ratings)`
        );
      }
    }

    console.log('\n✅ Verification complete!');
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
