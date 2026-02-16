/**
 * EAS Offchain Attestation (v2) URL Encoder
 *
 * DBに保存された { sig, signer } をEAS ScanのURLに変換する。
 * attestation-sample.json と同形式の v2 固定。
 */

import pako from 'pako';
import { fromUint8Array } from 'js-base64';

const EAS_SCAN_BASE = 'https://base-sepolia.easscan.org';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

interface AttestationV2 {
  sig: {
    domain: { version: string; chainId: string | number; verifyingContract: string };
    signature: { r: string; s: string; v: number };
    uid: string;
    message: {
      schema: string;
      recipient: string;
      time: string | number;
      expirationTime: string | number;
      refUID: string;
      revocable: boolean;
      data: string;
      version?: number;
      salt?: string;
    };
  };
  signer: string;
}

function compactAttestationV2(a: AttestationV2): unknown[] {
  const { sig, signer } = a;
  const { domain, signature, uid, message } = sig;
  return [
    domain.version,
    domain.chainId,
    domain.verifyingContract,
    signature.r,
    signature.s,
    signature.v, // signature.v は回復識別子であり、署名から公開鍵を復旧するために使われる。
    signer,
    uid,
    message.schema,
    message.recipient === ZERO_ADDRESS ? '0' : message.recipient,
    Number(message.time),
    Number(message.expirationTime),
    message.refUID === ZERO_HASH ? '0' : message.refUID,
    message.revocable,
    message.data,
    0,
    message.version,
    message.salt,
  ];
}

export function buildEasScanUrl(attestation: unknown): string {
  const compacted = compactAttestationV2(attestation as AttestationV2);
  const json = JSON.stringify(compacted);
  const base64 = fromUint8Array(pako.deflate(json, { level: 9 }));
  return `${EAS_SCAN_BASE}/offchain/url/#attestation=${encodeURIComponent(base64)}`;
}
