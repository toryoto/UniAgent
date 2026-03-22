import type { HotelData } from '../../mock-data/hotels.js';
import type { HotelSearchQuery } from '../../request/parser.js';

export function formatTextOnly(hotels: HotelData[], query: HotelSearchQuery): unknown {
  const city = query.city ?? 'your selected destination';
  const lines: string[] = [];

  lines.push(`Found ${hotels.length} hotel(s) in ${city}:\n`);

  for (const h of hotels) {
    lines.push(`${h.name} (${'★'.repeat(h.stars)})`);
    lines.push(`  Rating: ${h.rating}/5 (${h.reviewCount} reviews)`);
    lines.push(`  Price: ¥${h.pricePerNight.toLocaleString()}/night`);
    lines.push(`  Location: ${h.location.district}, ${h.location.city}`);
    lines.push(`  Amenities: ${h.amenities.join(', ')}`);
    lines.push(`  Room types: ${h.roomTypes.join(', ')}`);
    if (h.petFriendly) lines.push('  Pet-friendly: Yes');
    if (h.ecoRating) lines.push(`  Eco rating: ${h.ecoRating}/5`);
    lines.push('');
  }

  return {
    parts: [{ kind: 'text', text: lines.join('\n') }],
  };
}
