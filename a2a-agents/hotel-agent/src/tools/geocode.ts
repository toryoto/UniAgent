import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('hotel-agent');

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

async function geocodeCity(city: string): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a User-Agent identifying the application
      'User-Agent': 'UniAgent-HotelSearch/1.0 (https://uniagent.example.com)',
    },
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const results = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!results.length) {
    throw new Error(
      `Could not find location for "${city}". Please try a more specific city name.`,
    );
  }

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}

export const geocodeCityTool = tool(
  async ({ city }): Promise<string> => {
    log.info('geocode', { city });
    try {
      const result = await geocodeCity(city);
      log.info('geocode result', { lat: result.latitude, lon: result.longitude, name: result.displayName.slice(0, 60) });
      return JSON.stringify(result);
    } catch (err) {
      log.warn('geocode error', { city, error: (err as Error).message });
      return JSON.stringify({ error: (err as Error).message });
    }
  },
  {
    name: 'geocode_city',
    description:
      'Convert a city name to latitude and longitude coordinates for hotel search. Returns {latitude, longitude, displayName} or {error}.',
    schema: z.object({
      city: z.string().describe('City or destination name (e.g. "Tokyo", "Barcelona", "New York")'),
    }),
  },
);
