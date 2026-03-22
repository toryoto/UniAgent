import type { HotelData } from '../../mock-data/hotels.js';
import type { HotelSearchQuery } from '../../request/parser.js';

export function formatMixed(hotels: HotelData[], query: HotelSearchQuery): unknown {
  const city = query.city ?? 'your destination';

  const summary = hotels.length > 0
    ? `I found ${hotels.length} hotel(s) in ${city}. ` +
      `Prices range from ¥${Math.min(...hotels.map((h) => h.pricePerNight)).toLocaleString()} ` +
      `to ¥${Math.max(...hotels.map((h) => h.pricePerNight)).toLocaleString()} per night. ` +
      `The highest-rated option is ${hotels.reduce((a, b) => (a.rating > b.rating ? a : b)).name} ` +
      `with a ${hotels.reduce((a, b) => (a.rating > b.rating ? a : b)).rating}/5 rating.`
    : `No hotels found matching your criteria in ${city}.`;

  return {
    parts: [
      { kind: 'text', text: summary },
      {
        kind: 'data',
        data: {
          hotels: hotels.map((h) => ({
            name: h.name,
            stars: h.stars,
            rating: h.rating,
            pricePerNight: h.pricePerNight,
            currency: h.currency,
            location: h.location,
            amenities: h.amenities,
            roomTypes: h.roomTypes,
          })),
          searchParams: query,
          timestamp: new Date().toISOString(),
        },
      },
    ],
  };
}
