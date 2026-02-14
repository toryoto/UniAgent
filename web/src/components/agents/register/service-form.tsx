'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ERC8004Service } from '@agent-marketplace/shared';

interface ServiceFormProps {
  services: ERC8004Service[];
  onChange: (services: ERC8004Service[]) => void;
}

export function ServiceForm({ services, onChange }: ServiceFormProps) {
  const updateService = (
    index: number,
    field: keyof ERC8004Service,
    value: string
  ) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addService = () => {
    onChange([...services, { name: '', endpoint: '' }]);
  };

  const removeService = (index: number) => {
    if (services.length <= 1) return;
    onChange(services.filter((_, i) => i !== index));
  };

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
                placeholder="e.g. FlightSearch"
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
                placeholder="https://example.com/api"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
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
          </div>
        </div>
      ))}
    </div>
  );
}
