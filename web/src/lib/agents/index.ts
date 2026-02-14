/**
 * Agents Module
 *
 * Dummy Travel AI Agents with x402 Payment Support
 */

export * from './base-agent';
export * from './flight';
export * from './flight-demo';
export * from './hotel';
export * from './tourism';

// Re-export agent instances
import { flightAgent } from './flight';
import { flightDemoAgent } from './flight-demo';
import { hotelAgent } from './hotel';
import { tourismAgent } from './tourism';

export const agents = {
  flight: flightAgent,
  flightDemo: flightDemoAgent,
  hotel: hotelAgent,
  tourism: tourismAgent,
} as const;

export type AgentType = keyof typeof agents;
