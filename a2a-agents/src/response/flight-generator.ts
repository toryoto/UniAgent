import type { AgentDefinition } from '../agents/types.js';
import type { FlightSearchQuery } from '../request/flight-parser.js';
import type { FlightData } from '../mock-data/flights.js';
import { filterFlights, getAllFlights } from '../mock-data/flights.js';
import type { GenerationResult } from './generator.js';

/** Generate a flight search response based on agent definition and parsed query. */
export async function generateFlightResponse(
  agent: AgentDefinition,
  query: FlightSearchQuery,
): Promise<GenerationResult> {
  if (agent.latencyMs && agent.latencyMs > 0) {
    await sleep(agent.latencyMs);
  }

  if (agent.qualityLevel === 'unreliable' && agent.errorRate) {
    if (Math.random() < agent.errorRate) {
      return randomError();
    }
  }

  let flights = selectFlights(query, agent.qualityLevel);
  flights = applyQualityDegradation(flights, agent.qualityLevel);

  const maxResults = getMaxResults(agent.qualityLevel);
  flights = flights.slice(0, maxResults);

  const result = formatFlightResponse(flights, query, agent.responseFormat);
  return { result };
}

function selectFlights(query: FlightSearchQuery, quality: AgentDefinition['qualityLevel']): FlightData[] {
  switch (quality) {
    case 'high':
      return filterFlights({
        origin: query.origin,
        destination: query.destination,
        cabinClass: query.cabinClass,
        maxPrice: query.maxPrice,
        directOnly: query.directOnly,
      });

    case 'medium':
      return filterFlights({
        origin: query.origin,
        destination: query.destination,
        maxPrice: query.maxPrice,
      });

    case 'low':
    case 'unreliable': {
      const base = filterFlights({ origin: query.origin, destination: query.destination });
      if (base.length > 0) return base;
      const all = getAllFlights();
      return all.sort(() => Math.random() - 0.5).slice(0, 5);
    }

    default:
      return filterFlights({ origin: query.origin, destination: query.destination });
  }
}

function applyQualityDegradation(flights: FlightData[], quality: AgentDefinition['qualityLevel']): FlightData[] {
  switch (quality) {
    case 'high':
      return flights;

    case 'medium':
      return flights.map((f) => ({
        ...f,
        seatsAvailable: undefined as unknown as number,
      }));

    case 'low':
      return flights.map((f) => ({
        ...f,
        seatsAvailable: undefined as unknown as number,
        refundable: undefined as unknown as boolean,
        price: corruptNumber(f.price, 0.15),
      }));

    case 'unreliable':
      return flights.map((f) => ({
        ...f,
        seatsAvailable: undefined as unknown as number,
        refundable: undefined as unknown as boolean,
        price: corruptNumber(f.price, 0.3),
        durationMinutes: corruptNumber(f.durationMinutes, 0.1),
      }));

    default:
      return flights;
  }
}

function formatFlightResponse(
  flights: FlightData[],
  query: FlightSearchQuery,
  format: AgentDefinition['responseFormat'],
): unknown {
  switch (format) {
    case 'text-only':
      return formatFlightTextOnly(flights, query);
    case 'data-only':
      return formatFlightDataOnly(flights, query);
    case 'mixed':
    default:
      return formatFlightMixed(flights, query);
  }
}

function formatFlightTextOnly(flights: FlightData[], query: FlightSearchQuery): unknown {
  if (flights.length === 0) {
    return {
      parts: [{ kind: 'text', text: `No flights found from ${query.origin ?? 'origin'} to ${query.destination ?? 'destination'}.` }],
    };
  }

  const cheapest = Math.min(...flights.map((f) => f.price));
  const expensive = Math.max(...flights.map((f) => f.price));
  const origin = flights[0].originCity;
  const dest = flights[0].destinationCity;

  const summary = flights
    .slice(0, 3)
    .map((f) => `${f.airline} ${f.flightNumber} (${f.departureTime}→${f.arrivalTime}, ${formatDuration(f.durationMinutes)}, ¥${f.price.toLocaleString()})`)
    .join('; ');

  const text = `Found ${flights.length} flight(s) from ${origin} to ${dest}. Price range: ¥${cheapest.toLocaleString()}–¥${expensive.toLocaleString()}. Options: ${summary}.`;
  return { parts: [{ kind: 'text', text }] };
}

function formatFlightDataOnly(flights: FlightData[], query: FlightSearchQuery): unknown {
  return {
    parts: [{
      kind: 'data',
      data: {
        flights,
        searchParams: { origin: query.origin, destination: query.destination, departureDate: query.departureDate },
        totalResults: flights.length,
        timestamp: new Date().toISOString(),
      },
    }],
  };
}

function formatFlightMixed(flights: FlightData[], query: FlightSearchQuery): unknown {
  if (flights.length === 0) {
    return {
      parts: [{ kind: 'text', text: `No flights found from ${query.origin ?? 'origin'} to ${query.destination ?? 'destination'}.` }],
    };
  }

  const cheapest = Math.min(...flights.map((f) => f.price));
  const origin = flights[0].originCity;
  const dest = flights[0].destinationCity;
  const text = `Found ${flights.length} flight(s) from ${origin} to ${dest}. Cheapest: ¥${cheapest.toLocaleString()}.`;

  return {
    parts: [
      { kind: 'text', text },
      {
        kind: 'data',
        data: {
          flights,
          searchParams: { origin: query.origin, destination: query.destination, departureDate: query.departureDate },
          totalResults: flights.length,
          timestamp: new Date().toISOString(),
        },
      },
    ],
  };
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? `${m}m` : ''}`;
}

function getMaxResults(quality: AgentDefinition['qualityLevel']): number {
  switch (quality) {
    case 'high': return 5;
    case 'medium': return 3;
    case 'low': return 2;
    case 'unreliable': return 3;
    default: return 3;
  }
}

function randomError(): GenerationResult {
  const errors = [
    { code: -32603, message: 'Internal error: flight data source unavailable' },
    { code: -32001, message: 'Service temporarily unavailable' },
    { code: -32002, message: 'GDS timeout — please retry' },
    { code: -32603, message: 'Internal error: failed to process flight request' },
  ];
  return { error: errors[Math.floor(Math.random() * errors.length)] };
}

function corruptNumber(value: number, deviation: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * deviation;
  return Math.round(value * factor);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
