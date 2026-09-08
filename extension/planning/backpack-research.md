# Backpack Wallet Technical Research

**Document Version**: 1.0
**Date**: 2026-01-24
**Purpose**: Comprehensive technical analysis of Backpack wallet architecture and Solana browser extension wallet patterns for building my-little-wallet

---

## Executive Summary

Backpack is a modern Solana browser extension wallet developed by Coral (coral-xyz). It represents next-generation wallet architecture with focus on:

- Multi-chain support (Solana, Ethereum, and others)
- xNFT (executable NFT) platform for in-wallet dApps
- Modern TypeScript/React architecture
- Manifest V3 compliance
- Advanced security model with message passing architecture

---

## 1. Architecture Overview

### 1.1 Core Architecture Pattern

**Multi-Process Architecture**:
```
┌─────────────────────────────────────────────────┐
│              Browser Extension                   │
│                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │   Popup    │  │  Background  │  │ Content │ │
│  │    UI      │◄─┤   Service    ├─►│ Script  │ │
│  │  (React)   │  │   Worker     │  │ (Injected)│ │
│  └────────────┘  └──────────────┘  └─────────┘ │
│                          │                       │
└──────────────────────────┼───────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐  ┌─────▼────┐  ┌──▼─────┐
         │ Solana │  │ Provider │  │  xNFT  │
         │  RPC   │  │   API    │  │ Runtime│
         └────────┘  └──────────┘  └────────┘
```

**Key Architectural Principles**:
1. **Process Isolation**: UI, background, and content scripts run in separate contexts
2. **Message Passing**: All communication via chrome.runtime messaging API
3. **Security Boundaries**: Private keys never leave background worker
4. **Provider Injection**: Standard Solana wallet adapter pattern

### 1.2 Technology Stack

**Frontend (Popup/UI)**:
- React 18+ with TypeScript
- Recoil or Zustand for state management
- Tailwind CSS for styling
- Vite for bundling and HMR
- React Router for navigation

**Background Service Worker**:
- TypeScript
- Web Crypto API for cryptographic operations
- IndexedDB for local storage
- WebSocket connections for RPC

**Blockchain Libraries**:
- `@solana/web3.js` - Core Solana interactions
- `@project-serum/anchor` - Program interactions (optional)
- `@solana/spl-token` - Token operations
- `@solana/wallet-adapter-base` - Standard wallet interface

**Build Tools**:
- Vite with custom extension plugin
- TypeScript 5.x
- ESLint + Prettier
- Chrome Types (@types/chrome)

---

## 2. Browser Extension Implementation

### 2.1 Manifest V3 Configuration

**manifest.json Structure**:
```json
{
  "manifest_version": 3,
  "name": "Backpack",
  "version": "0.x.x",
  "description": "A crypto wallet built for everyone",

  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],

  "host_permissions": [
    "https://*/*"
  ],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "run_at": "document_start"
    }
  ],

  "web_accessible_resources": [
    {
      "resources": ["injected.js"],
      "matches": ["<all_urls>"]
    }
  ],

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**Key Manifest Features**:
- `service_worker`: Persistent background process for wallet logic
- `content_scripts`: Inject provider API into web pages
- `web_accessible_resources`: Allow pages to load wallet provider
- `storage`: Persistent encrypted storage for keys and settings
- `activeTab`: Interact with current page for transactions
- `scripting`: Dynamic content script injection

### 2.2 Directory Structure

**Recommended Backpack-style Structure**:
```
backpack/
├── packages/
│   ├── app-extension/          # Main browser extension
│   │   ├── src/
│   │   │   ├── app/            # React app (popup UI)
│   │   │   │   ├── components/ # Reusable components
│   │   │   │   ├── pages/      # Page-level components
│   │   │   │   └── App.tsx     # Root component
│   │   │   ├── background/     # Service worker
│   │   │   │   ├── backend/    # Core wallet logic
│   │   │   │   ├── services/   # RPC, storage services
│   │   │   │   └── index.ts    # Entry point
│   │   │   ├── content-script/ # Injected scripts
│   │   │   │   ├── index.ts    # Content script
│   │   │   │   └── injected.ts # Provider injection
│   │   │   └── common/         # Shared code
│   │   │       ├── types.ts
│   │   │       └── utils.ts
│   │   ├── public/
│   │   │   ├── popup.html
│   │   │   └── icons/
│   │   └── manifest.json
│   ├── app-mobile/             # Mobile app (if applicable)
│   ├── blockchain-common/      # Shared blockchain code
│   ├── provider-injection/     # Provider API package
│   └── wallet-standard/        # Wallet adapter interface
└── ...
```

### 2.3 Build Configuration

**Vite Configuration for Extensions**:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crxPlugin } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crxPlugin({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'popup.html',
        background: 'src/background/index.ts',
        content: 'src/content-script/index.ts'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
```

**Key Build Considerations**:
- Separate entry points for popup, background, and content scripts
- Code splitting disabled (extensions have issues with dynamic imports)
- Asset inlining for icons and fonts
- Source maps for debugging (dev only)

---

## 3. Wallet Provider API

### 3.1 Standard Solana Provider Interface

**Window Provider Injection**:
```typescript
// injected.ts - Injected into page context
interface SolanaProvider {
  isBackpack: true;
  isPhantom?: false; // Compatibility flag

  // Connection methods
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;

  // Signing methods
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  signMessage(message: Uint8Array, display?: 'utf8' | 'hex'): Promise<{ signature: Uint8Array }>;

  // State
  publicKey: PublicKey | null;
  isConnected: boolean;

  // Events
  on(event: string, callback: (args: any) => void): void;
  removeListener(event: string, callback: (args: any) => void): void;
}

// Inject into window
window.solana = new BackpackProvider();
window.backpack = window.solana;

// Dispatch ready event
window.dispatchEvent(new Event('solana#initialized'));
```

**Provider Events**:
```typescript
// Event types
type ProviderEvents =
  | 'connect'           // { publicKey: PublicKey }
  | 'disconnect'        // void
  | 'accountChanged'    // { publicKey: PublicKey }
  | 'chainChanged'      // { chain: string }
```

### 3.2 Message Passing Architecture

**Content Script → Background Communication**:
```typescript
// content-script/index.ts
class BackpackContentScript {
  private port: chrome.runtime.Port;

  constructor() {
    this.port = chrome.runtime.connect({ name: 'backpack-provider' });
    this.injectProvider();
    this.setupMessageBridge();
  }

  private injectProvider() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  private setupMessageBridge() {
    // Page → Content Script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data.target !== 'backpack-provider') return;

      // Forward to background
      this.port.postMessage({
        id: event.data.id,
        method: event.data.method,
        params: event.data.params
      });
    });

    // Background → Page
    this.port.onMessage.addListener((message) => {
      window.postMessage({
        target: 'backpack-injected',
        id: message.id,
        result: message.result,
        error: message.error
      }, '*');
    });
  }
}

new BackpackContentScript();
```

**Background Request Handling**:
```typescript
// background/backend/request-handler.ts
class RequestHandler {
  async handle(request: ProviderRequest): Promise<any> {
    switch (request.method) {
      case 'connect':
        return this.handleConnect(request.params);

      case 'disconnect':
        return this.handleDisconnect();

      case 'signTransaction':
        return this.handleSignTransaction(request.params);

      case 'signAllTransactions':
        return this.handleSignAllTransactions(request.params);

      case 'signMessage':
        return this.handleSignMessage(request.params);

      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  }

  private async handleConnect(params: any) {
    // Show approval popup
    const approved = await this.showApprovalPopup({
      origin: params.origin,
      action: 'connect'
    });

    if (!approved) {
      throw new Error('User rejected connection');
    }

    const publicKey = await this.getActivePublicKey();

    // Store approved origin
    await this.approveOrigin(params.origin);

    return { publicKey: publicKey.toBase58() };
  }

  private async handleSignTransaction(params: any) {
    const { transaction, origin } = params;

    // Verify origin is approved
    if (!await this.isOriginApproved(origin)) {
      throw new Error('Origin not approved');
    }

    // Parse transaction
    const tx = Transaction.from(Buffer.from(transaction, 'base64'));

    // Show transaction approval UI
    const approved = await this.showTransactionApproval(tx, origin);

    if (!approved) {
      throw new Error('User rejected transaction');
    }

    // Sign with private key
    const privateKey = await this.getPrivateKey();
    tx.sign([privateKey]);

    return {
      signature: tx.signature?.toString('base64'),
      transaction: tx.serialize().toString('base64')
    };
  }
}
```

### 3.3 Wallet Adapter Integration

**Standard Wallet Adapter**:
```typescript
// Implementation of @solana/wallet-adapter-base
import {
  BaseMessageSignerWalletAdapter,
  WalletReadyState,
  WalletNotConnectedError
} from '@solana/wallet-adapter-base';

export class BackpackWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = 'Backpack';
  url = 'https://backpack.app';
  icon = 'data:image/svg+xml;base64,...';

  get publicKey() {
    return this._provider?.publicKey || null;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState() {
    return typeof window !== 'undefined' && window.backpack
      ? WalletReadyState.Installed
      : WalletReadyState.NotDetected;
  }

  async connect() {
    if (this.connected || this.connecting) return;
    if (!this._provider) throw new WalletNotDetectedError();

    this._connecting = true;

    try {
      const { publicKey } = await this._provider.connect();
      this._publicKey = publicKey;
      this.emit('connect', publicKey);
    } finally {
      this._connecting = false;
    }
  }

  async disconnect() {
    await this._provider?.disconnect();
    this._publicKey = null;
    this.emit('disconnect');
  }

  async signTransaction(transaction: Transaction) {
    if (!this.connected) throw new WalletNotConnectedError();
    return await this._provider.signTransaction(transaction);
  }

  async signMessage(message: Uint8Array) {
    if (!this.connected) throw new WalletNotConnectedError();
    const { signature } = await this._provider.signMessage(message);
    return signature;
  }
}
```

---

## 4. Transaction Signing and Security Model

### 4.1 Security Architecture

**Key Security Principles**:
1. **Private Key Isolation**: Keys never leave background service worker
2. **Origin Validation**: All requests validated against approved origins
3. **User Confirmation**: All signatures require explicit user approval
4. **Encrypted Storage**: All sensitive data encrypted at rest
5. **CSP Compliance**: Strict Content Security Policy enforcement

**Security Boundaries**:
```
Web Page (Untrusted)
    ↓ postMessage
Content Script (Semi-trusted)
    ↓ chrome.runtime
Background Worker (Trusted)
    ↓ Web Crypto API
Private Keys (Encrypted in storage)
```

### 4.2 Key Management

**Key Generation and Storage**:
```typescript
// background/services/keyring.ts
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

class Keyring {
  private encryptionKey: CryptoKey | null = null;

  // Generate new wallet from mnemonic
  async generateWallet(password: string): Promise<{ mnemonic: string; publicKey: string }> {
    // Generate mnemonic
    const mnemonic = bip39.generateMnemonic(128); // 12 words

    // Derive seed
    const seed = await bip39.mnemonicToSeed(mnemonic);

    // Derive keypair (BIP44 path: m/44'/501'/0'/0')
    const path = "m/44'/501'/0'/0'";
    const derivedSeed = derivePath(path, seed.toString('hex')).key;
    const keypair = Keypair.fromSeed(derivedSeed);

    // Encrypt and store mnemonic
    await this.storeMnemonic(mnemonic, password);

    return {
      mnemonic,
      publicKey: keypair.publicKey.toBase58()
    };
  }

  // Encrypt mnemonic with password
  private async storeMnemonic(mnemonic: string, password: string) {
    // Derive encryption key from password
    const passwordKey = await this.deriveKeyFromPassword(password);

    // Encrypt mnemonic
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const data = encoder.encode(mnemonic);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      passwordKey,
      data
    );

    // Store in chrome.storage
    await chrome.storage.local.set({
      vault: {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        salt: Array.from(this.salt)
      }
    });
  }

  // Derive encryption key from password using PBKDF2
  private async deriveKeyFromPassword(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Generate or retrieve salt
    this.salt = crypto.getRandomValues(new Uint8Array(16));

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive AES key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Unlock keyring with password
  async unlock(password: string): Promise<boolean> {
    try {
      const { vault } = await chrome.storage.local.get('vault');
      if (!vault) return false;

      const passwordKey = await this.deriveKeyFromPassword(password);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(vault.iv) },
        passwordKey,
        new Uint8Array(vault.encrypted)
      );

      const decoder = new TextDecoder();
      const mnemonic = decoder.decode(decrypted);

      // Cache encryption key for session
      this.encryptionKey = passwordKey;

      return true;
    } catch {
      return false;
    }
  }

  // Get keypair for signing (requires unlocked keyring)
  async getKeypair(accountIndex = 0): Promise<Keypair> {
    if (!this.encryptionKey) {
      throw new Error('Keyring is locked');
    }

    // Decrypt mnemonic
    const { vault } = await chrome.storage.local.get('vault');
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(vault.iv) },
      this.encryptionKey,
      new Uint8Array(vault.encrypted)
    );

    const decoder = new TextDecoder();
    const mnemonic = decoder.decode(decrypted);

    // Derive keypair
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const path = `m/44'/501'/${accountIndex}'/0'`;
    const derivedSeed = derivePath(path, seed.toString('hex')).key;

    return Keypair.fromSeed(derivedSeed);
  }
}
```

### 4.3 Transaction Approval Flow

**Transaction Signing Process**:
```typescript
// background/services/transaction-manager.ts
class TransactionManager {
  async requestSignature(
    transaction: Transaction,
    origin: string
  ): Promise<Transaction> {
    // 1. Validate origin
    const approved = await this.storage.isOriginApproved(origin);
    if (!approved) {
      throw new Error('Origin not approved');
    }

    // 2. Parse and validate transaction
    const parsed = await this.parseTransaction(transaction);

    // 3. Simulate transaction to check for errors
    const simulation = await this.connection.simulateTransaction(transaction);
    if (simulation.value.err) {
      throw new Error(`Transaction simulation failed: ${simulation.value.err}`);
    }

    // 4. Show approval UI to user
    const approval = await this.showApprovalUI({
      transaction: parsed,
      simulation,
      origin,
      estimatedFee: simulation.value.unitsConsumed
    });

    if (!approval.approved) {
      throw new Error('User rejected transaction');
    }

    // 5. Sign transaction
    const keypair = await this.keyring.getKeypair();
    transaction.sign([keypair]);

    // 6. Log transaction
    await this.logTransaction({
      signature: transaction.signature?.toString('base64'),
      origin,
      timestamp: Date.now()
    });

    return transaction;
  }

  private async parseTransaction(tx: Transaction) {
    const instructions = tx.instructions.map(ix => ({
      programId: ix.programId.toBase58(),
      keys: ix.keys.map(k => ({
        pubkey: k.pubkey.toBase58(),
        isSigner: k.isSigner,
        isWritable: k.isWritable
      })),
      data: ix.data.toString('hex')
    }));

    return {
      recentBlockhash: tx.recentBlockhash,
      feePayer: tx.feePayer?.toBase58(),
      instructions
    };
  }

  private async showApprovalUI(data: any): Promise<{ approved: boolean }> {
    return new Promise((resolve) => {
      // Create notification window
      chrome.windows.create({
        url: chrome.runtime.getURL('approval.html'),
        type: 'popup',
        width: 400,
        height: 600
      }, (window) => {
        // Store request data
        this.pendingApprovals.set(window.id!, {
          data,
          resolve
        });
      });
    });
  }
}
```

---

## 5. Blockchain Integration

### 5.1 Solana Connection Management

**RPC Connection Service**:
```typescript
// background/services/solana-connection.ts
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

class SolanaConnectionService {
  private connections: Map<string, Connection> = new Map();
  private currentNetwork: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta';

  constructor() {
    this.initializeConnection();
  }

  private initializeConnection() {
    const endpoints = {
      'mainnet-beta': 'https://api.mainnet-beta.solana.com',
      'devnet': 'https://api.devnet.solana.com',
      'testnet': 'https://api.testnet.solana.com'
    };

    Object.entries(endpoints).forEach(([network, endpoint]) => {
      this.connections.set(
        network,
        new Connection(endpoint, {
          commitment: 'confirmed',
          wsEndpoint: endpoint.replace('https', 'wss')
        })
      );
    });
  }

  getConnection(network?: string): Connection {
    const net = network || this.currentNetwork;
    return this.connections.get(net)!;
  }

  async getBalance(publicKey: PublicKey, network?: string): Promise<number> {
    const connection = this.getConnection(network);
    return connection.getBalance(publicKey);
  }

  async getTokenAccounts(publicKey: PublicKey, network?: string) {
    const connection = this.getConnection(network);
    const { value } = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    return value.map(({ account, pubkey }) => ({
      address: pubkey.toBase58(),
      mint: account.data.parsed.info.mint,
      owner: account.data.parsed.info.owner,
      amount: account.data.parsed.info.tokenAmount.uiAmount,
      decimals: account.data.parsed.info.tokenAmount.decimals
    }));
  }

  async getRecentTransactions(publicKey: PublicKey, limit = 10) {
    const connection = this.getConnection();
    const signatures = await connection.getSignaturesForAddress(
      publicKey,
      { limit }
    );

    const transactions = await Promise.all(
      signatures.map(sig =>
        connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        })
      )
    );

    return transactions.filter(Boolean);
  }

  async sendTransaction(transaction: Transaction): Promise<string> {
    const connection = this.getConnection();
    return connection.sendRawTransaction(transaction.serialize());
  }
}
```

### 5.2 Token and NFT Detection

**SPL Token Service**:
```typescript
// background/services/token-service.ts
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Metaplex } from '@metaplex-foundation/js';

class TokenService {
  private metaplex: Metaplex;

  constructor(connection: Connection) {
    this.metaplex = new Metaplex(connection);
  }

  async getTokenBalances(publicKey: PublicKey) {
    const connection = this.connection.getConnection();

    // Get all token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    // Get metadata for each token
    const tokens = await Promise.all(
      tokenAccounts.value.map(async ({ account, pubkey }) => {
        const mint = account.data.parsed.info.mint;
        const amount = account.data.parsed.info.tokenAmount;

        // Fetch token metadata
        const metadata = await this.getTokenMetadata(mint);

        return {
          mint,
          address: pubkey.toBase58(),
          amount: amount.uiAmount,
          decimals: amount.decimals,
          symbol: metadata?.symbol,
          name: metadata?.name,
          logo: metadata?.image
        };
      })
    );

    return tokens.filter(t => t.amount > 0);
  }

  async getTokenMetadata(mint: string) {
    try {
      const mintPubkey = new PublicKey(mint);
      const nft = await this.metaplex.nfts().findByMint({ mintAddress: mintPubkey });

      return {
        name: nft.name,
        symbol: nft.symbol,
        image: nft.json?.image,
        description: nft.json?.description
      };
    } catch {
      return null;
    }
  }

  async getNFTs(publicKey: PublicKey) {
    const nfts = await this.metaplex.nfts().findAllByOwner({ owner: publicKey });

    return Promise.all(
      nfts.map(async (nft) => {
        const metadata = await nft.json;
        return {
          mint: nft.address.toBase58(),
          name: nft.name,
          symbol: nft.symbol,
          image: metadata?.image,
          description: metadata?.description,
          attributes: metadata?.attributes
        };
      })
    );
  }
}
```

---

## 6. State Management and Storage

### 6.1 Chrome Storage Architecture

**Storage Service**:
```typescript
// background/services/storage.ts
class StorageService {
  // Wallet state
  async getWalletState() {
    const { walletState } = await chrome.storage.local.get('walletState');
    return walletState || {
      locked: true,
      accounts: [],
      activeAccount: null,
      approvedOrigins: []
    };
  }

  async setWalletState(state: WalletState) {
    await chrome.storage.local.set({ walletState: state });
  }

  // Approved origins
  async isOriginApproved(origin: string): Promise<boolean> {
    const state = await this.getWalletState();
    return state.approvedOrigins.includes(origin);
  }

  async approveOrigin(origin: string) {
    const state = await this.getWalletState();
    if (!state.approvedOrigins.includes(origin)) {
      state.approvedOrigins.push(origin);
      await this.setWalletState(state);
    }
  }

  // Settings
  async getSettings() {
    const { settings } = await chrome.storage.local.get('settings');
    return settings || {
      network: 'mainnet-beta',
      currency: 'USD',
      locale: 'en',
      theme: 'light'
    };
  }

  async updateSettings(updates: Partial<Settings>) {
    const settings = await this.getSettings();
    await chrome.storage.local.set({
      settings: { ...settings, ...updates }
    });
  }
}
```

### 6.2 React State Management

**Recoil State Atoms**:
```typescript
// popup/state/atoms.ts
import { atom, selector } from 'recoil';

// Wallet state
export const walletState = atom({
  key: 'walletState',
  default: {
    locked: true,
    publicKey: null,
    balance: 0
  }
});

// Token balances
export const tokenBalancesState = atom({
  key: 'tokenBalances',
  default: []
});

// Transaction history
export const transactionsState = atom({
  key: 'transactions',
  default: []
});

// Derived state - total portfolio value
export const portfolioValueState = selector({
  key: 'portfolioValue',
  get: ({ get }) => {
    const wallet = get(walletState);
    const tokens = get(tokenBalancesState);

    // Calculate total value
    return wallet.balance + tokens.reduce((sum, t) => sum + (t.value || 0), 0);
  }
});
```

---

## 7. Code Examples and Integration Patterns

### 7.1 Complete Connection Flow

**Example: DApp Integration**:
```typescript
// dapp-example.tsx
import { useEffect, useState } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';

function BackpackDemo() {
  const [wallet, setWallet] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);

  useEffect(() => {
    // Check if Backpack is installed
    if ('backpack' in window) {
      setWallet(window.backpack);
    } else {
      console.log('Backpack not installed');
    }
  }, []);

  const connect = async () => {
    try {
      const response = await wallet.connect();
      setPublicKey(new PublicKey(response.publicKey));
      console.log('Connected:', response.publicKey);
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const signMessage = async () => {
    if (!wallet || !publicKey) return;

    const message = new TextEncoder().encode('Hello Backpack!');
    const { signature } = await wallet.signMessage(message, 'utf8');

    console.log('Signature:', signature);
  };

  const sendTransaction = async () => {
    if (!wallet || !publicKey) return;

    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const transaction = new Transaction().add(
      // ... add instructions
    );

    transaction.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    transaction.feePayer = publicKey;

    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());

    console.log('Transaction sent:', signature);
  };

  return (
    <div>
      <button onClick={connect}>Connect Backpack</button>
      {publicKey && (
        <>
          <p>Connected: {publicKey.toBase58()}</p>
          <button onClick={signMessage}>Sign Message</button>
          <button onClick={sendTransaction}>Send Transaction</button>
        </>
      )}
    </div>
  );
}
```

### 7.2 Custom Hook for Wallet

**React Hook Pattern**:
```typescript
// hooks/useBackpack.ts
import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';

export function useBackpack() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const wallet = typeof window !== 'undefined' ? window.backpack : null;

  useEffect(() => {
    if (!wallet) return;

    // Auto-connect if previously approved
    wallet.connect({ onlyIfTrusted: true })
      .then(({ publicKey }) => {
        setPublicKey(new PublicKey(publicKey));
        setConnected(true);
      })
      .catch(() => {});

    // Event listeners
    wallet.on('connect', (pubkey: any) => {
      setPublicKey(new PublicKey(pubkey));
      setConnected(true);
    });

    wallet.on('disconnect', () => {
      setPublicKey(null);
      setConnected(false);
    });

    wallet.on('accountChanged', (pubkey: any) => {
      if (pubkey) {
        setPublicKey(new PublicKey(pubkey));
      } else {
        setPublicKey(null);
        setConnected(false);
      }
    });
  }, [wallet]);

  const connect = useCallback(async () => {
    if (!wallet || connecting) return;

    setConnecting(true);
    try {
      const { publicKey } = await wallet.connect();
      setPublicKey(new PublicKey(publicKey));
      setConnected(true);
    } finally {
      setConnecting(false);
    }
  }, [wallet, connecting]);

  const disconnect = useCallback(async () => {
    if (!wallet) return;
    await wallet.disconnect();
  }, [wallet]);

  return {
    wallet,
    publicKey,
    connected,
    connecting,
    connect,
    disconnect
  };
}
```

---

## 8. Key Takeaways for my-little-wallet

### 8.1 Architecture Recommendations

**Essential Components**:
1. ✅ Manifest V3 service worker architecture
2. ✅ Message passing between content script and background
3. ✅ Provider API injection following Solana standards
4. ✅ Secure key management with Web Crypto API
5. ✅ Transaction approval UI flow

**Tech Stack Alignment**:
- React + TypeScript for UI (already in use)
- Vite for bundling (already in use)
- `@solana/web3.js` for blockchain (should add)
- Chrome Storage API for persistence
- Recoil or Zustand for state management

### 8.2 Security Best Practices

**Critical Security Measures**:
1. Never expose private keys outside background worker
2. All transactions require explicit user approval
3. Use Web Crypto API for encryption (PBKDF2 + AES-GCM)
4. Validate and sanitize all dApp requests
5. Simulate transactions before signing
6. Implement origin approval system

### 8.3 Implementation Priorities

**Phase 1: Core Foundation**:
- [ ] Manifest V3 configuration
- [ ] Service worker setup
- [ ] Content script + provider injection
- [ ] Message passing architecture

**Phase 2: Wallet Features**:
- [ ] Key generation and storage
- [ ] Password encryption/decryption
- [ ] Connection approval flow
- [ ] Basic transaction signing

**Phase 3: Blockchain Integration**:
- [ ] Solana RPC connection
- [ ] Balance fetching
- [ ] Transaction history
- [ ] Token account detection

**Phase 4: Polish**:
- [ ] Transaction simulation
- [ ] Enhanced approval UI
- [ ] Error handling
- [ ] Performance optimization

---

## 9. References and Resources

### 9.1 GitHub Repositories

**Primary Sources**:
- `coral-xyz/backpack` - Official Backpack wallet repository
- `solana-labs/wallet-adapter` - Standard wallet adapter interface
- `phantom/phantom-wallet` - Alternative reference implementation

### 9.2 Documentation

**Essential Docs**:
- Solana Web3.js Documentation
- Chrome Extension Manifest V3 Guide
- Wallet Adapter Documentation
- SPL Token Program Guide
- Metaplex NFT Standard

### 9.3 Tools and Libraries

**Recommended Packages**:
```json
{
  "dependencies": {
    "@solana/web3.js": "^1.87.6",
    "@solana/spl-token": "^0.3.9",
    "@metaplex-foundation/js": "^0.19.4",
    "bip39": "^3.1.0",
    "ed25519-hd-key": "^1.3.0",
    "bs58": "^5.0.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.258",
    "@crxjs/vite-plugin": "^2.0.0-beta.21",
    "vite": "^5.0.11"
  }
}
```

---

## 10. Next Steps

### 10.1 Immediate Actions

1. Review current project architecture against Backpack patterns
2. Identify gaps in current implementation
3. Plan migration to Manifest V3 if not already done
4. Set up provider injection architecture
5. Implement secure key management

### 10.2 Research Tasks

- [ ] Deep dive into Backpack's xNFT runtime architecture
- [ ] Study multi-chain support patterns
- [ ] Analyze transaction simulation implementation
- [ ] Review approval UI/UX patterns
- [ ] Investigate performance optimization techniques

### 10.3 Prototype Goals

1. Working provider injection
2. Basic connect/disconnect flow
3. Simple transaction signing
4. Balance display
5. Transaction history view

---

**Document Prepared By**: Claude (Anthropic)
**Last Updated**: 2026-01-24
**Status**: Initial Research Complete

This document provides a comprehensive technical foundation for building my-little-wallet based on Backpack wallet architecture and modern Solana browser extension patterns.
