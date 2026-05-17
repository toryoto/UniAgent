import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage } from '@langchain/core/messages';
import { geocodeCityTool } from './tools/geocode.js';
import { searchHotelsTool, getLastSearchResult, clearLastSearchResult } from './tools/search-hotels.js';
import type { HotelbedsSearchResult } from './hotelbeds-client.js';

const SYSTEM_PROMPT = `You are a hotel search assistant integrated into the UniAgent marketplace. Your job is to help users find available hotels using real-time data from the Hotelbeds API.

## Required information for hotel search
To perform a hotel search, you MUST have all of the following:
1. **Destination** - The city or area to search in
2. **Check-in date** - In YYYY-MM-DD format (e.g., 2026-07-01)
3. **Check-out date** - In YYYY-MM-DD format (e.g., 2026-07-03)
4. **Number of adults** - How many adult guests (default: 2 if user doesn't specify)

## When information is missing
If any required information is missing, politely ask for it. Respond in the same language as the user (Japanese or English). Be concise and specific about what you need.

## Search process (when all info is available)
1. Use geocode_city to get coordinates for the destination
2. Use search_hotels with those coordinates and the travel details
3. Summarize the results clearly, mentioning the number of hotels found and price range

## Response guidelines
- Respond in the same language as the user (Japanese or English)
- When presenting results, include: number of hotels found, price range, a brief mention of top options
- If no hotels are found, suggest trying with a larger radius or fewer filters
- Be helpful and concise`;

export interface HotelAgentResult {
  text: string;
  searchResult?: HotelbedsSearchResult;
}

let _agent: ReturnType<typeof createReactAgent> | null = null;

function getAgent(): ReturnType<typeof createReactAgent> {
  if (_agent) return _agent;

  const llm = new ChatAnthropic({
    model: process.env.HOTEL_AGENT_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  _agent = createReactAgent({
    llm,
    tools: [geocodeCityTool, searchHotelsTool],
    prompt: SYSTEM_PROMPT,
  });

  return _agent;
}

export async function runHotelAgent(userText: string): Promise<HotelAgentResult> {
  clearLastSearchResult();

  const agent = getAgent();
  const preview = userText.slice(0, 80).replace(/\n/g, ' ');
  const model = process.env.HOTEL_AGENT_MODEL ?? 'claude-haiku-4-5-20251001';
  console.log(`[hotel-agent] agent start model=${model} input="${preview}${userText.length > 80 ? '...' : ''}"`);

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
  const hotelsFound = searchResult ? searchResult.hotels.length : 0;
  console.log(`[hotel-agent] agent done steps=${steps} hotelsFound=${hotelsFound} (${ms}ms)`);

  return { text, searchResult };
}
