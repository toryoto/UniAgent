/**
 * HotelAgent - ホテル検索エージェント
 *
 * x402決済対応のホテル検索Dummyエージェント
 */

import { BaseAgent } from '../base-agent';
import { AGENT_PRICES, AGENT_IDS, AGENT_RECEIVER_ADDRESS } from '@/lib/x402/constants';
import { selectHotels, type HotelInfo } from './mock-data';

export interface HotelSearchParams {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
  minRating?: number;
  maxPrice?: number;
}

export interface HotelSearchResult {
  hotels: HotelInfo[];
  searchParams: HotelSearchParams;
  timestamp: string;
}

export class HotelAgent extends BaseAgent {
  readonly agentId = AGENT_IDS.hotel;
  readonly name = 'HotelBookerPro';
  readonly description =
    'AI-powered hotel booking agent that finds the best accommodations based on your preferences. Supports hotels worldwide with real-time availability.';
  readonly pricePerCall = AGENT_PRICES.hotel;
  readonly receiverAddress = AGENT_RECEIVER_ADDRESS;
  readonly category = 'travel';

  protected getAgentPath(): string {
    return 'hotel';
  }

  protected generateMockResponse(params: Record<string, unknown>): HotelSearchResult {
    const searchParams: HotelSearchParams = {
      city: typeof params.city === 'string' ? params.city : undefined,
      checkIn: typeof params.checkIn === 'string' ? params.checkIn : undefined,
      checkOut: typeof params.checkOut === 'string' ? params.checkOut : undefined,
      guests: typeof params.guests === 'number' ? params.guests : 2,
      rooms: typeof params.rooms === 'number' ? params.rooms : 1,
      minRating: typeof params.minRating === 'number' ? params.minRating : undefined,
      maxPrice: typeof params.maxPrice === 'number' ? params.maxPrice : undefined,
    };

    const hotels = selectHotels({
      city: searchParams.city,
      checkIn: searchParams.checkIn,
      checkOut: searchParams.checkOut,
      minRating: searchParams.minRating,
      maxPrice: searchParams.maxPrice,
    });

    return {
      hotels,
      searchParams,
      timestamp: new Date().toISOString(),
    };
  }

  getOpenApiSpec(baseUrl: string): Record<string, unknown> {
    return {
      openapi: '3.0.3',
      info: {
        title: 'HotelBookerPro API',
        description: this.description,
        version: '1.0.0',
      },
      servers: [{ url: `${baseUrl}/api/agents/hotel` }],
      paths: {
        '/': {
          post: {
            summary: 'Search for hotels',
            description: 'Search for available hotels based on city, dates, and preferences',
            operationId: 'searchHotels',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      jsonrpc: { type: 'string', enum: ['2.0'] },
                      id: { type: 'string' },
                      method: { type: 'string', enum: ['message/send'] },
                      params: {
                        type: 'object',
                        properties: {
                          city: {
                            type: 'string',
                            description: 'City name (e.g., Paris, London)',
                          },
                          checkIn: {
                            type: 'string',
                            format: 'date',
                            description: 'Check-in date (YYYY-MM-DD)',
                          },
                          checkOut: {
                            type: 'string',
                            format: 'date',
                            description: 'Check-out date (YYYY-MM-DD)',
                          },
                          guests: {
                            type: 'integer',
                            minimum: 1,
                            default: 2,
                          },
                          rooms: {
                            type: 'integer',
                            minimum: 1,
                            default: 1,
                          },
                          minRating: {
                            type: 'number',
                            minimum: 0,
                            maximum: 5,
                            description: 'Minimum hotel rating',
                          },
                          maxPrice: {
                            type: 'number',
                            description: 'Maximum price per night',
                          },
                        },
                      },
                    },
                    required: ['jsonrpc', 'method', 'params'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Successful hotel search',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        jsonrpc: { type: 'string' },
                        id: { type: 'string' },
                        result: {
                          type: 'object',
                          properties: {
                            hotels: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  rating: { type: 'number' },
                                  stars: { type: 'integer' },
                                  pricePerNight: { type: 'number' },
                                  currency: { type: 'string' },
                                  location: { type: 'object' },
                                  amenities: { type: 'array' },
                                  roomType: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              '402': {
                description: 'Payment Required',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        version: { type: 'string' },
                        paymentRequired: { type: 'boolean' },
                        amount: { type: 'string' },
                        receiver: { type: 'string' },
                        tokenAddress: { type: 'string' },
                        network: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }
}

// シングルトンインスタンス
export const hotelAgent = new HotelAgent();
