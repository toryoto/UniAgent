import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchDuffel } from '../duffel-client.js';
import type { DuffelSearchResult } from '../duffel-client.js';

// Shared state: last successful flight search result for inclusion in A2A DataPart
let _lastSearchResult: DuffelSearchResult | null = null;

export function getLastSearchResult(): DuffelSearchResult | null {
  return _lastSearchResult;
}

export function clearLastSearchResult(): void {
  _lastSearchResult = null;
}

export const searchFlightsTool = tool(
  async ({
    origin,
    destination,
    departureDate,
    returnDate,
    adults,
    cabinClass,
  }): Promise<string> => {
    try {
      const result = await searchDuffel({
        origin,
        destination,
        departureDate,
        returnDate,
        adults,
        cabinClass: cabinClass as 'economy' | 'premium_economy' | 'business' | 'first' | undefined,
      });

      _lastSearchResult = result;

      if (result.offers.length === 0) {
        return JSON.stringify({
          found: 0,
          message: 'No flights found for this route and date. Try adjusting the dates or route.',
        });
      }

      // Return summary for the LLM (not the full data, to keep token count low)
      const summary = result.offers.map((o) => {
        const outbound = o.slices[0];
        return {
          id: o.id,
          airline: outbound?.segments[0]?.airline ?? 'Unknown',
          flightNumber: outbound?.segments[0]?.flightNumber ?? '',
          departure: outbound?.departureAt ?? '',
          arrival: outbound?.arrivalAt ?? '',
          durationMinutes: outbound?.durationMinutes ?? 0,
          stops: outbound?.stops ?? 0,
          price: `${o.totalAmount} ${o.totalCurrency}`,
          cabinClass: o.cabinClass,
          refundable: o.refundable,
        };
      });

      return JSON.stringify({
        found: result.offers.length,
        origin: result.origin,
        destination: result.destination,
        departureDate: result.departureDate,
        offers: summary,
      });
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message });
    }
  },
  {
    name: 'search_flights',
    description:
      'Search for available flights using the Duffel API. Provide IATA airport or city codes (e.g. NRT for Tokyo Narita, LHR for London Heathrow, TYO for Tokyo area). Returns available offers with pricing.',
    schema: z.object({
      origin: z.string().describe('IATA airport or city code for departure (e.g. NRT, TYO, LHR, CDG)'),
      destination: z.string().describe('IATA airport or city code for arrival (e.g. LHR, CDG, JFK, SIN)'),
      departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
      returnDate: z.string().optional().describe('Return date in YYYY-MM-DD format for round-trip (omit for one-way)'),
      adults: z.number().int().min(1).max(9).describe('Number of adult passengers'),
      cabinClass: z
        .enum(['economy', 'premium_economy', 'business', 'first'])
        .optional()
        .describe('Cabin class (default: economy)'),
    }),
  },
);
