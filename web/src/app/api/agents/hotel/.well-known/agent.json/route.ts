/**
 * Hotel Agent Discovery Endpoint
 *
 * GET /api/agents/hotel/.well-known/agent.json
 */

import { NextResponse } from 'next/server';
import { hotelAgent } from '@/lib/agents/hotel';

export const runtime = 'nodejs';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return NextResponse.json(hotelAgent.getAgentJson(baseUrl));
}
