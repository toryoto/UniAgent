import type { HotelData } from '../../mock-data/hotels.js';
import type { HotelSearchQuery } from '../../request/parser.js';
import { getReviewsForHotel } from '../../mock-data/reviews.js';

export function formatMarkdown(hotels: HotelData[], query: HotelSearchQuery): unknown {
  const city = query.city ?? 'Selected Destination';
  const lines: string[] = [];

  lines.push(`# Hotel Search Results: ${city}`);
  lines.push('');
  lines.push(`> Found **${hotels.length}** hotels matching your criteria.`);
  lines.push('');

  for (const h of hotels) {
    lines.push(`## ${h.name} ${'⭐'.repeat(h.stars)}`);
    lines.push('');
    lines.push(`**Rating:** ${h.rating}/5 (${h.reviewCount} reviews) | **Price:** ¥${h.pricePerNight.toLocaleString()}/night`);
    lines.push('');
    lines.push(`📍 ${h.location.district}, ${h.location.city}, ${h.location.country}`);
    lines.push('');
    lines.push('### Amenities');
    lines.push(h.amenities.map((a) => `- ${a}`).join('\n'));
    lines.push('');
    lines.push('### Room Types');
    lines.push(h.roomTypes.map((r) => `- ${r}`).join('\n'));
    lines.push('');

    if (h.petFriendly) lines.push('🐾 **Pet-friendly**');
    if (h.ecoRating) lines.push(`🌿 **Eco rating:** ${h.ecoRating}/5`);
    if (h.nearestAirport) lines.push(`✈️ **Nearest airport:** ${h.nearestAirport} (${h.airportDistanceKm}km)`);
    lines.push('');

    const reviews = getReviewsForHotel(h.name, 2);
    if (reviews.length > 0) {
      lines.push('### Recent Reviews');
      for (const r of reviews) {
        lines.push(`> **${r.title}** — ${r.reviewer} (${r.rating}/5, ${r.stayType})`);
        lines.push(`> ${r.text}`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  return {
    parts: [{ kind: 'text', text: lines.join('\n') }],
  };
}
