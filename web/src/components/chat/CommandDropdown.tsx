/**
 * CommandDropdown - Dropdown UI for slash command suggestions
 */

import { useRef, useEffect } from 'react';
import type { SlashCommandOption } from '@/lib/hooks/useSlashCommand';
import { Command } from 'lucide-react';

export interface CommandDropdownProps {
  options: SlashCommandOption[];
  selectedIndex: number;
  onSelect: (option: SlashCommandOption) => void;
  onClose: () => void;
}

export function CommandDropdown({
  options,
  selectedIndex,
  onSelect,
  onClose,
}: CommandDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (options.length === 0) {
    return (
      <div
        ref={dropdownRef}
        className="absolute bottom-full left-0 mb-2 w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-3 shadow-xl"
      >
        <p className="text-sm text-slate-400">No commands found</p>
      </div>
    );
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-2 max-h-64 w-full max-w-md overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl"
    >
      {options.map((option, index) => (
        <div
          key={option.id}
          ref={index === selectedIndex ? selectedRef : null}
          onClick={() => onSelect(option)}
          className={`cursor-pointer border-b border-slate-700/50 px-4 py-3 transition-colors last:border-b-0 ${
            index === selectedIndex ? 'bg-purple-600/20' : 'hover:bg-slate-700/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                index === selectedIndex ? 'bg-purple-600' : 'bg-slate-700'
              }`}
            >
              <Command className="h-3 w-3 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`truncate text-sm font-medium ${
                    index === selectedIndex ? 'text-purple-300' : 'text-slate-200'
                  }`}
                >
                  {option.label}
                </span>
              </div>
              {option.description && (
                <p className="mt-0.5 truncate text-xs text-slate-400">{option.description}</p>
              )}
              <p className="mt-1 truncate font-mono text-xs text-slate-500">{option.value}</p>
            </div>
          </div>
        </div>
      ))}
      <div className="border-t border-slate-700 bg-slate-900/50 px-4 py-2">
        <p className="text-xs text-slate-500">↑↓ to navigate • Enter to select • Esc to cancel</p>
      </div>
    </div>
  );
}
