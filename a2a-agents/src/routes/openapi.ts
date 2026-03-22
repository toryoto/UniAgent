import { Router } from 'express';
import type { AgentRegistry } from '../agents/types.js';

export function createOpenApiRoutes(registry: AgentRegistry): Router {
  const router = Router();

  router.get('/:slug/openapi.json', (req, res) => {
    const agent = registry[req.params.slug];
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const requestSchema = buildRequestSchema(agent.requestFormat);
    const responseSchema = buildResponseSchema(agent.responseFormat);

    res.json({
      openapi: '3.0.3',
      info: {
        title: `${agent.name} API`,
        description: agent.description,
        version: '1.0.0',
      },
      servers: [{ url: `${baseUrl}/${agent.slug}` }],
      paths: {
        '/': {
          post: {
            summary: `Execute ${agent.name}`,
            description: agent.description,
            operationId: `execute_${agent.slug.replace(/-/g, '_')}`,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: requestSchema,
                },
              },
            },
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: responseSchema,
                  },
                },
              },
              '402': {
                description: 'Payment Required',
              },
            },
          },
        },
      },
    });
  });

  return router;
}

function buildRequestSchema(format: string): Record<string, unknown> {
  const base = {
    type: 'object',
    required: ['jsonrpc', 'method', 'params'],
    properties: {
      jsonrpc: { type: 'string', enum: ['2.0'] },
      id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      method: { type: 'string', enum: ['message/send'] },
    },
  };

  switch (format) {
    case 'a2a-standard':
    case 'mixed-input':
      return {
        ...base,
        properties: {
          ...base.properties,
          params: {
            type: 'object',
            properties: {
              message: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user'] },
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
                                city: { type: 'string' },
                                checkIn: { type: 'string', format: 'date' },
                                checkOut: { type: 'string', format: 'date' },
                                guests: { type: 'integer' },
                                maxPrice: { type: 'number' },
                                minRating: { type: 'number' },
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
      };

    case 'natural-language':
      return {
        ...base,
        properties: {
          ...base.properties,
          params: {
            type: 'object',
            properties: {
              message: {
                type: 'object',
                properties: {
                  role: { type: 'string', enum: ['user'] },
                  parts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        kind: { type: 'string', enum: ['text'] },
                        text: { type: 'string', description: 'Natural language hotel search query' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

    case 'flat':
    default:
      return {
        ...base,
        properties: {
          ...base.properties,
          params: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              checkIn: { type: 'string', format: 'date' },
              checkOut: { type: 'string', format: 'date' },
              guests: { type: 'integer', minimum: 1, default: 2 },
              rooms: { type: 'integer', minimum: 1, default: 1 },
              maxPrice: { type: 'number' },
              minRating: { type: 'number', minimum: 0, maximum: 5 },
            },
          },
        },
      };
  }
}

function buildResponseSchema(format: string): Record<string, unknown> {
  const jsonrpcWrapper = {
    type: 'object',
    properties: {
      jsonrpc: { type: 'string' },
      id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
      result: {} as Record<string, unknown>,
    },
  };

  switch (format) {
    case 'legacy-flat':
      jsonrpcWrapper.properties.result = {
        type: 'object',
        properties: {
          hotels: { type: 'array', items: { type: 'object' } },
          searchParams: { type: 'object' },
          timestamp: { type: 'string' },
        },
      };
      break;
    default:
      jsonrpcWrapper.properties.result = {
        type: 'object',
        properties: {
          parts: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'object', properties: { kind: { enum: ['text'] }, text: { type: 'string' } } },
                { type: 'object', properties: { kind: { enum: ['data'] }, data: { type: 'object' } } },
              ],
            },
          },
        },
      };
  }

  return jsonrpcWrapper;
}
