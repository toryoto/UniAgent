import { createHash } from 'crypto';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('hotel-agent');

export interface HotelbedsSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
  minStars?: number;
  maxBudgetPerNight?: number;
}

export interface HotelRate {
  rateKey: string;
  rateType: string;
  net: string;
  sellingRate?: string;
  boardCode: string;
  boardName: string;
  adults: number;
  children: number;
  rooms: number;
}

export interface HotelRoom {
  code: string;
  name: string;
  rates: HotelRate[];
}

export interface HotelResult {
  code: number;
  name: string;
  categoryCode: string;
  categoryName: string;
  destinationCode: string;
  destinationName: string;
  latitude: string;
  longitude: string;
  minRate: string;
  maxRate: string;
  currency: string;
  rooms: HotelRoom[];
}

export interface HotelbedsSearchResult {
  hotels: HotelResult[];
  total: number;
  checkIn: string;
  checkOut: string;
}

function buildSignature(apiKey: string, apiSecret: string): { key: string; signature: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHash('sha256').update(apiKey + apiSecret + timestamp).digest('hex');
  return { key: apiKey, signature };
}

export async function searchHotelbeds(
  params: HotelbedsSearchParams,
): Promise<HotelbedsSearchResult> {
  const apiKey = process.env.HOTELBEDS_API_KEY;
  const apiSecret = process.env.HOTELBEDS_API_SECRET;
  const baseUrl = process.env.HOTELBEDS_BASE_URL ?? 'https://api.test.hotelbeds.com';

  if (!apiKey || !apiSecret) {
    throw new Error('HOTELBEDS_API_KEY and HOTELBEDS_API_SECRET are required');
  }

  const { key, signature } = buildSignature(apiKey, apiSecret);

  const requestBody: Record<string, unknown> = {
    stay: { checkIn: params.checkIn, checkOut: params.checkOut },
    occupancies: [{ rooms: params.rooms, adults: params.adults, children: 0 }],
    geolocation: {
      latitude: params.latitude,
      longitude: params.longitude,
      radius: params.radiusKm,
      unit: 'km',
    },
  };

  if (params.minStars) {
    requestBody.filter = { minCategory: params.minStars };
  }

  log.info('hotelbeds search', {
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    lat: params.latitude,
    lon: params.longitude,
    adults: params.adults,
    radiusKm: params.radiusKm,
  });

  const fetchStart = Date.now();
  const res = await fetch(`${baseUrl}/hotel-api/1.0/hotels`, {
    method: 'POST',
    headers: {
      'Api-key': key,
      'X-Signature': signature,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  const fetchMs = Date.now() - fetchStart;

  if (!res.ok) {
    const text = await res.text();
    log.error('hotelbeds error', { status: res.status, ms: fetchMs, body: text.slice(0, 200) });
    throw new Error(`Hotelbeds API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    hotels?: {
      checkIn: string;
      checkOut: string;
      hotels?: HotelResult[];
      total?: number;
    };
    error?: { code: string; message: string };
  };

  if (data.error) {
    log.error('hotelbeds api error', { code: data.error.code, message: data.error.message });
    throw new Error(`Hotelbeds error ${data.error.code}: ${data.error.message}`);
  }

  const hotelsData = data.hotels;
  if (!hotelsData) {
    log.info('hotelbeds result', { total: 0, ms: fetchMs });
    return { hotels: [], total: 0, checkIn: params.checkIn, checkOut: params.checkOut };
  }

  let hotels = hotelsData.hotels ?? [];

  // Apply budget filter client-side if needed (Hotelbeds doesn't support max price natively)
  if (params.maxBudgetPerNight) {
    hotels = hotels.filter(
      (h) => parseFloat(h.minRate) <= (params.maxBudgetPerNight as number),
    );
  }

  const total = hotelsData.total ?? hotels.length;
  const returned = Math.min(hotels.length, 10);
  log.info('hotelbeds result', { total, returning: returned, ms: fetchMs });

  // Return top 10 results
  return {
    hotels: hotels.slice(0, 10),
    total,
    checkIn: hotelsData.checkIn ?? params.checkIn,
    checkOut: hotelsData.checkOut ?? params.checkOut,
  };
}
