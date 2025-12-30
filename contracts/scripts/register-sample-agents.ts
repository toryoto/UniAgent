import { ethers } from 'hardhat';

/**
 * Register sample agents for testing
 * Run this after deploying AgentRegistry
 *
 * Usage:
 * AGENT_REGISTRY_ADDRESS=0x... npx hardhat run scripts/register-sample-agents.ts --network base-sepolia
 */

async function main() {
  // AgentRegistry contract address (Base Sepolia)
  const AGENT_REGISTRY_ADDRESS =
    process.env.AGENT_REGISTRY_ADDRESS || '0xe2B64700330af9e408ACb3A04a827045673311C1';

  // Base URL for agent.json endpoints (ローカルサーバー)
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  console.log('Registering sample agents...');
  console.log('AgentRegistry address:', AGENT_REGISTRY_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log('Using account:', deployer.address);

  // Get AgentRegistry contract
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
  const agentRegistry = AgentRegistry.attach(AGENT_REGISTRY_ADDRESS);

  // USDC address (Base Sepolia Testnet)
  const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

  // Sample Agent 1: Flight Search Agent
  console.log('\n1️⃣ Registering FlightFinderPro...');
  const agent1Id = ethers.id('FlightFinderPro-v1');
  const agent1Skills = [
    { id: 'search-flights', name: 'Flight Search', description: '2地点間のフライトを検索' },
    { id: 'compare-prices', name: 'Price Comparison', description: '複数航空会社の価格比較' },
  ];
  const agent1Payment = {
    tokenAddress: USDC_ADDRESS,
    receiverAddress: deployer.address, // For demo, use deployer address
    pricePerCall: ethers.parseUnits('0.01', 6), // 0.01 USDC
    chain: 'base-sepolia',
  };

  try {
    const tx1 = await agentRegistry.registerAgent(
      agent1Id,
      'FlightFinderPro',
      '最安値フライト検索エージェント',
      `${BASE_URL}/api/agents/flight/.well-known/agent.json`,
      '1.0.0',
      ['text/plain'],
      ['application/json'],
      agent1Skills,
      agent1Payment,
      'travel',
      'https://via.placeholder.com/150/3498db/ffffff?text=Flight'
    );
    await tx1.wait();
    console.log('✅ FlightFinderPro registered');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  FlightFinderPro already registered');
    } else {
      throw error;
    }
  }

  // Sample Agent 2: Hotel Search Agent
  console.log('\n2️⃣ Registering HotelBookerPro...');
  const agent2Id = ethers.id('HotelBookerPro-v1');
  const agent2Skills = [
    { id: 'search-hotels', name: 'Hotel Search', description: '宿泊施設を検索' },
    { id: 'check-availability', name: 'Availability Check', description: '空室確認' },
  ];
  const agent2Payment = {
    tokenAddress: USDC_ADDRESS,
    receiverAddress: deployer.address,
    pricePerCall: ethers.parseUnits('0.015', 6), // 0.015 USDC
    chain: 'base-sepolia',
  };

  try {
    const tx2 = await agentRegistry.registerAgent(
      agent2Id,
      'HotelBookerPro',
      'ホテル予約エージェント',
      `${BASE_URL}/api/agents/hotel/.well-known/agent.json`,
      '1.0.0',
      ['text/plain'],
      ['application/json'],
      agent2Skills,
      agent2Payment,
      'travel',
      'https://via.placeholder.com/150/e74c3c/ffffff?text=Hotel'
    );
    await tx2.wait();
    console.log('✅ HotelBookerPro registered');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  HotelBookerPro already registered');
    } else {
      throw error;
    }
  }

  // Sample Agent 3: Tourism Guide Agent
  console.log('\n3️⃣ Registering TourismGuide...');
  const agent3Id = ethers.id('TourismGuide-v1');
  const agent3Skills = [
    { id: 'recommend-spots', name: 'Spot Recommendation', description: '観光スポット推薦' },
    { id: 'create-itinerary', name: 'Itinerary Creation', description: '旅行プラン作成' },
  ];
  const agent3Payment = {
    tokenAddress: USDC_ADDRESS,
    receiverAddress: deployer.address,
    pricePerCall: ethers.parseUnits('0.02', 6), // 0.02 USDC
    chain: 'base-sepolia',
  };

  try {
    const tx3 = await agentRegistry.registerAgent(
      agent3Id,
      'TourismGuide',
      '観光ガイドエージェント',
      `${BASE_URL}/api/agents/tourism/.well-known/agent.json`,
      '1.0.0',
      ['text/plain'],
      ['application/json'],
      agent3Skills,
      agent3Payment,
      'travel',
      'https://via.placeholder.com/150/2ecc71/ffffff?text=Tourism'
    );
    await tx3.wait();
    console.log('✅ TourismGuide registered');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  TourismGuide already registered');
    } else {
      throw error;
    }
  }

  // Display summary
  console.log('\n==================================================');
  console.log('📝 Registration Summary');
  console.log('==================================================');
  console.log('Total agents registered: 3');
  console.log('\nAgent IDs:');
  console.log('1. FlightFinderPro:', agent1Id);
  console.log('2. HotelBookerPro:', agent2Id);
  console.log('3. TourismGuide:', agent3Id);
  console.log('==================================================');

  // Verify registration
  console.log('\n🔍 Verifying registration...');
  const travelAgents = await agentRegistry.getAgentsByCategory('travel');
  console.log(`Found ${travelAgents.length} agents in 'travel' category`);

  const totalAgents = await agentRegistry.getTotalAgentCount();
  console.log(`Total agents in registry: ${totalAgents}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
