/**
 * @module compact-hotels
 * Hotelbeds availability レスポンスを LLM / A2A 向けに最小化する純粋関数群。
 * rateKey（booking 専用 opaque token）や冗長な room/rate を除外し、
 * UI 表示・LLM tool 返却・A2A data.hotels で共通利用する。
 */

import type { HotelResult, HotelRoom, HotelRate } from './hotelbeds-client.js';

export interface CompactHotelRate {
  boardCode: string;
  boardName: string;
  net: string;
  sellingRate?: string;
}

export interface CompactHotelRoom {
  code: string;
  name: string;
  rates: CompactHotelRate[];
}

export interface CompactHotelResult {
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
  rooms: CompactHotelRoom[];
  imageUrl?: string;
  webUrl?: string;
}

function cheapestRate(rooms: HotelRoom[]): { room: HotelRoom; rate: HotelRate } | null {
  let best: { room: HotelRoom; rate: HotelRate; net: number } | null = null;

  for (const room of rooms) {
    for (const rate of room.rates) {
      const net = parseFloat(rate.net);
      if (!Number.isFinite(net)) continue;
      if (!best || net < best.net) {
        best = { room, rate, net };
      }
    }
  }

  return best ? { room: best.room, rate: best.rate } : null;
}

export function toCompactHotel(hotel: HotelResult): CompactHotelResult {
  const pick = cheapestRate(hotel.rooms);

  const compactRooms: CompactHotelRoom[] = pick
    ? [
        {
          code: pick.room.code,
          name: pick.room.name,
          rates: [
            {
              boardCode: pick.rate.boardCode,
              boardName: pick.rate.boardName,
              net: pick.rate.net,
              ...(pick.rate.sellingRate ? { sellingRate: pick.rate.sellingRate } : {}),
            },
          ],
        },
      ]
    : [];

  return {
    code: hotel.code,
    name: hotel.name,
    categoryCode: hotel.categoryCode,
    categoryName: hotel.categoryName,
    destinationCode: hotel.destinationCode,
    destinationName: hotel.destinationName,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    minRate: hotel.minRate,
    maxRate: hotel.maxRate,
    currency: hotel.currency,
    rooms: compactRooms,
    ...(hotel.imageUrl ? { imageUrl: hotel.imageUrl } : {}),
    ...(hotel.webUrl ? { webUrl: hotel.webUrl } : {}),
  };
}

export function compactHotelResults(hotels: HotelResult[]): CompactHotelResult[] {
  return hotels.map(toCompactHotel);
}
