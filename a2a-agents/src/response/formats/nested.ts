import type { HotelData } from '../../mock-data/hotels.js';
import type { HotelSearchQuery } from '../../request/parser.js';

/**
 * Nested format — groups hotels by city, then by price tier.
 */
export function formatNested(hotels: HotelData[], query: HotelSearchQuery): unknown {
  const byCity: Record<string, Record<string, unknown[]>> = {};

  for (const h of hotels) {
    const city = h.location.city;
    if (!byCity[city]) byCity[city] = {};

    const tier = getPriceTier(h.pricePerNight);
    if (!byCity[city][tier]) byCity[city][tier] = [];

    byCity[city][tier].push({
      name: h.name,
      stars: h.stars,
      rating: h.rating,
      pricePerNight: h.pricePerNight,
      currency: h.currency,
      district: h.location.district,
      amenities: h.amenities,
      roomTypes: h.roomTypes,
    });
  }

  return {
    parts: [
      {
        kind: 'data',
        data: {
          byCity,
          summary: {
            totalHotels: hotels.length,
            cities: Object.keys(byCity),
            priceRange: {
              min: Math.min(...hotels.map((h) => h.pricePerNight)),
              max: Math.max(...hotels.map((h) => h.pricePerNight)),
              currency: 'JPY',
            },
          },
          searchParams: query,
          timestamp: new Date().toISOString(),
        },
      },
    ],
  };
}

function getPriceTier(price: number): string {
  if (price < 10000) return 'budget';
  if (price < 30000) return 'mid-range';
  if (price < 60000) return 'premium';
  return 'luxury';
}
