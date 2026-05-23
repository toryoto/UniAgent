/**
 * set-wallets-for-ids.ts
 *
 * 指定した agentId 範囲に対して setAgentWallet を実行する回復スクリプト。
 * register() は成功したが setAgentWallet がスキップされたエージェントの修復用。
 *
 * Usage:
 *   PRIVATE_KEY=0x... WALLET_ADDRESS=0x... \
 *     npx tsx scripts/set-wallets-for-ids.ts 25 26 28-55
 */

import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { CONTRACT_ADDRESSES } from '@agent-marketplace/shared/config';
import { AGENT_IDENTITY_REGISTRY_ABI } from '@agent-marketplace/shared/contract';

function parseIdArgs(args: string[]): number[] {
  const ids: number[] = [];
  for (const arg of args) {
    if (arg.includes('-')) {
      const [start, end] = arg.split('-').map(Number);
      for (let i = start; i <= end; i++) ids.push(i);
    } else {
      ids.push(Number(arg));
    }
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

async function main() {
  const rawIds = process.argv.slice(2);
  if (rawIds.length === 0) {
    console.error('Usage: tsx set-wallets-for-ids.ts <id|range> ...');
    console.error('Example: tsx set-wallets-for-ids.ts 25 26 28-55');
    process.exit(1);
  }

  const ids = parseIdArgs(rawIds);

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const WALLET_ADDRESS = process.env.WALLET_ADDRESS || process.env.AGENT_RECEIVER_ADDRESS;
  const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || undefined;

  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required');
  if (!WALLET_ADDRESS) throw new Error('WALLET_ADDRESS (or AGENT_RECEIVER_ADDRESS) is required');

  const formattedKey = PRIVATE_KEY.startsWith('0x')
    ? (PRIVATE_KEY as `0x${string}`)
    : (`0x${PRIVATE_KEY}` as `0x${string}`);

  const account = privateKeyToAccount(formattedKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });

  const registryAddr = CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as `0x${string}`;

  console.log(`=== Set Agent Wallets ===`);
  console.log(`IDs:     ${ids.join(', ')}`);
  console.log(`Wallet:  ${WALLET_ADDRESS}`);
  console.log(`Account: ${account.address}`);
  console.log('');

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const agentId of ids) {
    process.stdout.write(`[${agentId}] `);
    try {
      const existing = await publicClient.readContract({
        address: registryAddr,
        abi: AGENT_IDENTITY_REGISTRY_ABI,
        functionName: 'getAgentWallet',
        args: [BigInt(agentId)],
      }) as `0x${string}`;

      if (existing !== '0x0000000000000000000000000000000000000000') {
        console.log(`skip (wallet already set: ${existing})`);
        skipped++;
        continue;
      }

      const hash = await walletClient.writeContract({
        account,
        chain: baseSepolia,
        address: registryAddr,
        abi: AGENT_IDENTITY_REGISTRY_ABI,
        functionName: 'setAgentWallet',
        args: [BigInt(agentId), WALLET_ADDRESS as `0x${string}`],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        console.log(`ERROR: setAgentWallet tx reverted (${hash})`);
        failed++;
      } else {
        console.log(`done (tx: ${hash.slice(0, 18)}...)`);
        success++;
      }
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message.slice(0, 120)}`);
      failed++;
    }
  }

  console.log('');
  console.log(`=== Done: ${success} set, ${skipped} skipped, ${failed} failed ===`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
