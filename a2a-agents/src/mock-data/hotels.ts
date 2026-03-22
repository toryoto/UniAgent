export interface HotelData {
  name: string;
  stars: number;
  rating: number;
  reviewCount: number;
  pricePerNight: number;
  currency: string;
  location: {
    city: string;
    country: string;
    district: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  amenities: string[];
  roomTypes: string[];
  checkInTime: string;
  checkOutTime: string;
  petFriendly: boolean;
  ecoRating?: number;
  nearestAirport?: string;
  airportDistanceKm?: number;
}

const HOTELS: HotelData[] = [
  // --- Tokyo ---
  {
    name: 'The Peninsula Tokyo',
    stars: 5, rating: 4.9, reviewCount: 2340, pricePerNight: 65000, currency: 'JPY',
    location: { city: 'Tokyo', country: 'Japan', district: 'Marunouchi', address: '1-8-1 Yurakucho, Chiyoda-ku', latitude: 35.6745, longitude: 139.7614 },
    amenities: ['WiFi', 'Spa', 'Pool', 'Fitness', 'Restaurant', 'Bar', 'Concierge', 'Valet Parking', 'Room Service'],
    roomTypes: ['Deluxe Room', 'Premier Suite', 'Peninsula Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 4, nearestAirport: 'HND', airportDistanceKm: 16,
  },
  {
    name: 'Shinjuku Granbell Hotel',
    stars: 3, rating: 4.2, reviewCount: 1850, pricePerNight: 12000, currency: 'JPY',
    location: { city: 'Tokyo', country: 'Japan', district: 'Shinjuku', address: '2-14-5 Kabukicho, Shinjuku-ku', latitude: 35.6951, longitude: 139.7036 },
    amenities: ['WiFi', 'Restaurant', 'Laundry'],
    roomTypes: ['Standard Double', 'Superior Twin'],
    checkInTime: '14:00', checkOutTime: '11:00', petFriendly: false, nearestAirport: 'HND', airportDistanceKm: 22,
  },
  {
    name: 'Hoshinoya Tokyo',
    stars: 5, rating: 4.8, reviewCount: 890, pricePerNight: 80000, currency: 'JPY',
    location: { city: 'Tokyo', country: 'Japan', district: 'Otemachi', address: '1-9-1 Otemachi, Chiyoda-ku', latitude: 35.6867, longitude: 139.7634 },
    amenities: ['WiFi', 'Onsen', 'Spa', 'Restaurant', 'Meditation Room', 'Room Service'],
    roomTypes: ['Kiku Room', 'Yuri Room', 'Sakura Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 5,
  },
  // --- Paris ---
  {
    name: 'Hotel Le Marais Boutique',
    stars: 4, rating: 4.7, reviewCount: 1120, pricePerNight: 25000, currency: 'JPY',
    location: { city: 'Paris', country: 'France', district: 'Le Marais', address: '12 Rue des Archives, 75004', latitude: 48.8584, longitude: 2.3536 },
    amenities: ['WiFi', 'Breakfast', 'Air Conditioning', 'Room Service', 'Bar'],
    roomTypes: ['Deluxe Double', 'Superior Suite'],
    checkInTime: '14:00', checkOutTime: '11:00', petFriendly: true, ecoRating: 3, nearestAirport: 'CDG', airportDistanceKm: 28,
  },
  {
    name: 'Grand Hotel Opera Paris',
    stars: 5, rating: 4.5, reviewCount: 2100, pricePerNight: 45000, currency: 'JPY',
    location: { city: 'Paris', country: 'France', district: 'Opera', address: '8 Boulevard des Capucines, 75009', latitude: 48.8708, longitude: 2.3318 },
    amenities: ['WiFi', 'Spa', 'Restaurant', 'Concierge', 'Fitness Center', 'Business Center'],
    roomTypes: ['Classic Room', 'Opera Suite', 'Presidential Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 4, nearestAirport: 'CDG', airportDistanceKm: 26,
  },
  {
    name: 'Montmartre View Inn',
    stars: 3, rating: 4.3, reviewCount: 780, pricePerNight: 15000, currency: 'JPY',
    location: { city: 'Paris', country: 'France', district: 'Montmartre', address: '45 Rue Lepic, 75018', latitude: 48.8845, longitude: 2.3333 },
    amenities: ['WiFi', 'Breakfast', 'City View'],
    roomTypes: ['Standard Double', 'View Room'],
    checkInTime: '14:00', checkOutTime: '10:00', petFriendly: false,
  },
  // --- London ---
  {
    name: 'The Westminster London',
    stars: 5, rating: 4.8, reviewCount: 1650, pricePerNight: 55000, currency: 'JPY',
    location: { city: 'London', country: 'UK', district: 'Westminster', address: '30 Victoria Street, SW1H', latitude: 51.4975, longitude: -0.1357 },
    amenities: ['WiFi', 'Spa', 'Restaurant', 'Gym', 'Business Center', 'Concierge'],
    roomTypes: ['Executive Suite', 'Deluxe King', 'Royal Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: true, ecoRating: 4, nearestAirport: 'LHR', airportDistanceKm: 24,
  },
  {
    name: 'Covent Garden Hotel',
    stars: 4, rating: 4.6, reviewCount: 920, pricePerNight: 35000, currency: 'JPY',
    location: { city: 'London', country: 'UK', district: 'Covent Garden', address: '10 Monmouth Street, WC2H', latitude: 51.5136, longitude: -0.1269 },
    amenities: ['WiFi', 'Restaurant', 'Bar', 'Room Service', 'Screening Room'],
    roomTypes: ['Deluxe King', 'Loft Suite'],
    checkInTime: '14:00', checkOutTime: '11:00', petFriendly: true, nearestAirport: 'LHR', airportDistanceKm: 27,
  },
  // --- New York ---
  {
    name: 'The Plaza Hotel',
    stars: 5, rating: 4.7, reviewCount: 3200, pricePerNight: 72000, currency: 'JPY',
    location: { city: 'New York', country: 'USA', district: 'Midtown Manhattan', address: '768 5th Avenue, NY 10019', latitude: 40.7645, longitude: -73.9744 },
    amenities: ['WiFi', 'Spa', 'Pool', 'Fitness', 'Multiple Restaurants', 'Butler Service', 'Shopping Gallery'],
    roomTypes: ['Edwardian Suite', 'Royal Plaza Suite', 'Penthouse'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: true, ecoRating: 3, nearestAirport: 'JFK', airportDistanceKm: 26,
  },
  {
    name: 'Pod 51 Hotel',
    stars: 2, rating: 4.0, reviewCount: 4100, pricePerNight: 15000, currency: 'JPY',
    location: { city: 'New York', country: 'USA', district: 'Midtown East', address: '230 E 51st St, NY 10022', latitude: 40.7559, longitude: -73.9708 },
    amenities: ['WiFi', 'Rooftop Bar', 'Shared Kitchen'],
    roomTypes: ['Pod Single', 'Pod Queen', 'Pod Bunk'],
    checkInTime: '15:00', checkOutTime: '11:00', petFriendly: false, nearestAirport: 'JFK', airportDistanceKm: 24,
  },
  // --- Singapore ---
  {
    name: 'Marina Bay Sands',
    stars: 5, rating: 4.6, reviewCount: 5400, pricePerNight: 58000, currency: 'JPY',
    location: { city: 'Singapore', country: 'Singapore', district: 'Marina Bay', address: '10 Bayfront Avenue', latitude: 1.2834, longitude: 103.8607 },
    amenities: ['WiFi', 'Infinity Pool', 'Casino', 'Spa', 'Multiple Restaurants', 'Shopping Mall', 'Convention Center'],
    roomTypes: ['Deluxe Room', 'Orchid Suite', 'Chairman Suite'],
    checkInTime: '15:00', checkOutTime: '11:00', petFriendly: false, ecoRating: 4, nearestAirport: 'SIN', airportDistanceKm: 18,
  },
  {
    name: 'YOTEL Singapore',
    stars: 3, rating: 4.3, reviewCount: 2100, pricePerNight: 16000, currency: 'JPY',
    location: { city: 'Singapore', country: 'Singapore', district: 'Orchard', address: '366 Orchard Road', latitude: 1.3028, longitude: 103.8357 },
    amenities: ['WiFi', 'Pool', 'Gym', 'Restaurant', 'Self Check-in'],
    roomTypes: ['Premium Queen', 'First Class King', 'VIP Suite'],
    checkInTime: '14:00', checkOutTime: '12:00', petFriendly: false, nearestAirport: 'SIN', airportDistanceKm: 20,
  },
  // --- Barcelona ---
  {
    name: 'Hotel Arts Barcelona',
    stars: 5, rating: 4.7, reviewCount: 1800, pricePerNight: 48000, currency: 'JPY',
    location: { city: 'Barcelona', country: 'Spain', district: 'Vila Olimpica', address: 'Carrer de la Marina 19-21', latitude: 41.3875, longitude: 2.1972 },
    amenities: ['WiFi', 'Pool', 'Spa', 'Beach Access', 'Multiple Restaurants', 'Fitness'],
    roomTypes: ['Deluxe Sea View', 'Arts Suite', 'Penthouse'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: true, ecoRating: 4, nearestAirport: 'BCN', airportDistanceKm: 14,
  },
  {
    name: 'Casa Camper Barcelona',
    stars: 4, rating: 4.5, reviewCount: 650, pricePerNight: 22000, currency: 'JPY',
    location: { city: 'Barcelona', country: 'Spain', district: 'El Raval', address: 'Carrer d\'Elisabets 11', latitude: 41.3825, longitude: 2.1701 },
    amenities: ['WiFi', 'Rooftop Terrace', 'Free Snack Bar', 'Bicycle Rental'],
    roomTypes: ['Camper Room', 'Suite'],
    checkInTime: '14:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 5,
  },
  // --- Dubai ---
  {
    name: 'Burj Al Arab Jumeirah',
    stars: 5, rating: 4.9, reviewCount: 4200, pricePerNight: 120000, currency: 'JPY',
    location: { city: 'Dubai', country: 'UAE', district: 'Jumeirah', address: 'Jumeirah Beach Road', latitude: 25.1412, longitude: 55.1853 },
    amenities: ['WiFi', 'Private Beach', 'Spa', 'Multiple Pools', 'Helipad', 'Butler Service', '9 Restaurants'],
    roomTypes: ['Deluxe Suite', 'Panoramic Suite', 'Royal Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 3, nearestAirport: 'DXB', airportDistanceKm: 22,
  },
  {
    name: 'Rove Downtown Dubai',
    stars: 3, rating: 4.4, reviewCount: 3100, pricePerNight: 14000, currency: 'JPY',
    location: { city: 'Dubai', country: 'UAE', district: 'Downtown', address: 'Al Mustaqbal Street', latitude: 25.1857, longitude: 55.2651 },
    amenities: ['WiFi', 'Pool', 'Gym', 'Restaurant', 'Laundry'],
    roomTypes: ['Rover Room', 'Rover Twin'],
    checkInTime: '14:00', checkOutTime: '12:00', petFriendly: false, nearestAirport: 'DXB', airportDistanceKm: 12,
  },
  // --- Sydney ---
  {
    name: 'Park Hyatt Sydney',
    stars: 5, rating: 4.8, reviewCount: 1400, pricePerNight: 62000, currency: 'JPY',
    location: { city: 'Sydney', country: 'Australia', district: 'The Rocks', address: '7 Hickson Road', latitude: -33.8563, longitude: 151.2092 },
    amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Opera House Views', 'Fitness'],
    roomTypes: ['Opera Deluxe', 'Sydney Suite', 'Ambassador Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 4, nearestAirport: 'SYD', airportDistanceKm: 14,
  },
  // --- Bangkok ---
  {
    name: 'Mandarin Oriental Bangkok',
    stars: 5, rating: 4.8, reviewCount: 2800, pricePerNight: 38000, currency: 'JPY',
    location: { city: 'Bangkok', country: 'Thailand', district: 'Bangrak', address: '48 Oriental Avenue', latitude: 13.7234, longitude: 100.5152 },
    amenities: ['WiFi', 'Spa', 'Pool', 'Multiple Restaurants', 'River Views', 'Thai Cooking Class'],
    roomTypes: ['Superior Room', 'State Room', 'Royal Suite'],
    checkInTime: '14:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 4, nearestAirport: 'BKK', airportDistanceKm: 30,
  },
  {
    name: 'Ibis Bangkok Riverside',
    stars: 3, rating: 4.1, reviewCount: 2200, pricePerNight: 5000, currency: 'JPY',
    location: { city: 'Bangkok', country: 'Thailand', district: 'Klongsan', address: '27 Charoen Nakhon Road', latitude: 13.7186, longitude: 100.5072 },
    amenities: ['WiFi', 'Pool', 'Restaurant', 'Shuttle Boat'],
    roomTypes: ['Standard Room', 'River View Room'],
    checkInTime: '14:00', checkOutTime: '12:00', petFriendly: false, nearestAirport: 'BKK', airportDistanceKm: 32,
  },
  // --- Rome ---
  {
    name: 'Hotel de Russie Roma',
    stars: 5, rating: 4.7, reviewCount: 1300, pricePerNight: 52000, currency: 'JPY',
    location: { city: 'Rome', country: 'Italy', district: 'Centro Storico', address: 'Via del Babuino 9', latitude: 41.9093, longitude: 12.4788 },
    amenities: ['WiFi', 'Spa', 'Garden', 'Restaurant', 'Bar', 'Fitness'],
    roomTypes: ['Classic Room', 'Popolo Suite', 'Nijinsky Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: true, ecoRating: 4, nearestAirport: 'FCO', airportDistanceKm: 30,
  },
  // --- Seoul ---
  {
    name: 'Signiel Seoul',
    stars: 5, rating: 4.8, reviewCount: 1600, pricePerNight: 42000, currency: 'JPY',
    location: { city: 'Seoul', country: 'South Korea', district: 'Songpa-gu', address: '300 Olympic-ro, Lotte World Tower', latitude: 37.5126, longitude: 127.1025 },
    amenities: ['WiFi', 'Pool', 'Spa', 'Fitness', 'Sky Lounge', 'Restaurant', 'Observation Deck Access'],
    roomTypes: ['Grand Deluxe', 'Premier Suite', 'Royal Suite'],
    checkInTime: '15:00', checkOutTime: '11:00', petFriendly: false, ecoRating: 5, nearestAirport: 'ICN', airportDistanceKm: 62,
  },
  // --- Istanbul ---
  {
    name: 'Four Seasons Sultanahmet',
    stars: 5, rating: 4.9, reviewCount: 980, pricePerNight: 48000, currency: 'JPY',
    location: { city: 'Istanbul', country: 'Turkey', district: 'Sultanahmet', address: 'Tevkifhane Sokak No 1', latitude: 41.0056, longitude: 28.9762 },
    amenities: ['WiFi', 'Restaurant', 'Spa', 'Garden Terrace', 'Concierge', 'Historic Building'],
    roomTypes: ['Superior Room', 'Deluxe Suite', 'Pasha Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: true, ecoRating: 3, nearestAirport: 'IST', airportDistanceKm: 45,
  },
  // --- Bali ---
  {
    name: 'COMO Uma Ubud',
    stars: 5, rating: 4.7, reviewCount: 720, pricePerNight: 35000, currency: 'JPY',
    location: { city: 'Bali', country: 'Indonesia', district: 'Ubud', address: 'Jalan Raya Sanggingan, Kedewatan', latitude: -8.4952, longitude: 115.2487 },
    amenities: ['WiFi', 'Pool', 'Spa', 'Yoga Studio', 'Restaurant', 'Rice Terrace Views'],
    roomTypes: ['Terrace Room', 'Garden Pool Suite', 'COMO Villa'],
    checkInTime: '14:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 5, nearestAirport: 'DPS', airportDistanceKm: 36,
  },
  // --- Lisbon ---
  {
    name: 'Pestana Palace Lisboa',
    stars: 5, rating: 4.6, reviewCount: 1100, pricePerNight: 33000, currency: 'JPY',
    location: { city: 'Lisbon', country: 'Portugal', district: 'Alcantara', address: 'Rua Jau 54', latitude: 38.7013, longitude: -9.1771 },
    amenities: ['WiFi', 'Pool', 'Spa', 'Garden', 'Restaurant', 'Historic Palace'],
    roomTypes: ['Classic Room', 'Palace Suite', 'Royal Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: true, ecoRating: 3, nearestAirport: 'LIS', airportDistanceKm: 10,
  },
  // --- Cape Town ---
  {
    name: 'The Silo Hotel',
    stars: 5, rating: 4.8, reviewCount: 620, pricePerNight: 55000, currency: 'JPY',
    location: { city: 'Cape Town', country: 'South Africa', district: 'V&A Waterfront', address: 'Silo Square, South Arm Road', latitude: -33.9084, longitude: 18.4213 },
    amenities: ['WiFi', 'Rooftop Pool', 'Spa', 'Restaurant', 'Museum Access', 'Table Mountain Views'],
    roomTypes: ['Superior Room', 'Penthouse Suite', 'Family Loft'],
    checkInTime: '14:00', checkOutTime: '11:00', petFriendly: false, ecoRating: 4, nearestAirport: 'CPT', airportDistanceKm: 22,
  },
  // --- Osaka ---
  {
    name: 'The Ritz-Carlton Osaka',
    stars: 5, rating: 4.7, reviewCount: 1900, pricePerNight: 48000, currency: 'JPY',
    location: { city: 'Osaka', country: 'Japan', district: 'Kita-ku', address: '2-5-25 Umeda', latitude: 34.6996, longitude: 135.4947 },
    amenities: ['WiFi', 'Spa', 'Pool', 'Fitness', 'Multiple Restaurants', 'Club Lounge'],
    roomTypes: ['Deluxe Room', 'Club Room', 'Presidential Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 4, nearestAirport: 'KIX', airportDistanceKm: 50,
  },
  {
    name: 'Cross Hotel Osaka',
    stars: 3, rating: 4.4, reviewCount: 2800, pricePerNight: 10000, currency: 'JPY',
    location: { city: 'Osaka', country: 'Japan', district: 'Chuo-ku', address: '2-5-15 Shinsaibashisuji', latitude: 34.6719, longitude: 135.5034 },
    amenities: ['WiFi', 'Restaurant', 'Bar', 'Laundry'],
    roomTypes: ['Standard Single', 'Moderate Double', 'Deluxe Twin'],
    checkInTime: '14:00', checkOutTime: '11:00', petFriendly: false, nearestAirport: 'KIX', airportDistanceKm: 48,
  },
  // --- Kyoto ---
  {
    name: 'Aman Kyoto',
    stars: 5, rating: 4.9, reviewCount: 450, pricePerNight: 95000, currency: 'JPY',
    location: { city: 'Kyoto', country: 'Japan', district: 'Kita-ku', address: '1 Okitayama Washimine-cho', latitude: 35.0547, longitude: 135.7356 },
    amenities: ['WiFi', 'Onsen', 'Spa', 'Restaurant', 'Forest Garden', 'Meditation Room'],
    roomTypes: ['Hotaru Pavilion', 'Nara Pavilion', 'Washigamine Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 5,
  },
  // --- Maldives ---
  {
    name: 'Soneva Fushi',
    stars: 5, rating: 4.9, reviewCount: 380, pricePerNight: 150000, currency: 'JPY',
    location: { city: 'Maldives', country: 'Maldives', district: 'Baa Atoll', address: 'Kunfunadhoo Island', latitude: 5.1063, longitude: 73.0667 },
    amenities: ['WiFi', 'Private Beach', 'Spa', 'Diving Center', 'Observatory', 'Cinema', 'Organic Garden'],
    roomTypes: ['Crusoe Villa', 'Soneva Fushi Villa', 'Private Reserve'],
    checkInTime: '14:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 5, nearestAirport: 'MLE', airportDistanceKm: 124,
  },
  // --- Hawaii ---
  {
    name: 'Halekulani',
    stars: 5, rating: 4.8, reviewCount: 1500, pricePerNight: 70000, currency: 'JPY',
    location: { city: 'Honolulu', country: 'USA', district: 'Waikiki', address: '2199 Kalia Road', latitude: 21.2795, longitude: -157.8316 },
    amenities: ['WiFi', 'Pool', 'Spa', 'Beach Access', 'Multiple Restaurants', 'Cultural Programs'],
    roomTypes: ['Garden Courtyard', 'Ocean Front', 'Orchid Suite'],
    checkInTime: '15:00', checkOutTime: '12:00', petFriendly: false, ecoRating: 4, nearestAirport: 'HNL', airportDistanceKm: 12,
  },
];

export function getAllHotels(): HotelData[] {
  return HOTELS;
}

export function getHotelsByCity(city: string): HotelData[] {
  const normalized = city.toLowerCase();
  return HOTELS.filter((h) => h.location.city.toLowerCase().includes(normalized));
}

export function getCities(): string[] {
  return [...new Set(HOTELS.map((h) => h.location.city))];
}

export function filterHotels(params: {
  city?: string;
  minStars?: number;
  maxPrice?: number;
  minRating?: number;
  petFriendly?: boolean;
  ecoOnly?: boolean;
  nearAirport?: string;
}): HotelData[] {
  let results = [...HOTELS];

  if (params.city) {
    const city = params.city.toLowerCase();
    results = results.filter((h) => h.location.city.toLowerCase().includes(city));
  }
  if (params.minStars) {
    results = results.filter((h) => h.stars >= params.minStars!);
  }
  if (params.maxPrice) {
    results = results.filter((h) => h.pricePerNight <= params.maxPrice!);
  }
  if (params.minRating) {
    results = results.filter((h) => h.rating >= params.minRating!);
  }
  if (params.petFriendly) {
    results = results.filter((h) => h.petFriendly);
  }
  if (params.ecoOnly) {
    results = results.filter((h) => h.ecoRating && h.ecoRating >= 4);
  }
  if (params.nearAirport) {
    const code = params.nearAirport.toUpperCase();
    results = results.filter((h) => h.nearestAirport === code);
  }

  if (results.length === 0) {
    const shuffled = [...HOTELS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }

  return results;
}
