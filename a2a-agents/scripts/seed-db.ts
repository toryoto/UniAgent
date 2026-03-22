/**
 * seed-db.ts
 *
 * agents.yaml の全エージェントを AgentCache に登録し、
 * ランキングアルゴリズムテスト用に EasAttestation と AgentStake もシードする。
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/seed-db.ts
 *
 * Options:
 *   --clean    : 既存のシードデータを削除してから再作成
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { prisma } from '@agent-marketplace/database';

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
  qualityLevel: string;
  responseFormat: string;
  requestFormat: string;
  skills: YamlSkill[];
  image?: string;
}

function dollarToPricePerCall(dollar: string): string {
  const amount = parseFloat(dollar.replace('$', ''));
  return Math.round(amount * 1_000_000).toString();
}

const QUALITY_SCORE_RANGES: Record<string, { quality: [number, number]; reliability: [number, number] }> = {
  high: { quality: [75, 95], reliability: [85, 100] },
  medium: { quality: [45, 70], reliability: [55, 80] },
  low: { quality: [15, 40], reliability: [30, 55] },
  unreliable: { quality: [5, 35], reliability: [5, 40] },
};

const ATTESTATION_COUNT_RANGES: Record<string, [number, number]> = {
  high: [5, 20],
  medium: [2, 12],
  low: [0, 8],
  unreliable: [1, 10],
};

const STAKE_RANGES: Record<string, [number, number]> = {
  high: [100, 500],
  medium: [20, 200],
  low: [0, 50],
  unreliable: [0, 30],
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomDate(daysAgoMin: number, daysAgoMax: number): Date {
  const daysAgo = randInt(daysAgoMin, daysAgoMax);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

async function main() {
  const isClean = process.argv.includes('--clean');

  const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
  const OWNER_ADDRESS = process.env.AGENT_RECEIVER_ADDRESS || '0x25b61126EED206F6470533C073DDC3B4157bb6d1';
  const ATTESTER_ADDRESS = process.env.ATTESTER_ADDRESS || '0x0000000000000000000000000000000000000001';

  const yamlPath = resolve(__dirname, '../agents.yaml');
  const raw = readFileSync(yamlPath, 'utf-8');
  const data = parseYaml(raw) as { agents: YamlAgent[] };

  console.log(`=== Seed Database ===`);
  console.log(`Agents: ${data.agents.length}`);
  console.log(`Clean: ${isClean}`);
  console.log('');

  if (isClean) {
    const agentIds = data.agents.map((_, i) => agentIdForIndex(i));
    console.log('Cleaning existing seed data...');
    await prisma.easAttestation.deleteMany({ where: { agentId: { in: agentIds } } });
    await prisma.agentStake.deleteMany({ where: { agentId: { in: agentIds } } });
    await prisma.agentCache.deleteMany({ where: { agentId: { in: agentIds } } });
    console.log('Cleaned.');
    console.log('');
  }

  let attestationCount = 0;

  for (let i = 0; i < data.agents.length; i++) {
    const agent = data.agents[i];
    const agentId = agentIdForIndex(i);
    const qualityLevel = agent.qualityLevel as keyof typeof QUALITY_SCORE_RANGES;
    const createdAt = randomDate(0, 90);

    console.log(`[${i + 1}/${data.agents.length}] ${agent.name} (${agentId})`);

    const agentCard = JSON.parse(JSON.stringify({
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
      payment: {
        tokenAddress: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
        receiverAddress: OWNER_ADDRESS,
        pricePerCall: dollarToPricePerCall(agent.price),
        price: agent.price,
        network: 'base-sepolia',
        chain: 'eip155:84532',
      },
    }));

    // 1. AgentCache
    await prisma.agentCache.upsert({
      where: { agentId },
      create: {
        agentId,
        owner: OWNER_ADDRESS,
        category: agent.category,
        isActive: true,
        agentCard,
        lastSyncedBlock: 0,
        lastSyncedLogIdx: 0,
        createdAt,
      },
      update: {
        owner: OWNER_ADDRESS,
        category: agent.category,
        isActive: true,
        agentCard,
        createdAt,
      },
    });

    // 2. AgentStake
    const stakeRange = STAKE_RANGES[qualityLevel] ?? [0, 100];
    const stakedAmount = randFloat(stakeRange[0], stakeRange[1]);

    await prisma.agentStake.upsert({
      where: { agentId },
      create: {
        agentId,
        stakedAmount,
        unstakeRequestAmount: 0,
      },
      update: {
        stakedAmount,
      },
    });

    // 3. EasAttestations
    const attRange = ATTESTATION_COUNT_RANGES[qualityLevel] ?? [0, 5];
    const numAttestations = randInt(attRange[0], attRange[1]);
    const scoreRange = QUALITY_SCORE_RANGES[qualityLevel] ?? { quality: [30, 70], reliability: [30, 70] };

    for (let j = 0; j < numAttestations; j++) {
      const quality = randInt(scoreRange.quality[0], scoreRange.quality[1]);
      const reliability = randInt(scoreRange.reliability[0], scoreRange.reliability[1]);

      await prisma.easAttestation.create({
        data: {
          agentId,
          schemaUid: '0x0000000000000000000000000000000000000000000000000000000000000000',
          attestation: {
            sig: { v: 0, r: '0x', s: '0x' },
            signer: ATTESTER_ADDRESS,
          },
          attester: ATTESTER_ADDRESS,
          paymentTx: null,
          chainId: 84532,
          quality,
          reliability,
          latency: randInt(200, qualityLevel === 'unreliable' ? 10000 : 3000),
          tags: generateTags(qualityLevel),
          reasoning: `Seed data for ${agent.name} (${qualityLevel} quality)`,
          createdAt: randomDate(0, 60),
        },
      });
      attestationCount++;
    }

    console.log(`  Stake: ${stakedAmount.toFixed(2)} USDC, Attestations: ${numAttestations}, Created: ${createdAt.toISOString().slice(0, 10)}`);
  }

  console.log('');
  console.log('=== Seed Summary ===');
  console.log(`AgentCache: ${data.agents.length}`);
  console.log(`AgentStake: ${data.agents.length}`);
  console.log(`EasAttestation: ${attestationCount}`);
  console.log('====================');

  await prisma.$disconnect();
}

function agentIdForIndex(index: number): string {
  return `seed-${(index + 1).toString().padStart(4, '0')}`;
}

function generateTags(qualityLevel: string): string[] {
  const baseTags = ['hotel', 'travel'];
  switch (qualityLevel) {
    case 'high':
      return [...baseTags, 'reliable', 'detailed', 'accurate'];
    case 'medium':
      return [...baseTags, 'functional', 'basic'];
    case 'low':
      return [...baseTags, 'incomplete', 'inaccurate'];
    case 'unreliable':
      return [...baseTags, 'unstable', 'slow'];
    default:
      return baseTags;
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
