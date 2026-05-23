/**
 * 一括 IPFS + register 系スクリプトから除外する slug（手動管理・既登録など）
 */
export const SKIP_BULK_REGISTRATION_SLUGS = new Set([
  'premium-hotel-search',
  'budget-stay-finder',
  // Already registered on-chain (IDs 25, 26) — skipped on first bulk run due to ownerOf verification error
  'luxury-concierge',
  'family-hotel-expert',
]);
