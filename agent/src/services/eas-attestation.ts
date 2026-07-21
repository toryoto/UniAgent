/**
 * @module services/eas-attestation
 * EAS オフチェーンアテステーション署名サービス。
 * エージェント評価結果を EIP-712 で署名し、DB に保存する。
 */

import { createRequire } from 'node:module';

type EASModule = typeof import('@ethereum-attestation-service/eas-sdk');
const require = createRequire(import.meta.url);
const { EAS, SchemaEncoder } = require('@ethereum-attestation-service/eas-sdk') as EASModule;
import { ethers } from 'ethers';
import type { Prisma } from '@agent-marketplace/database';
import { createAttestation } from './attestation-db.js';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('logic');
import { EAS_CONTRACT_ADDRESS, EAS_SCHEMA, CHAIN_ID } from '../config/constants.js';
import type { AttestationInput } from '../types/index.js';

// ── Public ────────────────────────────────────────────────────────────────

/**
 * EAS オフチェーンアテステーションに署名し、DB に保存する。
 *
 * フロー:
 * 1. 環境変数からプライベートキーで署名者を作成
 * 2. EAS SDK でスキーマエンコード
 * 3. オフチェーン署名（ガスレス）
 * 4. DB に保存
 *
 * @param input - アテステーション入力（agentId, スコア, タグなど）
 * @returns 署名済みアテステーションと DB レコード
 * @throws EAS_SIGNER_PRIVATE_KEY / EAS_SCHEMA_UID / RPC_URL 未設定時
 */
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

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(signerPrivateKey, provider);

  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eas.connect(signer as any);
  const offchain = await eas.getOffchain();

  const schemaEncoder = new SchemaEncoder(EAS_SCHEMA);

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
    signer,
  );

  const easScanFormat = { sig: attestation, signer: signer.address };

  log.info(
    { agentId: input.agentId, quality: input.quality, reliability: input.reliability, attester: signer.address },
    'EAS offchain attestation signed',
  );

  const serializable = JSON.parse(
    JSON.stringify(easScanFormat, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  ) as Prisma.InputJsonValue;

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
