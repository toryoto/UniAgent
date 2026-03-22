import type { HotelData } from '../../mock-data/hotels.js';
import type { HotelSearchQuery } from '../../request/parser.js';

export function formatDataOnly(hotels: HotelData[], query: HotelSearchQuery): unknown {
  return {
    parts: [
      {
        kind: 'data',
        data: {
          hotels: hotels.map((h) => ({
            name: h.name,
            stars: h.stars,
            rating: h.rating,
            reviewCount: h.reviewCount,
            pricePerNight: h.pricePerNight,
            currency: h.currency,
            location: h.location,
            amenities: h.amenities,
            roomTypes: h.roomTypes,
            checkInTime: h.checkInTime,
            checkOutTime: h.checkOutTime,
            petFriendly: h.petFriendly,
            ecoRating: h.ecoRating ?? null,
            nearestAirport: h.nearestAirport ?? null,
            airportDistanceKm: h.airportDistanceKm ?? null,
          })),
          searchParams: query,
          totalResults: hotels.length,
          timestamp: new Date().toISOString(),
        },
      },
    ],
  };
}
