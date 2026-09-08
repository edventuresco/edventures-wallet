/**
 * Wallet Standard Adapter
 *
 * Registers My Little Wallet with the Wallet Standard API
 * This makes the wallet discoverable by modern Solana dapps like pump.fun
 */

import type {
  Wallet,
  WalletAccount,
  WalletVersion,
} from '@wallet-standard/base';
import { registerWallet } from '@wallet-standard/wallet';
import bs58 from 'bs58';

interface SolanaProvider {
  isMyLittleWallet: boolean;
  publicKey: { toString: () => string } | null;
  isConnected: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  signTransaction: (transaction: any) => Promise<any>;
  signAndSendTransaction: (transaction: any) => Promise<{ signature: string }>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
}

/**
 * Wallet Standard wallet implementation for My Little Wallet
 */
class MyLittleWalletStandard implements Wallet {
  readonly version: WalletVersion = '1.0.0' as WalletVersion;
  readonly name = 'My Little Wallet';
  readonly icon =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNDgiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+8J+mhDwvdGV4dD48L3N2Zz4='; // Simple SVG with unicorn emoji

  readonly chains = [
    'solana:mainnet',
    'solana:devnet',
    'solana:testnet',
  ] as const;

  private provider: SolanaProvider;
  private _accounts: WalletAccount[] = [];

  constructor(provider: SolanaProvider) {
    this.provider = provider;

    // Listen for connection events to update accounts
    this.provider.on('connect', () => {
      this.updateAccounts();
    });

    this.provider.on('disconnect', () => {
      this._accounts = [];
    });
  }

  get accounts(): readonly WalletAccount[] {
    return this._accounts;
  }

  get features() {
    return {
      'standard:connect': {
        version: '1.0.0' as WalletVersion,
        connect: this.connect.bind(this),
      },
      'standard:disconnect': {
        version: '1.0.0' as WalletVersion,
        disconnect: this.disconnect.bind(this),
      },
      'standard:events': {
        version: '1.0.0' as WalletVersion,
        on: this.on.bind(this),
      },
      'solana:signTransaction': {
        version: '1.0.0' as WalletVersion,
        supportedTransactionVersions: ['legacy', 0],
        signTransaction: this.signTransaction.bind(this),
      },
      'solana:signMessage': {
        version: '1.0.0' as WalletVersion,
        signMessage: this.signMessage.bind(this),
      },
    };
  }

  private updateAccounts() {
    if (this.provider.publicKey) {
      const address = this.provider.publicKey.toString();

      // Decode base58 public key to bytes (proper Solana format)
      let publicKeyBytes: Uint8Array;
      try {
        publicKeyBytes = bs58.decode(address);
        if (publicKeyBytes.length !== 32) {
          throw new Error('Invalid public key length');
        }
      } catch (error) {
        console.error('[My Little Wallet] Failed to decode public key:', error);
        // Fallback to empty array if decode fails
        publicKeyBytes = new Uint8Array(32);
      }

      this._accounts = [
        {
          address,
          publicKey: publicKeyBytes,
          chains: ['solana:mainnet', 'solana:devnet', 'solana:testnet'],
          features: ['solana:signTransaction', 'solana:signMessage'],
        },
      ];
    }
  }

  async connect(): Promise<{ accounts: readonly WalletAccount[] }> {
    await this.provider.connect();
    this.updateAccounts();
    return { accounts: this._accounts };
  }

  async disconnect(): Promise<void> {
    await this.provider.disconnect();
    this._accounts = [];
  }

  on(event: string, handler: (...args: any[]) => void): () => void {
    this.provider.on(event, handler);
    return () => this.provider.off(event, handler);
  }

  async signTransaction(input: any): Promise<any> {
    return await this.provider.signTransaction(input);
  }

  async signMessage(input: { message: Uint8Array }): Promise<{ signature: Uint8Array }> {
    return await this.provider.signMessage(input.message);
  }
}

/**
 * Register wallet with Wallet Standard API
 * Uses the official @wallet-standard/wallet registerWallet function
 */
export function registerWalletStandard(solanaProvider: SolanaProvider): void {
  try {
    console.log('[My Little Wallet] Registering with Wallet Standard...');

    const wallet = new MyLittleWalletStandard(solanaProvider);

    // Use the official registerWallet function from @wallet-standard/wallet
    // This properly handles the registration event protocol
    registerWallet(wallet);

    console.log('[My Little Wallet] ✅ Registered with Wallet Standard (official API)');

    // Add global injection flag for debugging
    Object.defineProperty(globalThis, '_my_little_wallet_injected', {
      value: true,
      writable: false,
      configurable: false,
    });
    console.log('[My Little Wallet] Set global injection flag');

  } catch (error) {
    console.error('[My Little Wallet] Failed to register wallet standard:', error);
  }
}
