/**
 * Pinata IPFS Service
 *
 * ERC-8004 Registration FileをIPFSにアップロード/フェッチするサービス
 */

import { uploadJson, type PinataConfig } from 'pinata';
import type { ERC8004RegistrationFile } from '../types.js';

const PINATA_GATEWAY_URL =
  process.env.PINATA_GATEWAY_URL || process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || '';

function getPinataConfig(): PinataConfig {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error('PINATA_JWT environment variable is required');
  }
  return {
    pinataJwt: jwt,
    pinataGateway: PINATA_GATEWAY_URL,
  };
}

/**
 * ERC-8004 Registration FileをPinata経由でIPFSにアップロード
 * @param metadata ERC-8004 Registration File
 * @param name Optional file name for Pinata
 * @returns IPFS URI (ipfs://<CID>)
 */
export async function uploadAgentMetadata(
  metadata: ERC8004RegistrationFile,
  name?: string
): Promise<string> {
  const config = getPinataConfig();

  const result = await uploadJson(
    config,
    metadata as unknown as Record<string, unknown>,
    'public',
    { metadata: { name: name || `agent-${metadata.name}` } }
  );

  return `ipfs://${result.cid}`;
}

/**
 * IPFS URIからERC-8004 Registration Fileを取得
 * @param ipfsUri IPFS URI (ipfs://<CID> or CID string)
 * @returns ERC-8004 Registration File
 */
export async function fetchAgentMetadata(ipfsUri: string): Promise<ERC8004RegistrationFile> {
  const cid = ipfsUri.replace('ipfs://', '');

  // Try Pinata gateway first, then public gateway
  const gatewayUrl = PINATA_GATEWAY_URL
    ? `https://${PINATA_GATEWAY_URL}/ipfs/${cid}`
    : `https://gateway.pinata.cloud/ipfs/${cid}`;

  const response = await fetch(gatewayUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch IPFS metadata: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ERC8004RegistrationFile;
}
