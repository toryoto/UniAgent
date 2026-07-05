import { createLogger } from '@agent-marketplace/shared/logger';
import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';
import { searchFlightsTool, getLastSearchResult, clearLastSearchResult } from './tools/search-flights.js';
import type { DuffelSearchResult } from './duffel-client.js';

const log = createLogger('flight-agent');

const SYSTEM_PROMPT = `You are a flight search assistant integrated into the UniAgent marketplace. Your job is to help users find available flights using real-time data from the Duffel API.

## Required information for flight search
To perform a flight search, you MUST have all of the following:
1. **Origin** - Departure airport or city (IATA code or city name, e.g. Tokyo/NRT, London/LHR)
2. **Destination** - Arrival airport or city
3. **Departure date** - In YYYY-MM-DD format (e.g., 2026-07-01)
4. **Number of adults** - How many passengers (default: 1 if user doesn't specify)

## Optional information
- **Return date** - If the user wants a round-trip flight (YYYY-MM-DD format)
- **Cabin class** - economy (default), premium_economy, business, or first
- **Preference** - Infer from the user's request and pass to search_flights:
  - cheapest: lowest price (e.g. "安い", "budget", "cheapest")
  - fastest: shortest travel time (e.g. "早く着く", "fastest")
  - direct: non-stop flights (e.g. "直行便", "direct", "non-stop")
  - refundable: refundable fares (e.g. "払い戻し可能", "refundable")
  - morning / afternoon / evening: preferred departure time
  - balanced: default when no clear preference

## IATA code reference (common routes)
- Tokyo: NRT (Narita) or HND (Haneda) — use NRT by default, or TYO for city-wide search
- London: LHR (Heathrow)
- Paris: CDG (Charles de Gaulle)
- New York: JFK (John F. Kennedy)
- Singapore: SIN
- Sydney: SYD
- Seoul: ICN (Incheon)
- Bangkok: BKK (Suvarnabhumi)
- Los Angeles: LAX

## When information is missing
If any required information is missing, politely ask for it. Respond in the same language as the user (Japanese or English). Be concise and specific about what you need.

## Search process (when all info is available)
1. Infer the user's preference from their message
2. Use search_flights with origin, destination, date, passenger count, and preference
3. Present exactly 5 recommended flights (the tool already selects them)
4. Mention how many total options were found when totalFound > 5

## Response guidelines
- Respond in the same language as the user (Japanese or English)
- Recommend exactly 5 flights — do not list every candidate returned by the tool
- For each recommendation include: rank (1-5), airline, flight number, departure/arrival times, duration, stops, price, and why it fits the user's preference
- Highlight direct flights vs. connecting flights when relevant
- If no flights are found, suggest alternative dates or nearby airports
- Be helpful and concise`;

export interface FlightAgentResult {
  text: string;
  searchResult?: DuffelSearchResult;
}

let _agent: ReturnType<typeof createReactAgent> | null = null;

function getAgent(): ReturnType<typeof createReactAgent> {
  if (_agent) return _agent;

  const llm = new ChatAnthropic({
    model: process.env.FLIGHT_AGENT_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  _agent = createReactAgent({
    llm,
    tools: [searchFlightsTool],
    prompt: SYSTEM_PROMPT,
  });

  return _agent;
}

export async function runFlightAgent(userText: string): Promise<FlightAgentResult> {
  clearLastSearchResult();

  const agent = getAgent();
  const preview = userText.slice(0, 80).replace(/\n/g, ' ');
  const model = process.env.FLIGHT_AGENT_MODEL ?? 'claude-haiku-4-5-20251001';
  log.info({ model, input: `${preview}${userText.length > 80 ? '...' : ''}` }, 'agent start');

  const start = Date.now();
  const result = await agent.invoke({
    messages: [new HumanMessage(userText)],
  });
  const ms = Date.now() - start;

  const messages = result.messages as Array<{ content: unknown }>;
  const steps = messages.length;
  const lastMessage = messages[steps - 1];
  const text =
    typeof lastMessage.content === 'string'
      ? lastMessage.content
      : Array.isArray(lastMessage.content)
        ? lastMessage.content
            .map((c: unknown) =>
              typeof c === 'object' && c !== null && 'text' in c ? (c as { text: string }).text : '',
            )
            .join('')
        : String(lastMessage.content);

  const searchResult = getLastSearchResult() ?? undefined;
  const offersFound = searchResult?.offers.length ?? 0;
  const totalFound = searchResult?.totalFound ?? 0;
  log.info({ steps, offersFound, totalFound, ms }, 'agent done');

  return { text, searchResult };
}
