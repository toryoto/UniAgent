/**
 * Tourism Agent Discovery Endpoint
 *
 * GET /api/agents/tourism/.well-known/agent.json
 */

import { NextResponse } from 'next/server';
import { tourismAgent } from '@/lib/agents/tourism';

export const runtime = 'nodejs';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return NextResponse.json(tourismAgent.getAgentJson(baseUrl));
}
