'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Hotel, Star } from 'lucide-react';

interface HotelRate {
  boardName?: string;
  net?: string;
  sellingRate?: string;
}

interface HotelRoom {
  name?: string;
  rates?: HotelRate[];
}

export interface HotelData {
  code?: number;
  name: string;
  categoryCode?: string;
  categoryName?: string;
  destinationName?: string;
  latitude?: string;
  longitude?: string;
  minRate?: string;
  maxRate?: string;
  currency?: string;
  rooms?: HotelRoom[];
  imageUrl?: string;
  webUrl?: string;
}

interface HotelResultsCardProps {
  hotels: HotelData[];
  searchParams?: {
    checkIn?: string;
    checkOut?: string;
  };
  totalResults?: number;
}

function starCount(categoryCode?: string): number {
  if (!categoryCode) return 0;
  // Hotelbeds category codes: 1EST, 2EST, 3EST, 4EST, 5EST, APAR, etc.
  const match = categoryCode.match(/^(\d)/);
  return match ? parseInt(match[1], 10) : 0;
}

function StarRating({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      ))}
    </span>
  );
}

function HotelCard({ hotel }: { hotel: HotelData }) {
  const stars = starCount(hotel.categoryCode);
  const boardName = hotel.rooms?.[0]?.rates?.[0]?.boardName;
  const currency = hotel.currency ?? '';
  const price = hotel.minRate ? `${parseFloat(hotel.minRate).toLocaleString()} ${currency}` : null;

  return (
    <div className="rounded-md border border-slate-600 bg-slate-800 overflow-hidden">
      {hotel.imageUrl && (
        <div className="h-28 overflow-hidden">
          <img
            src={hotel.imageUrl}
            alt={hotel.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Hotel className="h-3.5 w-3.5 shrink-0 text-blue-400" />
              <span className="font-medium text-slate-100 text-xs leading-tight">{hotel.name}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {stars > 0 && <StarRating count={stars} />}
              {hotel.categoryName && stars === 0 && (
                <span className="text-[10px] text-slate-400">{hotel.categoryName}</span>
              )}
              {hotel.destinationName && (
                <span className="text-[10px] text-slate-500">{hotel.destinationName}</span>
              )}
            </div>
            {boardName && (
              <p className="mt-0.5 text-[10px] text-slate-500">{boardName}</p>
            )}
            {hotel.webUrl && (
              <a
                href={hotel.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                公式サイト
              </a>
            )}
          </div>
          {price && (
            <div className="shrink-0 text-right">
              <span className="text-xs font-semibold text-emerald-400">From</span>
              <p className="text-xs font-bold text-emerald-300">{price}</p>
              <p className="text-[10px] text-slate-500">/night</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HotelResultsCard({ hotels, searchParams, totalResults }: HotelResultsCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!hotels.length) return null;

  const dateRange =
    searchParams?.checkIn && searchParams?.checkOut
      ? `${searchParams.checkIn} → ${searchParams.checkOut}`
      : null;

  return (
    <div className="mt-2 rounded-lg border border-blue-500/30 bg-slate-900/80">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs"
      >
        <Hotel className="h-3.5 w-3.5 text-blue-400" />
        <span className="font-medium text-blue-300">
          Hotel Results — {hotels.length} hotels
          {totalResults && totalResults > hotels.length ? ` (of ${totalResults})` : ''}
        </span>
        {dateRange && (
          <span className="ml-1 text-[10px] text-slate-500">{dateRange}</span>
        )}
        <span className="ml-auto text-slate-500">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="max-h-80 overflow-y-auto px-3 pb-3">
          <div className="space-y-1.5">
            {hotels.map((hotel, i) => (
              <HotelCard key={hotel.code ?? i} hotel={hotel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
