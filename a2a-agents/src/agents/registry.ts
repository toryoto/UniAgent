import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import type { AgentDefinition, AgentRegistry } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface YamlSkill {
  id: string;
  name: string;
  description: string;
}

interface YamlAgent {
  slug: string;
  name: string;
  description: string;
  category: string;
  price: string;
  qualityLevel: string;
  responseFormat: string;
  requestFormat: string;
  skills: YamlSkill[];
  errorRate?: number;
  latencyMs?: number;
  image?: string;
}

function dollarToPricePerCall(dollar: string): string {
  const amount = parseFloat(dollar.replace('$', ''));
  return Math.round(amount * 1_000_000).toString();
}

export function loadAgentRegistry(yamlPath?: string): AgentRegistry {
  const filePath = yamlPath ?? resolve(__dirname, '../../agents.yaml');
  const raw = readFileSync(filePath, 'utf-8');
  const data = parseYaml(raw) as { agents: YamlAgent[] };

  const registry: AgentRegistry = {};

  for (const agent of data.agents) {
    registry[agent.slug] = {
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      price: agent.price,
      pricePerCall: dollarToPricePerCall(agent.price),
      qualityLevel: agent.qualityLevel as AgentDefinition['qualityLevel'],
      responseFormat: agent.responseFormat as AgentDefinition['responseFormat'],
      requestFormat: agent.requestFormat as AgentDefinition['requestFormat'],
      skills: agent.skills,
      errorRate: agent.errorRate,
      latencyMs: agent.latencyMs,
      image: agent.image,
    };
  }

  return registry;
}
