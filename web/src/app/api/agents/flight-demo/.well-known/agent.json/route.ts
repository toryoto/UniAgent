/**
 * Flight Demo Agent Discovery Endpoint
 *
 * GET /api/agents/flight-demo/.well-known/agent.json
 * 登録テスト用ダミーエージェント（SkySearch）
 */

import { NextResponse } from 'next/server';
import { flightDemoAgent } from '@/lib/agents/flight-demo';

export const runtime = 'nodejs';

export async function GET() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return NextResponse.json(flightDemoAgent.getAgentJson(baseUrl));
}
