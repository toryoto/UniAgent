import type { DuffelOffer } from './duffel-client.js';

export const RECOMMENDED_OFFER_COUNT = 5;

export type FlightPreference =
  | 'balanced'
  | 'cheapest'
  | 'fastest'
  | 'direct'
  | 'refundable'
  | 'morning'
  | 'afternoon'
  | 'evening';

export interface CompactFlightOffer {
  id: string;
  totalAmount: string;
  totalCurrency: string;
  cabinClass: string;
  refundable: boolean;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  stops: number;
  stopAirports: string[];
  returnDepartureAt?: string;
  returnArrivalAt?: string;
}

function parseAmount(amount: string): number {
  const value = Number.parseFloat(amount);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function outboundSlice(offer: DuffelOffer) {
  return offer.slices[0];
}

function outboundDuration(offer: DuffelOffer): number {
  return outboundSlice(offer)?.durationMinutes ?? Number.POSITIVE_INFINITY;
}

function outboundStops(offer: DuffelOffer): number {
  return outboundSlice(offer)?.stops ?? Number.POSITIVE_INFINITY;
}

function outboundDepartureHour(offer: DuffelOffer): number {
  const departureAt = outboundSlice(offer)?.departureAt;
  if (!departureAt) return 12;
  const hour = new Date(departureAt).getUTCHours();
  return Number.isFinite(hour) ? hour : 12;
}

function compareByPrice(a: DuffelOffer, b: DuffelOffer): number {
  return parseAmount(a.totalAmount) - parseAmount(b.totalAmount);
}

function compareByDuration(a: DuffelOffer, b: DuffelOffer): number {
  return outboundDuration(a) - outboundDuration(b);
}

function compareByStopsThenDuration(a: DuffelOffer, b: DuffelOffer): number {
  const stopDiff = outboundStops(a) - outboundStops(b);
  return stopDiff !== 0 ? stopDiff : compareByDuration(a, b);
}

function departureWindowScore(offer: DuffelOffer, preference: FlightPreference): number {
  const hour = outboundDepartureHour(offer);
  if (preference === 'morning') {
    if (hour >= 5 && hour < 12) return 0;
    if (hour >= 12 && hour < 17) return 1;
    return 2;
  }
  if (preference === 'afternoon') {
    if (hour >= 12 && hour < 17) return 0;
    if (hour >= 17 && hour < 22) return 1;
    return 2;
  }
  if (preference === 'evening') {
    if (hour >= 17 && hour < 22) return 0;
    if (hour >= 12 && hour < 17) return 1;
    return 2;
  }
  return 0;
}

function pickUnique(
  offers: DuffelOffer[],
  selector: (candidates: DuffelOffer[]) => DuffelOffer | undefined,
  selected: DuffelOffer[],
): DuffelOffer | undefined {
  const selectedIds = new Set(selected.map((offer) => offer.id));
  const candidates = offers.filter((offer) => !selectedIds.has(offer.id));
  return selector(candidates);
}

function pickCheapest(candidates: DuffelOffer[]): DuffelOffer | undefined {
  return [...candidates].sort(compareByPrice)[0];
}

function pickFastest(candidates: DuffelOffer[]): DuffelOffer | undefined {
  return [...candidates].sort(compareByDuration)[0];
}

function pickDirect(candidates: DuffelOffer[]): DuffelOffer | undefined {
  const direct = candidates.filter((offer) => outboundStops(offer) === 0);
  return [...direct].sort(compareByDuration)[0] ?? [...candidates].sort(compareByStopsThenDuration)[0];
}

function pickRefundable(candidates: DuffelOffer[]): DuffelOffer | undefined {
  const refundable = candidates.filter((offer) => offer.refundable);
  return [...refundable].sort(compareByPrice)[0];
}

function pickByDepartureWindow(
  candidates: DuffelOffer[],
  preference: FlightPreference,
): DuffelOffer | undefined {
  return [...candidates].sort((a, b) => {
    const windowDiff = departureWindowScore(a, preference) - departureWindowScore(b, preference);
    return windowDiff !== 0 ? windowDiff : compareByPrice(a, b);
  })[0];
}

function selectBalancedOffers(offers: DuffelOffer[], limit: number): DuffelOffer[] {
  const selected: DuffelOffer[] = [];

  const picks = [
    pickUnique(offers, pickCheapest, selected),
    pickUnique(offers, pickFastest, selected),
    pickUnique(offers, pickDirect, selected),
    pickUnique(offers, pickRefundable, selected),
  ];

  for (const offer of picks) {
    if (offer) selected.push(offer);
  }

  const remaining = [...offers]
    .filter((offer) => !selected.some((picked) => picked.id === offer.id))
    .sort(compareByPrice);

  for (const offer of remaining) {
    if (selected.length >= limit) break;
    selected.push(offer);
  }

  return selected.slice(0, limit);
}

/**
 * Rank Duffel offers by user preference and return up to `limit` recommendations.
 */
export function selectRecommendedOffers(
  offers: DuffelOffer[],
  preference: FlightPreference = 'balanced',
  limit = RECOMMENDED_OFFER_COUNT,
): DuffelOffer[] {
  if (offers.length <= limit) return offers;

  switch (preference) {
    case 'cheapest':
      return [...offers].sort(compareByPrice).slice(0, limit);
    case 'fastest':
      return [...offers].sort(compareByDuration).slice(0, limit);
    case 'direct':
      return [...offers].sort(compareByStopsThenDuration).slice(0, limit);
    case 'refundable':
      return [...offers]
        .sort((a, b) => {
          if (a.refundable !== b.refundable) return a.refundable ? -1 : 1;
          return compareByPrice(a, b);
        })
        .slice(0, limit);
    case 'morning':
    case 'afternoon':
    case 'evening':
      return [...offers]
        .sort((a, b) => {
          const windowDiff = departureWindowScore(a, preference) - departureWindowScore(b, preference);
          return windowDiff !== 0 ? windowDiff : compareByPrice(a, b);
        })
        .slice(0, limit);
    case 'balanced':
    default:
      return selectBalancedOffers(offers, limit);
  }
}

export function toCompactOffer(offer: DuffelOffer): CompactFlightOffer {
  const outbound = offer.slices[0];
  const inbound = offer.slices[1];
  const firstSegment = outbound?.segments[0];

  return {
    id: offer.id,
    totalAmount: offer.totalAmount,
    totalCurrency: offer.totalCurrency,
    cabinClass: offer.cabinClass,
    refundable: offer.refundable,
    airline: firstSegment?.airline ?? 'Unknown',
    flightNumber: firstSegment?.flightNumber ?? '',
    origin: outbound?.origin ?? '',
    destination: outbound?.destination ?? '',
    departureAt: outbound?.departureAt ?? '',
    arrivalAt: outbound?.arrivalAt ?? '',
    durationMinutes: outbound?.durationMinutes ?? 0,
    stops: outbound?.stops ?? 0,
    stopAirports: outbound?.stopAirports ?? [],
    returnDepartureAt: inbound?.departureAt,
    returnArrivalAt: inbound?.arrivalAt,
  };
}
