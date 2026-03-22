import type { RequestFormat } from '../agents/types.js';

export interface HotelSearchQuery {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
  minStars?: number;
  maxPrice?: number;
  minRating?: number;
  petFriendly?: boolean;
  ecoOnly?: boolean;
  nearAirport?: string;
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

/**
 * Parse incoming JSON-RPC body into a normalized HotelSearchQuery.
 * Supports all 4 request formats depending on the agent's configuration.
 */
export function parseRequest(
  body: Record<string, unknown>,
  format: RequestFormat,
): HotelSearchQuery {
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

function parseA2AStandard(params: Record<string, unknown>): HotelSearchQuery {
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

function parseNaturalLanguage(params: Record<string, unknown>): HotelSearchQuery {
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

function parseFlat(params: Record<string, unknown>): HotelSearchQuery {
  return extractQueryFromObject(params);
}

function parseMixedInput(params: Record<string, unknown>): HotelSearchQuery {
  const msg = (params as unknown as A2AMessageSendParams).message;
  if (!msg?.parts) return parseFlat(params);

  let query: HotelSearchQuery = {};

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

function extractQueryFromObject(obj: Record<string, unknown>): HotelSearchQuery {
  return {
    city: asString(obj.city),
    checkIn: asString(obj.checkIn ?? obj.check_in ?? obj.checkin),
    checkOut: asString(obj.checkOut ?? obj.check_out ?? obj.checkout),
    guests: asNumber(obj.guests),
    rooms: asNumber(obj.rooms),
    minStars: asNumber(obj.minStars ?? obj.min_stars ?? obj.stars),
    maxPrice: asNumber(obj.maxPrice ?? obj.max_price ?? obj.budget),
    minRating: asNumber(obj.minRating ?? obj.min_rating),
    petFriendly: asBoolean(obj.petFriendly ?? obj.pet_friendly ?? obj.pets),
    ecoOnly: asBoolean(obj.ecoOnly ?? obj.eco_only ?? obj.eco ?? obj.green),
    nearAirport: asString(obj.nearAirport ?? obj.near_airport ?? obj.airport),
    freeText: asString(obj.query ?? obj.text ?? obj.message),
  };
}

const CITY_PATTERNS: Record<string, RegExp> = {
  'Tokyo': /(?:\b|^)(tokyo)(?:\b|$)|東京/i,
  'Paris': /(?:\b|^)(paris)(?:\b|$)|パリ/i,
  'London': /(?:\b|^)(london)(?:\b|$)|ロンドン/i,
  'New York': /(?:\b|^)(new\s*york|NY)(?:\b|$)|ニューヨーク/i,
  'Singapore': /(?:\b|^)(singapore)(?:\b|$)|シンガポール/i,
  'Barcelona': /(?:\b|^)(barcelona)(?:\b|$)|バルセロナ/i,
  'Dubai': /(?:\b|^)(dubai)(?:\b|$)|ドバイ/i,
  'Sydney': /(?:\b|^)(sydney)(?:\b|$)|シドニー/i,
  'Bangkok': /(?:\b|^)(bangkok)(?:\b|$)|バンコク/i,
  'Rome': /(?:\b|^)(rome|roma)(?:\b|$)|ローマ/i,
  'Seoul': /(?:\b|^)(seoul)(?:\b|$)|ソウル/i,
  'Istanbul': /(?:\b|^)(istanbul)(?:\b|$)|イスタンブール/i,
  'Bali': /(?:\b|^)(bali)(?:\b|$)|バリ/i,
  'Lisbon': /(?:\b|^)(lisbon|lisboa)(?:\b|$)|リスボン/i,
  'Cape Town': /(?:\b|^)(cape\s*town)(?:\b|$)|ケープタウン/i,
  'Osaka': /(?:\b|^)(osaka)(?:\b|$)|大阪/i,
  'Kyoto': /(?:\b|^)(kyoto)(?:\b|$)|京都/i,
  'Maldives': /(?:\b|^)(maldives)(?:\b|$)|モルディブ/i,
  'Honolulu': /(?:\b|^)(honolulu|hawaii)(?:\b|$)|ハワイ|ホノルル/i,
};

function extractQueryFromText(text: string): HotelSearchQuery {
  const query: HotelSearchQuery = { freeText: text };

  for (const [city, pattern] of Object.entries(CITY_PATTERNS)) {
    if (pattern.test(text)) {
      query.city = city;
      break;
    }
  }

  const dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g);
  if (dateMatch) {
    query.checkIn = dateMatch[0];
    if (dateMatch.length > 1) query.checkOut = dateMatch[1];
  }

  const guestsMatch = text.match(/(\d+)\s*(?:guests?|人|名)/i);
  if (guestsMatch) query.guests = parseInt(guestsMatch[1], 10);

  const priceMatch = text.match(/(?:budget|予算|under|以下|max)\s*(?:¥|￥)?(\d[\d,]*)/i);
  if (priceMatch) query.maxPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);

  if (/\b(pet|dog)\b|ペット|猫|犬/i.test(text)) query.petFriendly = true;
  if (/\b(eco|green|sustainable)\b|エコ|サステナブル/i.test(text)) query.ecoOnly = true;

  const starsMatch = text.match(/(\d)\s*(?:star|stars|つ星|☆)/i);
  if (starsMatch) query.minStars = parseInt(starsMatch[1], 10);

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
