/**
 * FlightDemoAgent - フライト検索ダミーエージェント（登録テスト用）
 *
 * FlightAgent と同様の機能だが、API インターフェースを変更:
 * - パラメータ: from / to / departureDate / adults / cabin
 * - レスポンス: results.flights, query, totalCount
 */

import { BaseAgent } from '../base-agent';
import { AGENT_PRICES, AGENT_RECEIVER_ADDRESS } from '@/lib/x402/constants';
import { selectFlights, type FlightInfo } from './mock-data';

export interface FlightDemoQuery {
  from?: string;
  to?: string;
  departureDate?: string;
  adults?: number;
  cabin?: string;
}

export interface FlightDemoResult {
  results: {
    flights: FlightInfo[];
  };
  query: FlightDemoQuery;
  totalCount: number;
  timestamp: string;
}

export class FlightDemoAgent extends BaseAgent {
  readonly name = 'SkySearch';
  readonly description =
    'Alternative flight search agent with a simple from/to interface. Returns available flights with price and schedule.';
  readonly price = '$0.01';
  readonly pricePerCall = AGENT_PRICES.flightDemo;
  readonly receiverAddress = AGENT_RECEIVER_ADDRESS;
  readonly category = 'travel';

  protected getAgentPath(): string {
    return 'flight-demo';
  }

  generateMockResponse(params: Record<string, unknown>): FlightDemoResult {
    const query: FlightDemoQuery = {
      from: typeof params.from === 'string' ? params.from : undefined,
      to: typeof params.to === 'string' ? params.to : undefined,
      departureDate:
        typeof params.departureDate === 'string' ? params.departureDate : undefined,
      adults: typeof params.adults === 'number' ? params.adults : 1,
      cabin: typeof params.cabin === 'string' ? params.cabin : 'economy',
    };

    const flights = selectFlights({
      origin: query.from,
      destination: query.to,
      date: query.departureDate,
    });

    return {
      results: { flights },
      query,
      totalCount: flights.length,
      timestamp: new Date().toISOString(),
    };
  }

  getOpenApiSpec(baseUrl: string): Record<string, unknown> {
    return {
      openapi: '3.0.3',
      info: {
        title: 'SkySearch API',
        description: this.description,
        version: '1.0.0',
      },
      servers: [{ url: `${baseUrl}/api/agents/flight-demo` }],
      paths: {
        '/': {
          post: {
            summary: 'Search flights',
            description:
              'Search flights by from/to airports and departure date',
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
                          from: {
                            type: 'string',
                            description: 'Departure airport code (e.g. NRT, HND)',
                          },
                          to: {
                            type: 'string',
                            description: 'Arrival airport code (e.g. CDG, LHR)',
                          },
                          departureDate: {
                            type: 'string',
                            format: 'date',
                            description: 'Departure date (YYYY-MM-DD)',
                          },
                          adults: {
                            type: 'integer',
                            minimum: 1,
                            default: 1,
                          },
                          cabin: {
                            type: 'string',
                            enum: ['economy', 'premium', 'business'],
                            default: 'economy',
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
                description: 'Flight search result',
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
                            results: {
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
                            query: { type: 'object' },
                            totalCount: { type: 'integer' },
                            timestamp: { type: 'string' },
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

export const flightDemoAgent = new FlightDemoAgent();
