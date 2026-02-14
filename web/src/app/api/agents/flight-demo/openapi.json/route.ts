/**
 * Flight Demo Agent OpenAPI Specification
 *
 * GET /api/agents/flight-demo/openapi.json
 */

import { NextResponse } from 'next/server';
import { flightDemoAgent } from '@/lib/agents/flight-demo';

export const runtime = 'nodejs';

export async function GET() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return NextResponse.json(flightDemoAgent.getOpenApiSpec(baseUrl));
}
