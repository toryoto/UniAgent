/**
 * register-reupload.ts
 *
 * IPFS からやり直す一括フロー（register-all と同じ処理）。
 * メタデータ修正・BASE_URL 修正後の再 pin / 新規 register 用。
 * premium-hotel-search / budget-stay-finder は register-skip-slugs で除外。
 *
 * Usage:
 *   PINATA_JWT=... PRIVATE_KEY=... BASE_URL=https://a2a-agent-production-....up.railway.app \
 *     npm run register-reupload --workspace=a2a-agents
 *
 *   --dry-run  : IPFS のみ
 */

import 'dotenv/config';
import { SKIP_BULK_REGISTRATION_SLUGS } from './register-skip-slugs.js';
import { runBulkRegistration } from './run-bulk-registration.js';

void runBulkRegistration({
  title: 'A2A Agents Bulk Re-upload (IPFS → on-chain)',
  skipSlugs: SKIP_BULK_REGISTRATION_SLUGS,
}).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
