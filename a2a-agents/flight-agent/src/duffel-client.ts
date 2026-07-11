import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('flight-agent');

const DUFFEL_API_BASE = 'https://api.duffel.com';
/** Candidate pool fetched from Duffel before preference-based selection. */
export const DUFFEL_FETCH_LIMIT = 25;

export interface DuffelSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

export interface DuffelSlice {
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  stops: number;
  stopAirports: string[];
  segments: DuffelSegment[];
}

export interface DuffelSegment {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departureAt: string;
  arrivalAt: string;
  origin: string;
  destination: string;
  durationMinutes: number;
  cabinClass: string;
}

export interface DuffelOffer {
  id: string;
  totalAmount: string;
  totalCurrency: string;
  cabinClass: string;
  slices: DuffelSlice[];
  refundable: boolean;
  seatsAvailable?: number;
}

export interface DuffelRawSearchResult {
  offers: DuffelOffer[];
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
}

export interface DuffelSearchResult extends DuffelRawSearchResult {
  totalFound: number;
  preference: string;
}

function duffelHeaders(): Record<string, string> {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) throw new Error('DUFFEL_ACCESS_TOKEN is required');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Duffel-Version': 'v2',
    Accept: 'application/json',
  };
}

async function createOfferRequest(params: DuffelSearchParams): Promise<string> {
  const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
    { origin: params.origin, destination: params.destination, departure_date: params.departureDate },
  ];

  if (params.returnDate) {
    slices.push({
      origin: params.destination,
      destination: params.origin,
      departure_date: params.returnDate,
    });
  }

  const passengers = Array.from({ length: params.adults }, () => ({ type: 'adult' }));

  const body = {
    data: {
      slices,
      passengers,
      cabin_class: params.cabinClass ?? 'economy',
    },
  };

  const res = await fetch(`${DUFFEL_API_BASE}/air/offer_requests`, {
    method: 'POST',
    headers: duffelHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Duffel offer_requests failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { data: { id: string } };
  return data.data.id;
}

async function fetchOffers(offerRequestId: string): Promise<DuffelOffer[]> {
  const url = `${DUFFEL_API_BASE}/air/offers?offer_request_id=${offerRequestId}&sort=total_amount&limit=${DUFFEL_FETCH_LIMIT}`;

  const res = await fetch(url, { headers: duffelHeaders() });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Duffel offers fetch failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data: Array<{
      id: string;
      total_amount: string;
      total_currency: string;
      slices: Array<{
        origin: { iata_code: string; city_name: string };
        destination: { iata_code: string; city_name: string };
        duration: string;
        segments: Array<{
          marketing_carrier: { iata_code: string; name: string };
          marketing_carrier_flight_number: string;
          departing_at: string;
          arriving_at: string;
          origin: { iata_code: string };
          destination: { iata_code: string };
          duration: string;
          passengers: Array<{ cabin_class: string }>;
        }>;
      }>;
      conditions?: { refund_before_departure?: { allowed: boolean } };
      available_services?: unknown[];
    }>;
  };

  return data.data.map((offer) => {
    const slices: DuffelSlice[] = offer.slices.map((slice) => {
      const segments: DuffelSegment[] = slice.segments.map((seg) => ({
        airline: seg.marketing_carrier.name,
        airlineCode: seg.marketing_carrier.iata_code,
        flightNumber: `${seg.marketing_carrier.iata_code}${seg.marketing_carrier_flight_number}`,
        departureAt: seg.departing_at,
        arrivalAt: seg.arriving_at,
        origin: seg.origin.iata_code,
        destination: seg.destination.iata_code,
        durationMinutes: parseDuffelDuration(seg.duration),
        cabinClass: seg.passengers[0]?.cabin_class ?? 'economy',
      }));

      const stops = segments.length - 1;
      const stopAirports = segments.slice(0, -1).map((s) => s.destination);

      return {
        origin: slice.origin.iata_code,
        originName: slice.origin.city_name,
        destination: slice.destination.iata_code,
        destinationName: slice.destination.city_name,
        departureAt: segments[0]?.departureAt ?? '',
        arrivalAt: segments[segments.length - 1]?.arrivalAt ?? '',
        durationMinutes: parseDuffelDuration(slice.duration),
        stops,
        stopAirports,
        segments,
      };
    });

    return {
      id: offer.id,
      totalAmount: offer.total_amount,
      totalCurrency: offer.total_currency,
      cabinClass: offer.slices[0]?.segments[0]?.passengers[0]?.cabin_class ?? 'economy',
      slices,
      refundable: offer.conditions?.refund_before_departure?.allowed ?? false,
    };
  });
}

/** ISO 8601 duration (PT12H30M) → minutes */
function parseDuffelDuration(duration: string): number {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  return hours * 60 + minutes;
}

export async function searchDuffel(params: DuffelSearchParams): Promise<DuffelRawSearchResult> {
  log.info(
    {
      origin: params.origin,
      destination: params.destination,
      date: params.departureDate,
      adults: params.adults,
      cabinClass: params.cabinClass ?? 'economy',
    },
    'duffel search',
  );

  const start = Date.now();
  const offerRequestId = await createOfferRequest(params);
  const offers = await fetchOffers(offerRequestId);
  const ms = Date.now() - start;

  log.info({ offers: offers.length, ms }, 'duffel result');

  return {
    offers,
    origin: params.origin,
    destination: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
  };
}
