/**
 * @module core/thread-cost-store
 * HITL resume をまたいで thread ごとの累積決済コスト (USDC) を保持する in-memory ストア。
 * checkpointer (MemorySaver) と同じくプロセス内限定のライフサイクルで、
 * resume 時のコストリセット（予算超過の見逃し）を防ぐために使う。
 */

/** メモリ肥大防止の上限。超えたら挿入順で最古の thread から破棄する。 */
const MAX_TRACKED_THREADS = 1000;

const costsByThread = new Map<string, number>();

/** thread の累積コストを取得する（未登録は 0） */
export function getThreadCost(threadId: string): number {
  return costsByThread.get(threadId) ?? 0;
}

/** thread の累積コストを記録する */
export function setThreadCost(threadId: string, totalCost: number): void {
  if (!costsByThread.has(threadId) && costsByThread.size >= MAX_TRACKED_THREADS) {
    const oldest = costsByThread.keys().next().value;
    if (oldest !== undefined) costsByThread.delete(oldest);
  }
  costsByThread.set(threadId, totalCost);
}
