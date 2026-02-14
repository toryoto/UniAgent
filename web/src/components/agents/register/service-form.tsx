'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { A2ASkill, ERC8004Service } from '@agent-marketplace/shared';

interface ServiceFormProps {
  services: ERC8004Service[];
  onChange: (services: ERC8004Service[]) => void;
}

function updateServiceField(
  services: ERC8004Service[],
  index: number,
  field: keyof ERC8004Service,
  value: string | A2ASkill[] | string[] | undefined
): ERC8004Service[] {
  const updated = [...services];
  updated[index] = { ...updated[index], [field]: value };
  return updated;
}

export function ServiceForm({ services, onChange }: ServiceFormProps) {
  const updateService = (
    index: number,
    field: keyof ERC8004Service,
    value: string | A2ASkill[] | string[] | undefined
  ) => {
    onChange(updateServiceField(services, index, field, value));
  };

  const addService = () => {
    onChange([...services, { name: '', endpoint: '' }]);
  };

  const removeService = (index: number) => {
    if (services.length <= 1) return;
    onChange(services.filter((_, i) => i !== index));
  };

  const skills = (service: ERC8004Service): A2ASkill[] =>
    service.skills && service.skills.length > 0 ? service.skills : [];

  const updateSkill = (
    serviceIdx: number,
    skillIdx: number,
    field: keyof A2ASkill,
    value: string
  ) => {
    const list = [...skills(services[serviceIdx])];
    if (!list[skillIdx]) return;
    list[skillIdx] = { ...list[skillIdx], [field]: value };
    updateService(serviceIdx, 'skills', list);
  };

  const addSkill = (serviceIdx: number) => {
    const list = [...skills(services[serviceIdx]), { id: '', name: '', description: '' }];
    updateService(serviceIdx, 'skills', list);
  };

  const removeSkill = (serviceIdx: number, skillIdx: number) => {
    const list = skills(services[serviceIdx]).filter((_, i) => i !== skillIdx);
    updateService(serviceIdx, 'skills', list.length > 0 ? list : undefined);
  };

  const setDomainsFromInput = (serviceIdx: number, raw: string) => {
    const domains = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateService(serviceIdx, 'domains', domains.length > 0 ? domains : undefined);
  };

  const domainsInput = (service: ERC8004Service) =>
    (service.domains && service.domains.length > 0 ? service.domains.join(', ') : '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">Services</label>
        <button
          type="button"
          onClick={addService}
          className="flex items-center gap-1 text-xs text-purple-400 transition-colors hover:text-purple-300"
        >
          <Plus className="h-3 w-3" />
          Add Service
        </button>
      </div>

      {services.map((service, idx) => (
        <div
          key={idx}
          className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 md:p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Service {idx + 1}
            </span>
            {services.length > 1 && (
              <button
                type="button"
                onClick={() => removeService(idx)}
                className="text-slate-500 transition-colors hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Name *
              </label>
              <input
                type="text"
                value={service.name}
                onChange={(e) => updateService(idx, 'name', e.target.value)}
                placeholder="e.g. A2A"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Endpoint *
              </label>
              <input
                type="url"
                value={service.endpoint}
                onChange={(e) => updateService(idx, 'endpoint', e.target.value)}
                placeholder="https://example.com/.well-known/agent.json"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">
                Version
              </label>
              <input
                type="text"
                value={service.version || ''}
                onChange={(e) => updateService(idx, 'version', e.target.value)}
                placeholder="e.g. 1.0.0"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">
                Domains
              </label>
              <input
                type="text"
                value={domainsInput(service)}
                onChange={(e) => setDomainsFromInput(idx, e.target.value)}
                placeholder="e.g. travel, finance (comma-separated)"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 border-t border-slate-700 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400">Skills</label>
              <button
                type="button"
                onClick={() => addSkill(idx)}
                className="flex items-center gap-1 text-xs text-purple-400 transition-colors hover:text-purple-300"
              >
                <Plus className="h-3 w-3" />
                Add Skill
              </button>
            </div>
            {skills(service).length === 0 ? (
              <p className="text-xs text-slate-500">
                Optional. Add skills for discovery (id, name, description).
              </p>
            ) : (
              <div className="space-y-3">
                {skills(service).map((skill, skillIdx) => (
                  <div
                    key={skillIdx}
                    className="rounded border border-slate-600 bg-slate-900/50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Skill {skillIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeSkill(idx, skillIdx)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={skill.id}
                        onChange={(e) => updateSkill(idx, skillIdx, 'id', e.target.value)}
                        placeholder="id (e.g. recommend-spots)"
                        className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={skill.name}
                        onChange={(e) => updateSkill(idx, skillIdx, 'name', e.target.value)}
                        placeholder="name (e.g. Spot Recommendation)"
                        className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={skill.description}
                        onChange={(e) =>
                          updateSkill(idx, skillIdx, 'description', e.target.value)
                        }
                        placeholder="description"
                        className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none sm:col-span-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
