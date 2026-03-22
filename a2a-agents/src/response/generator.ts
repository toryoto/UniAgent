import type { AgentDefinition } from '../agents/types.js';
import type { HotelSearchQuery } from '../request/parser.js';
import type { HotelData } from '../mock-data/hotels.js';
import { filterHotels, getAllHotels } from '../mock-data/hotels.js';
import { formatTextOnly } from './formats/text-only.js';
import { formatDataOnly } from './formats/data-only.js';
import { formatMixed } from './formats/mixed.js';
import { formatLegacyFlat } from './formats/legacy-flat.js';
import { formatNested } from './formats/nested.js';
import { formatMarkdown } from './formats/markdown.js';

export interface GenerationResult {
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Generate a response based on agent definition and parsed query.
 * Quality level affects both data selection and response content.
 */
export async function generateResponse(
  agent: AgentDefinition,
  query: HotelSearchQuery,
): Promise<GenerationResult> {
  if (agent.latencyMs && agent.latencyMs > 0) {
    await sleep(agent.latencyMs);
  }

  if (agent.qualityLevel === 'unreliable' && agent.errorRate) {
    if (Math.random() < agent.errorRate) {
      return randomError();
    }
  }

  let hotels = selectHotels(query, agent.qualityLevel);
  hotels = applyQualityDegradation(hotels, agent.qualityLevel);

  const maxResults = getMaxResults(agent.qualityLevel);
  hotels = hotels.slice(0, maxResults);

  const result = formatResponse(hotels, query, agent.responseFormat);
  return { result };
}

function selectHotels(query: HotelSearchQuery, quality: AgentDefinition['qualityLevel']): HotelData[] {
  switch (quality) {
    case 'high':
      return filterHotels({
        city: query.city,
        minStars: query.minStars,
        maxPrice: query.maxPrice,
        minRating: query.minRating,
        petFriendly: query.petFriendly,
        ecoOnly: query.ecoOnly,
        nearAirport: query.nearAirport,
      });

    case 'medium':
      return filterHotels({
        city: query.city,
        maxPrice: query.maxPrice,
        minRating: query.minRating,
      });

    case 'low':
    case 'unreliable': {
      if (query.city) {
        return filterHotels({ city: query.city });
      }
      const all = getAllHotels();
      return all.sort(() => Math.random() - 0.5).slice(0, 5);
    }

    default:
      return filterHotels({ city: query.city });
  }
}

function applyQualityDegradation(hotels: HotelData[], quality: AgentDefinition['qualityLevel']): HotelData[] {
  switch (quality) {
    case 'high':
      return hotels;

    case 'medium':
      return hotels.map((h) => ({
        ...h,
        amenities: h.amenities.slice(0, 4),
        roomTypes: h.roomTypes.slice(0, 2),
      }));

    case 'low':
      return hotels.map((h) => ({
        ...h,
        amenities: h.amenities.slice(0, 2),
        roomTypes: [h.roomTypes[0] ?? 'Standard'],
        reviewCount: 0,
        ecoRating: undefined,
        nearestAirport: undefined,
        airportDistanceKm: undefined,
        pricePerNight: corruptNumber(h.pricePerNight, 0.15),
        rating: Math.round(corruptNumber(h.rating, 0.1) * 10) / 10,
      }));

    case 'unreliable':
      return hotels.map((h) => ({
        ...h,
        amenities: shuffleArray(h.amenities).slice(0, Math.floor(Math.random() * 3) + 1),
        roomTypes: [h.roomTypes[Math.floor(Math.random() * h.roomTypes.length)] ?? 'Room'],
        pricePerNight: corruptNumber(h.pricePerNight, 0.3),
        rating: Math.round(Math.max(1, Math.min(5, corruptNumber(h.rating, 0.25))) * 10) / 10,
        reviewCount: Math.floor(Math.random() * h.reviewCount),
      }));

    default:
      return hotels;
  }
}

function formatResponse(
  hotels: HotelData[],
  query: HotelSearchQuery,
  format: AgentDefinition['responseFormat'],
): unknown {
  switch (format) {
    case 'text-only':
      return formatTextOnly(hotels, query);
    case 'data-only':
      return formatDataOnly(hotels, query);
    case 'mixed':
      return formatMixed(hotels, query);
    case 'legacy-flat':
      return formatLegacyFlat(hotels, query);
    case 'nested':
      return formatNested(hotels, query);
    case 'markdown':
      return formatMarkdown(hotels, query);
    default:
      return formatDataOnly(hotels, query);
  }
}

function getMaxResults(quality: AgentDefinition['qualityLevel']): number {
  switch (quality) {
    case 'high': return 5;
    case 'medium': return 3;
    case 'low': return 2;
    case 'unreliable': return 3;
    default: return 3;
  }
}

function randomError(): GenerationResult {
  const errors = [
    { code: -32603, message: 'Internal error: upstream data source unavailable' },
    { code: -32001, message: 'Service temporarily unavailable' },
    { code: -32002, message: 'Data source timeout' },
    { code: -32603, message: 'Internal error: failed to process request' },
  ];
  return { error: errors[Math.floor(Math.random() * errors.length)] };
}

function corruptNumber(value: number, deviation: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * deviation;
  return Math.round(value * factor);
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
