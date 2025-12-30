/**
 * Hotel Agent - Mock Data
 *
 * ホテル検索のモックデータ
 */

export interface HotelInfo {
  name: string;
  rating: number;
  stars: number;
  pricePerNight: number;
  currency: string;
  location: {
    city: string;
    district: string;
    address: string;
  };
  amenities: string[];
  roomType: string;
  availability: boolean;
}

export const MOCK_HOTELS: HotelInfo[] = [
  {
    name: 'Hotel Le Marais Boutique',
    rating: 4.7,
    stars: 4,
    pricePerNight: 25000,
    currency: 'JPY',
    location: {
      city: 'Paris',
      district: 'Le Marais',
      address: '12 Rue des Archives, 75004 Paris',
    },
    amenities: ['WiFi', 'Breakfast', 'Air Conditioning', 'Room Service'],
    roomType: 'Deluxe Double',
    availability: true,
  },
  {
    name: 'Grand Hotel Opera',
    rating: 4.5,
    stars: 5,
    pricePerNight: 45000,
    currency: 'JPY',
    location: {
      city: 'Paris',
      district: 'Opera',
      address: '8 Boulevard des Capucines, 75009 Paris',
    },
    amenities: ['WiFi', 'Spa', 'Restaurant', 'Concierge', 'Fitness Center'],
    roomType: 'Superior Suite',
    availability: true,
  },
  {
    name: 'Montmartre View Inn',
    rating: 4.3,
    stars: 3,
    pricePerNight: 15000,
    currency: 'JPY',
    location: {
      city: 'Paris',
      district: 'Montmartre',
      address: '45 Rue Lepic, 75018 Paris',
    },
    amenities: ['WiFi', 'Breakfast', 'City View'],
    roomType: 'Standard Double',
    availability: true,
  },
  {
    name: 'The Westminster London',
    rating: 4.8,
    stars: 5,
    pricePerNight: 55000,
    currency: 'JPY',
    location: {
      city: 'London',
      district: 'Westminster',
      address: '30 Victoria Street, London SW1H',
    },
    amenities: ['WiFi', 'Spa', 'Restaurant', 'Gym', 'Business Center'],
    roomType: 'Executive Suite',
    availability: true,
  },
  {
    name: 'Covent Garden Hotel',
    rating: 4.6,
    stars: 4,
    pricePerNight: 35000,
    currency: 'JPY',
    location: {
      city: 'London',
      district: 'Covent Garden',
      address: '10 Monmouth Street, London WC2H',
    },
    amenities: ['WiFi', 'Restaurant', 'Bar', 'Room Service'],
    roomType: 'Deluxe King',
    availability: true,
  },
];

/**
 * パラメータに基づいてホテルを選択
 */
export function selectHotels(params: {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  minRating?: number;
  maxPrice?: number;
  maxResults?: number;
}): HotelInfo[] {
  let results = [...MOCK_HOTELS];

  // 都市フィルタ
  if (params.city) {
    const city = params.city.toLowerCase();
    if (city.includes('paris') || city.includes('パリ')) {
      results = results.filter((h) => h.location.city === 'Paris');
    } else if (city.includes('london') || city.includes('ロンドン')) {
      results = results.filter((h) => h.location.city === 'London');
    }
  }

  // 最低評価フィルタ
  if (params.minRating) {
    results = results.filter((h) => h.rating >= params.minRating!);
  }

  // 最大価格フィルタ
  if (params.maxPrice) {
    results = results.filter((h) => h.pricePerNight <= params.maxPrice!);
  }

  // 結果がない場合はランダムに1-2件返す
  if (results.length === 0) {
    const shuffled = [...MOCK_HOTELS].sort(() => Math.random() - 0.5);
    results = shuffled.slice(0, 2);
  }

  // 最大件数
  const maxResults = params.maxResults ?? 3;
  return results.slice(0, maxResults);
}
