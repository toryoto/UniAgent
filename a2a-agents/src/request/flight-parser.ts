import type { RequestFormat } from '../agents/types.js';

export interface FlightSearchQuery {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  passengers?: number;
  cabinClass?: string;
  maxPrice?: number;
  directOnly?: boolean;
  freeText?: string;
}

interface A2APart {
  kind: 'text' | 'data';
  text?: string;
  data?: Record<string, unknown>;
}

interface A2AMessageSendParams {
  message?: {
    role?: string;
    parts?: A2APart[];
  };
}

/** Parse incoming JSON-RPC body into a normalized FlightSearchQuery. */
export function parseFlightRequest(
  body: Record<string, unknown>,
  format: RequestFormat,
): FlightSearchQuery {
  const params = body.params as Record<string, unknown> | undefined;
  if (!params) return {};

  switch (format) {
    case 'a2a-standard':
      return parseA2AStandard(params);
    case 'natural-language':
      return parseNaturalLanguage(params);
    case 'flat':
      return parseFlat(params);
    case 'mixed-input':
      return parseMixedInput(params);
    default:
      return parseFlat(params);
  }
}

function parseA2AStandard(params: Record<string, unknown>): FlightSearchQuery {
  const msg = (params as unknown as A2AMessageSendParams).message;
  if (!msg?.parts) return parseFlat(params);

  for (const part of msg.parts) {
    if (part.kind === 'data' && part.data) {
      return extractQueryFromObject(part.data);
    }
  }

  for (const part of msg.parts) {
    if (part.kind === 'text' && part.text) {
      return extractQueryFromText(part.text);
    }
  }

  return {};
}

function parseNaturalLanguage(params: Record<string, unknown>): FlightSearchQuery {
  const msg = (params as unknown as A2AMessageSendParams).message;
  if (!msg?.parts) {
    if (typeof params.text === 'string') return extractQueryFromText(params.text);
    return {};
  }

  const textParts = msg.parts.filter((p) => p.kind === 'text' && p.text);
  const combined = textParts.map((p) => p.text!).join(' ');
  if (combined) return extractQueryFromText(combined);
  return {};
}

function parseFlat(params: Record<string, unknown>): FlightSearchQuery {
  return extractQueryFromObject(params);
}

function parseMixedInput(params: Record<string, unknown>): FlightSearchQuery {
  const msg = (params as unknown as A2AMessageSendParams).message;
  if (!msg?.parts) return parseFlat(params);

  let query: FlightSearchQuery = {};

  for (const part of msg.parts) {
    if (part.kind === 'data' && part.data) {
      query = { ...query, ...extractQueryFromObject(part.data) };
    }
  }

  for (const part of msg.parts) {
    if (part.kind === 'text' && part.text) {
      const textQuery = extractQueryFromText(part.text);
      query = { ...textQuery, ...query };
    }
  }

  return query;
}

function extractQueryFromObject(obj: Record<string, unknown>): FlightSearchQuery {
  return {
    origin: asString(obj.origin ?? obj.from ?? obj.departure),
    destination: asString(obj.destination ?? obj.to ?? obj.arrival),
    departureDate: asString(obj.departureDate ?? obj.departure_date ?? obj.date),
    returnDate: asString(obj.returnDate ?? obj.return_date ?? obj.returnDate),
    passengers: asNumber(obj.passengers ?? obj.adults ?? obj.pax),
    cabinClass: asString(obj.cabinClass ?? obj.cabin_class ?? obj.cabin ?? obj.class),
    maxPrice: asNumber(obj.maxPrice ?? obj.max_price ?? obj.budget),
    directOnly: asBoolean(obj.directOnly ?? obj.direct_only ?? obj.direct ?? obj.nonstop),
    freeText: asString(obj.query ?? obj.text ?? obj.message),
  };
}

const ORIGIN_PATTERNS: Record<string, RegExp> = {
  'Tokyo': /(?:from|発|から)\s*(?:tokyo|東京|nrt|hnd)/i,
  'London': /(?:from|発|から)\s*(?:london|ロンドン|lhr)/i,
  'Paris': /(?:from|発|から)\s*(?:paris|パリ|cdg)/i,
  'New York': /(?:from|発|から)\s*(?:new\s*york|ニューヨーク|jfk|ewr)/i,
  'Singapore': /(?:from|発|から)\s*(?:singapore|シンガポール|sin)/i,
  'Sydney': /(?:from|発|から)\s*(?:sydney|シドニー|syd)/i,
  'Seoul': /(?:from|発|から)\s*(?:seoul|ソウル|icn)/i,
  'Bangkok': /(?:from|発|から)\s*(?:bangkok|バンコク|bkk)/i,
  'Los Angeles': /(?:from|発|から)\s*(?:los\s*angeles|ロサンゼルス|lax)/i,
};

const DEST_PATTERNS: Record<string, RegExp> = {
  'Tokyo': /(?:to|行き|へ|着)\s*(?:tokyo|東京|nrt|hnd)/i,
  'London': /(?:to|行き|へ|着)\s*(?:london|ロンドン|lhr)/i,
  'Paris': /(?:to|行き|へ|着)\s*(?:paris|パリ|cdg)/i,
  'New York': /(?:to|行き|へ|着)\s*(?:new\s*york|ニューヨーク|jfk|ewr)/i,
  'Singapore': /(?:to|行き|へ|着)\s*(?:singapore|シンガポール|sin)/i,
  'Sydney': /(?:to|行き|へ|着)\s*(?:sydney|シドニー|syd)/i,
  'Seoul': /(?:to|行き|へ|着)\s*(?:seoul|ソウル|icn)/i,
  'Bangkok': /(?:to|行き|へ|着)\s*(?:bangkok|バンコク|bkk)/i,
  'Los Angeles': /(?:to|行き|へ|着)\s*(?:los\s*angeles|ロサンゼルス|lax)/i,
};

// Fallback city patterns when no directional keyword is present
const CITY_PATTERNS: Record<string, RegExp> = {
  'Tokyo': /(?:\b|^)(tokyo)(?:\b|$)|東京/i,
  'London': /(?:\b|^)(london)(?:\b|$)|ロンドン/i,
  'Paris': /(?:\b|^)(paris)(?:\b|$)|パリ/i,
  'New York': /(?:\b|^)(new\s*york|NY)(?:\b|$)|ニューヨーク/i,
  'Singapore': /(?:\b|^)(singapore)(?:\b|$)|シンガポール/i,
  'Sydney': /(?:\b|^)(sydney)(?:\b|$)|シドニー/i,
  'Seoul': /(?:\b|^)(seoul)(?:\b|$)|ソウル/i,
  'Bangkok': /(?:\b|^)(bangkok)(?:\b|$)|バンコク/i,
  'Los Angeles': /(?:\b|^)(los\s*angeles|LA)(?:\b|$)|ロサンゼルス/i,
};

function extractQueryFromText(text: string): FlightSearchQuery {
  const query: FlightSearchQuery = { freeText: text };

  for (const [city, pattern] of Object.entries(ORIGIN_PATTERNS)) {
    if (pattern.test(text)) { query.origin = city; break; }
  }
  for (const [city, pattern] of Object.entries(DEST_PATTERNS)) {
    if (pattern.test(text)) { query.destination = city; break; }
  }

  // Fallback: if origin/destination not found with directional keywords, pick first two city mentions
  if (!query.origin || !query.destination) {
    const mentioned: string[] = [];
    for (const [city, pattern] of Object.entries(CITY_PATTERNS)) {
      if (pattern.test(text)) mentioned.push(city);
      if (mentioned.length >= 2) break;
    }
    if (!query.origin && mentioned[0]) query.origin = mentioned[0];
    if (!query.destination && mentioned[1]) query.destination = mentioned[1];
  }

  const dateMatches = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g);
  if (dateMatches) {
    query.departureDate = dateMatches[0];
    if (dateMatches.length > 1) query.returnDate = dateMatches[1];
  }

  const paxMatch = text.match(/(\d+)\s*(?:passengers?|people|persons?|人|名|大人)/i);
  if (paxMatch) query.passengers = parseInt(paxMatch[1], 10);

  const priceMatch = text.match(/(?:budget|予算|under|以下|max)\s*(?:¥|￥)?(\d[\d,]*)/i);
  if (priceMatch) query.maxPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);

  if (/\b(business)\b|ビジネス/i.test(text)) query.cabinClass = 'business';
  else if (/\b(first|first\s*class)\b|ファースト/i.test(text)) query.cabinClass = 'first';
  else if (/\b(economy|coach)\b|エコノミー/i.test(text)) query.cabinClass = 'economy';

  if (/\b(direct|nonstop|non-stop)\b|直行|乗り継ぎなし/i.test(text)) query.directOnly = true;

  return query;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}
