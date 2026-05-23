import type { Request } from 'express';

function getBaseUrl(req: Request): string {
  const host = req.headers.host ?? 'localhost:3005';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export function buildAgentCard(req: Request): Record<string, unknown> {
  const base = getBaseUrl(req);
  const endpoint = `${base}/flight-agent`;

  return {
    name: 'FlightSearchAgent',
    description:
      'Real-time flight search powered by Duffel API. Accepts natural language queries (Japanese/English) and returns live flight offers with pricing. Requires: origin, destination, departure date, and number of passengers.',
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
        id: 'flight-availability-search',
        name: 'Flight Availability Search',
        description:
          'Search real flight availability with live fares from Duffel. Provide origin, destination, date, and passenger count in natural language.',
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
      title: 'FlightSearchAgent',
      version: '1.0.0',
      description: 'A2A-compatible flight availability search agent powered by Duffel',
    },
    servers: [{ url: `${base}/flight-agent` }],
    paths: {
      '/': {
        post: {
          summary: 'Search flights via natural language',
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
                                          'Find economy flights from Tokyo to London for 2 adults on 2026-07-01',
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
              description: 'Flight search results or clarification request',
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
                                        offers: { type: 'array' },
                                        searchParams: { type: 'object' },
                                        source: { type: 'string', example: 'duffel' },
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
