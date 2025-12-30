/**
 * Flight Agent - Mock Data
 *
 * フライト検索のモックデータ
 */

export interface FlightInfo {
  carrier: string;
  flightNo: string;
  price: number;
  currency: string;
  departure: {
    airport: string;
    time: string;
    date: string;
  };
  arrival: {
    airport: string;
    time: string;
    date: string;
  };
  duration: string;
  class: string;
}

export const MOCK_FLIGHTS: FlightInfo[] = [
  {
    carrier: 'Air France',
    flightNo: 'AF275',
    price: 85000,
    currency: 'JPY',
    departure: { airport: 'NRT', time: '10:30', date: '2025-06-15' },
    arrival: { airport: 'CDG', time: '15:45', date: '2025-06-15' },
    duration: '13h 15m',
    class: 'Economy',
  },
  {
    carrier: 'Japan Airlines',
    flightNo: 'JL045',
    price: 92000,
    currency: 'JPY',
    departure: { airport: 'HND', time: '11:00', date: '2025-06-15' },
    arrival: { airport: 'CDG', time: '16:30', date: '2025-06-15' },
    duration: '13h 30m',
    class: 'Economy',
  },
  {
    carrier: 'ANA',
    flightNo: 'NH215',
    price: 88000,
    currency: 'JPY',
    departure: { airport: 'NRT', time: '09:00', date: '2025-06-15' },
    arrival: { airport: 'CDG', time: '14:30', date: '2025-06-15' },
    duration: '13h 30m',
    class: 'Economy',
  },
  {
    carrier: 'Lufthansa',
    flightNo: 'LH711',
    price: 78000,
    currency: 'JPY',
    departure: { airport: 'NRT', time: '13:00', date: '2025-06-15' },
    arrival: { airport: 'FRA', time: '18:00', date: '2025-06-15' },
    duration: '12h 00m',
    class: 'Economy',
  },
  {
    carrier: 'British Airways',
    flightNo: 'BA006',
    price: 95000,
    currency: 'JPY',
    departure: { airport: 'HND', time: '19:00', date: '2025-06-15' },
    arrival: { airport: 'LHR', time: '23:30', date: '2025-06-15' },
    duration: '12h 30m',
    class: 'Economy',
  },
];

/**
 * パラメータに基づいてフライトを選択
 */
export function selectFlights(params: {
  origin?: string;
  destination?: string;
  date?: string;
  maxResults?: number;
}): FlightInfo[] {
  let results = [...MOCK_FLIGHTS];

  // 出発地フィルタ
  if (params.origin) {
    const origin = params.origin.toUpperCase();
    results = results.filter(
      (f) => f.departure.airport === origin || f.departure.airport.includes(origin)
    );
  }

  // 目的地フィルタ（パリ、ロンドン等のキーワード対応）
  if (params.destination) {
    const dest = params.destination.toLowerCase();
    if (dest.includes('paris') || dest.includes('パリ') || dest === 'cdg') {
      results = results.filter((f) => f.arrival.airport === 'CDG');
    } else if (dest.includes('london') || dest.includes('ロンドン') || dest === 'lhr') {
      results = results.filter((f) => f.arrival.airport === 'LHR');
    } else if (dest.includes('frankfurt') || dest.includes('フランクフルト') || dest === 'fra') {
      results = results.filter((f) => f.arrival.airport === 'FRA');
    }
  }

  // 日付があれば設定
  if (params.date) {
    results = results.map((f) => ({
      ...f,
      departure: { ...f.departure, date: params.date! },
      arrival: { ...f.arrival, date: params.date! },
    }));
  }

  // 結果がない場合はランダムに1-2件返す
  if (results.length === 0) {
    const shuffled = [...MOCK_FLIGHTS].sort(() => Math.random() - 0.5);
    results = shuffled.slice(0, 2);
  }

  // 最大件数
  const maxResults = params.maxResults ?? 3;
  return results.slice(0, maxResults);
}
