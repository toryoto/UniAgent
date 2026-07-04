import type { HotelData } from '@/components/chat/HotelResultsCard';

export interface HotelSearchResultData {
  hotels: HotelData[];
  searchParams?: { checkIn?: string; checkOut?: string };
  totalResults?: number;
}

/** execute_and_evaluate_agent のホテル Agent 結果をパースする */
export function extractHotelResults(result: string): HotelSearchResultData | null {
  try {
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const resultObj = parsed?.result as Record<string, unknown> | undefined;
    const parts = resultObj?.parts as Array<{ kind: string; data?: Record<string, unknown> }> | undefined;
    if (!parts) return null;
    const dataPart = parts.find((p) => p.kind === 'data' && Array.isArray(p.data?.hotels));
    if (!dataPart?.data) return null;
    const hotels = dataPart.data.hotels as HotelData[];
    if (!hotels.length) return null;
    return {
      hotels,
      searchParams: dataPart.data.searchParams as HotelSearchResultData['searchParams'],
      totalResults: dataPart.data.totalResults as number | undefined,
    };
  } catch {
    return null;
  }
}
