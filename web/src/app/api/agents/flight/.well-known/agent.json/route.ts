/**
 * Flight Agent Discovery Endpoint
 *
 * GET /api/agents/flight/.well-known/agent.json
 */

import { NextResponse } from 'next/server';
import { flightAgent } from '@/lib/agents/flight';

export const runtime = 'nodejs';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return NextResponse.json(flightAgent.getAgentJson(baseUrl));
}
