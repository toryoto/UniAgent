/**
 * Formatting Utilities
 *
 * 数値、日付、アドレスなどのフォーマット関数
 */

import { formatUSDCAmount } from '@agent-marketplace/shared';

/**
 * UI表示用のUSDCの金額をフォーマット（6 decimals）
 */
export function formatUSDC(amount: bigint | string): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const dollars = formatUSDCAmount(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(dollars);
}

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 10) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(2);
}

export function formatRelativeTime(timestamp: Date | bigint): string {
  const date = timestamp instanceof Date ? timestamp : new Date(Number(timestamp) * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}秒前`;
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return date.toLocaleDateString('ja-JP');
}

export function formatDate(timestamp: Date | bigint): string {
  const date = timestamp instanceof Date ? timestamp : new Date(Number(timestamp) * 1000);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    travel: '旅行',
    finance: '金融',
    health: '健康',
    education: '教育',
    entertainment: 'エンターテイメント',
    productivity: '生産性',
    other: 'その他',
  };
  return categoryMap[category.toLowerCase()] || category;
}
