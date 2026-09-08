# Quick Reference Card

**Purpose**: Fast lookup for common patterns and critical security rules

---

## Critical Security Rules

### 🚨 NEVER DO

```typescript
// ❌ NEVER store plaintext keys
await chrome.storage.local.set({ secretKey: secretKey });

// ❌ NEVER skip user approval for transactions
const signed = await wallet.sign(tx); // Auto-sign = DANGEROUS

// ❌ NEVER use wildcard CORS in production
res.setHeader('Access-Control-Allow-Origin', '*');

// ❌ NEVER log sensitive data
console.log('Secret key:', secretKey); // SECURITY VIOLATION

// ❌ NEVER use weak encryption
const encrypted = btoa(secretKey); // Base64 is NOT encryption
```

### ✅ ALWAYS DO

```typescript
// ✅ ALWAYS encrypt keys with strong crypto
const encrypted = await encryptWithAESGCM(secretKey, password);

// ✅ ALWAYS require user approval
const approved = await requestUserApproval(tx);
if (!approved) throw new Error('User rejected');

// ✅ ALWAYS validate origins
if (!trustedOrigins.includes(origin)) {
  throw new Error('Untrusted origin');
}

// ✅ ALWAYS use secure random
const keypair = nacl.sign.keyPair(); // Uses crypto.getRandomValues

// ✅ ALWAYS clear sensitive data
password = null;
secretKey = null;
```

---

## Transaction Serialization

### Correct Pattern

```typescript
// For SIGNING (transaction not fully signed yet)
const serialized = transaction.serialize({
  requireAllSignatures: false,  // Don't require all signatures
  verifySignatures: false        // Don't verify during build
});

// For SENDING (transaction fully signed and ready)
const readyToSend = signedTransaction.serialize({
  requireAllSignatures: true,    // Require complete signatures
  verifySignatures: true          // Verify before sending
});
```

### Common Mistake

```typescript
// ❌ WRONG - Will fail if not all signers present
const serialized = transaction.serialize(); // Uses defaults = true, true

// ✅ CORRECT - Explicit options
const serialized = transaction.serialize({
  requireAllSignatures: false,
  verifySignatures: false
});
```

---

## Message Passing Pattern

### Three-Layer Architecture

```
Page (untrusted)
  ↓ window.postMessage
Content Script (bridge)
  ↓ chrome.runtime.sendMessage
Background (trusted)
  ↓ Process & respond
```

### RPC with Timeout

```typescript
export async function rpc<T>(method: string, params?: any): Promise<T> {
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // CRITICAL: Add timeout
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Request timeout'));
    }, 60000); // 60 second timeout

    const handler = (event: MessageEvent) => {
      if (event.data.id !== id) return;
      cleanup();

      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.result);
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
    };

    window.addEventListener('message', handler);

    // Send request
    window.postMessage({
      source: 'my-little-wallet',
      method,
      params,
      id
    }, window.location.origin); // NOT '*'
  });
}
```

---

## Encrypted Keyring Pattern

### AES-GCM + PBKDF2

```typescript
class SecureKeyring {
  private async encrypt(data: string, password: string): Promise<string> {
    const encoder = new TextEncoder();

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
        iterations: 100000,  // CRITICAL: High iteration count
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
      encoder.encode(data)
    );

    // Combine: salt + iv + encrypted
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(encrypted), salt.length + iv.length);

    return bs58.encode(result);
  }

  // Decrypt is reverse process
}
```

---

## Wallet Standard Features

### Required Features

```typescript
const wallet = {
  version: "1.0.0",
  name: "My Little Wallet",
  icon: "data:image/svg+xml;base64,...",
  chains: ["solana:mainnet", "solana:devnet", "solana:testnet"],

  features: {
    // REQUIRED
    "standard:connect": { ... },
    "standard:disconnect": { ... },
    "standard:events": { ... },

    // SOLANA REQUIRED
    "solana:signTransaction": { ... },
    "solana:signMessage": { ... },

    // RECOMMENDED
    "solana:signAndSendTransaction": { ... },
    "solana:signIn": { ... }
  },

  accounts: [] // Populated on connect
};
```

### Chain Identifiers

```typescript
const CHAINS = {
  MAINNET: 'solana:mainnet',
  DEVNET: 'solana:devnet',
  TESTNET: 'solana:testnet',
  LOCALNET: 'solana:localnet'
};

// NOT just "mainnet", "devnet" - must include "solana:" prefix
```

---

## Legacy Provider (window.solana)

### Required Interface

```typescript
interface SolanaProvider {
  // Identification
  isMyLittleWallet: boolean;
  isPhantom: boolean; // For compatibility

  // State
  publicKey: PublicKey | null;
  isConnected: boolean;

  // Methods
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signMessage(msg: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  signTransaction<T>(tx: T): Promise<T>;
  signAllTransactions<T>(txs: T[]): Promise<T[]>;
  signAndSendTransaction?(tx: Transaction, opts?: SendOptions): Promise<{ signature: string }>;

  // Events
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}

// Events: 'connect', 'disconnect', 'accountChanged'
```

---

## Network Management

### RPC Endpoints

```typescript
const RPC_ENDPOINTS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  'devnet': 'https://api.devnet.solana.com',
  'testnet': 'https://api.testnet.solana.com'
};

// Connection instance
const connection = new Connection(
  RPC_ENDPOINTS[network],
  'confirmed' // Commitment level
);
```

### Blockhash Management

```typescript
// ALWAYS fetch fresh blockhash
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

transaction.recentBlockhash = blockhash;
transaction.lastValidBlockHeight = lastValidBlockHeight;

// Sign and send QUICKLY (blockhash expires in ~60 seconds)
```

---

## Transaction Approval Flow

### Pattern

```typescript
class TransactionManager {
  private pending = new Map<string, PendingTx>();

  async requestApproval(tx: Transaction, origin: string): Promise<string> {
    const id = crypto.randomUUID();

    // Decode for human-readable preview
    const decoded = await this.decodeTransaction(tx);

    // Store pending
    this.pending.set(id, { tx, origin, decoded });

    // Open approval popup
    await chrome.windows.create({
      url: `popup.html?approval=${id}`,
      type: 'popup',
      width: 375,
      height: 600
    });

    // Wait for user decision
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });

      // Timeout after 5 minutes
      setTimeout(() => {
        this.reject(id, new Error('Approval timeout'));
      }, 5 * 60 * 1000);
    });
  }

  async approve(id: string): Promise<void> {
    const pending = this.pending.get(id);
    const signature = await this.signAndSend(pending);
    this.callbacks.get(id)?.resolve(signature);
    this.cleanup(id);
  }

  reject(id: string, error: Error): void {
    this.callbacks.get(id)?.reject(error);
    this.cleanup(id);
  }
}
```

---

## Service Worker State

### Handle Termination

```typescript
// Service workers can terminate at ANY time
// MUST persist critical state immediately

class StateManager {
  private state: any = {};

  async set(key: string, value: any): Promise<void> {
    this.state[key] = value;
    // IMMEDIATE persistence
    await chrome.storage.local.set({ [key]: value });
  }

  async get(key: string): Promise<any> {
    // Try memory first
    if (key in this.state) return this.state[key];

    // Fall back to storage
    const result = await chrome.storage.local.get(key);
    this.state[key] = result[key];
    return result[key];
  }
}

// Restore on wake-up
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get();
  Object.assign(state, data);
});
```

---

## Content Script Injection

### Timing is Critical

```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content-script.js"],
    "run_at": "document_start",  // CRITICAL: Before page scripts
    "all_frames": false
  }]
}
```

### Inject Provider

```typescript
// content-script.ts
function injectScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inpage-script.js');
  script.type = 'module';

  (document.head || document.documentElement).appendChild(script);

  script.onload = () => {
    script.remove();
  };
}

// Inject ASAP
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectScript);
} else {
  injectScript();
}
```

### Announce Ready

```typescript
// inpage-script.ts
function injectProvider(): void {
  const provider = new MyWalletProvider();
  window.solana = provider;

  // CRITICAL: Dispatch ready event
  window.dispatchEvent(new Event('solana#initialized'));
}

// dApp side
window.addEventListener('solana#initialized', () => {
  // Now safe to use window.solana
  const wallet = window.solana;
});
```

---

## Common Errors & Fixes

### "Blockhash not found"

```typescript
// ❌ WRONG: Stale blockhash
transaction.recentBlockhash = someOldBlockhash;

// ✅ CORRECT: Fetch fresh
const { blockhash } = await connection.getLatestBlockhash('finalized');
transaction.recentBlockhash = blockhash;
```

### "Signature verification failed"

```typescript
// ❌ WRONG: Verifying incomplete transaction
const serialized = tx.serialize({
  verifySignatures: true  // Fails if not all signed
});

// ✅ CORRECT: Disable verification until complete
const serialized = tx.serialize({
  requireAllSignatures: false,
  verifySignatures: false
});
```

### "Transaction simulation failed"

```typescript
// Always simulate before signing
const simulation = await connection.simulateTransaction(transaction);

if (simulation.value.err) {
  throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
}

// Now safe to sign
```

---

## Testing Patterns

### Unit Test Template

```typescript
describe('Keyring', () => {
  let keyring: Keyring;

  beforeEach(() => {
    keyring = new Keyring();
  });

  test('should encrypt and decrypt correctly', async () => {
    await keyring.unlock('password123');
    const publicKey = await keyring.addAccount('Test');

    keyring.lock();

    const unlocked = await keyring.unlock('password123');
    expect(unlocked).toBe(true);

    const accounts = keyring.getPublicKeys();
    expect(accounts).toContain(publicKey);
  });
});
```

### Integration Test Template

```typescript
describe('RPC Communication', () => {
  test('should send message from page to background', async () => {
    const result = await rpc('connect');
    expect(result).toHaveProperty('publicKey');
  });

  test('should timeout after 60 seconds', async () => {
    jest.setTimeout(70000);
    await expect(
      rpc('never-responds')
    ).rejects.toThrow('timeout');
  });
});
```

---

## Priority Checklist

### Before ANY Production Release

- [ ] Keys encrypted with AES-GCM
- [ ] PBKDF2 with 100k+ iterations
- [ ] User approval for all signatures
- [ ] Origin validation implemented
- [ ] Auto-lock after 15 minutes
- [ ] Transaction simulation before signing
- [ ] No plaintext secrets in logs
- [ ] Security audit completed
- [ ] Comprehensive tests written

### Before ANY Commit

- [ ] No console.log of sensitive data
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Code follows project patterns
- [ ] Comments explain complex logic
- [ ] Tests updated if needed

---

## Key Dependencies

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.95.8",           // Core blockchain
    "@solana/wallet-standard-features": "^1.2.0",  // Wallet standard
    "@wallet-standard/base": "^1.0.1",      // Base interfaces
    "@wallet-standard/features": "^1.0.3",  // Feature interfaces
    "bs58": "^6.0.0",                       // Base58 encoding
    "tweetnacl": "^1.0.3"                   // Ed25519 signing
  }
}
```

---

## Useful Commands

```bash
# Type check
npm run type-check

# Build
npm run build

# Development mode (watch)
npm run dev

# Lint
npm run lint

# Test
npm test
```

---

## Emergency Contacts

**If you find a security vulnerability**:
1. DO NOT commit the fix publicly
2. DO NOT discuss in public channels
3. Notify team lead immediately
4. Document in private security channel

**If keys are exposed**:
1. Immediately revoke/rotate affected keys
2. Notify all users
3. Conduct security audit
4. Document incident

---

## Further Reading

- Full technical reference: `planning/solana-wallet-technical-reference.md`
- Implementation analysis: `planning/implementation-analysis.md`
- Research summary: `planning/research-summary.md`
- Architecture: `planning/architecture.md`

---

**Keep this card handy during development!**
