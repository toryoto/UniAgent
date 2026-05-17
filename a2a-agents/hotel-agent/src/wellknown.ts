import type { Request } from 'express';

function getBaseUrl(req: Request): string {
  const host = req.headers.host ?? 'localhost:3004';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export function buildAgentCard(req: Request): Record<string, unknown> {
  const base = getBaseUrl(req);
  const endpoint = `${base}/hotel-agent`;

  return {
    name: 'HotelSearchAgent',
    description:
      'Real hotel availability search powered by Hotelbeds API. Accepts natural language queries (Japanese/English) and returns live hotel inventory with pricing. Requires: destination city, check-in/check-out dates, number of adults.',
    version: '1.0.0',
    category: 'travel',
    endpoints: [
      {
        url: endpoint,
        spec: `${endpoint}/openapi.json`,
      },
    ],
    skills: [
      {
        id: 'hotel-availability-search',
        name: 'Hotel Availability Search',
        description:
          'Search real hotel availability with live rates from Hotelbeds. Provide destination, dates, and guest count in natural language.',
      },
    ],
    payment: {
      tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      receiverAddress: process.env.AGENT_RECEIVER_ADDRESS ?? '',
      pricePerCall: '10000',
      price: '$0.01',
      network: 'base-sepolia',
      chain: 'eip155:84532',
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text', 'data'],
  };
}

export function buildOpenApiSpec(req: Request): Record<string, unknown> {
  const base = getBaseUrl(req);

  return {
    openapi: '3.0.3',
    info: {
      title: 'HotelSearchAgent',
      version: '1.0.0',
      description: 'A2A-compatible hotel availability search agent',
    },
    servers: [{ url: `${base}/hotel-agent` }],
    paths: {
      '/': {
        post: {
          summary: 'Search hotels via natural language',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jsonrpc', 'method', 'params'],
                  properties: {
                    jsonrpc: { type: 'string', enum: ['2.0'] },
                    id: { type: 'string' },
                    method: { type: 'string', enum: ['message/send'] },
                    params: {
                      type: 'object',
                      properties: {
                        message: {
                          type: 'object',
                          properties: {
                            role: { type: 'string' },
                            parts: {
                              type: 'array',
                              items: {
                                oneOf: [
                                  {
                                    type: 'object',
                                    properties: {
                                      kind: { type: 'string', enum: ['text'] },
                                      text: {
                                        type: 'string',
                                        example:
                                          'Find hotels in Tokyo for 2 adults, check-in 2026-07-01 to 2026-07-03',
                                      },
                                    },
                                  },
                                ],
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
          },
          responses: {
            '200': {
              description: 'Hotel search results or clarification request',
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
                          parts: {
                            type: 'array',
                            items: {
                              oneOf: [
                                {
                                  type: 'object',
                                  properties: {
                                    kind: { type: 'string', enum: ['text'] },
                                    text: { type: 'string' },
                                  },
                                },
                                {
                                  type: 'object',
                                  properties: {
                                    kind: { type: 'string', enum: ['data'] },
                                    data: {
                                      type: 'object',
                                      properties: {
                                        hotels: { type: 'array' },
                                        searchParams: { type: 'object' },
                                        source: { type: 'string' },
                                      },
                                    },
                                  },
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '402': { description: 'Payment required' },
          },
        },
      },
    },
  };
}
