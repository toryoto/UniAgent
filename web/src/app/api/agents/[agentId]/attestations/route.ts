/**
 * Agent Attestations API
 *
 * 指定エージェントのEASオフチェーンattestationを返す。
 * 各attestationにEAS ScanのURLを付与。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@agent-marketplace/database';
import type { ApiResponse } from '@/lib/types';
import { buildEasScanUrl } from '@/lib/eas/encode-offchain-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AttestationResponse {
  id: string;
  quality: number;
  reliability: number;
  latency: number;
  tags: string[];
  reasoning: string | null;
  attester: string;
  paymentTx: string | null;
  easScanUrl: string;
  createdAt: string;
}

export interface AttestationsApiResponse {
  attestations: AttestationResponse[];
  summary: {
    count: number;
    avgQuality: number;
    avgReliability: number;
    avgLatency: number;
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const rows = await prisma.easAttestation.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });

    const attestations: AttestationResponse[] = rows.map((row) => ({
      id: row.id,
      quality: row.quality,
      reliability: row.reliability,
      latency: row.latency,
      tags: row.tags,
      reasoning: row.reasoning,
      attester: row.attester,
      paymentTx: row.paymentTx,
      easScanUrl: buildEasScanUrl(row.attestation),
      createdAt: row.createdAt.toISOString(),
    }));

    const count = attestations.length;
    const summary = {
      count,
      avgQuality:
        count > 0
          ? Math.round(
              attestations.reduce((s, a) => s + a.quality, 0) / count
            )
          : 0,
      avgReliability:
        count > 0
          ? Math.round(
              attestations.reduce((s, a) => s + a.reliability, 0) / count
            )
          : 0,
      avgLatency:
        count > 0
          ? Math.round(
              attestations.reduce((s, a) => s + a.latency, 0) / count
            )
          : 0,
    };

    const data: AttestationsApiResponse = { attestations, summary };
    const res: ApiResponse<AttestationsApiResponse> = { success: true, data };
    return NextResponse.json(res);
  } catch (e) {
    const res: ApiResponse<never> = {
      success: false,
      error: e instanceof Error ? e.message : 'Internal server error',
    };
    return NextResponse.json(res, { status: 500 });
  }
}
