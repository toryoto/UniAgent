import { ethers } from 'hardhat';
import { PinataSDK } from 'pinata';

/**
 * Register sample agents using ERC-8004 Identity Registry + Pinata IPFS
 *
 * Usage:
 * AGENT_IDENTITY_REGISTRY_ADDRESS=0x... PINATA_JWT=... PINATA_GATEWAY_URL=... \
 *   npx hardhat run scripts/register-agents-erc8004.ts --network base-sepolia
 */

interface ERC8004RegistrationFile {
  type: string;
  name: string;
  description: string;
  image: string;
  services: Array<{
    name: string;
    endpoint: string;
    version?: string;
    skills?: Array<{ id: string; name: string; description: string }>;
    domains?: string[];
  }>;
  x402Support?: boolean;
  active?: boolean;
  category?: string;
}

async function uploadToIPFS(
  pinata: PinataSDK,
  metadata: ERC8004RegistrationFile,
  name: string
): Promise<string> {
  const result = await pinata.upload.public.json(metadata).name(name);
  return `ipfs://${result.cid}`;
}

async function main() {
  const REGISTRY_ADDRESS =
    process.env.AGENT_IDENTITY_REGISTRY_ADDRESS;

  if (!REGISTRY_ADDRESS) {
    throw new Error('AGENT_IDENTITY_REGISTRY_ADDRESS is required');
  }

  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT is required');
  }

  const PINATA_GATEWAY_URL = process.env.PINATA_GATEWAY_URL || '';
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

  console.log('Registering sample agents (ERC-8004)...');
  console.log('Registry address:', REGISTRY_ADDRESS);
  console.log('Base URL:', BASE_URL);

  const [deployer] = await ethers.getSigners();
  console.log('Using account:', deployer.address);

  // Initialize Pinata client
  const pinata = new PinataSDK({
    pinataJwt: PINATA_JWT,
    pinataGateway: PINATA_GATEWAY_URL,
  });

  // Get contract instance
  const Factory = await ethers.getContractFactory('AgentIdentityRegistry');
  const registry = Factory.attach(REGISTRY_ADDRESS);

  // Agent definitions
  const agents: Array<{
    name: string;
    metadata: ERC8004RegistrationFile;
    walletAddress: string;
  }> = [
    {
      name: 'FlightFinderPro',
      walletAddress: deployer.address,
      metadata: {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: 'FlightFinderPro',
        description: '最安値フライト検索エージェント',
        image: 'https://via.placeholder.com/150/3498db/ffffff?text=Flight',
        services: [
          {
            name: 'A2A',
            endpoint: `${BASE_URL}/api/agents/flight/.well-known/agent.json`,
            version: '1.0.0',
            skills: [
              { id: 'search-flights', name: 'Flight Search', description: '2地点間のフライトを検索' },
              { id: 'compare-prices', name: 'Price Comparison', description: '複数航空会社の価格比較' },
            ],
            domains: ['travel'],
          },
        ],
        x402Support: true,
        active: true,
        category: 'travel',
      },
    },
    {
      name: 'HotelBookerPro',
      walletAddress: deployer.address,
      metadata: {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: 'HotelBookerPro',
        description: 'ホテル予約エージェント',
        image: 'https://via.placeholder.com/150/e74c3c/ffffff?text=Hotel',
        services: [
          {
            name: 'A2A',
            endpoint: `${BASE_URL}/api/agents/hotel/.well-known/agent.json`,
            version: '1.0.0',
            skills: [
              { id: 'search-hotels', name: 'Hotel Search', description: '宿泊施設を検索' },
              { id: 'check-availability', name: 'Availability Check', description: '空室確認' },
            ],
            domains: ['travel'],
          },
        ],
        x402Support: true,
        active: true,
        category: 'travel',
      },
    },
    {
      name: 'TourismGuide',
      walletAddress: deployer.address,
      metadata: {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: 'TourismGuide',
        description: '観光ガイドエージェント',
        image: 'https://via.placeholder.com/150/2ecc71/ffffff?text=Tourism',
        services: [
          {
            name: 'A2A',
            endpoint: `${BASE_URL}/api/agents/tourism/.well-known/agent.json`,
            version: '1.0.0',
            skills: [
              { id: 'recommend-spots', name: 'Spot Recommendation', description: '観光スポット推薦' },
              { id: 'create-itinerary', name: 'Itinerary Creation', description: '旅行プラン作成' },
            ],
            domains: ['travel'],
          },
        ],
        x402Support: true,
        active: true,
        category: 'travel',
      },
    },
  ];

  const registeredAgents: Array<{ name: string; agentId: string; ipfsUri: string }> = [];

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    console.log(`\n${i + 1}. Registering ${agent.name}...`);

    try {
      // Upload metadata to IPFS
      console.log('   Uploading metadata to IPFS...');
      const ipfsUri = await uploadToIPFS(pinata, agent.metadata, `agent-${agent.name}`);
      console.log(`   IPFS URI: ${ipfsUri}`);

      // Register on-chain
      console.log('   Registering on-chain...');
      const tx = await registry.getFunction('register(string)')(ipfsUri);
      const receipt = await tx.wait();

      // Get agentId from Registered event
      const registeredEvent = receipt?.logs.find((log: any) => {
        try {
          return registry.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === 'Registered';
        } catch { return false; }
      });

      const parsedEvent = registeredEvent
        ? registry.interface.parseLog({ topics: [...registeredEvent.topics], data: registeredEvent.data })
        : null;
      const agentId = parsedEvent?.args?.[0]?.toString() || 'unknown';

      console.log(`   Agent ID: ${agentId}`);

      // Set agent wallet
      console.log('   Setting agent wallet...');
      const walletTx = await registry.getFunction('setAgentWallet')(agentId, agent.walletAddress);
      await walletTx.wait();

      registeredAgents.push({ name: agent.name, agentId, ipfsUri });
      console.log(`   ${agent.name} registered successfully`);
    } catch (error: any) {
      console.error(`   Error registering ${agent.name}:`, error.message);
    }
  }

  // Summary
  console.log('\n==================================================');
  console.log('Registration Summary (ERC-8004)');
  console.log('==================================================');
  console.log(`Total agents registered: ${registeredAgents.length}`);
  for (const agent of registeredAgents) {
    console.log(`\n  ${agent.name}:`);
    console.log(`    Agent ID: ${agent.agentId}`);
    console.log(`    IPFS URI: ${agent.ipfsUri}`);
  }
  console.log('==================================================');

  // Verify
  console.log('\nVerifying registration...');
  const totalSupply = await registry.getFunction('totalSupply')();
  console.log(`Total agents in registry: ${totalSupply}`);

  const allIds = await registry.getFunction('getAllAgentIds')();
  console.log(`All agent IDs: ${allIds.map((id: any) => id.toString()).join(', ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
