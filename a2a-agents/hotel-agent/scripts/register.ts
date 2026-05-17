/**
 * Hotel Agent — Pinata IPFS upload + AgentIdentityRegistry on-chain registration.
 * Usage:
 *   tsx scripts/register.ts              # full registration
 *   tsx scripts/register.ts --dry-run    # IPFS upload only, skip on-chain
 *
 * Required env vars (see .env.example):
 *   PINATA_JWT, PRIVATE_KEY, RPC_URL, BASE_URL, AGENT_RECEIVER_ADDRESS
 */

import 'dotenv/config';
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

const isDryRun = process.argv.includes('--dry-run');

const AGENT_SLUG = 'hotel-agent';
const AGENT_NAME = 'HotelSearchAgent';
const AGENT_DESCRIPTION =
  'Real hotel availability search powered by Hotelbeds API. Accepts natural language queries (Japanese/English) and returns live hotel inventory with pricing. Requires: destination city, check-in/check-out dates, number of adults.';
const AGENT_CATEGORY = 'travel';
const AGENT_IMAGE =
  'https://via.placeholder.com/150/1a73e8/ffffff?text=HotelSearch';

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
      /* different event */
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

async function main(): Promise<void> {
  const BASE_URL = normalizeBaseUrl(process.env.BASE_URL ?? 'http://localhost:3004');
  const RPC_URL = process.env.RPC_URL ?? '';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const WALLET_ADDRESS = process.env.AGENT_RECEIVER_ADDRESS ?? '';

  console.log('=== Hotel Agent Registration ===');
  console.log(`Agent:        ${AGENT_NAME} (${AGENT_SLUG})`);
  console.log(`Base URL:     ${BASE_URL}`);
  console.log(`Pinata GW:    ${PINATA_GATEWAY_URL}`);
  console.log(`Registry:     ${CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY}`);
  console.log(`Dry run:      ${isDryRun}`);
  console.log('');

  if (!isDryRun && !PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is required (use --dry-run to skip on-chain)');
  }

  const metadata: ERC8004RegistrationFile = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: AGENT_NAME,
    description: AGENT_DESCRIPTION,
    image: AGENT_IMAGE,
    services: [
      {
        name: 'A2A',
        endpoint: `${BASE_URL}/${AGENT_SLUG}/.well-known/agent.json`,
        version: '1.0.0',
        skills: [
          {
            id: 'hotel-availability-search',
            name: 'Hotel Availability Search',
            description:
              'Search real hotel availability with live rates from Hotelbeds. Provide destination, dates, and guest count in natural language.',
          },
        ],
        domains: [AGENT_CATEGORY],
      },
    ],
    x402Support: true,
    active: true,
    category: AGENT_CATEGORY,
  };

  console.log('Uploading to IPFS...');
  const ipfsUri = await uploadToIPFS(metadata, `hotel-agent-${AGENT_SLUG}`);
  console.log(`IPFS URI: ${ipfsUri}`);

  if (isDryRun) {
    console.log('\n[Dry run] Skipping on-chain registration.');
    return;
  }

  const formattedKey = (
    PRIVATE_KEY!.startsWith('0x') ? PRIVATE_KEY! : `0x${PRIVATE_KEY!}`
  ) as `0x${string}`;

  const account = privateKeyToAccount(formattedKey);
  console.log(`\nUsing account: ${account.address}`);

  const publicClient = createPublicClient({ transport: http(RPC_URL || undefined) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL || undefined) });

  console.log('Registering on-chain...');
  const hash = await walletClient.writeContract({
    account,
    chain: baseSepolia,
    address: CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as `0x${string}`,
    abi: AGENT_IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [ipfsUri],
  });

  console.log(`Tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'reverted') {
    throw new Error(`register tx reverted: ${hash}`);
  }

  const registryAddr = CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as `0x${string}`;
  const agentId = parseAgentIdFromRegisterReceipt(receipt, registryAddr);

  if (!agentId) {
    console.warn('Could not parse agentId from receipt');
  } else {
    console.log(`Agent ID: ${agentId}`);
  }

  if (agentId && WALLET_ADDRESS) {
    await publicClient.readContract({
      address: registryAddr,
      abi: AGENT_IDENTITY_REGISTRY_ABI,
      functionName: 'ownerOf',
      args: [BigInt(agentId)],
    });

    console.log('Setting agent wallet...');
    const walletHash = await walletClient.writeContract({
      account,
      chain: baseSepolia,
      address: registryAddr,
      abi: AGENT_IDENTITY_REGISTRY_ABI,
      functionName: 'setAgentWallet',
      args: [BigInt(agentId), WALLET_ADDRESS as `0x${string}`],
    });
    const walletReceipt = await publicClient.waitForTransactionReceipt({ hash: walletHash });
    if (walletReceipt.status === 'reverted') {
      throw new Error(`setAgentWallet tx reverted: ${walletHash}`);
    }
    console.log('Agent wallet set');
  }

  console.log('\n=== Registration Complete ===');
  console.log(`  Name:     ${AGENT_NAME}`);
  console.log(`  IPFS URI: ${ipfsUri}`);
  if (agentId) console.log(`  Agent ID: ${agentId}`);
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});
