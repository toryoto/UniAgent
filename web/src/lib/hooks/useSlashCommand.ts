/**
 * useSlashCommand - Slash command handler for chat input
 *
 * Detects `/` prefix and provides command suggestions with keyboard navigation
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface SlashCommandOption {
  id: string;
  label: string;
  description?: string;
  value: string;
  metadata?: Record<string, unknown>;
}

export interface UseSlashCommandOptions {
  onSelect: (option: SlashCommandOption) => void;
  options: SlashCommandOption[];
}

export interface UseSlashCommandReturn {
  isOpen: boolean;
  filteredOptions: SlashCommandOption[];
  selectedIndex: number;
  detectCommand: (text: string, cursorPosition: number) => void;
  selectOption: (option: SlashCommandOption) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean; // Returns true if event was handled
  close: () => void;
}

export function useSlashCommand({
  onSelect,
  options,
}: UseSlashCommandOptions): UseSlashCommandReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<SlashCommandOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commandQuery, setCommandQuery] = useState('');
  const commandStartPos = useRef<number>(0);

  // Filter options based on query
  useEffect(() => {
    if (!commandQuery) {
      setFilteredOptions(options);
      return;
    }

    const query = commandQuery.toLowerCase();
    const filtered = options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
    );

    setFilteredOptions(filtered);
    setSelectedIndex(0);
  }, [commandQuery, options]);

  // Detect slash command in text
  const detectCommand = useCallback((text: string, cursorPosition: number) => {
    // Find the last `/` before cursor position
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

    if (lastSlashIndex === -1) {
      setIsOpen(false);
      return;
    }

    // Check if the slash is at the start or after a space (valid command position)
    const isValidPosition =
      lastSlashIndex === 0 || text[lastSlashIndex - 1] === ' ' || text[lastSlashIndex - 1] === '\n';

    if (!isValidPosition) {
      setIsOpen(false);
      return;
    }

    // Extract query after slash
    const query = textBeforeCursor.substring(lastSlashIndex + 1);

    // Check if there's a space after the slash (command is complete)
    if (query.includes(' ') || query.includes('\n')) {
      setIsOpen(false);
      return;
    }

    commandStartPos.current = lastSlashIndex;
    setCommandQuery(query);
    setIsOpen(true);
  }, []);

  // Select an option
  const selectOption = useCallback(
    (option: SlashCommandOption) => {
      onSelect(option);
      setIsOpen(false);
      setCommandQuery('');
    },
    [onSelect]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || filteredOptions.length === 0) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredOptions.length);
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
          return true;

        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (filteredOptions[selectedIndex]) {
            selectOption(filteredOptions[selectedIndex]);
          }
          return true;

        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          return true;

        default:
          return false;
      }
    },
    [isOpen, filteredOptions, selectedIndex, selectOption]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setCommandQuery('');
  }, []);

  return {
    isOpen,
    filteredOptions,
    selectedIndex,
    detectCommand,
    selectOption,
    handleKeyDown,
    close,
  };
}
