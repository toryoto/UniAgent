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
1. Use search_flights with the origin, destination, date, and passenger count
2. Summarize the results clearly: number of options, price range, fastest/cheapest flights

## Response guidelines
- Respond in the same language as the user (Japanese or English)
- When presenting results, include: number of flights found, price range, airline and flight number, departure/arrival times
- Highlight direct flights vs. connecting flights
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
  log.info('agent start', { model, input: `${preview}${userText.length > 80 ? '...' : ''}` });

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
  const offersFound = searchResult ? searchResult.offers.length : 0;
  log.success('agent done', { steps, offersFound, ms });

  return { text, searchResult };
}
