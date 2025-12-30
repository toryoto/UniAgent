/**
 * Flight Agent OpenAPI Specification
 *
 * GET /api/agents/flight/openapi.json
 */

import { NextResponse } from 'next/server';
import { flightAgent } from '@/lib/agents/flight';

export const runtime = 'nodejs';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return NextResponse.json(flightAgent.getOpenApiSpec(baseUrl));
}
