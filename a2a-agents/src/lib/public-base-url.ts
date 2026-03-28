import type { Request } from 'express';

function isLocalHost(host: string): boolean {
  const h = host.split(':')[0].toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/**
 * agent.json / OpenAPI に載せる公開ベース URL。
 * ローカル以外は常に https（プロキシ内で req.protocol が http でも矯正し、POST→リダイレクト→GET を防ぐ）。
 */
export function getPublicBaseUrl(req: Request): string {
  const host = req.get('host') || `localhost:${process.env.PORT || '3003'}`;
  const proto = isLocalHost(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}
