import type { HotelData } from '../../mock-data/hotels.js';
import type { HotelSearchQuery } from '../../request/parser.js';

/**
 * Legacy flat format — non-A2A compliant, matching the current web/ agent pattern.
 * Returns { hotels, searchParams, timestamp } directly as the result.
 */
export function formatLegacyFlat(hotels: HotelData[], query: HotelSearchQuery): unknown {
  return {
    hotels: hotels.map((h) => ({
      name: h.name,
      rating: h.rating,
      stars: h.stars,
      pricePerNight: h.pricePerNight,
      currency: h.currency,
      location: h.location,
      amenities: h.amenities,
      roomType: h.roomTypes[0] ?? 'Standard',
      availability: true,
    })),
    searchParams: query,
    timestamp: new Date().toISOString(),
  };
}
