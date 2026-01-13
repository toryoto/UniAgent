/**
 * Message Parser - Extract structured data from chat messages
 */

export interface ParsedMessage {
  text: string;
  agentId?: string;
  command?: string;
}

/**
 * Parse message to extract agent ID from /use-agent command
 *
 * Format: /use-agent <agent-id> [additional text]
 *
 * @param message - Raw message text
 * @returns Parsed message with extracted agentId
 */
export function parseMessage(message: string): ParsedMessage {
  const trimmedMessage = message.trim();

  // Match /use-agent command pattern
  const useAgentPattern = /^\/use-agent\s+([^\s]+)(?:\s+(.*))?$/i;
  const match = trimmedMessage.match(useAgentPattern);

  if (match) {
    const agentId = match[1];
    const remainingText = match[2] || '';

    return {
      text: remainingText || `Execute agent ${agentId}`,
      agentId,
      command: 'use-agent',
    };
  }

  // No command found, return original message
  return {
    text: trimmedMessage,
  };
}
