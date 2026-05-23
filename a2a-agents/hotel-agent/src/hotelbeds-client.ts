import { createHash } from 'crypto';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('hotel-agent');

/** Maximum hotels requested from Hotelbeds availability search. */
const MAX_HOTEL_RESULTS = 10;

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
  imageUrl?: string;
  webUrl?: string;
}

export interface HotelbedsSearchResult {
  hotels: HotelResult[];
  total: number;
  checkIn: string;
  checkOut: string;
}

interface HotelContentItem {
  imageUrl?: string;
  webUrl?: string;
}

/** Hotelbeds Content API returns hostnames without a scheme; browsers treat those as relative paths. */
function normalizeHotelWebUrl(web?: string): string | undefined {
  if (!web?.trim()) return undefined;

  const trimmed = web.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;

  return `https://${trimmed}`;
}

async function fetchHotelContent(hotelCodes: number[]): Promise<Map<number, HotelContentItem>> {
  if (hotelCodes.length === 0) return new Map();

  const apiKey = process.env.HOTELBEDS_API_KEY;
  const apiSecret = process.env.HOTELBEDS_API_SECRET;
  const baseUrl = process.env.HOTELBEDS_BASE_URL ?? 'https://api.test.hotelbeds.com';

  if (!apiKey || !apiSecret) return new Map();

  const { key, signature } = buildSignature(apiKey, apiSecret);
  const codes = hotelCodes.join(',');

  try {
    const res = await fetch(
      `${baseUrl}/hotel-content-api/1.0/hotels?codes=${codes}&fields=images,web&language=ENG&from=1&to=${hotelCodes.length}`,
      {
        headers: {
          'Api-key': key,
          'X-Signature': signature,
          'Accept': 'application/json',
        },
      },
    );

    if (!res.ok) {
      log.warn('hotel content api failed', { status: res.status });
      return new Map();
    }

    const data = (await res.json()) as {
      hotels?: Array<{
        code: number;
        images?: Array<{ path: string; visualOrder: number }>;
        web?: string;
      }>;
    };

    const result = new Map<number, HotelContentItem>();
    for (const hotel of data.hotels ?? []) {
      const sorted = (hotel.images ?? []).slice().sort((a, b) => a.visualOrder - b.visualOrder);
      const mainImage = sorted[0];
      result.set(hotel.code, {
        imageUrl: mainImage ? `https://photos.hotelbeds.com/giata/bigger/${mainImage.path}` : undefined,
        webUrl: normalizeHotelWebUrl(hotel.web),
      });
    }
    return result;
  } catch (err) {
    log.warn('hotel content api error', { error: (err as Error).message });
    return new Map();
  }
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

  const filter: Record<string, unknown> = { maxHotels: MAX_HOTEL_RESULTS };
  if (params.minStars) {
    filter.minCategory = params.minStars;
  }
  requestBody.filter = filter;

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
  log.info('hotelbeds result', { total, returning: hotels.length, ms: fetchMs });

  const contentMap = await fetchHotelContent(hotels.map((h) => h.code));
  const enrichedHotels = hotels.map((h) => {
    const content = contentMap.get(h.code);
    return content ? { ...h, imageUrl: content.imageUrl, webUrl: content.webUrl } : h;
  });

  return {
    hotels: enrichedHotels,
    total,
    checkIn: hotelsData.checkIn ?? params.checkIn,
    checkOut: hotelsData.checkOut ?? params.checkOut,
  };
}
