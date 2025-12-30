/**
 * TourismAgent - 観光ガイドエージェント
 *
 * x402決済対応の観光情報・プラン作成Dummyエージェント
 */

import { BaseAgent } from '../base-agent';
import { AGENT_PRICES, AGENT_IDS, AGENT_RECEIVER_ADDRESS } from '@/lib/x402/constants';
import {
  selectTourismSpots,
  generateTourPlan,
  type TourismSpot,
  type TourPlan,
} from './mock-data';

export interface TourismSearchParams {
  city?: string;
  days?: number;
  interests?: string[];
  type?: string;
}

export interface TourismSearchResult {
  plan: TourPlan;
  spots: TourismSpot[];
  searchParams: TourismSearchParams;
  timestamp: string;
}

export class TourismAgent extends BaseAgent {
  readonly agentId = AGENT_IDS.tourism;
  readonly name = 'TourismGuide';
  readonly description =
    'AI-powered tourism guide that creates personalized travel itineraries and recommends attractions, restaurants, and activities based on your interests.';
  readonly pricePerCall = AGENT_PRICES.tourism;
  readonly receiverAddress = AGENT_RECEIVER_ADDRESS;
  readonly category = 'travel';

  protected getAgentPath(): string {
    return 'tourism';
  }

  protected generateMockResponse(params: Record<string, unknown>): TourismSearchResult {
    const searchParams: TourismSearchParams = {
      city: typeof params.city === 'string' ? params.city : undefined,
      days: typeof params.days === 'number' ? params.days : 2,
      interests: Array.isArray(params.interests) ? params.interests : undefined,
      type: typeof params.type === 'string' ? params.type : undefined,
    };

    const spots = selectTourismSpots({
      city: searchParams.city,
      type: searchParams.type,
    });

    const plan = generateTourPlan({
      city: searchParams.city,
      days: searchParams.days,
    });

    return {
      plan,
      spots,
      searchParams,
      timestamp: new Date().toISOString(),
    };
  }

  getOpenApiSpec(baseUrl: string): Record<string, unknown> {
    return {
      openapi: '3.0.3',
      info: {
        title: 'TourismGuide API',
        description: this.description,
        version: '1.0.0',
      },
      servers: [{ url: `${baseUrl}/api/agents/tourism` }],
      paths: {
        '/': {
          post: {
            summary: 'Get tourism recommendations',
            description:
              'Get personalized tourism recommendations and itineraries based on city and preferences',
            operationId: 'getTourismInfo',
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
                          days: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 14,
                            default: 2,
                            description: 'Number of days for the trip',
                          },
                          interests: {
                            type: 'array',
                            items: { type: 'string' },
                            description:
                              'Interests (e.g., history, art, food, nature)',
                          },
                          type: {
                            type: 'string',
                            enum: ['Landmark', 'Museum', 'Religious Site', 'Park', 'Restaurant'],
                            description: 'Type of attractions to focus on',
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
                description: 'Successful tourism search',
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
                            plan: {
                              type: 'object',
                              properties: {
                                title: { type: 'string' },
                                duration: { type: 'string' },
                                spots: { type: 'array' },
                                totalCost: { type: 'number' },
                              },
                            },
                            spots: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  type: { type: 'string' },
                                  rating: { type: 'number' },
                                  description: { type: 'string' },
                                  location: { type: 'object' },
                                  openingHours: { type: 'string' },
                                  admissionFee: { type: 'object' },
                                  tips: { type: 'array' },
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
export const tourismAgent = new TourismAgent();
