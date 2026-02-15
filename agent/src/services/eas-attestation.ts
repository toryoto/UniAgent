/**
 * EAS Offchain Attestation Service
 *
 * エージェント評価結果を EAS オフチェーンアテステーションとして署名し DB に保存する
 */


import { createRequire } from 'node:module';

type EASModule = typeof import('@ethereum-attestation-service/eas-sdk');
const require = createRequire(import.meta.url);
const { EAS, SchemaEncoder } = require('@ethereum-attestation-service/eas-sdk') as EASModule;
import { ethers } from 'ethers';
import type { Prisma } from '@agent-marketplace/database';
import { createAttestation } from './attestation-db.js';
import { logger } from '../utils/logger.js';

/** Base Sepolia EAS contract */
const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';
const CHAIN_ID = 84532;

/** デプロイ済みスキーマ */
const SCHEMA =
  'uint256 agentId, bytes32 paymentTx, uint256 chainId, uint8 quality, uint8 reliability, uint32 latency, uint64 timestamp, string[] tags';

export interface AttestationInput {
  agentId: string;
  paymentTx?: string;
  quality: number;
  reliability: number;
  latency: number;
  tags: string[];
  reasoning?: string;
}

export async function signAndStoreAttestation(input: AttestationInput) {
  const signerPrivateKey = process.env.EAS_SIGNER_PRIVATE_KEY;
  const schemaUid = process.env.EAS_SCHEMA_UID;

  if (!signerPrivateKey || !schemaUid) {
    throw new Error('EAS_SIGNER_PRIVATE_KEY and EAS_SCHEMA_UID environment variables must be set');
  }

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error('RPC_URL environment variable must be set');
  }

  // 1. Signer
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(signerPrivateKey, provider);

  // 2. EAS Offchain インスタンス
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eas.connect(signer as any);
  const offchain = await eas.getOffchain();

  // 3. スキーマエンコード
  const schemaEncoder = new SchemaEncoder(SCHEMA);

  const agentIdBigInt = BigInt(input.agentId.startsWith('0x') ? input.agentId : `0x${input.agentId}`);
  const paymentTxBytes32 = input.paymentTx
    ? ethers.zeroPadValue(input.paymentTx, 32)
    : ethers.ZeroHash;
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

  const encodedData = schemaEncoder.encodeData([
    { name: 'agentId', value: agentIdBigInt, type: 'uint256' },
    { name: 'paymentTx', value: paymentTxBytes32, type: 'bytes32' },
    { name: 'chainId', value: BigInt(CHAIN_ID), type: 'uint256' },
    { name: 'quality', value: input.quality, type: 'uint8' },
    { name: 'reliability', value: input.reliability, type: 'uint8' },
    { name: 'latency', value: input.latency, type: 'uint32' },
    { name: 'timestamp', value: nowSeconds, type: 'uint64' },
    { name: 'tags', value: input.tags, type: 'string[]' },
  ]);

  // 4. オフチェーン署名（ガスレス）
  const attestation = await offchain.signOffchainAttestation(
    {
      recipient: ethers.ZeroAddress,
      expirationTime: BigInt(0),
      time: nowSeconds,
      revocable: true,
      refUID: ethers.ZeroHash,
      schema: schemaUid,
      data: encodedData,
    },
    signer
  );

  // EAS Scan で読み込める形式（sig + signer）に整形
  const easScanFormat = {
    sig: attestation,
    signer: signer.address,
  };

  logger.logic.success('EAS offchain attestation signed', {
    agentId: input.agentId,
    quality: input.quality,
    reliability: input.reliability,
    attester: signer.address,
  });

  // 5. BigInt を string に変換して JSON シリアライズ可能にする
  const serializable = JSON.parse(
    JSON.stringify(easScanFormat, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  ) as Prisma.InputJsonValue;

  // 6. DB 保存
  const record = await createAttestation({
    agentId: input.agentId,
    schemaUid,
    attestation: serializable,
    attester: signer.address,
    paymentTx: input.paymentTx,
    chainId: CHAIN_ID,
    quality: input.quality,
    reliability: input.reliability,
    latency: input.latency,
    tags: input.tags,
    reasoning: input.reasoning,
  });

  return { attestation: serializable, dbRecord: record };
}
