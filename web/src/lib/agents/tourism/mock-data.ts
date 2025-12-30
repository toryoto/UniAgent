/**
 * Tourism Agent - Mock Data
 *
 * 観光情報のモックデータ
 */

export interface TourismSpot {
  name: string;
  type: string;
  rating: number;
  description: string;
  location: {
    city: string;
    district: string;
    address: string;
  };
  openingHours: string;
  admissionFee: {
    adult: number;
    child: number;
    currency: string;
  };
  recommendedDuration: string;
  tips: string[];
}

export interface TourPlan {
  title: string;
  duration: string;
  spots: TourismSpot[];
  totalCost: number;
  currency: string;
}

export const MOCK_TOURISM_SPOTS: TourismSpot[] = [
  {
    name: 'Eiffel Tower',
    type: 'Landmark',
    rating: 4.7,
    description:
      'Iconic iron lattice tower on the Champ de Mars, symbol of Paris and France.',
    location: {
      city: 'Paris',
      district: 'Champ de Mars',
      address: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris',
    },
    openingHours: '09:00-00:00',
    admissionFee: { adult: 2800, child: 1400, currency: 'JPY' },
    recommendedDuration: '2-3 hours',
    tips: [
      'Book tickets online to skip the queue',
      'Visit at sunset for stunning views',
      'Take the stairs to the 2nd floor for exercise and shorter wait',
    ],
  },
  {
    name: 'Louvre Museum',
    type: 'Museum',
    rating: 4.8,
    description:
      "World's largest art museum and historic monument housing the Mona Lisa.",
    location: {
      city: 'Paris',
      district: 'Louvre',
      address: 'Rue de Rivoli, 75001 Paris',
    },
    openingHours: '09:00-18:00 (Closed Tuesday)',
    admissionFee: { adult: 2200, child: 0, currency: 'JPY' },
    recommendedDuration: '3-4 hours',
    tips: [
      'Enter via the Carrousel du Louvre for shorter lines',
      'Get a museum map and plan your route',
      'Free entry on first Sunday of each month',
    ],
  },
  {
    name: 'Notre-Dame Cathedral',
    type: 'Religious Site',
    rating: 4.6,
    description:
      'Medieval Catholic cathedral, a masterpiece of French Gothic architecture.',
    location: {
      city: 'Paris',
      district: 'Île de la Cité',
      address: '6 Parvis Notre-Dame, 75004 Paris',
    },
    openingHours: '08:00-18:45',
    admissionFee: { adult: 0, child: 0, currency: 'JPY' },
    recommendedDuration: '1-2 hours',
    tips: [
      'Currently under restoration - check opening status',
      'View from the bridges for best photos',
      'Visit early morning to avoid crowds',
    ],
  },
  {
    name: 'Big Ben & Houses of Parliament',
    type: 'Landmark',
    rating: 4.5,
    description: 'Iconic clock tower and seat of the UK Parliament.',
    location: {
      city: 'London',
      district: 'Westminster',
      address: 'Westminster, London SW1A 0AA',
    },
    openingHours: 'External viewing 24/7',
    admissionFee: { adult: 0, child: 0, currency: 'JPY' },
    recommendedDuration: '1 hour',
    tips: [
      'Best viewed from Westminster Bridge',
      'Night illumination is spectacular',
      'Combine with Westminster Abbey visit',
    ],
  },
  {
    name: 'British Museum',
    type: 'Museum',
    rating: 4.8,
    description:
      'World-famous museum with over 8 million works from all continents.',
    location: {
      city: 'London',
      district: 'Bloomsbury',
      address: 'Great Russell St, London WC1B 3DG',
    },
    openingHours: '10:00-17:00',
    admissionFee: { adult: 0, child: 0, currency: 'JPY' },
    recommendedDuration: '3-4 hours',
    tips: [
      'Free entry - donations welcome',
      'Must-see: Rosetta Stone, Egyptian mummies',
      'Free guided tours available',
    ],
  },
];

/**
 * パラメータに基づいて観光スポットを選択
 */
export function selectTourismSpots(params: {
  city?: string;
  type?: string;
  maxResults?: number;
}): TourismSpot[] {
  let results = [...MOCK_TOURISM_SPOTS];

  // 都市フィルタ
  if (params.city) {
    const city = params.city.toLowerCase();
    if (city.includes('paris') || city.includes('パリ')) {
      results = results.filter((s) => s.location.city === 'Paris');
    } else if (city.includes('london') || city.includes('ロンドン')) {
      results = results.filter((s) => s.location.city === 'London');
    }
  }

  // タイプフィルタ
  if (params.type) {
    const type = params.type.toLowerCase();
    results = results.filter((s) => s.type.toLowerCase().includes(type));
  }

  // 結果がない場合はランダムに2件返す
  if (results.length === 0) {
    const shuffled = [...MOCK_TOURISM_SPOTS].sort(() => Math.random() - 0.5);
    results = shuffled.slice(0, 2);
  }

  // 最大件数
  const maxResults = params.maxResults ?? 3;
  return results.slice(0, maxResults);
}

/**
 * 観光プランを生成
 */
export function generateTourPlan(params: {
  city?: string;
  days?: number;
}): TourPlan {
  const spots = selectTourismSpots({
    city: params.city,
    maxResults: params.days ? params.days * 2 : 4,
  });

  const totalCost = spots.reduce((sum, spot) => sum + spot.admissionFee.adult, 0);

  return {
    title: `${params.city || 'City'} ${params.days || 2}-Day Tour`,
    duration: `${params.days || 2} days`,
    spots,
    totalCost,
    currency: 'JPY',
  };
}
