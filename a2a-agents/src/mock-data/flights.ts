export interface FlightData {
  airline: string;
  airlineCode: string;
  flightNumber: string;
  origin: string;
  originCity: string;
  destination: string;
  destinationCity: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  stopCities?: string[];
  price: number;
  currency: string;
  cabinClass: string;
  seatsAvailable: number;
  refundable: boolean;
}

const FLIGHTS: FlightData[] = [
  // --- NRT / HND (Tokyo) → LHR (London) ---
  {
    airline: 'Japan Airlines', airlineCode: 'JL', flightNumber: 'JL401',
    origin: 'NRT', originCity: 'Tokyo', destination: 'LHR', destinationCity: 'London',
    departureTime: '11:30', arrivalTime: '15:45', durationMinutes: 735,
    stops: 0, price: 120000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 14, refundable: false,
  },
  {
    airline: 'British Airways', airlineCode: 'BA', flightNumber: 'BA5',
    origin: 'NRT', originCity: 'Tokyo', destination: 'LHR', destinationCity: 'London',
    departureTime: '10:00', arrivalTime: '14:30', durationMinutes: 750,
    stops: 0, price: 135000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 6, refundable: true,
  },
  {
    airline: 'Japan Airlines', airlineCode: 'JL', flightNumber: 'JL7001',
    origin: 'NRT', originCity: 'Tokyo', destination: 'LHR', destinationCity: 'London',
    departureTime: '13:00', arrivalTime: '06:00+1', durationMinutes: 900,
    stops: 1, stopCities: ['Helsinki'], price: 89000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 22, refundable: false,
  },
  {
    airline: 'Japan Airlines', airlineCode: 'JL', flightNumber: 'JL401B',
    origin: 'NRT', originCity: 'Tokyo', destination: 'LHR', destinationCity: 'London',
    departureTime: '11:30', arrivalTime: '15:45', durationMinutes: 735,
    stops: 0, price: 380000, currency: 'JPY', cabinClass: 'business', seatsAvailable: 4, refundable: true,
  },

  // --- NRT (Tokyo) → CDG (Paris) ---
  {
    airline: 'Air France', airlineCode: 'AF', flightNumber: 'AF271',
    origin: 'NRT', originCity: 'Tokyo', destination: 'CDG', destinationCity: 'Paris',
    departureTime: '12:20', arrivalTime: '18:15', durationMinutes: 715,
    stops: 0, price: 128000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 9, refundable: false,
  },
  {
    airline: 'ANA', airlineCode: 'NH', flightNumber: 'NH201',
    origin: 'NRT', originCity: 'Tokyo', destination: 'CDG', destinationCity: 'Paris',
    departureTime: '10:55', arrivalTime: '17:00', durationMinutes: 725,
    stops: 0, price: 142000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 5, refundable: true,
  },
  {
    airline: 'Air France', airlineCode: 'AF', flightNumber: 'AF271B',
    origin: 'NRT', originCity: 'Tokyo', destination: 'CDG', destinationCity: 'Paris',
    departureTime: '12:20', arrivalTime: '18:15', durationMinutes: 715,
    stops: 0, price: 410000, currency: 'JPY', cabinClass: 'business', seatsAvailable: 3, refundable: true,
  },

  // --- NRT (Tokyo) → JFK (New York) ---
  {
    airline: 'ANA', airlineCode: 'NH', flightNumber: 'NH110',
    origin: 'NRT', originCity: 'Tokyo', destination: 'JFK', destinationCity: 'New York',
    departureTime: '17:00', arrivalTime: '16:00', durationMinutes: 780,
    stops: 0, price: 115000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 18, refundable: false,
  },
  {
    airline: 'Japan Airlines', airlineCode: 'JL', flightNumber: 'JL5',
    origin: 'NRT', originCity: 'Tokyo', destination: 'JFK', destinationCity: 'New York',
    departureTime: '11:00', arrivalTime: '10:30', durationMinutes: 810,
    stops: 0, price: 125000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 7, refundable: false,
  },
  {
    airline: 'ANA', airlineCode: 'NH', flightNumber: 'NH110B',
    origin: 'NRT', originCity: 'Tokyo', destination: 'JFK', destinationCity: 'New York',
    departureTime: '17:00', arrivalTime: '16:00', durationMinutes: 780,
    stops: 0, price: 450000, currency: 'JPY', cabinClass: 'business', seatsAvailable: 2, refundable: true,
  },

  // --- NRT (Tokyo) → SIN (Singapore) ---
  {
    airline: 'Singapore Airlines', airlineCode: 'SQ', flightNumber: 'SQ637',
    origin: 'NRT', originCity: 'Tokyo', destination: 'SIN', destinationCity: 'Singapore',
    departureTime: '09:40', arrivalTime: '16:05', durationMinutes: 385,
    stops: 0, price: 65000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 20, refundable: false,
  },
  {
    airline: 'ANA', airlineCode: 'NH', flightNumber: 'NH829',
    origin: 'NRT', originCity: 'Tokyo', destination: 'SIN', destinationCity: 'Singapore',
    departureTime: '18:00', arrivalTime: '00:30+1', durationMinutes: 390,
    stops: 0, price: 72000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 11, refundable: true,
  },
  {
    airline: 'Singapore Airlines', airlineCode: 'SQ', flightNumber: 'SQ637B',
    origin: 'NRT', originCity: 'Tokyo', destination: 'SIN', destinationCity: 'Singapore',
    departureTime: '09:40', arrivalTime: '16:05', durationMinutes: 385,
    stops: 0, price: 250000, currency: 'JPY', cabinClass: 'business', seatsAvailable: 5, refundable: true,
  },

  // --- NRT (Tokyo) → SYD (Sydney) ---
  {
    airline: 'Qantas', airlineCode: 'QF', flightNumber: 'QF26',
    origin: 'NRT', originCity: 'Tokyo', destination: 'SYD', destinationCity: 'Sydney',
    departureTime: '21:30', arrivalTime: '09:00+1', durationMinutes: 570,
    stops: 0, price: 95000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 15, refundable: false,
  },
  {
    airline: 'Japan Airlines', airlineCode: 'JL', flightNumber: 'JL771',
    origin: 'NRT', originCity: 'Tokyo', destination: 'SYD', destinationCity: 'Sydney',
    departureTime: '11:30', arrivalTime: '23:55', durationMinutes: 565,
    stops: 0, price: 105000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 8, refundable: true,
  },

  // --- HND (Tokyo) → ICN (Seoul) ---
  {
    airline: 'ANA', airlineCode: 'NH', flightNumber: 'NH861',
    origin: 'HND', originCity: 'Tokyo', destination: 'ICN', destinationCity: 'Seoul',
    departureTime: '08:00', arrivalTime: '10:35', durationMinutes: 155,
    stops: 0, price: 28000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 30, refundable: false,
  },
  {
    airline: 'Korean Air', airlineCode: 'KE', flightNumber: 'KE2001',
    origin: 'HND', originCity: 'Tokyo', destination: 'ICN', destinationCity: 'Seoul',
    departureTime: '14:00', arrivalTime: '16:40', durationMinutes: 160,
    stops: 0, price: 32000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 25, refundable: true,
  },

  // --- HND (Tokyo) → BKK (Bangkok) ---
  {
    airline: 'Thai Airways', airlineCode: 'TG', flightNumber: 'TG661',
    origin: 'HND', originCity: 'Tokyo', destination: 'BKK', destinationCity: 'Bangkok',
    departureTime: '23:50', arrivalTime: '05:30+1', durationMinutes: 340,
    stops: 0, price: 55000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 17, refundable: false,
  },
  {
    airline: 'ANA', airlineCode: 'NH', flightNumber: 'NH847',
    origin: 'HND', originCity: 'Tokyo', destination: 'BKK', destinationCity: 'Bangkok',
    departureTime: '10:30', arrivalTime: '16:10', durationMinutes: 340,
    stops: 0, price: 62000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 12, refundable: true,
  },

  // --- NRT (Tokyo) → LAX (Los Angeles) ---
  {
    airline: 'ANA', airlineCode: 'NH', flightNumber: 'NH106',
    origin: 'NRT', originCity: 'Tokyo', destination: 'LAX', destinationCity: 'Los Angeles',
    departureTime: '17:30', arrivalTime: '10:30', durationMinutes: 540,
    stops: 0, price: 108000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 14, refundable: false,
  },
  {
    airline: 'United Airlines', airlineCode: 'UA', flightNumber: 'UA837',
    origin: 'NRT', originCity: 'Tokyo', destination: 'LAX', destinationCity: 'Los Angeles',
    departureTime: '12:00', arrivalTime: '06:10', durationMinutes: 550,
    stops: 0, price: 98000, currency: 'JPY', cabinClass: 'economy', seatsAvailable: 21, refundable: true,
  },
];

export interface FlightFilterOptions {
  origin?: string;
  destination?: string;
  cabinClass?: string;
  maxPrice?: number;
  directOnly?: boolean;
}

const CITY_TO_IATA: Record<string, string[]> = {
  'Tokyo': ['NRT', 'HND'],
  '東京': ['NRT', 'HND'],
  'London': ['LHR'],
  'ロンドン': ['LHR'],
  'Paris': ['CDG'],
  'パリ': ['CDG'],
  'New York': ['JFK', 'EWR'],
  'ニューヨーク': ['JFK', 'EWR'],
  'Singapore': ['SIN'],
  'シンガポール': ['SIN'],
  'Sydney': ['SYD'],
  'シドニー': ['SYD'],
  'Seoul': ['ICN', 'GMP'],
  'ソウル': ['ICN', 'GMP'],
  'Bangkok': ['BKK'],
  'バンコク': ['BKK'],
  'Los Angeles': ['LAX'],
  'ロサンゼルス': ['LAX'],
};

function matchesLocation(flightCode: string, query?: string): boolean {
  if (!query) return true;
  const upper = query.toUpperCase();
  if (flightCode.toUpperCase() === upper) return true;
  const codes = CITY_TO_IATA[query] ?? CITY_TO_IATA[query.charAt(0).toUpperCase() + query.slice(1).toLowerCase()];
  if (codes) return codes.includes(flightCode.toUpperCase());
  return false;
}

export function filterFlights(opts: FlightFilterOptions): FlightData[] {
  return FLIGHTS.filter((f) => {
    if (!matchesLocation(f.origin, opts.origin) && !matchesLocation(f.originCity, opts.origin)) return false;
    if (!matchesLocation(f.destination, opts.destination) && !matchesLocation(f.destinationCity, opts.destination)) return false;
    if (opts.cabinClass && f.cabinClass !== opts.cabinClass) return false;
    if (opts.maxPrice && f.price > opts.maxPrice) return false;
    if (opts.directOnly && f.stops > 0) return false;
    return true;
  });
}

export function getAllFlights(): FlightData[] {
  return FLIGHTS;
}
