/**
 * Voice Command Parser
 *
 * Maps natural language to wallet actions
 * Uses pattern matching (no AI/OpenAI required for MVP)
 */

import { PublicKey } from '@solana/web3.js';

export interface VoiceCommand {
  action: 'getBalance' | 'sendTransaction' | 'getAddress' | 'refreshBalance' | 'copyAddress' | 'unknown';
  params: {
    amount?: number;
    recipient?: string;
    [key: string]: any;
  };
  confidence: number; // 0-1
  originalText: string;
}

export class VoiceCommandParser {
  /**
   * Parse natural language transcript into structured command
   * @param transcript - User's voice input
   * @returns Parsed command or null if no match
   */
  parse(transcript: string): VoiceCommand | null {
    if (!transcript || transcript.trim().length === 0) {
      return null;
    }

    const lower = transcript.toLowerCase().trim();

    // Try each command pattern
    const command =
      this.parseBalanceCommand(lower, transcript) ||
      this.parseSendCommand(lower, transcript) ||
      this.parseAddressCommand(lower, transcript) ||
      this.parseRefreshCommand(lower, transcript) ||
      this.parseCopyCommand(lower, transcript);

    if (command) {
      // Validate command before returning
      try {
        this.validateCommand(command);
        return command;
      } catch (error: any) {
        console.error('Command validation failed:', error.message);
        return {
          action: 'unknown',
          params: {},
          confidence: 0,
          originalText: transcript,
        };
      }
    }

    // No match found
    return {
      action: 'unknown',
      params: {},
      confidence: 0,
      originalText: transcript,
    };
  }

  /**
   * Parse balance inquiry commands
   */
  private parseBalanceCommand(lower: string, original: string): VoiceCommand | null {
    const balancePatterns = [
      /(?:what'?s|what is|show|check|get)\s+(?:my\s+)?balance/i,
      /how much (?:sol|money|funds?)\s+(?:do i have|have i got)/i,
      /(?:my\s+)?balance/i,
    ];

    for (const pattern of balancePatterns) {
      if (pattern.test(lower)) {
        return {
          action: 'getBalance',
          params: {},
          confidence: 0.9,
          originalText: original,
        };
      }
    }

    return null;
  }

  /**
   * Parse send transaction commands
   */
  private parseSendCommand(lower: string, original: string): VoiceCommand | null {
    // Pattern: "send [amount] [SOL] to [address]"
    const patterns = [
      /send\s+([\d.]+)\s+(?:sol\s+)?to\s+([a-zA-Z0-9]+)/i,
      /transfer\s+([\d.]+)\s+(?:sol\s+)?to\s+([a-zA-Z0-9]+)/i,
      /pay\s+([\d.]+)\s+(?:sol\s+)?to\s+([a-zA-Z0-9]+)/i,
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        const amount = parseFloat(match[1]);
        const recipient = match[2];

        return {
          action: 'sendTransaction',
          params: {
            amount,
            recipient,
          },
          confidence: 0.85,
          originalText: original,
        };
      }
    }

    return null;
  }

  /**
   * Parse address inquiry commands
   */
  private parseAddressCommand(lower: string, original: string): VoiceCommand | null {
    const addressPatterns = [
      /(?:what'?s|what is|show|get)\s+(?:my\s+)?(?:wallet\s+)?address/i,
      /(?:my\s+)?(?:wallet\s+)?address/i,
      /show\s+(?:my\s+)?(?:public\s+)?key/i,
    ];

    for (const pattern of addressPatterns) {
      if (pattern.test(lower)) {
        return {
          action: 'getAddress',
          params: {},
          confidence: 0.9,
          originalText: original,
        };
      }
    }

    return null;
  }

  /**
   * Parse refresh balance commands
   */
  private parseRefreshCommand(lower: string, original: string): VoiceCommand | null {
    const refreshPatterns = [
      /refresh\s+(?:my\s+)?balance/i,
      /update\s+(?:my\s+)?balance/i,
      /reload\s+balance/i,
    ];

    for (const pattern of refreshPatterns) {
      if (pattern.test(lower)) {
        return {
          action: 'refreshBalance',
          params: {},
          confidence: 0.9,
          originalText: original,
        };
      }
    }

    return null;
  }

  /**
   * Parse copy address commands
   */
  private parseCopyCommand(lower: string, original: string): VoiceCommand | null {
    const copyPatterns = [
      /copy\s+(?:my\s+)?(?:wallet\s+)?address/i,
      /copy\s+(?:public\s+)?key/i,
    ];

    for (const pattern of copyPatterns) {
      if (pattern.test(lower)) {
        return {
          action: 'copyAddress',
          params: {},
          confidence: 0.9,
          originalText: original,
        };
      }
    }

    return null;
  }

  /**
   * Validate command parameters
   * Throws error if validation fails
   */
  private validateCommand(command: VoiceCommand): void {
    switch (command.action) {
      case 'sendTransaction':
        this.validateSendTransaction(command.params);
        break;
      case 'getBalance':
      case 'getAddress':
      case 'refreshBalance':
      case 'copyAddress':
        // No validation needed for these commands
        break;
      case 'unknown':
        // Unknown commands don't need validation
        break;
    }
  }

  /**
   * Validate send transaction parameters
   */
  private validateSendTransaction(params: any): void {
    // Validate amount
    if (typeof params.amount !== 'number' || isNaN(params.amount)) {
      throw new Error('Invalid amount');
    }

    if (params.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Validate recipient address
    if (!params.recipient || typeof params.recipient !== 'string') {
      throw new Error('Recipient address is required');
    }

    if (!this.isValidSolanaAddress(params.recipient)) {
      throw new Error('Invalid Solana address');
    }
  }

  /**
   * Validate Solana address using PublicKey class
   */
  private isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get friendly description of command for confirmation
   */
  getCommandDescription(command: VoiceCommand): string {
    switch (command.action) {
      case 'getBalance':
        return 'Check wallet balance';
      case 'sendTransaction':
        return `Send ${command.params.amount} SOL to ${command.params.recipient}`;
      case 'getAddress':
        return 'Show wallet address';
      case 'refreshBalance':
        return 'Refresh balance';
      case 'copyAddress':
        return 'Copy wallet address';
      case 'unknown':
        return `Unknown command: "${command.originalText}"`;
      default:
        return 'Unknown command';
    }
  }

  /**
   * Check if command requires user confirmation
   */
  requiresConfirmation(command: VoiceCommand): boolean {
    // Send transactions always require confirmation
    return command.action === 'sendTransaction';
  }
}
