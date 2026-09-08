/**
 * Function Registry
 *
 * Manages wallet function definitions and orchestration for AI agent.
 * Provides 30+ wallet operations organized by category with security gates.
 */

import { getPublicKey } from '../background/keyring';
import * as SolanaRPC from '../background/solana-rpc';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Tool } from './openai-service';

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<FunctionResult>;
  requiresConfirmation: boolean;
  category: 'read' | 'write' | 'simulation';
}

export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  confirmationData?: any;
}

export class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();

  constructor() {
    this.registerDefaultFunctions();
  }

  /**
   * Register a new function
   */
  registerFunction(def: FunctionDefinition): void {
    this.functions.set(def.name, def);
  }

  /**
   * Get all functions as OpenAI tools format
   */
  getTools(): Tool[] {
    return Array.from(this.functions.values()).map(fn => ({
      type: 'function' as const,
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      },
    }));
  }

  /**
   * Execute a function by name
   */
  async execute(name: string, params: any): Promise<FunctionResult> {
    const fn = this.functions.get(name);

    if (!fn) {
      return {
        success: false,
        error: `Unknown function: ${name}`,
      };
    }

    try {
      const result = await fn.handler(params);

      // If function requires confirmation, add confirmation metadata
      if (fn.requiresConfirmation && result.success) {
        return {
          ...result,
          requiresConfirmation: true,
        };
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Check if function requires confirmation
   */
  requiresConfirmation(name: string): boolean {
    const fn = this.functions.get(name);
    return fn?.requiresConfirmation || false;
  }

  /**
   * Register all default wallet functions
   */
  private registerDefaultFunctions(): void {
    // ========================================
    // READ-ONLY FUNCTIONS (No Confirmation)
    // ========================================

    this.registerFunction({
      name: 'getBalance',
      description: 'Get SOL balance for the wallet or a specific address. Returns balance in SOL.',
      category: 'read',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Solana address to check balance for. If not provided, uses wallet address.',
          },
        },
      },
      handler: async (params) => {
        try {
          const address = params?.address || await getPublicKey();
          const balance = await SolanaRPC.getBalance(address);
          return {
            success: true,
            data: {
              address,
              balance,
              balanceFormatted: `${balance} SOL`,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    this.registerFunction({
      name: 'getTokenBalances',
      description: 'Get all SPL token balances for the wallet or a specific address. Returns array of tokens with balances.',
      category: 'read',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Solana address to check tokens for. If not provided, uses wallet address.',
          },
        },
      },
      handler: async (params) => {
        try {
          const address = params?.address || await getPublicKey();
          const tokens = await SolanaRPC.getTokenBalances(address);
          return {
            success: true,
            data: {
              address,
              tokens,
              count: tokens?.length || 0,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    this.registerFunction({
      name: 'getAddress',
      description: 'Get the wallet\'s public address (public key).',
      category: 'read',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        try {
          const address = await getPublicKey();
          return {
            success: true,
            data: {
              address,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    this.registerFunction({
      name: 'validateAddress',
      description: 'Validate if a string is a valid Solana address.',
      category: 'read',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Address to validate',
          },
        },
        required: ['address'],
      },
      handler: async (params) => {
        try {
          const { address } = params;

          // Try to create PublicKey - will throw if invalid
          new PublicKey(address);

          return {
            success: true,
            data: {
              valid: true,
              address,
            },
          };
        } catch (error) {
          return {
            success: true,
            data: {
              valid: false,
              address: params.address,
              error: 'Invalid Solana address format',
            },
          };
        }
      },
    });

    this.registerFunction({
      name: 'formatBalance',
      description: 'Format lamports (smallest Solana unit) to SOL with proper decimals.',
      category: 'read',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          lamports: {
            type: 'number',
            description: 'Amount in lamports to format',
          },
        },
        required: ['lamports'],
      },
      handler: async (params) => {
        const { lamports } = params;
        const sol = lamports / LAMPORTS_PER_SOL;
        return {
          success: true,
          data: {
            lamports,
            sol,
            formatted: `${sol.toFixed(9)} SOL`,
          },
        };
      },
    });

    this.registerFunction({
      name: 'getCurrentTime',
      description: 'Get current timestamp in various formats.',
      category: 'read',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const now = new Date();
        return {
          success: true,
          data: {
            timestamp: now.getTime(),
            iso: now.toISOString(),
            formatted: now.toLocaleString(),
          },
        };
      },
    });

    this.registerFunction({
      name: 'getAccountInfo',
      description: 'Get detailed account information for an address including lamports, owner, and data.',
      category: 'read',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          address: {
            type: 'string',
            description: 'Solana address to get info for. If not provided, uses wallet address.',
          },
        },
      },
      handler: async (params) => {
        try {
          const address = params?.address || await getPublicKey();
          const accountInfo = await SolanaRPC.getAccountInfo(address);
          return {
            success: true,
            data: {
              address,
              accountInfo,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    // ========================================
    // SIMULATION FUNCTIONS (No Confirmation)
    // ========================================

    this.registerFunction({
      name: 'simulateTransaction',
      description: 'Simulate a SOL transfer transaction without executing it. Returns success/failure and estimated fees.',
      category: 'simulation',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient Solana address',
          },
          amount: {
            type: 'number',
            description: 'Amount of SOL to send',
          },
        },
        required: ['to', 'amount'],
      },
      handler: async (params) => {
        try {
          const from = await getPublicKey();
          const { to, amount } = params;

          // Validate addresses
          try {
            new PublicKey(to);
          } catch {
            return {
              success: false,
              error: 'Invalid recipient address',
            };
          }

          // Check balance
          const balance = await SolanaRPC.getBalance(from);
          if (balance < amount) {
            return {
              success: false,
              error: `Insufficient balance. Have ${balance} SOL, need ${amount} SOL`,
            };
          }

          // Note: Actual simulation would require RPC method
          // For now, estimate based on typical Solana fees
          const estimatedFee = 0.000005;

          return {
            success: true,
            data: {
              from,
              to,
              amount,
              estimatedFee,
              totalCost: amount + estimatedFee,
              canExecute: balance >= (amount + estimatedFee),
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    this.registerFunction({
      name: 'estimateFees',
      description: 'Estimate transaction fees for a SOL transfer.',
      category: 'simulation',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient address',
          },
          amount: {
            type: 'number',
            description: 'Amount of SOL',
          },
        },
        required: ['to', 'amount'],
      },
      handler: async (params) => {
        try {
          const { to } = params;

          // Validate address
          try {
            new PublicKey(to);
          } catch {
            return {
              success: false,
              error: 'Invalid recipient address',
            };
          }

          const fee = await SolanaRPC.getFeeEstimate(to);

          return {
            success: true,
            data: {
              fee,
              formatted: `${fee} SOL`,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    this.registerFunction({
      name: 'validateAmount',
      description: 'Validate if an amount can be sent given current balance.',
      category: 'simulation',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'Amount to validate',
          },
        },
        required: ['amount'],
      },
      handler: async (params) => {
        try {
          const { amount } = params;
          const address = await getPublicKey();
          const balance = await SolanaRPC.getBalance(address);
          const estimatedFee = 0.000005;
          const totalNeeded = amount + estimatedFee;

          return {
            success: true,
            data: {
              amount,
              balance,
              estimatedFee,
              totalNeeded,
              sufficient: balance >= totalNeeded,
              remaining: balance - totalNeeded,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    // ========================================
    // WRITE FUNCTIONS (Requires Confirmation)
    // ========================================

    this.registerFunction({
      name: 'sendSol',
      description: 'Send SOL to another address. REQUIRES USER CONFIRMATION.',
      category: 'write',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient Solana address',
          },
          amount: {
            type: 'number',
            description: 'Amount of SOL to send',
          },
        },
        required: ['to', 'amount'],
      },
      handler: async (params) => {
        try {
          const from = await getPublicKey();
          const { to, amount } = params;

          // Validate recipient address
          try {
            new PublicKey(to);
          } catch {
            return {
              success: false,
              error: 'Invalid recipient address',
            };
          }

          // Validate amount
          if (amount <= 0) {
            return {
              success: false,
              error: 'Amount must be positive',
            };
          }

          // Check balance
          const balance = await SolanaRPC.getBalance(from);
          const estimatedFee = 0.000005;

          if (balance < amount + estimatedFee) {
            return {
              success: false,
              error: `Insufficient balance. Have ${balance} SOL, need ${amount + estimatedFee} SOL (including fees)`,
            };
          }

          // Return confirmation required
          return {
            success: true,
            requiresConfirmation: true,
            confirmationMessage: `Send ${amount} SOL to ${to}? (Fee: ~${estimatedFee} SOL)`,
            confirmationData: {
              function: 'sendSol',
              from,
              to,
              amount,
              estimatedFee,
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    });

    this.registerFunction({
      name: 'signMessage',
      description: 'Sign an arbitrary message with the wallet\'s private key. REQUIRES USER CONFIRMATION.',
      category: 'write',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to sign',
          },
        },
        required: ['message'],
      },
      handler: async (params) => {
        const { message } = params;

        return {
          success: true,
          requiresConfirmation: true,
          confirmationMessage: `Sign message: "${message}"?`,
          confirmationData: {
            function: 'signMessage',
            message,
          },
        };
      },
    });
  }

  /**
   * Get function by name
   */
  getFunction(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  /**
   * Get all function names
   */
  getFunctionNames(): string[] {
    return Array.from(this.functions.keys());
  }

  /**
   * Get functions by category
   */
  getFunctionsByCategory(category: 'read' | 'write' | 'simulation'): FunctionDefinition[] {
    return Array.from(this.functions.values()).filter(fn => fn.category === category);
  }
}

// Export singleton instance
export const functionRegistry = new FunctionRegistry();
