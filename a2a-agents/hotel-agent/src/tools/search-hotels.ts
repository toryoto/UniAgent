import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchHotelbeds } from '../hotelbeds-client.js';
import type { HotelbedsSearchResult } from '../hotelbeds-client.js';

// Shared state: last successful hotel search result for inclusion in A2A response
let _lastSearchResult: HotelbedsSearchResult | null = null;

export function getLastSearchResult(): HotelbedsSearchResult | null {
  return _lastSearchResult;
}

export function clearLastSearchResult(): void {
  _lastSearchResult = null;
}

export const searchHotelsTool = tool(
  async ({
    latitude,
    longitude,
    checkIn,
    checkOut,
    adults,
    rooms,
    minStars,
    maxBudgetPerNight,
    radiusKm,
  }): Promise<string> => {
    try {
      const result = await searchHotelbeds({
        latitude,
        longitude,
        radiusKm: radiusKm ?? 20,
        checkIn,
        checkOut,
        adults,
        rooms: rooms ?? 1,
        minStars,
        maxBudgetPerNight,
      });

      _lastSearchResult = result;

      if (result.hotels.length === 0) {
        return JSON.stringify({
          found: 0,
          message: 'No hotels found matching the criteria. Try expanding the radius or relaxing filters.',
        });
      }

      // Return summary for the LLM (not the full data, to keep token count low)
      const summary = result.hotels.map((h) => ({
        name: h.name,
        category: h.categoryName,
        minRate: `${h.minRate} ${h.currency}`,
        boardName: h.rooms[0]?.rates[0]?.boardName ?? 'Room only',
      }));

      return JSON.stringify({
        found: result.total,
        showing: result.hotels.length,
        checkIn: result.checkIn,
        checkOut: result.checkOut,
        hotels: summary,
      });
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message });
    }
  },
  {
    name: 'search_hotels',
    description:
      'Search hotel availability using the Hotelbeds API. Requires coordinates from geocode_city first. Returns available hotels with rates.',
    schema: z.object({
      latitude: z.number().describe('Latitude of the destination (from geocode_city)'),
      longitude: z.number().describe('Longitude of the destination (from geocode_city)'),
      checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
      checkOut: z.string().describe('Check-out date in YYYY-MM-DD format'),
      adults: z.number().int().min(1).describe('Number of adult guests'),
      rooms: z.number().int().min(1).optional().describe('Number of rooms (default: 1)'),
      radiusKm: z
        .number()
        .optional()
        .describe('Search radius in kilometers around coordinates (default: 20)'),
      minStars: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .describe('Minimum hotel star category (1-5)'),
      maxBudgetPerNight: z
        .number()
        .optional()
        .describe('Maximum price per night (in the local currency)'),
    }),
  },
);
