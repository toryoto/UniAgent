/**
 * Agent Stream API Route — 認証・検証は lib/agent に委譲。
 */

import { NextRequest } from 'next/server';
import { runAgentStreamRoute } from '@/lib/agent/agent-route-orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return runAgentStreamRoute(request);
}
