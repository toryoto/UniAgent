/**
 * agents.yaml から IPFS (Pinata) → register → setAgentWallet までの一括処理。
 * register-all.ts / register-reupload.ts から利用。
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  getAddress,
} from 'viem';
import type { TransactionReceipt } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  CONTRACT_ADDRESSES,
  PINATA_GATEWAY_URL,
} from '@agent-marketplace/shared/config';
import { AGENT_IDENTITY_REGISTRY_ABI } from '@agent-marketplace/shared/contract';
import type { ERC8004RegistrationFile } from '@agent-marketplace/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ZERO_ADDR_TOPIC =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function parseAgentIdFromRegisterReceipt(
  receipt: TransactionReceipt,
  registryAddress: `0x${string}`,
): string | undefined {
  const registryLc = getAddress(registryAddress).toLowerCase();

  for (const log of receipt.logs) {
    if (getAddress(log.address).toLowerCase() !== registryLc) continue;
    try {
      const decoded = decodeEventLog({
        abi: AGENT_IDENTITY_REGISTRY_ABI,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
      if (decoded.eventName === 'Registered') {
        const { agentId } = decoded.args as unknown as { agentId: bigint };
        return agentId.toString();
      }
    } catch {
      /* 別イベント */
    }
  }

  for (const log of receipt.logs) {
    if (getAddress(log.address).toLowerCase() !== registryLc) continue;
    if (log.topics.length !== 4 || log.topics[1] !== ZERO_ADDR_TOPIC) continue;
    try {
      const decoded = decodeEventLog({
        abi: AGENT_IDENTITY_REGISTRY_ABI,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
      if (decoded.eventName !== 'Transfer') continue;
      const { from, tokenId } = decoded.args as unknown as {
        from: `0x${string}`;
        tokenId: bigint;
      };
      if (getAddress(from) === getAddress('0x0000000000000000000000000000000000000000')) {
        return tokenId.toString();
      }
    } catch {
      /* skip */
    }
  }

  return undefined;
}

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

export async function runBulkRegistration(options: {
  title: string;
  skipSlugs: Set<string>;
}): Promise<void> {
  const { title, skipSlugs } = options;
  const isDryRun = process.argv.includes('--dry-run');

  const BASE_URL_RAW = process.env.BASE_URL || 'http://localhost:3003';
  const BASE_URL = normalizeBaseUrl(BASE_URL_RAW);
  const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || '';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const WALLET_ADDRESS = process.env.AGENT_RECEIVER_ADDRESS || '';

  if (!isDryRun && !PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required for on-chain registration (use --dry-run to skip)');
  }

  const yamlPath = resolve(__dirname, '../agents.yaml');
  const raw = readFileSync(yamlPath, 'utf-8');
  const data = parseYaml(raw) as { agents: YamlAgent[] };

  const agentsToRegister = data.agents.filter((a) => !skipSlugs.has(a.slug));
  const skippedAgents = data.agents.filter((a) => skipSlugs.has(a.slug));

  console.log(`=== ${title} ===`);
  console.log(`Agents in yaml: ${data.agents.length} (registering: ${agentsToRegister.length})`);
  if (skippedAgents.length > 0) {
    console.log(`Skipped slugs: ${skippedAgents.map((a) => a.slug).join(', ')}`);
  }
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Pinata Gateway: ${PINATA_GATEWAY_URL}`);
  console.log(`Registry: ${CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log('');

  const results: Array<{ name: string; slug: string; ipfsUri: string; agentId?: string }> = [];

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
    console.log(`Using account: ${account.address}`);
    console.log('');
  }

  for (let i = 0; i < agentsToRegister.length; i++) {
    const agent = agentsToRegister[i];
    console.log(`[${i + 1}/${agentsToRegister.length}] ${agent.name} (${agent.slug})`);

    try {
      const metadata: ERC8004RegistrationFile = {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: agent.name,
        description: agent.description,
        image:
          agent.image ||
          `https://via.placeholder.com/150/2ecc71/ffffff?text=${encodeURIComponent(agent.slug)}`,
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

      console.log('  Uploading to IPFS...');
      const ipfsUri = await uploadToIPFS(metadata, `a2a-agent-${agent.slug}`);
      console.log(`  IPFS: ${ipfsUri}`);

      const result: (typeof results)[number] = { name: agent.name, slug: agent.slug, ipfsUri };

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

        if (receipt.status === 'reverted') {
          throw new Error(
            `register tx reverted on-chain: ${hash}（Basescan で status / logs を確認）`,
          );
        }

        const registryAddr = CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as `0x${string}`;
        const parsedId = parseAgentIdFromRegisterReceipt(receipt, registryAddr);
        if (parsedId) {
          result.agentId = parsedId;
          console.log(`  Agent ID: ${result.agentId}`);
        } else {
          console.warn('  Could not parse agentId from receipt (Registered / mint Transfer)');
        }

        if (result.agentId && WALLET_ADDRESS) {
          try {
            await publicClient.readContract({
              address: registryAddr,
              abi: AGENT_IDENTITY_REGISTRY_ABI,
              functionName: 'ownerOf',
              args: [BigInt(result.agentId)],
            });
          } catch {
            throw new Error(
              `レシートでは agentId=${result.agentId} と解釈したが ownerOf が revert しました。tx ${hash} をエクスプローラで確認し、別トークン ID の可能性や reorg を疑ってください。`,
            );
          }

          console.log('  Setting agent wallet...');
          const walletHash = await walletClient.writeContract({
            account,
            chain: baseSepolia,
            address: registryAddr,
            abi: AGENT_IDENTITY_REGISTRY_ABI,
            functionName: 'setAgentWallet',
            args: [BigInt(result.agentId), WALLET_ADDRESS as `0x${string}`],
          });
          const walletReceipt = await publicClient.waitForTransactionReceipt({ hash: walletHash });
          if (walletReceipt.status === 'reverted') {
            throw new Error(`setAgentWallet tx reverted: ${walletHash}`);
          }
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

  console.log('=== Registration Summary ===');
  console.log(
    `Registered: ${results.length} / ${agentsToRegister.length} (excluded from bulk: ${skippedAgents.length})`,
  );
  console.log('');
  for (const r of results) {
    console.log(`  ${r.name} (${r.slug})`);
    console.log(`    IPFS: ${r.ipfsUri}`);
    if (r.agentId) console.log(`    Agent ID: ${r.agentId}`);
  }
  console.log('============================');
}
