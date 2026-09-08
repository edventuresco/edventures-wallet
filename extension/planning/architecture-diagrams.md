# Architecture Diagrams

**Visual reference for Solana wallet browser extension architecture**

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Page (dApp)                          │
│                                                                   │
│  window.solana (Legacy)     +     wallet-standard (Modern)      │
│  ├─ connect()                     ├─ standard:connect            │
│  ├─ signTransaction()             ├─ solana:signTransaction     │
│  ├─ signMessage()                 ├─ solana:signMessage         │
│  └─ on/off/emit                   └─ standard:events            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ window.postMessage
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Inpage Script (Injected)                      │
│                                                                   │
│  • Provider Implementation (window.solana)                       │
│  • Wallet Standard Registration                                 │
│  • RPC Client (message passing)                                 │
│  • Event Forwarding                                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ window.postMessage
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│              Content Script (Isolated Context)                   │
│                                                                   │
│  • Message Bridge (page ↔ background)                           │
│  • Request/Response Matching                                    │
│  • Origin Validation                                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ chrome.runtime.sendMessage
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│            Background Service Worker (Trusted)                   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ RPC Handler                                             │   │
│  │  • Route methods to appropriate services                │   │
│  │  • Validate requests                                    │   │
│  │  • Return responses                                     │   │
│  └────┬────────────────────────────────────────────────────┘   │
│       │                                                          │
│  ┌────▼────────────┬────────────────┬────────────────────────┐ │
│  │ Keyring         │ Transaction    │ Connection Manager     │ │
│  │ • Encrypted     │ Manager        │ • Track connected sites│ │
│  │   storage       │ • Approval     │ • Permission control   │ │
│  │ • Lock/unlock   │   queue        │ • Auto-disconnect      │ │
│  │ • Sign ops      │ • User confirm │ • Origin whitelist     │ │
│  └─────────────────┴────────────────┴────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Network Manager                                            │ │
│  │ • RPC endpoint configuration                              │ │
│  │ • Connection instances (mainnet/devnet/testnet)           │ │
│  │ • Network switching                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ State Manager                                              │ │
│  │ • Persist to chrome.storage                               │ │
│  │ • Handle service worker termination                       │ │
│  │ • Restore on wake-up                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ chrome.windows.create
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                      Popup UI (React)                            │
│                                                                   │
│  • Account Management                                            │
│  • Transaction Approval                                          │
│  • Network Selection                                             │
│  • Settings                                                      │
│  • Connection Management                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Message Flow: Connect Request

```
┌──────────┐         ┌──────────┐         ┌─────────┐         ┌────────────┐         ┌───────┐
│   dApp   │         │ Inpage   │         │ Content │         │ Background │         │ Popup │
└────┬─────┘         └────┬─────┘         └────┬────┘         └─────┬──────┘         └───┬───┘
     │                    │                     │                    │                    │
     │ window.solana      │                     │                    │                    │
     │   .connect()       │                     │                    │                    │
     ├────────────────────>                     │                    │                    │
     │                    │                     │                    │                    │
     │                    │ window.postMessage  │                    │                    │
     │                    │ { method: connect } │                    │                    │
     │                    ├─────────────────────>                    │                    │
     │                    │                     │                    │                    │
     │                    │                     │ chrome.runtime     │                    │
     │                    │                     │   .sendMessage     │                    │
     │                    │                     ├────────────────────>                    │
     │                    │                     │                    │                    │
     │                    │                     │                    │ chrome.windows     │
     │                    │                     │                    │   .create()        │
     │                    │                     │                    ├────────────────────>
     │                    │                     │                    │                    │
     │                    │                     │                    │                    │
     │                    │                     │                    │   User approves    │
     │                    │                     │                    │<────────────────────
     │                    │                     │                    │                    │
     │                    │                     │   { publicKey }    │                    │
     │                    │                     │<────────────────────                    │
     │                    │                     │                    │                    │
     │                    │ { publicKey }       │                    │                    │
     │                    │<─────────────────────                    │                    │
     │                    │                     │                    │                    │
     │  { publicKey }     │                     │                    │                    │
     │<────────────────────                     │                    │                    │
     │                    │                     │                    │                    │
     │ emit('connect')    │                     │                    │                    │
     │<────────────────────                     │                    │                    │
     │                    │                     │                    │                    │
```

---

## Message Flow: Sign Transaction

```
┌──────────┐         ┌──────────┐         ┌─────────┐         ┌────────────┐         ┌───────┐
│   dApp   │         │ Inpage   │         │ Content │         │ Background │         │ Popup │
└────┬─────┘         └────┬─────┘         └────┬────┘         └─────┬──────┘         └───┬───┘
     │                    │                     │                    │                    │
     │ signTransaction(tx)│                     │                    │                    │
     ├────────────────────>                     │                    │                    │
     │                    │                     │                    │                    │
     │                    │ Serialize tx        │                    │                    │
     │                    │ (requireAll=false)  │                    │                    │
     │                    │                     │                    │                    │
     │                    │ window.postMessage  │                    │                    │
     │                    │ { method: signTx,   │                    │                    │
     │                    │   params: {txBase64}│                    │                    │
     │                    ├─────────────────────>                    │                    │
     │                    │                     │                    │                    │
     │                    │                     │ chrome.runtime     │                    │
     │                    │                     │   .sendMessage     │                    │
     │                    │                     ├────────────────────>                    │
     │                    │                     │                    │                    │
     │                    │                     │                    │ Deserialize tx     │
     │                    │                     │                    │ Decode for preview │
     │                    │                     │                    │                    │
     │                    │                     │                    │ Open approval popup│
     │                    │                     │                    ├────────────────────>
     │                    │                     │                    │                    │
     │                    │                     │                    │   Show tx details  │
     │                    │                     │                    │   • From/To        │
     │                    │                     │                    │   • Amount         │
     │                    │                     │                    │   • Network fee    │
     │                    │                     │                    │                    │
     │                    │                     │                    │   User approves    │
     │                    │                     │                    │<────────────────────
     │                    │                     │                    │                    │
     │                    │                     │                    │ Sign with keyring  │
     │                    │                     │                    │ Serialize signed   │
     │                    │                     │                    │                    │
     │                    │                     │  { signedTxBase64 }│                    │
     │                    │                     │<────────────────────                    │
     │                    │                     │                    │                    │
     │                    │ { signedTxBase64 }  │                    │                    │
     │                    │<─────────────────────                    │                    │
     │                    │                     │                    │                    │
     │                    │ Deserialize to      │                    │                    │
     │                    │ Transaction object  │                    │                    │
     │                    │                     │                    │                    │
     │  signedTx          │                     │                    │                    │
     │<────────────────────                     │                    │                    │
     │                    │                     │                    │                    │
```

---

## Keyring Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Keyring Class                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ In-Memory State (Cleared on Lock)                          │ │
│  │                                                             │ │
│  │ ┌──────────────────────────────────────────────────────┐  │ │
│  │ │ Private Keys (Unencrypted)                           │  │ │
│  │ │  • Account 1: Uint8Array(64)                         │  │ │
│  │ │  • Account 2: Uint8Array(64)                         │  │ │
│  │ │  • ...                                                │  │ │
│  │ └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │ ┌──────────────────────────────────────────────────────┐  │ │
│  │ │ Password Hash (For Validation)                       │  │ │
│  │ │  • Hashed with PBKDF2                                │  │ │
│  │ └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │ Auto-Lock Timer: 15 minutes                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│                            ↕                                      │
│                  lock() / unlock(password)                        │
│                            ↕                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ chrome.storage.local (Persistent, Encrypted)               │ │
│  │                                                             │ │
│  │ {                                                           │ │
│  │   accounts: [                                               │ │
│  │     {                                                       │ │
│  │       publicKey: "Gjh3...base58",                          │ │
│  │       encryptedPrivateKey: "encrypted_with_AES-GCM",       │ │
│  │       name: "Account 1",                                   │ │
│  │       derivationPath: "m/44'/501'/0'/0'"                   │ │
│  │     },                                                      │ │
│  │     ...                                                     │ │
│  │   ],                                                        │ │
│  │   passwordHash: "pbkdf2_hash_for_validation"               │ │
│  │ }                                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘

Encryption Flow:
┌─────────────┐
│  Password   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ PBKDF2 Key Derivation   │
│ • 100,000 iterations    │
│ • Unique salt per key   │
│ • SHA-256 hash          │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ AES-GCM Encryption      │
│ • 256-bit key           │
│ • Unique IV per key     │
│ • Authenticated         │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│ Encrypted Private Key   │
│ Format: salt+iv+cipher  │
│ Encoding: Base58        │
└─────────────────────────┘
```

---

## Transaction Approval State Machine

```
┌──────────────────────────────────────────────────────────────┐
│                    Transaction States                         │
└──────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │ dApp Requests│
  │ Signature    │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │   PENDING    │◄─────────────┐
  │  (Queued)    │              │
  └──────┬───────┘              │
         │                      │
         │ Open Popup           │
         ▼                      │
  ┌──────────────┐              │
  │   REVIEWING  │              │
  │  (User sees) │              │
  └──────┬───────┘              │
         │                      │
         ├──────────────────────┤
         │                      │
    User Decision          5min Timeout
         │                      │
    ┌────┴────┐                 │
    │         │                 │
    ▼         ▼                 ▼
┌────────┐ ┌────────┐    ┌──────────┐
│APPROVED│ │REJECTED│    │ EXPIRED  │
└───┬────┘ └───┬────┘    └────┬─────┘
    │          │              │
    │ Sign     │ Throw Error  │ Throw Error
    │          │              │
    ▼          ▼              ▼
┌────────┐ ┌───────────────────┐
│ SIGNED │ │    CANCELLED      │
└───┬────┘ └───────────────────┘
    │
    │ Send to Network
    │
    ▼
┌────────────┐
│ CONFIRMED  │
└────────────┘
```

---

## Network Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Network Manager                            │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Mainnet    │  │   Devnet    │  │  Testnet    │
│  Connection │  │  Connection │  │  Connection │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────────────────────────────────────┐
│        RPC Endpoint Configuration            │
├──────────────────────────────────────────────┤
│ mainnet: https://api.mainnet-beta.solana.com│
│ devnet:  https://api.devnet.solana.com      │
│ testnet: https://api.testnet.solana.com     │
└──────────────────────────────────────────────┘

Current Network: Devnet (configurable)
       │
       ▼
┌─────────────────────────────────────────────┐
│         Active Connection Instance           │
│                                              │
│ • getBalance()                               │
│ • getLatestBlockhash()                      │
│ • sendRawTransaction()                      │
│ • confirmTransaction()                      │
│ • simulateTransaction()                     │
└─────────────────────────────────────────────┘

Chain ID Mapping:
mainnet  → "solana:mainnet"
devnet   → "solana:devnet"
testnet  → "solana:testnet"
```

---

## Storage Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  chrome.storage.local                         │
└──────────────────────────────────────────────────────────────┘

┌────────────────────────┬─────────────────────────────────────┐
│ Key                    │ Value                               │
├────────────────────────┼─────────────────────────────────────┤
│ accounts               │ Array<{                             │
│                        │   publicKey: string,                │
│                        │   encryptedPrivateKey: string,      │
│                        │   name: string                      │
│                        │ }>                                  │
├────────────────────────┼─────────────────────────────────────┤
│ currentNetwork         │ "mainnet" | "devnet" | "testnet"    │
├────────────────────────┼─────────────────────────────────────┤
│ connections            │ {                                   │
│                        │   [origin: string]: {               │
│                        │     publicKeys: string[],           │
│                        │     connectedAt: number,            │
│                        │     permissions: string[]           │
│                        │   }                                 │
│                        │ }                                   │
├────────────────────────┼─────────────────────────────────────┤
│ settings               │ {                                   │
│                        │   autoLockMinutes: 15,              │
│                        │   trustedOrigins: string[]          │
│                        │ }                                   │
└────────────────────────┴─────────────────────────────────────┘

⚠️ NEVER STORE:
- Unencrypted private keys
- Passwords (only hashed for validation)
- Session tokens
- Sensitive transaction data
```

---

## Manifest V3 Structure

```
my-little-wallet/
├── manifest.json
│   └── Defines:
│       • Service worker: background/index.js
│       • Content scripts: content/bridge.js
│       • Popup: popup.html
│       • Permissions: storage, activeTab
│       • Web accessible resources: injected/provider.js
│
├── background/
│   └── Service Worker (Always-on background logic)
│       • No DOM access
│       • Can terminate at any time
│       • Must persist state to chrome.storage
│
├── content/
│   └── Content Script (Runs in page context)
│       • Has limited DOM access
│       • Can use chrome.* APIs
│       • Isolated from page JavaScript
│
├── injected/
│   └── Inpage Script (Injected into page)
│       • Full DOM access
│       • Same context as dApp
│       • NO chrome.* API access
│       • Communicates via window.postMessage
│
└── popup/
    └── Popup UI (React application)
        • Full chrome.* API access
        • Separate context from page
        • Communicates with background via chrome.runtime
```

---

## Event Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Event Propagation                          │
└──────────────────────────────────────────────────────────────┘

Account Change Event:

Background (source)
    │
    │ chrome.runtime.sendMessage
    │ { type: 'ACCOUNT_CHANGED', publicKey }
    │
    ├─────────────────┬─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
Content Script    Popup UI        Inpage Script
    │                                   │
    │ window.postMessage                │
    │ { type: 'accountChanged' }        │
    │                                   │
    └───────────────────────────────────>
                                        │
                                        ▼
                                  window.solana
                                     .emit('accountChanged')
                                        │
                                        ▼
                                    dApp listeners
                                    (all notified)

Network Change Event:

User selects network in popup
    │
    ▼
Background: networkManager.setNetwork()
    │
    ├── Update chrome.storage
    │
    ├── Recreate Connection instance
    │
    └── Broadcast change
        │
        ├─> Content scripts
        │   └─> Inpage scripts
        │       └─> window.solana.emit('networkChanged')
        │
        └─> Popup UI
            └─> Update network indicator
```

---

## Security Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│                    Security Zones                             │
└──────────────────────────────────────────────────────────────┘

UNTRUSTED                            TRUSTED
┌──────────┐                         ┌──────────┐
│   dApp   │                         │ Extension│
│  (Page)  │                         │          │
└────┬─────┘                         └────┬─────┘
     │                                    │
     │ NO direct access                   │ Full access
     │ to chrome.* APIs                   │ to chrome.* APIs
     │                                    │
     ▼                                    ▼
┌─────────────┐  Isolation   ┌─────────────────┐
│   Inpage    │◄─────────────┤ Content Script  │
│   Script    │   Boundary   │                 │
└─────────────┘              └─────────────────┘
     │                              │
     │ window.postMessage           │ chrome.runtime
     │ (message passing)            │   .sendMessage
     │                              │
     └──────────┬───────────────────┘
                │
                ▼
        ┌─────────────┐
        │ Background  │
        │   Worker    │
        │             │
        │ • Keyring   │
        │ • Signing   │
        │ • Approval  │
        └─────────────┘

Security Rules:
✅ Background is fully trusted
✅ Content script is semi-trusted (isolated)
❌ Inpage script is untrusted (same as page)
❌ Page/dApp is completely untrusted
```

---

## Component Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│                  Component Dependency Graph                   │
└──────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   Popup     │
                    │   (React)   │
                    └──────┬──────┘
                           │
                           │ chrome.runtime
                           │
                    ┌──────▼──────┐
      ┌─────────────┤ Background  │─────────────┐
      │             │   Worker    │             │
      │             └──────┬──────┘             │
      │                    │                    │
      │                    │                    │
┌─────▼──────┐  ┌──────────▼───────┐  ┌────────▼────────┐
│  Keyring   │  │ Transaction Mgr  │  │ Network Manager │
│            │  │                  │  │                 │
│ • encrypt  │  │ • approval queue │  │ • connections   │
│ • decrypt  │  │ • sign & send    │  │ • RPC endpoints │
│ • sign     │  │ • simulation     │  │ • chain IDs     │
└────────────┘  └──────────────────┘  └─────────────────┘
      │                    │                    │
      │                    │                    │
      └────────────────────┴────────────────────┘
                           │
                           │
                  ┌────────▼────────┐
                  │ State Manager   │
                  │                 │
                  │ chrome.storage  │
                  └─────────────────┘

External Dependencies:
- @solana/web3.js (blockchain interaction)
- tweetnacl (signing)
- bs58 (encoding)
- @wallet-standard/* (interfaces)
```

---

**For full implementation details, see:**
- `planning/solana-wallet-technical-reference.md` - Complete code examples
- `planning/implementation-analysis.md` - Current state analysis
- `planning/quick-reference.md` - Common patterns
