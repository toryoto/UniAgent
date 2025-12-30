/**
 * FlightAgent - フライト検索エージェント
 *
 * x402決済対応のフライト検索Dummyエージェント
 */

import { BaseAgent } from '../base-agent';
import { AGENT_PRICES, AGENT_IDS, AGENT_RECEIVER_ADDRESS } from '@/lib/x402/constants';
import { selectFlights, type FlightInfo } from './mock-data';

export interface FlightSearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  passengers?: number;
  class?: string;
}

export interface FlightSearchResult {
  flights: FlightInfo[];
  searchParams: FlightSearchParams;
  timestamp: string;
}

export class FlightAgent extends BaseAgent {
  readonly agentId = AGENT_IDS.flight;
  readonly name = 'FlightFinderPro';
  readonly description =
    'AI-powered flight search agent that finds the best flights based on your preferences. Supports major airlines and destinations worldwide.';
  readonly pricePerCall = AGENT_PRICES.flight;
  readonly receiverAddress = AGENT_RECEIVER_ADDRESS;
  readonly category = 'travel';

  protected getAgentPath(): string {
    return 'flight';
  }

  protected generateMockResponse(params: Record<string, unknown>): FlightSearchResult {
    const searchParams: FlightSearchParams = {
      origin: typeof params.origin === 'string' ? params.origin : undefined,
      destination: typeof params.destination === 'string' ? params.destination : undefined,
      date: typeof params.date === 'string' ? params.date : undefined,
      passengers: typeof params.passengers === 'number' ? params.passengers : 1,
      class: typeof params.class === 'string' ? params.class : 'Economy',
    };

    const flights = selectFlights({
      origin: searchParams.origin,
      destination: searchParams.destination,
      date: searchParams.date,
    });

    return {
      flights,
      searchParams,
      timestamp: new Date().toISOString(),
    };
  }

  getOpenApiSpec(baseUrl: string): Record<string, unknown> {
    return {
      openapi: '3.0.3',
      info: {
        title: 'FlightFinderPro API',
        description: this.description,
        version: '1.0.0',
      },
      servers: [{ url: `${baseUrl}/api/agents/flight` }],
      paths: {
        '/': {
          post: {
            summary: 'Search for flights',
            description: 'Search for available flights based on origin, destination, and date',
            operationId: 'searchFlights',
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
                          origin: {
                            type: 'string',
                            description: 'Departure airport code (e.g., NRT, HND)',
                          },
                          destination: {
                            type: 'string',
                            description: 'Arrival airport or city (e.g., CDG, Paris)',
                          },
                          date: {
                            type: 'string',
                            format: 'date',
                            description: 'Travel date (YYYY-MM-DD)',
                          },
                          passengers: {
                            type: 'integer',
                            minimum: 1,
                            default: 1,
                          },
                          class: {
                            type: 'string',
                            enum: ['Economy', 'Business', 'First'],
                            default: 'Economy',
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
                description: 'Successful flight search',
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
                            flights: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  carrier: { type: 'string' },
                                  flightNo: { type: 'string' },
                                  price: { type: 'number' },
                                  currency: { type: 'string' },
                                  departure: { type: 'object' },
                                  arrival: { type: 'object' },
                                  duration: { type: 'string' },
                                  class: { type: 'string' },
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
export const flightAgent = new FlightAgent();
