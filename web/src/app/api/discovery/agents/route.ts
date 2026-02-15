/**
 * Discovery Agents API
 *
 * DB(AgentCache) からエージェントを検索して返す。
 * フィルタ・マッピングロジックは packages/shared, packages/database に集約。
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { discoverAgents } from '@agent-marketplace/database';
import type { DiscoveredAgent } from '@agent-marketplace/shared';
import type { ApiResponse, DiscoveryApiResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  maxPrice: z
    .preprocess(
      (v) => (v === undefined || v === null || v === '' ? undefined : v),
      z.coerce.number()
    )
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), 'maxPrice must be >= 0')
    .optional(),
  limit: z
    .preprocess(
      (v) => (v === undefined || v === null || v === '' ? undefined : v),
      z.coerce.number()
    )
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 100),
      'limit must be 1-100'
    )
    .optional()
    .default(30),
  offset: z
    .preprocess(
      (v) => (v === undefined || v === null || v === '' ? undefined : v),
      z.coerce.number()
    )
    .refine((v) => v === undefined || (Number.isInteger(v) && v >= 0), 'offset must be >= 0')
    .optional()
    .default(0),
  sortBy: z.enum(['price', 'newest']).optional().default('newest'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      q: sp.get('q') ?? undefined,
      category: sp.get('category') ?? undefined,
      maxPrice: sp.get('maxPrice') ?? undefined,
      limit: sp.get('limit') ?? undefined,
      offset: sp.get('offset') ?? undefined,
      sortBy: sp.get('sortBy') ?? undefined,
      sortOrder: sp.get('sortOrder') ?? undefined,
    });

    if (!parsed.success) {
      const res: ApiResponse<never> = {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid query',
      };
      return NextResponse.json(res, { status: 400 });
    }

    const { q, category, maxPrice, limit, offset, sortBy, sortOrder } = parsed.data;

    // DB + shared ロジックでフィルタ済みの DiscoveredAgent[] を取得
    const result = await discoverAgents({ q, category, maxPrice });

    let agents: DiscoveredAgent[] = result.agents;

    // Sorting
    const dir = sortOrder === 'asc' ? 1 : -1;
    agents = [...agents].sort((a, b) => {
      if (sortBy === 'price') return dir * (a.price - b.price);
      return 0; // newest: DB の updatedAt 順を維持
    });

    // Pagination
    const total = agents.length;
    const page = agents.slice(offset, offset + limit);

    const data: DiscoveryApiResponse = { agents: page, total };
    const res: ApiResponse<DiscoveryApiResponse> = { success: true, data };
    return NextResponse.json(res);
  } catch (e) {
    const res: ApiResponse<never> = {
      success: false,
      error: e instanceof Error ? e.message : 'Internal server error',
    };
    return NextResponse.json(res, { status: 500 });
  }
}
