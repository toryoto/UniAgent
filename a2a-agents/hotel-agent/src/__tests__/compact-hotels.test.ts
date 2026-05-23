import { describe, it, expect } from 'vitest';
import { toCompactHotel, compactHotelResults } from '../compact-hotels.js';
import type { HotelResult } from '../hotelbeds-client.js';

function makeRate(net: string, rateKey = 'FAKE_RATEKEY_'.padEnd(200, 'X')) {
  return {
    rateKey,
    rateType: 'BOOKABLE',
    net,
    boardCode: 'BB',
    boardName: 'BED AND BREAKFAST',
    adults: 2,
    children: 0,
    rooms: 1,
  };
}

function makeHotel(overrides?: Partial<HotelResult>): HotelResult {
  return {
    code: 1234,
    name: 'Test Hotel',
    categoryCode: '4EST',
    categoryName: '4 STARS',
    destinationCode: 'TYO',
    destinationName: 'Tokyo',
    latitude: '35.68',
    longitude: '139.76',
    minRate: '100.00',
    maxRate: '500.00',
    currency: 'EUR',
    rooms: [
      {
        code: 'DBL.ST',
        name: 'DOUBLE STANDARD',
        rates: [makeRate('150.00'), makeRate('120.00'), makeRate('200.00')],
      },
      {
        code: 'SUI.PR',
        name: 'SUITE PREMIUM',
        rates: [makeRate('500.00'), makeRate('400.00')],
      },
      {
        code: 'TWN.ST',
        name: 'TWIN STANDARD',
        rates: [makeRate('110.00')],
      },
    ],
    ...overrides,
  };
}

describe('toCompactHotel', () => {
  it('selects the cheapest rate across all rooms', () => {
    const hotel = makeHotel();
    const compact = toCompactHotel(hotel);

    expect(compact.rooms).toHaveLength(1);
    expect(compact.rooms[0].rates).toHaveLength(1);
    expect(compact.rooms[0].rates[0].net).toBe('110.00');
    expect(compact.rooms[0].code).toBe('TWN.ST');
  });

  it('removes rateKey from the output', () => {
    const hotel = makeHotel();
    const compact = toCompactHotel(hotel);
    const json = JSON.stringify(compact);

    expect(json).not.toContain('rateKey');
    expect(json).not.toContain('FAKE_RATEKEY_');
  });

  it('removes rateType, adults, children, rooms from rate', () => {
    const hotel = makeHotel();
    const compact = toCompactHotel(hotel);
    const rate = compact.rooms[0].rates[0];

    expect(rate).not.toHaveProperty('rateType');
    expect(rate).not.toHaveProperty('adults');
    expect(rate).not.toHaveProperty('children');
    expect(rate).not.toHaveProperty('rooms');
  });

  it('preserves hotel-level metadata', () => {
    const hotel = makeHotel({ imageUrl: 'https://example.com/img.jpg', webUrl: 'https://hotel.com' });
    const compact = toCompactHotel(hotel);

    expect(compact.code).toBe(1234);
    expect(compact.name).toBe('Test Hotel');
    expect(compact.categoryCode).toBe('4EST');
    expect(compact.currency).toBe('EUR');
    expect(compact.imageUrl).toBe('https://example.com/img.jpg');
    expect(compact.webUrl).toBe('https://hotel.com');
  });

  it('preserves sellingRate when present', () => {
    const hotel = makeHotel({
      rooms: [
        {
          code: 'DBL.ST',
          name: 'DOUBLE',
          rates: [{ ...makeRate('100.00'), sellingRate: '120.00' }],
        },
      ],
    });
    const compact = toCompactHotel(hotel);

    expect(compact.rooms[0].rates[0].sellingRate).toBe('120.00');
  });

  it('handles hotel with empty rooms gracefully', () => {
    const hotel = makeHotel({ rooms: [] });
    const compact = toCompactHotel(hotel);

    expect(compact.rooms).toHaveLength(0);
  });
});

describe('compactHotelResults', () => {
  it('compacts all hotels in the array', () => {
    const hotels = [makeHotel({ code: 1 }), makeHotel({ code: 2 }), makeHotel({ code: 3 })];
    const result = compactHotelResults(hotels);

    expect(result).toHaveLength(3);
    result.forEach((h) => {
      expect(h.rooms).toHaveLength(1);
      expect(h.rooms[0].rates).toHaveLength(1);
    });
  });

  it('drastically reduces JSON size compared to raw input', () => {
    const bigHotel = makeHotel({
      rooms: Array.from({ length: 20 }, (_, i) => ({
        code: `ROOM_${i}`,
        name: `Room Type ${i}`,
        rates: Array.from({ length: 15 }, (_, j) => makeRate(`${100 + i * 10 + j}.00`)),
      })),
    });
    const hotels = Array.from({ length: 10 }, () => bigHotel);

    const rawSize = JSON.stringify(hotels).length;
    const compactSize = JSON.stringify(compactHotelResults(hotels)).length;

    expect(compactSize).toBeLessThan(rawSize * 0.05);
  });
});
