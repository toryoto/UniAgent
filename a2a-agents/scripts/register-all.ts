/**
 * register-all.ts
 *
 * agents.yaml のエージェントを一括で（SKIP_BULK_REGISTRATION_SLUGS を除く）:
 *   1. ERC-8004 メタデータを IPFS にアップロード (Pinata)
 *   2. AgentIdentityRegistry にオンチェーン登録
 *   3. setAgentWallet でウォレット設定
 *
 * 再アップロード用は register-reupload.ts（処理は同一・バナー文言のみ異なる）
 *
 * Usage:
 *   PINATA_JWT=... PRIVATE_KEY=0x... （64 hex のみでも可）BASE_URL=http://localhost:3003 \
 *     npx tsx scripts/register-all.ts
 *
 *   --dry-run  : IPFS アップロードのみ（オンチェーン登録をスキップ）
 */

import 'dotenv/config';
import { SKIP_BULK_REGISTRATION_SLUGS } from './register-skip-slugs.js';
import { runBulkRegistration } from './run-bulk-registration.js';

void runBulkRegistration({
  title: 'A2A Agents Bulk Registration',
  skipSlugs: SKIP_BULK_REGISTRATION_SLUGS,
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
