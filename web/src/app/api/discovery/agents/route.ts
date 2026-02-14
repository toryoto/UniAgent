import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { USDC_DECIMALS } from '@agent-marketplace/shared';
import type { ERC8004AgentCard, ApiResponse, DiscoveryApiResponse } from '@/lib/types';

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

/** agentCard JSON + DB 行から ERC8004AgentCard を組み立てる */
function toAgentCard(
  json: unknown,
  row: { agentId: string; owner: string | null }
): ERC8004AgentCard | null {
  if (!json || typeof json !== 'object') return null;
  const card = json as Record<string, unknown>;
  if (!card.name) return null;
  return {
    ...(card as unknown as ERC8004AgentCard),
    agentId: row.agentId,
    owner: row.owner ?? undefined,
  };
}

function priceUsdc(card: ERC8004AgentCard): number {
  const raw = card.payment?.pricePerCall ?? card.payment?.price;
  if (!raw) return 0;
  return Number(raw) / Math.pow(10, USDC_DECIMALS);
}

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

    const rows = await prisma.agentCache.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    const agents = rows
      .map((r) => toAgentCard(r.agentCard, { agentId: r.agentId, owner: r.owner }))
      .filter((v): v is ERC8004AgentCard => v !== null);

    const qLower = q?.toLowerCase() ?? '';

    const filtered = agents.filter((a) => {
      if (qLower) {
        const a2a = a.services?.find((s) => s.name === 'A2A');
        const hay = [
          a.name,
          a.description,
          a.category ?? '',
          ...(a2a?.skills?.map((s) => s.name) ?? []),
          ...(a2a?.skills?.map((s) => s.description) ?? []),
        ]
          .map((s) => (typeof s === 'string' ? s.toLowerCase() : ''))
          .join(' ');
        if (!hay.includes(qLower)) return false;
      }
      if (typeof maxPrice === 'number' && priceUsdc(a) > maxPrice) return false;
      return true;
    });

    const dir = sortOrder === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'price') return dir * (priceUsdc(a) - priceUsdc(b));
      return 0; // newest: DB の updatedAt 順を維持
    });

    const total = sorted.length;
    const page = sorted.slice(offset, offset + limit);

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
