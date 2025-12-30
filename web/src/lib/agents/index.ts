/**
 * Agents Module
 *
 * Dummy Travel AI Agents with x402 Payment Support
 */

export * from './base-agent';
export * from './flight';
export * from './hotel';
export * from './tourism';

// Re-export agent instances
import { flightAgent } from './flight';
import { hotelAgent } from './hotel';
import { tourismAgent } from './tourism';

export const agents = {
  flight: flightAgent,
  hotel: hotelAgent,
  tourism: tourismAgent,
} as const;

export type AgentType = keyof typeof agents;
