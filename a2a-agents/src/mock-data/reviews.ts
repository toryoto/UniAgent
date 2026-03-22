export interface ReviewData {
  reviewer: string;
  rating: number;
  title: string;
  text: string;
  date: string;
  stayType: 'business' | 'leisure' | 'family' | 'couple' | 'solo';
}

const POSITIVE_REVIEWS: ReviewData[] = [
  { reviewer: 'TravelPro22', rating: 5, title: 'Exceptional stay!', text: 'The staff went above and beyond. Room was spotless and the view was breathtaking. Would definitely return.', date: '2026-02-15', stayType: 'couple' },
  { reviewer: 'GlobalNomad', rating: 5, title: 'Worth every penny', text: 'From the moment we arrived, everything was perfect. The concierge arranged a private tour that was unforgettable.', date: '2026-01-28', stayType: 'leisure' },
  { reviewer: 'BusinessTraveler_K', rating: 5, title: 'Best business hotel', text: 'Fast WiFi, quiet rooms, excellent meeting facilities. The express check-in saved me so much time.', date: '2026-03-01', stayType: 'business' },
  { reviewer: 'FamilyVacation2026', rating: 4, title: 'Great for families', text: 'Kids loved the pool area. Staff provided extra towels and toys without asking. Only minor issue was slow room service.', date: '2026-02-20', stayType: 'family' },
  { reviewer: 'LuxuryLover', rating: 5, title: 'Pure luxury', text: 'The spa treatment was world-class. Bed was incredibly comfortable. Restaurant deserves its own Michelin star.', date: '2026-03-10', stayType: 'couple' },
];

const MIXED_REVIEWS: ReviewData[] = [
  { reviewer: 'HonestReview_M', rating: 3, title: 'Decent but overpriced', text: 'Room was clean and comfortable but nothing special for the price. Location was convenient though.', date: '2026-02-10', stayType: 'solo' },
  { reviewer: 'FrequentFlyer99', rating: 3, title: 'Good location, average service', text: 'Great location near the main attractions but staff seemed overwhelmed. Breakfast was mediocre.', date: '2026-01-15', stayType: 'business' },
  { reviewer: 'WeekendTripper', rating: 3, title: 'OK for a short stay', text: 'Nothing wrong but nothing memorable either. Room was smaller than expected from the photos.', date: '2026-02-05', stayType: 'leisure' },
];

const NEGATIVE_REVIEWS: ReviewData[] = [
  { reviewer: 'DisappointedGuest', rating: 2, title: 'Not as advertised', text: 'The photos online are misleading. Room was much smaller and the "city view" was of a parking lot.', date: '2026-01-20', stayType: 'couple' },
  { reviewer: 'NeverAgain123', rating: 1, title: 'Terrible experience', text: 'Noisy neighbors all night, broken air conditioning, and the front desk was unhelpful. Avoid.', date: '2026-02-28', stayType: 'solo' },
];

export function getReviewsForHotel(hotelName: string, count: number = 5): ReviewData[] {
  const seed = hashString(hotelName);
  const all = [...POSITIVE_REVIEWS, ...MIXED_REVIEWS, ...NEGATIVE_REVIEWS];
  const shuffled = seededShuffle(all, seed);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getAverageRating(reviews: ReviewData[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
