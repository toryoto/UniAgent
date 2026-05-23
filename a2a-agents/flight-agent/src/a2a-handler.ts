import { createLogger } from '@agent-marketplace/shared/logger';
import { runFlightAgent } from './langchain-agent.js';

const log = createLogger('flight-agent');

interface A2APart {
  kind: 'text' | 'data';
  text?: string;
  data?: Record<string, unknown>;
}

interface A2AMessage {
  role?: string;
  parts?: A2APart[];
}

interface A2AParams {
  message?: A2AMessage;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method?: string;
  params?: A2AParams;
}

function extractUserText(params: A2AParams): string {
  const parts = params.message?.parts ?? [];

  const textParts = parts.filter((p) => p.kind === 'text' && p.text);
  if (textParts.length > 0) {
    return textParts.map((p) => p.text!).join('\n');
  }

  const dataParts = parts.filter((p) => p.kind === 'data' && p.data);
  if (dataParts.length > 0) {
    return JSON.stringify(dataParts.map((p) => p.data));
  }

  return '';
}

export async function handleA2ARequest(body: Record<string, unknown>): Promise<{
  id: string | number | null;
  result?: { parts: A2APart[] };
  error?: { code: number; message: string };
}> {
  const req = body as unknown as JsonRpcRequest;
  const id = req.id ?? null;

  if (req.method !== 'message/send') {
    return {
      id,
      error: { code: -32601, message: `Method not found: ${req.method}` },
    };
  }

  if (!req.params) {
    return {
      id,
      error: { code: -32600, message: 'Missing params' },
    };
  }

  const userText = extractUserText(req.params);
  if (!userText.trim()) {
    return {
      id,
      result: {
        parts: [
          {
            kind: 'text',
            text: 'Please tell me where you want to fly from and to, your travel date, and the number of passengers.',
          },
        ],
      },
    };
  }

  try {
    const { text, searchResult } = await runFlightAgent(userText);

    const parts: A2APart[] = [{ kind: 'text', text }];

    if (searchResult && searchResult.offers.length > 0) {
      parts.push({
        kind: 'data',
        data: {
          offers: searchResult.offers,
          searchParams: {
            origin: searchResult.origin,
            destination: searchResult.destination,
            departureDate: searchResult.departureDate,
            returnDate: searchResult.returnDate,
          },
          totalResults: searchResult.offers.length,
          source: 'duffel',
        },
      });
    }

    return { id, result: { parts } };
  } catch (err) {
    const message = (err as Error).message;
    log.error('Flight search failed', { error: message });
    return {
      id,
      error: { code: -32603, message: `Flight search failed: ${message}` },
    };
  }
}
