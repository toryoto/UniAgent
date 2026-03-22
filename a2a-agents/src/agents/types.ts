import type { A2ASkill } from '@agent-marketplace/shared';

export type QualityLevel = 'high' | 'medium' | 'low' | 'unreliable';

export type ResponseFormat =
  | 'text-only'
  | 'data-only'
  | 'mixed'
  | 'legacy-flat'
  | 'nested'
  | 'markdown';

export type RequestFormat = 'a2a-standard' | 'natural-language' | 'flat' | 'mixed-input';

export interface AgentDefinition {
  slug: string;
  name: string;
  description: string;
  category: string;
  /** Dollar string, e.g. "$0.03" */
  price: string;
  /** USDC 6-decimal units, derived from price */
  pricePerCall: string;
  qualityLevel: QualityLevel;
  responseFormat: ResponseFormat;
  requestFormat: RequestFormat;
  skills: A2ASkill[];
  /** Probability of returning an error (0-1). Only meaningful for 'unreliable'. */
  errorRate?: number;
  /** Artificial latency in ms. */
  latencyMs?: number;
  /** Image URL for ERC-8004 metadata */
  image?: string;
}

export type AgentRegistry = Record<string, AgentDefinition>;
