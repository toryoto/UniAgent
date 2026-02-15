/**
 * EAS Offchain Attestation URL Encoder
 *
 * DBに保存された { sig, signer } をEAS ScanのURLに変換する。
 * EAS SDK の offchain-utils.ts と同じアルゴリズムを再実装。
 */

import pako from 'pako';
import { fromUint8Array } from 'js-base64';

const EAS_SCAN_BASE = 'https://base-sepolia.easscan.org';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

interface AttestationSignature {
  r: string;
  s: string;
  v: number;
}

interface AttestationMessage {
  version?: number;
  schema: string;
  recipient: string;
  time: string | number | bigint;
  expirationTime: string | number | bigint;
  refUID: string;
  revocable: boolean;
  data: string;
  salt?: string;
}

interface AttestationDomain {
  version: string;
  chainId: string | number | bigint;
  verifyingContract: string;
}

interface SignedAttestationV2 {
  domain: AttestationDomain;
  signature: AttestationSignature;
  uid: string;
  message: AttestationMessage;
  version?: number;
}

/** V1 format has r, s, v at the top level instead of in a signature object */
interface SignedAttestationV1 extends Omit<SignedAttestationV2, 'signature'> {
  r: string;
  s: string;
  v: number;
}

interface AttestationPackage {
  sig: SignedAttestationV2 | SignedAttestationV1;
  signer: string;
}

function isV1(
  sig: SignedAttestationV2 | SignedAttestationV1
): sig is SignedAttestationV1 {
  return 'v' in sig && 'r' in sig && 's' in sig;
}

function normalizeToV2(
  sig: SignedAttestationV2 | SignedAttestationV1
): SignedAttestationV2 {
  if (!isV1(sig)) return sig;
  const { v, r, s, ...rest } = sig;
  return { ...rest, signature: { v, r, s } };
}

function compactPackage(pkg: AttestationPackage): unknown[] {
  const { signer } = pkg;
  const sig = normalizeToV2(pkg.sig);

  return [
    sig.domain.version,
    sig.domain.chainId,
    sig.domain.verifyingContract,
    sig.signature.r,
    sig.signature.s,
    sig.signature.v,
    signer,
    sig.uid,
    sig.message.schema,
    sig.message.recipient === ZERO_ADDRESS ? '0' : sig.message.recipient,
    Number(sig.message.time),
    Number(sig.message.expirationTime),
    sig.message.refUID === ZERO_HASH ? '0' : sig.message.refUID,
    sig.message.revocable,
    sig.message.data,
    0,
    sig.message.version,
    sig.message.salt,
  ];
}

export function buildEasScanUrl(attestation: unknown): string {
  const pkg = attestation as AttestationPackage;
  const compacted = compactPackage(pkg);
  const json = JSON.stringify(compacted, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  );
  const gzipped = pako.deflate(json, { level: 9 });
  const base64 = fromUint8Array(gzipped);
  return `${EAS_SCAN_BASE}/offchain/url/#attestation=${encodeURIComponent(base64)}`;
}
