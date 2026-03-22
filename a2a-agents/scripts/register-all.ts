/**
 * register-all.ts
 *
 * agents.yaml の全エージェントを一括で:
 *   1. ERC-8004 メタデータを IPFS にアップロード (Pinata)
 *   2. AgentIdentityRegistry にオンチェーン登録
 *   3. setAgentWallet でウォレット設定
 *
 * Usage:
 *   PINATA_JWT=... PRIVATE_KEY=0x... BASE_URL=http://localhost:3003 \
 *     npx tsx scripts/register-all.ts
 *
 *   --dry-run  : IPFS アップロードのみ（オンチェーン登録をスキップ）
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createPublicClient, createWalletClient, http, encodeEventTopics, parseAbiItem } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  CONTRACT_ADDRESSES,
  PINATA_GATEWAY_URL,
} from '@agent-marketplace/shared/config';
import { AGENT_IDENTITY_REGISTRY_ABI } from '@agent-marketplace/shared/contract';
import type { ERC8004RegistrationFile } from '@agent-marketplace/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface YamlSkill {
  id: string;
  name: string;
  description: string;
}

interface YamlAgent {
  slug: string;
  name: string;
  description: string;
  category: string;
  price: string;
  skills: YamlSkill[];
  image?: string;
}

// ---------------------------------------------------------------------------
// IPFS Upload via Pinata REST API
// ---------------------------------------------------------------------------

async function uploadToIPFS(
  metadata: ERC8004RegistrationFile,
  name: string,
): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT is required');

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name },
    }),
  });

  if (!res.ok) {
    throw new Error(`Pinata upload failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { IpfsHash: string };
  return `ipfs://${data.IpfsHash}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
  const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || '';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const WALLET_ADDRESS = process.env.AGENT_RECEIVER_ADDRESS || '';

  if (!isDryRun && !PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required for on-chain registration (use --dry-run to skip)');
  }

  const yamlPath = resolve(__dirname, '../agents.yaml');
  const raw = readFileSync(yamlPath, 'utf-8');
  const data = parseYaml(raw) as { agents: YamlAgent[] };

  console.log(`=== A2A Agents Bulk Registration ===`);
  console.log(`Agents: ${data.agents.length}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Pinata Gateway: ${PINATA_GATEWAY_URL}`);
  console.log(`Registry: ${CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log('');

  const results: Array<{ name: string; slug: string; ipfsUri: string; agentId?: string }> = [];

  const account = !isDryRun && PRIVATE_KEY
    ? privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
    : null;

  const publicClient = account
    ? createPublicClient({ transport: http(RPC_URL || undefined) })
    : null;

  const walletClient = account
    ? createWalletClient({ account, transport: http(RPC_URL || undefined) })
    : null;

  if (account) {
    console.log(`Using account: ${account.address}`);
    console.log('');
  }

  for (let i = 0; i < data.agents.length; i++) {
    const agent = data.agents[i];
    console.log(`[${i + 1}/${data.agents.length}] ${agent.name} (${agent.slug})`);

    try {
      const metadata: ERC8004RegistrationFile = {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: agent.name,
        description: agent.description,
        image: agent.image || `https://via.placeholder.com/150/2ecc71/ffffff?text=${encodeURIComponent(agent.slug)}`,
        services: [
          {
            name: 'A2A',
            endpoint: `${BASE_URL}/${agent.slug}/.well-known/agent.json`,
            version: '1.0.0',
            skills: agent.skills,
            domains: [agent.category],
          },
        ],
        x402Support: true,
        active: true,
        category: agent.category,
      };

      // 1. Upload to IPFS
      console.log('  Uploading to IPFS...');
      const ipfsUri = await uploadToIPFS(metadata, `a2a-agent-${agent.slug}`);
      console.log(`  IPFS: ${ipfsUri}`);

      const result: (typeof results)[number] = { name: agent.name, slug: agent.slug, ipfsUri };

      // 2. Register on-chain
      if (!isDryRun && publicClient && walletClient && account) {
        console.log('  Registering on-chain...');

        const hash = await walletClient.writeContract({
          account,
          chain: baseSepolia,
          address: CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as `0x${string}`,
          abi: AGENT_IDENTITY_REGISTRY_ABI,
          functionName: 'register',
          args: [ipfsUri],
        });

        console.log(`  Tx: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Parse Registered event to get agentId
        const registeredEvent = parseAbiItem(
          'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
        );
        const [eventSelector] = encodeEventTopics({ abi: [registeredEvent] });
        const registeredLog = receipt.logs.find(
          (l) => l.topics[0] === eventSelector,
        );

        if (registeredLog?.topics[1]) {
          result.agentId = BigInt(registeredLog.topics[1]).toString();
          console.log(`  Agent ID: ${result.agentId}`);
        }

        // 3. Set agent wallet
        if (result.agentId && WALLET_ADDRESS) {
          console.log('  Setting agent wallet...');
          const walletHash = await walletClient.writeContract({
            account,
            chain: baseSepolia,
            address: CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as `0x${string}`,
            abi: AGENT_IDENTITY_REGISTRY_ABI,
            functionName: 'setAgentWallet',
            args: [BigInt(result.agentId), WALLET_ADDRESS],
          });
          await publicClient.waitForTransactionReceipt({ hash: walletHash });
          console.log('  Wallet set');
        }
      }

      results.push(result);
      console.log(`  Done`);
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`);
    }

    console.log('');
  }

  // Summary
  console.log('=== Registration Summary ===');
  console.log(`Total: ${results.length} / ${data.agents.length}`);
  console.log('');
  for (const r of results) {
    console.log(`  ${r.name} (${r.slug})`);
    console.log(`    IPFS: ${r.ipfsUri}`);
    if (r.agentId) console.log(`    Agent ID: ${r.agentId}`);
  }
  console.log('============================');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
