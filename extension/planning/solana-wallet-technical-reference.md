# Solana Wallet Technical Reference

**Version**: 1.0
**Date**: 2026-01-24
**Purpose**: Technical reference for building standards-compliant Solana browser extension wallets

---

## Table of Contents

1. [Solana Wallet Standard](#1-solana-wallet-standard)
2. [Browser Extension Architecture](#2-browser-extension-architecture)
3. [Key Management & Security](#3-key-management--security)
4. [Provider Injection & dApp Communication](#4-provider-injection--dapp-communication)
5. [Common Libraries](#5-common-libraries)
6. [Code Patterns & Examples](#6-code-patterns--examples)
7. [Architectural Decisions](#7-architectural-decisions)

---

## 1. Solana Wallet Standard

### 1.1 Overview

The Solana Wallet Standard provides a unified interface for wallets to interact with dApps across the Solana ecosystem.

**Key Packages**:
- `@wallet-standard/base` - Core wallet registration
- `@wallet-standard/features` - Standard feature interfaces
- `@solana/wallet-standard-features` - Solana-specific features

### 1.2 Core Features

#### Standard Features

```typescript
import type { WalletAccount, Wallet } from '@wallet-standard/base';
import type {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
  SolanaSignMessage,
  SolanaSignIn
} from '@solana/wallet-standard-features';

interface SolanaWallet extends Wallet {
  readonly version: '1.0.0';
  readonly name: string;
  readonly icon: string; // data URL or SVG
  readonly chains: readonly string[]; // ['solana:mainnet', 'solana:devnet', 'solana:testnet']
  readonly accounts: readonly WalletAccount[];
  readonly features: {
    'standard:connect': StandardConnect;
    'standard:disconnect': StandardDisconnect;
    'standard:events': StandardEvents;
    'solana:signAndSendTransaction': SolanaSignAndSendTransaction;
    'solana:signTransaction': SolanaSignTransaction;
    'solana:signMessage': SolanaSignMessage;
    'solana:signIn'?: SolanaSignIn;
  };
}
```

#### Feature Implementation Pattern

```typescript
import { SolanaSignAndSendTransaction } from '@solana/wallet-standard-features';
import { Transaction, Connection, SendOptions } from '@solana/web3.js';

class MyWalletSignAndSendTransaction implements SolanaSignAndSendTransaction {
  readonly version = '1.0.0' as const;

  async signAndSendTransaction(
    input: SolanaSignAndSendTransactionInput
  ): Promise<SolanaSignAndSendTransactionOutput> {
    const { account, chain, transaction, options } = input;

    // Validate chain
    if (!this.isSupportedChain(chain)) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    // Deserialize transaction
    const tx = Transaction.from(transaction);

    // Request user approval (show UI)
    const approved = await this.requestApproval(tx);
    if (!approved) {
      throw new Error('User rejected transaction');
    }

    // Sign transaction
    const signedTx = await this.signTransaction(tx, account.publicKey);

    // Send to network
    const connection = this.getConnection(chain);
    const signature = await connection.sendRawTransaction(
      signedTx.serialize(),
      options as SendOptions
    );

    return {
      signature: bs58.decode(signature)
    };
  }

  private isSupportedChain(chain: string): boolean {
    return ['solana:mainnet', 'solana:devnet', 'solana:testnet'].includes(chain);
  }
}
```

### 1.3 Wallet Registration

```typescript
import { registerWallet } from '@wallet-standard/wallet';

class MyWallet implements Wallet {
  readonly version = '1.0.0' as const;
  readonly name = 'My Little Wallet';
  readonly icon = 'data:image/svg+xml,...'; // Base64 or data URL
  readonly chains = ['solana:mainnet', 'solana:devnet'] as const;

  #accounts: WalletAccount[] = [];
  #eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  get accounts(): readonly WalletAccount[] {
    return this.#accounts;
  }

  get features(): WalletFeatures {
    return {
      'standard:connect': {
        version: '1.0.0',
        connect: this.connect.bind(this)
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: this.disconnect.bind(this)
      },
      'standard:events': {
        version: '1.0.0',
        on: this.on.bind(this)
      },
      'solana:signAndSendTransaction': new MyWalletSignAndSendTransaction(this),
      'solana:signTransaction': new MyWalletSignTransaction(this),
      'solana:signMessage': new MyWalletSignMessage(this)
    };
  }

  async connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }> {
    if (this.#accounts.length === 0) {
      // Show connection UI unless silent
      if (!input?.silent) {
        await this.showConnectionUI();
      }

      // Load accounts from storage
      const publicKeys = await this.loadPublicKeys();
      this.#accounts = publicKeys.map(pubkey => this.createWalletAccount(pubkey));

      // Emit change event
      this.emit('change', { accounts: this.#accounts });
    }

    return { accounts: this.#accounts };
  }

  async disconnect(): Promise<void> {
    this.#accounts = [];
    this.emit('change', { accounts: [] });
  }

  private createWalletAccount(publicKey: Uint8Array): WalletAccount {
    return {
      address: publicKey,
      publicKey,
      chains: this.chains,
      features: ['solana:signAndSendTransaction', 'solana:signTransaction', 'solana:signMessage'],
      label: 'Account 1',
      icon: this.icon
    };
  }

  private on(event: string, listener: (...args: any[]) => void): () => void {
    if (!this.#eventListeners.has(event)) {
      this.#eventListeners.set(event, new Set());
    }
    this.#eventListeners.get(event)!.add(listener);

    return () => {
      this.#eventListeners.get(event)?.delete(listener);
    };
  }

  private emit(event: string, ...args: any[]): void {
    this.#eventListeners.get(event)?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }
}

// Register wallet on load
function initializeWallet() {
  const wallet = new MyWallet();
  const unregister = registerWallet(wallet);

  // Store unregister function for cleanup
  return { wallet, unregister };
}
```

### 1.4 Chain Identifiers

Standard chain identifiers for Solana networks:

```typescript
const SOLANA_CHAINS = {
  MAINNET: 'solana:mainnet' as const,
  DEVNET: 'solana:devnet' as const,
  TESTNET: 'solana:testnet' as const,
  LOCALNET: 'solana:localnet' as const
};

// RPC endpoints mapping
const CHAIN_ENDPOINTS = {
  [SOLANA_CHAINS.MAINNET]: 'https://api.mainnet-beta.solana.com',
  [SOLANA_CHAINS.DEVNET]: 'https://api.devnet.solana.com',
  [SOLANA_CHAINS.TESTNET]: 'https://api.testnet.solana.com',
  [SOLANA_CHAINS.LOCALNET]: 'http://localhost:8899'
};
```

---

## 2. Browser Extension Architecture

### 2.1 Manifest V3 Structure

```json
{
  "manifest_version": 3,
  "name": "My Little Wallet",
  "version": "0.1.0",
  "description": "Solana wallet with Wallet Standard support",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://*.solana.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_start",
      "all_frames": false
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["inpage-script.js"],
      "matches": ["<all_urls>"]
    }
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 2.2 Extension Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                   Web Page (dApp)                    │
│  window.solana (legacy) + wallet-standard (modern)   │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│              Inpage Script (Injected)                │
│  • Wallet Standard Registration                     │
│  • window.solana Provider                           │
│  • Event Forwarding                                 │
└───────────────────┬─────────────────────────────────┘
                    │ (window.postMessage)
┌───────────────────▼─────────────────────────────────┐
│              Content Script (Isolated)               │
│  • Message Relay                                    │
│  • Request/Response Matching                        │
└───────────────────┬─────────────────────────────────┘
                    │ (chrome.runtime.sendMessage)
┌───────────────────▼─────────────────────────────────┐
│          Background Service Worker                   │
│  • Transaction Approval Queue                       │
│  • Keyring Management                               │
│  • Network State                                    │
│  • Persistent Storage                               │
└───────────────────┬─────────────────────────────────┘
                    │ (chrome.windows.create)
┌───────────────────▼─────────────────────────────────┐
│                  Popup UI (React)                    │
│  • Account Management                               │
│  • Transaction Approval                             │
│  • Settings                                         │
└─────────────────────────────────────────────────────┘
```

### 2.3 Message Passing Architecture

```typescript
// shared/types.ts
export enum MessageType {
  CONNECT_REQUEST = 'CONNECT_REQUEST',
  CONNECT_RESPONSE = 'CONNECT_RESPONSE',
  SIGN_TRANSACTION = 'SIGN_TRANSACTION',
  SIGN_MESSAGE = 'SIGN_MESSAGE',
  SEND_TRANSACTION = 'SEND_TRANSACTION',
  GET_ACCOUNTS = 'GET_ACCOUNTS',
  APPROVE_TRANSACTION = 'APPROVE_TRANSACTION',
  REJECT_TRANSACTION = 'REJECT_TRANSACTION'
}

export interface Message<T = any> {
  id: string;
  type: MessageType;
  payload: T;
  origin?: string;
}

export interface Response<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
}

// content-script.ts
let messageId = 0;
const pendingRequests = new Map<string, {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}>();

// Forward messages from page to background
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (!event.data?.type?.startsWith('SOLANA_')) return;

  const message = event.data;

  try {
    // Forward to background
    const response = await chrome.runtime.sendMessage(message);

    // Send response back to page
    window.postMessage({
      id: message.id,
      type: `${message.type}_RESPONSE`,
      ...response
    }, '*');
  } catch (error) {
    window.postMessage({
      id: message.id,
      type: `${message.type}_RESPONSE`,
      success: false,
      error: error.message
    }, '*');
  }
});

// background/index.ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender.origin)
    .then(result => sendResponse({ success: true, data: result }))
    .catch(error => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
});

async function handleMessage(message: Message, origin?: string): Promise<any> {
  switch (message.type) {
    case MessageType.CONNECT_REQUEST:
      return handleConnect(message.payload, origin);
    case MessageType.SIGN_TRANSACTION:
      return handleSignTransaction(message.payload, origin);
    case MessageType.SIGN_MESSAGE:
      return handleSignMessage(message.payload, origin);
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
}
```

---

## 3. Key Management & Security

### 3.1 Keyring Architecture

```typescript
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';

interface StoredAccount {
  publicKey: string; // base58
  encryptedPrivateKey: string; // encrypted with password
  derivationPath?: string; // for HD wallets
  name: string;
}

class Keyring {
  private accounts: Map<string, Keypair> = new Map();
  private password: string | null = null;

  async unlock(password: string): Promise<boolean> {
    try {
      // Retrieve encrypted accounts from storage
      const stored = await chrome.storage.local.get('accounts');
      const accounts: StoredAccount[] = stored.accounts || [];

      // Decrypt each account
      for (const account of accounts) {
        const privateKey = await this.decrypt(account.encryptedPrivateKey, password);
        const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
        this.accounts.set(account.publicKey, keypair);
      }

      this.password = password;
      return true;
    } catch (error) {
      console.error('Failed to unlock keyring:', error);
      return false;
    }
  }

  lock(): void {
    this.accounts.clear();
    this.password = null;
  }

  isLocked(): boolean {
    return this.password === null;
  }

  async addAccount(name: string): Promise<string> {
    if (this.isLocked()) {
      throw new Error('Keyring is locked');
    }

    // Generate new keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();

    // Encrypt private key
    const encryptedPrivateKey = await this.encrypt(
      bs58.encode(keypair.secretKey),
      this.password!
    );

    // Store encrypted account
    const stored = await chrome.storage.local.get('accounts');
    const accounts: StoredAccount[] = stored.accounts || [];
    accounts.push({
      publicKey,
      encryptedPrivateKey,
      name
    });
    await chrome.storage.local.set({ accounts });

    // Add to in-memory keyring
    this.accounts.set(publicKey, keypair);

    return publicKey;
  }

  getAccount(publicKey: string): Keypair | undefined {
    if (this.isLocked()) {
      throw new Error('Keyring is locked');
    }
    return this.accounts.get(publicKey);
  }

  getPublicKeys(): string[] {
    return Array.from(this.accounts.keys());
  }

  async signTransaction(transaction: Buffer, publicKey: string): Promise<Buffer> {
    const keypair = this.getAccount(publicKey);
    if (!keypair) {
      throw new Error('Account not found');
    }

    const signature = nacl.sign.detached(transaction, keypair.secretKey);
    return Buffer.from(signature);
  }

  async signMessage(message: Uint8Array, publicKey: string): Promise<Uint8Array> {
    const keypair = this.getAccount(publicKey);
    if (!keypair) {
      throw new Error('Account not found');
    }

    return nacl.sign.detached(message, keypair.secretKey);
  }

  // Encryption using Web Crypto API
  private async encrypt(data: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    // Derive key from password
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      256
    );

    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      'AES-GCM',
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );

    // Combine salt + iv + encrypted data
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    return bs58.encode(result);
  }

  private async decrypt(encrypted: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const data = bs58.decode(encrypted);

    // Extract salt, iv, and encrypted data
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const encryptedData = data.slice(28);

    // Derive key from password
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const keyMaterial = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      256
    );

    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      'AES-GCM',
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );

    return decoder.decode(decrypted);
  }
}

// Singleton instance
export const keyring = new Keyring();
```

### 3.2 Security Best Practices

**Critical Rules**:

1. **Never expose private keys**: Private keys must never leave the background script
2. **Encrypt at rest**: Use AES-GCM with PBKDF2 key derivation
3. **Auto-lock**: Implement idle timeout (default: 15 minutes)
4. **Transaction validation**: Always show human-readable transaction details
5. **Origin validation**: Track and validate requesting origins
6. **User confirmation**: Require explicit approval for all signatures
7. **CSP compliance**: Follow Content Security Policy for Manifest V3
8. **Secure random**: Use `crypto.getRandomValues()` for key generation

**Storage Strategy**:

```typescript
// Encrypted storage (chrome.storage.local)
interface WalletStorage {
  accounts: StoredAccount[];      // Encrypted private keys
  settings: {
    autoLockMinutes: number;
    defaultNetwork: string;
    trustedOrigins: string[];
  };
  connections: {
    [origin: string]: {
      publicKeys: string[];
      connectedAt: number;
    };
  };
}

// Never store in chrome.storage
// - Unencrypted private keys
// - Password/master password
// - Session tokens
```

---

## 4. Provider Injection & dApp Communication

### 4.1 Legacy window.solana Provider

For backward compatibility with older dApps:

```typescript
// inpage-script.ts
interface SolanaProvider {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  isConnected: boolean;
  autoApprove: boolean;

  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(
    transaction: Transaction,
    options?: SendOptions
  ): Promise<{ signature: string }>;

  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback: (...args: any[]) => void): void;
}

class MyLittleWalletProvider implements SolanaProvider {
  public publicKey: PublicKey | null = null;
  public isConnected = false;
  public autoApprove = false;
  public isMyLittleWallet = true; // Unique identifier

  private eventListeners = new Map<string, Set<Function>>();
  private requestId = 0;

  async connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }> {
    if (opts?.onlyIfTrusted && !this.isConnected) {
      throw new Error('User not previously connected');
    }

    const response = await this.sendRequest('connect', {});

    if (response.publicKey) {
      this.publicKey = new PublicKey(response.publicKey);
      this.isConnected = true;
      this.emit('connect', this.publicKey);
      return { publicKey: this.publicKey };
    }

    throw new Error('Connection failed');
  }

  async disconnect(): Promise<void> {
    await this.sendRequest('disconnect', {});
    this.publicKey = null;
    this.isConnected = false;
    this.emit('disconnect');
  }

  async signTransaction(transaction: Transaction): Promise<Transaction> {
    if (!this.publicKey) {
      throw new Error('Wallet not connected');
    }

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    const response = await this.sendRequest('signTransaction', {
      transaction: bs58.encode(serialized),
      publicKey: this.publicKey.toBase58()
    });

    const signedTx = Transaction.from(bs58.decode(response.transaction));
    return signedTx;
  }

  async signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    const serialized = transactions.map(tx =>
      bs58.encode(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))
    );

    const response = await this.sendRequest('signAllTransactions', {
      transactions: serialized,
      publicKey: this.publicKey!.toBase58()
    });

    return response.transactions.map((tx: string) => Transaction.from(bs58.decode(tx)));
  }

  async signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }> {
    const response = await this.sendRequest('signMessage', {
      message: bs58.encode(message),
      display,
      publicKey: this.publicKey!.toBase58()
    });

    return {
      signature: bs58.decode(response.signature)
    };
  }

  async signAndSendTransaction(
    transaction: Transaction,
    options?: SendOptions
  ): Promise<{ signature: string }> {
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    const response = await this.sendRequest('signAndSendTransaction', {
      transaction: bs58.encode(serialized),
      options,
      publicKey: this.publicKey!.toBase58()
    });

    return { signature: response.signature };
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach(cb => {
      try {
        cb(...args);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `req_${++this.requestId}`;

      const handler = (event: MessageEvent) => {
        if (event.data.id !== id) return;

        window.removeEventListener('message', handler);

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      };

      window.addEventListener('message', handler);

      window.postMessage({
        id,
        method: `solana_${method}`,
        params
      }, '*');

      // Timeout after 60 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Request timeout'));
      }, 60000);
    });
  }
}

// Inject provider
function injectProvider() {
  const provider = new MyLittleWalletProvider();

  Object.defineProperty(window, 'solana', {
    value: provider,
    writable: false,
    configurable: false
  });

  // Dispatch ready event
  window.dispatchEvent(new Event('solana#initialized'));
}

// Inject immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectProvider);
} else {
  injectProvider();
}
```

### 4.2 Wallet Standard Integration

Modern approach using wallet-standard:

```typescript
// inpage-script.ts
import { registerWallet } from '@wallet-standard/wallet';
import { MyWallet } from './wallet-standard-impl';

function initializeWalletStandard() {
  const wallet = new MyWallet();

  // Register with wallet standard
  const { unregister } = registerWallet(wallet);

  // Also inject legacy provider for backward compatibility
  injectLegacyProvider(wallet);

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    unregister();
  });
}

initializeWalletStandard();
```

### 4.3 Injection Script Loading

```typescript
// content-script.ts
// Inject inpage script into the page context
function injectScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inpage-script.js');
    script.type = 'module';

    (document.head || document.documentElement).appendChild(script);

    script.onload = () => {
      script.remove();
    };
  } catch (error) {
    console.error('Failed to inject inpage script:', error);
  }
}

// Inject as early as possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectScript);
} else {
  injectScript();
}
```

---

## 5. Common Libraries

### 5.1 @solana/web3.js

Core library for Solana blockchain interaction.

```typescript
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';

// Create connection to cluster
const connection = new Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

// Get account balance
async function getBalance(publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

// Create transfer transaction
function createTransferTransaction(
  from: PublicKey,
  to: PublicKey,
  lamports: number
): Transaction {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports
    })
  );

  return transaction;
}

// Get recent blockhash
async function getRecentBlockhash(): Promise<string> {
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  return blockhash;
}

// Send transaction
async function sendTransaction(
  signedTransaction: Transaction
): Promise<string> {
  const signature = await connection.sendRawTransaction(
    signedTransaction.serialize()
  );

  await connection.confirmTransaction(signature, 'confirmed');

  return signature;
}
```

### 5.2 @solana/wallet-adapter

Standardized wallet adapter (for dApp-side integration):

```typescript
// dApp example - not wallet implementation
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider,
  useWallet
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';

const wallets = [new PhantomWalletAdapter()];

function App() {
  return (
    <ConnectionProvider endpoint="https://api.devnet.solana.com">
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <YourApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Usage in components
function YourApp() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();

  // Component logic...
}
```

### 5.3 Supporting Libraries

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.95.8",
    "@solana/wallet-standard-features": "^1.2.0",
    "@wallet-standard/base": "^1.0.1",
    "@wallet-standard/features": "^1.0.3",
    "bs58": "^6.0.0",
    "tweetnacl": "^1.0.3"
  }
}
```

**Key Usage**:
- **bs58**: Base58 encoding/decoding for Solana addresses and signatures
- **tweetnacl**: Ed25519 signing (used by Solana keypairs)
- **@solana/web3.js**: All blockchain operations
- **wallet-standard packages**: Modern wallet interface

---

## 6. Code Patterns & Examples

### 6.1 Transaction Approval Flow

```typescript
// background/transaction-manager.ts
interface PendingTransaction {
  id: string;
  transaction: Transaction;
  origin: string;
  publicKey: string;
  createdAt: number;
}

class TransactionManager {
  private pendingTransactions = new Map<string, PendingTransaction>();
  private approvalCallbacks = new Map<string, {
    resolve: (signature: string) => void;
    reject: (error: Error) => void;
  }>();

  async requestApproval(
    transaction: Transaction,
    origin: string,
    publicKey: string
  ): Promise<string> {
    const id = crypto.randomUUID();

    // Store pending transaction
    this.pendingTransactions.set(id, {
      id,
      transaction,
      origin,
      publicKey,
      createdAt: Date.now()
    });

    // Open approval popup
    await chrome.windows.create({
      url: `popup.html?approval=${id}`,
      type: 'popup',
      width: 375,
      height: 600
    });

    // Wait for user decision
    return new Promise((resolve, reject) => {
      this.approvalCallbacks.set(id, { resolve, reject });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.approvalCallbacks.has(id)) {
          this.reject(id, new Error('Approval timeout'));
        }
      }, 5 * 60 * 1000);
    });
  }

  async approve(id: string): Promise<void> {
    const pending = this.pendingTransactions.get(id);
    if (!pending) {
      throw new Error('Transaction not found');
    }

    try {
      // Sign transaction
      const signature = await this.signAndSend(pending);

      // Resolve promise
      const callbacks = this.approvalCallbacks.get(id);
      callbacks?.resolve(signature);

      // Cleanup
      this.cleanup(id);
    } catch (error) {
      this.reject(id, error as Error);
    }
  }

  reject(id: string, error: Error): void {
    const callbacks = this.approvalCallbacks.get(id);
    callbacks?.reject(error);
    this.cleanup(id);
  }

  private cleanup(id: string): void {
    this.pendingTransactions.delete(id);
    this.approvalCallbacks.delete(id);
  }

  private async signAndSend(pending: PendingTransaction): Promise<string> {
    const { transaction, publicKey } = pending;

    // Get recent blockhash
    const connection = getConnection();
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(publicKey);

    // Sign with keyring
    const signedTx = await keyring.signTransaction(
      transaction.serializeMessage(),
      publicKey
    );

    transaction.addSignature(new PublicKey(publicKey), signedTx);

    // Send to network
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );

    return signature;
  }
}

export const transactionManager = new TransactionManager();
```

### 6.2 Connection State Management

```typescript
// background/connection-manager.ts
interface ConnectedSite {
  origin: string;
  publicKeys: string[];
  connectedAt: number;
  permissions: string[];
}

class ConnectionManager {
  private connections = new Map<string, ConnectedSite>();

  async connect(origin: string, publicKeys: string[]): Promise<void> {
    this.connections.set(origin, {
      origin,
      publicKeys,
      connectedAt: Date.now(),
      permissions: ['read']
    });

    // Persist to storage
    await this.saveConnections();

    // Notify other parts of extension
    chrome.runtime.sendMessage({
      type: 'CONNECTION_CHANGED',
      origin,
      connected: true
    });
  }

  async disconnect(origin: string): Promise<void> {
    this.connections.delete(origin);
    await this.saveConnections();

    chrome.runtime.sendMessage({
      type: 'CONNECTION_CHANGED',
      origin,
      connected: false
    });
  }

  isConnected(origin: string): boolean {
    return this.connections.has(origin);
  }

  getConnectedAccounts(origin: string): string[] {
    return this.connections.get(origin)?.publicKeys || [];
  }

  getAllConnections(): ConnectedSite[] {
    return Array.from(this.connections.values());
  }

  private async saveConnections(): Promise<void> {
    const data = Array.from(this.connections.values());
    await chrome.storage.local.set({ connections: data });
  }

  async loadConnections(): Promise<void> {
    const { connections } = await chrome.storage.local.get('connections');
    if (connections) {
      connections.forEach((site: ConnectedSite) => {
        this.connections.set(site.origin, site);
      });
    }
  }
}

export const connectionManager = new ConnectionManager();
```

### 6.3 Network Configuration

```typescript
// background/network-manager.ts
export enum SolanaNetwork {
  MAINNET = 'mainnet-beta',
  DEVNET = 'devnet',
  TESTNET = 'testnet',
  LOCALNET = 'localnet'
}

interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: string;
}

const NETWORK_CONFIGS: Record<SolanaNetwork, NetworkConfig> = {
  [SolanaNetwork.MAINNET]: {
    name: 'Mainnet Beta',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    chainId: 'solana:mainnet'
  },
  [SolanaNetwork.DEVNET]: {
    name: 'Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    chainId: 'solana:devnet'
  },
  [SolanaNetwork.TESTNET]: {
    name: 'Testnet',
    rpcUrl: 'https://api.testnet.solana.com',
    chainId: 'solana:testnet'
  },
  [SolanaNetwork.LOCALNET]: {
    name: 'Localnet',
    rpcUrl: 'http://localhost:8899',
    chainId: 'solana:localnet'
  }
};

class NetworkManager {
  private currentNetwork: SolanaNetwork = SolanaNetwork.DEVNET;
  private connection: Connection | null = null;

  async setNetwork(network: SolanaNetwork): Promise<void> {
    this.currentNetwork = network;
    const config = NETWORK_CONFIGS[network];

    this.connection = new Connection(config.rpcUrl, 'confirmed');

    // Save to storage
    await chrome.storage.local.set({ currentNetwork: network });

    // Notify listeners
    chrome.runtime.sendMessage({
      type: 'NETWORK_CHANGED',
      network
    });
  }

  getConnection(): Connection {
    if (!this.connection) {
      const config = NETWORK_CONFIGS[this.currentNetwork];
      this.connection = new Connection(config.rpcUrl, 'confirmed');
    }
    return this.connection;
  }

  getCurrentNetwork(): SolanaNetwork {
    return this.currentNetwork;
  }

  getChainId(): string {
    return NETWORK_CONFIGS[this.currentNetwork].chainId;
  }

  async loadNetwork(): Promise<void> {
    const { currentNetwork } = await chrome.storage.local.get('currentNetwork');
    if (currentNetwork) {
      await this.setNetwork(currentNetwork);
    }
  }
}

export const networkManager = new NetworkManager();
```

---

## 7. Architectural Decisions

### 7.1 Dual Provider Strategy

**Decision**: Implement both Wallet Standard and legacy window.solana provider

**Rationale**:
- **Wallet Standard**: Future-proof, standardized across ecosystem
- **Legacy Provider**: Backward compatibility with existing dApps (Phantom API)
- **Market Reality**: Many dApps still use window.solana pattern
- **User Experience**: Seamless integration with all dApps

**Implementation**:
```typescript
// Both providers share the same backend logic
// Wallet Standard is primary, legacy is wrapper
```

### 7.2 Manifest V3 Architecture

**Decision**: Use Manifest V3 with service worker background

**Rationale**:
- **Required**: Chrome will deprecate Manifest V2 in 2024
- **Security**: Better isolation and CSP enforcement
- **Performance**: Service workers are more efficient
- **Limitations**: Requires different state management strategy

**Challenges**:
- Service workers can be terminated at any time
- Must persist state to chrome.storage
- No long-running background page

**Mitigations**:
```typescript
// Persist critical state immediately
async function updateState(key: string, value: any) {
  state[key] = value;
  await chrome.storage.local.set({ [key]: value });
}

// Restore state on wake-up
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get();
  Object.assign(state, data);
});
```

### 7.3 Message Passing Architecture

**Decision**: Three-layer message passing (page → content script → background)

**Rationale**:
- **Security**: Content script provides isolation boundary
- **CSP Compliance**: Background can't access page context directly
- **Chrome API Access**: Only content script and background have chrome.* APIs

**Flow**:
```
Page (untrusted)
  → window.postMessage
Content Script (bridge)
  → chrome.runtime.sendMessage
Background (trusted)
  → Process & respond
```

### 7.4 Transaction Security Model

**Decision**: All transactions require explicit user approval

**Rationale**:
- **Security**: Prevents malicious dApps from draining funds
- **Trust**: User maintains control over all signing operations
- **Compliance**: Standard practice across all wallet providers

**Implementation**:
- Queue transactions in background
- Open popup window for approval
- Show decoded transaction details
- Support approve/reject actions

### 7.5 Key Storage Strategy

**Decision**: Encrypt private keys with user password using AES-GCM

**Rationale**:
- **Security**: Browser storage is accessible to other extensions
- **Standard**: Industry-standard encryption (AES-256-GCM)
- **Key Derivation**: PBKDF2 with 100,000 iterations prevents brute force
- **Salt + IV**: Unique per encryption prevents rainbow tables

**Never Do**:
- ❌ Store plaintext private keys
- ❌ Use weak encryption (XOR, simple substitution)
- ❌ Hardcode encryption keys
- ❌ Skip key derivation

### 7.6 Network State Management

**Decision**: Support multiple networks with user-selectable default

**Rationale**:
- **Developer Experience**: Easy testing on devnet/testnet
- **Production**: Mainnet for real usage
- **Flexibility**: Custom RPC endpoints for power users

**Implementation**:
- Default to devnet for safety
- Persist network choice
- Show network indicator in UI
- Validate RPC endpoints before switching

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// __tests__/keyring.test.ts
import { Keyring } from '../background/keyring';

describe('Keyring', () => {
  let keyring: Keyring;

  beforeEach(() => {
    keyring = new Keyring();
  });

  test('should start locked', () => {
    expect(keyring.isLocked()).toBe(true);
  });

  test('should unlock with correct password', async () => {
    // Setup: create encrypted account
    await keyring.unlock('password123');
    await keyring.addAccount('Test Account');
    keyring.lock();

    // Test
    const unlocked = await keyring.unlock('password123');
    expect(unlocked).toBe(true);
    expect(keyring.isLocked()).toBe(false);
  });

  test('should fail to unlock with wrong password', async () => {
    await keyring.unlock('password123');
    await keyring.addAccount('Test Account');
    keyring.lock();

    const unlocked = await keyring.unlock('wrongpassword');
    expect(unlocked).toBe(false);
    expect(keyring.isLocked()).toBe(true);
  });

  test('should sign transaction', async () => {
    await keyring.unlock('password123');
    const publicKey = await keyring.addAccount('Test');

    const message = Buffer.from('test transaction');
    const signature = await keyring.signTransaction(message, publicKey);

    expect(signature).toHaveLength(64);
  });
});
```

### 8.2 Integration Tests

```typescript
// __tests__/wallet-standard.test.ts
import { MyWallet } from '../inpage/wallet-standard';

describe('Wallet Standard Integration', () => {
  let wallet: MyWallet;

  beforeEach(() => {
    wallet = new MyWallet();
  });

  test('should implement required features', () => {
    expect(wallet.features).toHaveProperty('standard:connect');
    expect(wallet.features).toHaveProperty('standard:disconnect');
    expect(wallet.features).toHaveProperty('solana:signTransaction');
    expect(wallet.features).toHaveProperty('solana:signMessage');
  });

  test('should connect and return accounts', async () => {
    const result = await wallet.connect();
    expect(result.accounts).toBeDefined();
    expect(Array.isArray(result.accounts)).toBe(true);
  });

  test('should emit change event on connect', async () => {
    const onChange = jest.fn();
    wallet.features['standard:events'].on('change', onChange);

    await wallet.connect();

    expect(onChange).toHaveBeenCalled();
  });
});
```

### 8.3 E2E Tests

```typescript
// e2e/dapp-integration.test.ts
import puppeteer from 'puppeteer';

describe('dApp Integration', () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  beforeAll(async () => {
    // Load extension
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });
  });

  test('should inject window.solana', async () => {
    page = await browser.newPage();
    await page.goto('https://example.com');

    const hasSolana = await page.evaluate(() => {
      return typeof window.solana !== 'undefined';
    });

    expect(hasSolana).toBe(true);
  });

  test('should connect to dApp', async () => {
    const publicKey = await page.evaluate(async () => {
      const result = await window.solana.connect();
      return result.publicKey.toString();
    });

    expect(publicKey).toBeDefined();
  });

  afterAll(async () => {
    await browser.close();
  });
});
```

---

## 9. Common Pitfalls & Solutions

### 9.1 Serialization Issues

**Problem**: Transactions fail due to incorrect serialization

**Solution**:
```typescript
// Always use proper serialization options
const serialized = transaction.serialize({
  requireAllSignatures: false,  // Don't require all sigs during building
  verifySignatures: false        // Don't verify during serialization
});

// For signed transactions ready to send
const readyToSend = transaction.serialize({
  requireAllSignatures: true,
  verifySignatures: true
});
```

### 9.2 Blockhash Expiration

**Problem**: Transactions fail with "Blockhash not found"

**Solution**:
```typescript
// Always fetch fresh blockhash before signing
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

transaction.recentBlockhash = blockhash;
transaction.lastValidBlockHeight = lastValidBlockHeight;

// Sign and send quickly (blockhashes expire after ~60 seconds)
```

### 9.3 Service Worker Termination

**Problem**: Service worker terminates, losing in-memory state

**Solution**:
```typescript
// Persist critical state immediately
class StateManager {
  private state: any = {};

  async set(key: string, value: any) {
    this.state[key] = value;
    // Immediate persistence
    await chrome.storage.local.set({ [key]: value });
  }

  async get(key: string): Promise<any> {
    // Try memory first
    if (key in this.state) {
      return this.state[key];
    }
    // Fall back to storage
    const result = await chrome.storage.local.get(key);
    this.state[key] = result[key];
    return result[key];
  }
}
```

### 9.4 Content Script Injection Timing

**Problem**: window.solana not available when dApp loads

**Solution**:
```typescript
// Inject at document_start
// manifest.json
{
  "content_scripts": [{
    "run_at": "document_start",  // Critical timing
    "matches": ["<all_urls>"]
  }]
}

// Dispatch event when ready
window.dispatchEvent(new Event('solana#initialized'));

// dApp side
window.addEventListener('solana#initialized', () => {
  // Now safe to use window.solana
});
```

---

## 10. Resources & References

### Official Documentation
- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Wallet Standard Spec](https://github.com/wallet-standard/wallet-standard)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Solana Cookbook](https://solanacookbook.com/)

### Example Implementations
- [Phantom Wallet](https://github.com/phantom-labs/sandbox) - Reference implementation
- [Solflare Wallet](https://github.com/solflare-wallet/solflare-extension)
- [Backpack Wallet](https://github.com/coral-xyz/backpack)

### Security Resources
- [OWASP Browser Extension Security](https://owasp.org/www-community/vulnerabilities/Browser_extension_security)
- [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/security-best-practices)

### Community
- [Solana Stack Exchange](https://solana.stackexchange.com/)
- [Solana Discord](https://discord.gg/solana)

---

## Summary

This technical reference provides a comprehensive foundation for building a standards-compliant Solana browser extension wallet. Key takeaways:

1. **Dual Provider Support**: Implement both Wallet Standard (modern) and window.solana (legacy)
2. **Security First**: Encrypt keys, validate origins, require user approval
3. **Manifest V3**: Use service workers, persist state, handle termination
4. **Message Passing**: Three-layer architecture for security and isolation
5. **Standard Compliance**: Follow Wallet Standard specifications exactly
6. **Best Practices**: Proper serialization, blockhash management, error handling

**Next Steps**:
1. Review project architecture against this reference
2. Implement Wallet Standard features
3. Add legacy provider compatibility
4. Build transaction approval flow
5. Implement secure key management
6. Test with real dApps
