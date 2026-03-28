/**
 * update-agent-uri.ts
 *
 * Pinata から消した・壊した IPFS メタデータを、agents.yaml から再生成して pin し直し、
 * 既存の AgentIdentityRegistry トークンに setAgentURI で紐づけ直す。
 *
 * 事前に Base Sepolia のエクスプローラや過去の register トランザクションで
 * 各エージェントの tokenId（agentId）を確認しておくこと。
 *
 * Usage:
 *   PINATA_JWT=... PRIVATE_KEY=... BASE_URL=https://your-a2a-host \
 *     npx tsx scripts/update-agent-uri.ts premium-hotel-search 5 budget-stay-finder 6
 *
 *   --dry-run  Pinata に上げるまで（setAgentURI は送らない）
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { CONTRACT_ADDRESSES, PINATA_GATEWAY_URL } from '@agent-marketplace/shared/config';
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

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildRegistrationMetadata(agent: YamlAgent, baseUrl: string): ERC8004RegistrationFile {
  const root = normalizeBaseUrl(baseUrl);
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: agent.name,
    description: agent.description,
    image:
      agent.image ||
      `https://via.placeholder.com/150/2ecc71/ffffff?text=${encodeURIComponent(agent.slug)}`,
    services: [
      {
        name: 'A2A',
        endpoint: `${root}/${agent.slug}/.well-known/agent.json`,
        version: '1.0.0',
        skills: agent.skills,
        domains: [agent.category],
      },
    ],
    x402Support: true,
    active: true,
    category: agent.category,
  };
}

async function uploadToIPFS(metadata: ERC8004RegistrationFile, name: string): Promise<string> {
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

function parseSlugIdPairs(argv: string[]): Array<{ slug: string; agentId: string }> {
  const rest = argv.filter((a) => a !== '--dry-run');
  if (rest.length < 2 || rest.length % 2 !== 0) {
    throw new Error(
      '引数: <slug> <agentId> をペアで。例: premium-hotel-search 5 budget-stay-finder 6',
    );
  }
  const pairs: Array<{ slug: string; agentId: string }> = [];
  for (let i = 0; i < rest.length; i += 2) {
    const slug = rest[i];
    const agentId = rest[i + 1];
    if (!/^\d+$/.test(agentId)) {
      throw new Error(`agentId は非負整数である必要があります: ${agentId} (slug: ${slug})`);
    }
    pairs.push({ slug, agentId });
  }
  return pairs;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const argv = process.argv.slice(2).filter((a) => a !== '--dry-run');

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
  const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || '';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!isDryRun && !PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY が必要です（--dry-run で IPFS のみ試せます）');
  }

  const pairs = parseSlugIdPairs(argv);

  const yamlPath = resolve(__dirname, '../agents.yaml');
  const raw = readFileSync(yamlPath, 'utf-8');
  const data = parseYaml(raw) as { agents: YamlAgent[] };
  const bySlug = new Map(data.agents.map((a) => [a.slug, a]));

  const registryAddr = CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as `0x${string}`;

  console.log('=== update-agent-uri (IPFS 再 pin + setAgentURI) ===');
  console.log(`Base URL: ${normalizeBaseUrl(BASE_URL)}`);
  console.log(`Pinata Gateway: ${PINATA_GATEWAY_URL}`);
  console.log(`Registry: ${registryAddr}`);
  console.log(`Pairs: ${pairs.map((p) => `${p.slug}#${p.agentId}`).join(', ')}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log('');

  const formattedKey =
    PRIVATE_KEY &&
    (PRIVATE_KEY.startsWith('0x')
      ? (PRIVATE_KEY as `0x${string}`)
      : (`0x${PRIVATE_KEY}` as `0x${string}`));

  const account = !isDryRun && formattedKey ? privateKeyToAccount(formattedKey) : null;
  const publicClient = account
    ? createPublicClient({ transport: http(RPC_URL || undefined) })
    : null;
  const walletClient = account
    ? createWalletClient({ account, transport: http(RPC_URL || undefined) })
    : null;

  if (account) {
    console.log(`Signer: ${account.address}\n`);
  }

  for (const { slug, agentId } of pairs) {
    const agent = bySlug.get(slug);
    if (!agent) {
      console.error(`[SKIP] agents.yaml に slug がありません: ${slug}`);
      continue;
    }

    console.log(`--- ${agent.name} (${slug}) tokenId=${agentId} ---`);

    try {
      const metadata = buildRegistrationMetadata(agent, BASE_URL);
      console.log('  Uploading to Pinata...');
      const ipfsUri = await uploadToIPFS(metadata, `a2a-agent-${slug}-recovery`);
      console.log(`  New IPFS: ${ipfsUri}`);

      if (isDryRun || !walletClient || !publicClient || !account) {
        console.log('  (--dry-run) setAgentURI はスキップ');
        continue;
      }

      const hash = await walletClient.writeContract({
        account,
        chain: baseSepolia,
        address: registryAddr,
        abi: AGENT_IDENTITY_REGISTRY_ABI,
        functionName: 'setAgentURI',
        args: [BigInt(agentId), ipfsUri],
      });
      console.log(`  setAgentURI tx: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        console.error('  トランザクションが失敗しました（トークンの owner か agentId を確認）');
      } else {
        console.log('  完了');
      }
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`);
    }

    console.log('');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
