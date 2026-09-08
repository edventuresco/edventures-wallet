/**
 * Security Validator
 *
 * Provides security checks and validation for AI agent operations:
 * - Address validation (Solana base58)
 * - Amount validation (positive, sufficient balance)
 * - Prompt injection detection
 * - Rate limiting
 * - Input sanitization
 */

import { PublicKey } from '@solana/web3.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class SecurityValidator {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_PER_MINUTE = 10;
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000;

  /**
   * Validate a Solana address
   */
  validateAddress(address: string): ValidationResult {
    try {
      // Check if empty
      if (!address || address.trim().length === 0) {
        return {
          valid: false,
          error: 'Address cannot be empty',
        };
      }

      // Try to create PublicKey - will throw if invalid
      new PublicKey(address);

      // Additional checks
      if (address.length < 32 || address.length > 44) {
        return {
          valid: false,
          error: 'Invalid address length',
        };
      }

      // Check for valid base58 characters
      const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;
      if (!base58Pattern.test(address)) {
        return {
          valid: false,
          error: 'Address contains invalid characters',
        };
      }

      return {
        valid: true,
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Invalid Solana address',
      };
    }
  }

  /**
   * Validate an amount for a transaction
   */
  validateAmount(amount: number, balance: number): ValidationResult {
    // Check if amount is a valid number
    if (typeof amount !== 'number' || isNaN(amount)) {
      return {
        valid: false,
        error: 'Amount must be a valid number',
      };
    }

    // Check if amount is positive
    if (amount <= 0) {
      return {
        valid: false,
        error: 'Amount must be positive',
      };
    }

    // Check if amount is too large (sanity check: max 1M SOL)
    if (amount > 1_000_000) {
      return {
        valid: false,
        error: 'Amount exceeds maximum limit',
      };
    }

    // Check if amount has too many decimal places (max 9 for SOL)
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 9) {
      return {
        valid: false,
        error: 'Amount has too many decimal places (max 9)',
      };
    }

    // Check if sufficient balance
    if (amount > balance) {
      return {
        valid: false,
        error: `Insufficient balance. Have ${balance} SOL, need ${amount} SOL`,
      };
    }

    // Check if balance would be too low after transaction (including fees)
    const estimatedFee = 0.000005;
    if (balance < amount + estimatedFee) {
      return {
        valid: false,
        error: `Insufficient balance to cover amount + fees. Need ${amount + estimatedFee} SOL`,
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Detect potential prompt injection attacks
   */
  detectPromptInjection(text: string): boolean {
    // Convert to lowercase for pattern matching
    const lowerText = text.toLowerCase();

    // Common prompt injection patterns
    const injectionPatterns = [
      // Direct instruction overrides
      /ignore (previous|all|above|prior) (instructions|prompts|rules)/,
      /forget (previous|all|above) (instructions|prompts|context)/,
      /disregard (previous|all|above) (instructions|prompts)/,

      // Role manipulation
      /you are now/,
      /act as (a )?(different|new)/,
      /pretend (you are|to be)/,
      /from now on/,

      // System prompt exposure attempts
      /show (me )?(your|the) (system|original) (prompt|instructions)/,
      /what (are|were) your (original|initial) (instructions|prompt)/,
      /repeat (your|the) (instructions|prompt|rules)/,

      // Security rule bypasses
      /there are no rules/,
      /rules don't apply/,
      /make an exception/,
      /override security/,

      // Direct key/secret requests
      /(show|give|tell) (me )?(the )?(private key|secret|mnemonic|seed phrase)/,
      /export (private key|secret|wallet)/,
    ];

    // Check against patterns
    for (const pattern of injectionPatterns) {
      if (pattern.test(lowerText)) {
        console.warn('[SecurityValidator] Potential prompt injection detected:', text);
        return true;
      }
    }

    // Check for suspicious repetition (often used in injection attacks)
    const words = text.split(/\s+/);
    if (words.length > 10) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      const repetitionRatio = uniqueWords.size / words.length;
      if (repetitionRatio < 0.5) {
        console.warn('[SecurityValidator] Suspicious repetition detected');
        return true;
      }
    }

    // Check for excessively long input (potential injection)
    if (text.length > 1000) {
      console.warn('[SecurityValidator] Excessively long input detected');
      return true;
    }

    return false;
  }

  /**
   * Check rate limit for a session
   */
  checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    const record = this.requestCounts.get(sessionId);

    if (!record || now > record.resetTime) {
      // Create or reset record
      this.requestCounts.set(sessionId, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW_MS,
      });
      return true;
    }

    // Increment count
    record.count++;

    // Check if over limit
    if (record.count > this.RATE_LIMIT_PER_MINUTE) {
      console.warn(`[SecurityValidator] Rate limit exceeded for session ${sessionId}`);
      return false;
    }

    return true;
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(text: string): string {
    // Remove null bytes
    let sanitized = text.replace(/\0/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Remove control characters (except newlines and tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // Limit length
    const MAX_LENGTH = 1000;
    if (sanitized.length > MAX_LENGTH) {
      sanitized = sanitized.substring(0, MAX_LENGTH);
    }

    return sanitized;
  }

  /**
   * Validate transaction parameters
   */
  validateTransaction(params: {
    to: string;
    amount: number;
    balance: number;
  }): ValidationResult {
    // Validate recipient address
    const addressValidation = this.validateAddress(params.to);
    if (!addressValidation.valid) {
      return addressValidation;
    }

    // Validate amount
    const amountValidation = this.validateAmount(params.amount, params.balance);
    if (!amountValidation.valid) {
      return amountValidation;
    }

    return {
      valid: true,
    };
  }

  /**
   * Clear rate limit for a session (for testing or manual reset)
   */
  clearRateLimit(sessionId: string): void {
    this.requestCounts.delete(sessionId);
  }

  /**
   * Get rate limit stats for a session
   */
  getRateLimitStats(sessionId: string): { count: number; remaining: number; resetIn: number } | null {
    const record = this.requestCounts.get(sessionId);
    if (!record) {
      return null;
    }

    const now = Date.now();
    const resetIn = Math.max(0, record.resetTime - now);

    return {
      count: record.count,
      remaining: Math.max(0, this.RATE_LIMIT_PER_MINUTE - record.count),
      resetIn,
    };
  }
}

// Export singleton instance
export const securityValidator = new SecurityValidator();
