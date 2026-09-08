# Architecture

## High-Level Design

### System Overview - Real Solana Wallet with LLM UI

```
┌──────────────────────────────────────────────────────────┐
│                  Browser Extension                        │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Popup UI (React + LLM)                  │  │
│  │  - Wallet Dashboard                                │  │
│  │  - LLM-Generated UI Components                     │  │
│  │  - Transaction Approval UI                         │  │
│  │  - Settings & Account Management                   │  │
│  └──────────┬─────────────────────────────────────────┘  │
│             │ chrome.runtime.sendMessage                 │
│  ┌──────────▼─────────────────────────────────────────┐  │
│  │        Background Service Worker (Wallet Core)     │  │
│  │                                                     │  │
│  │  ┌───────────────────────────────────────────────┐ │  │
│  │  │ Keyring (BIP39 + BIP44 + Ed25519)             │ │  │
│  │  │  - Mnemonic generation/import                 │ │  │
│  │  │  - HD key derivation (m/44'/501'/0'/0')       │ │  │
│  │  │  - Transaction signing                        │ │  │
│  │  │  - Encryption/decryption (dev vs prod modes)  │ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  │                                                     │  │
│  │  ┌───────────────────────────────────────────────┐ │  │
│  │  │ RPC Handler                                   │ │  │
│  │  │  - Request routing                            │ │  │
│  │  │  - Origin validation                          │ │  │
│  │  │  - Transaction approval flow                  │ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  │                                                     │  │
│  │  ┌───────────────────────────────────────────────┐ │  │
│  │  │ Solana Connection Manager                     │ │  │
│  │  │  - Network switching (mainnet/devnet/testnet) │ │  │
│  │  │  - Balance queries                            │ │  │
│  │  │  - Transaction broadcasting                   │ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  │                                                     │  │
│  │  ┌───────────────────────────────────────────────┐ │  │
│  │  │ State Management                              │ │  │
│  │  │  - Connected sites (origin allowlist)         │ │  │
│  │  │  - Network selection                          │ │  │
│  │  │  - Lock/unlock state                          │ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  └──────────┬──────────────────────────────────────────┘  │
│             │ chrome.runtime.connect (port)               │
│  ┌──────────▼──────────────────────────────────────────┐  │
│  │       Content Script Bridge                         │  │
│  │  - Message relay (page ↔ background)               │  │
│  │  - Event forwarding                                 │  │
│  └──────────┬──────────────────────────────────────────┘  │
│             │ window.postMessage                          │
└─────────────┼───────────────────────────────────────────────┘
              │
  ┌───────────▼────────────┐
  │  Injected Provider     │  ← Runs in page context
  │  - window.solana       │
  │  - window.backpack     │
  │  - Wallet Standard     │
  └───────────┬────────────┘
              │
  ┌───────────▼────────────┐
  │  dApp JavaScript       │
  │  - Jupiter, Raydium    │
  │  - Pump.fun, etc       │
  └────────────────────────┘

External Services:
  ┌─────────────────┐       ┌──────────────────┐
  │  Solana Network │       │  LLM API (Opt.)  │
  │  - RPC nodes    │       │  - UI generation │
  │  - Mainnet/Dev  │       │  - Claude, etc   │
  └─────────────────┘       └──────────────────┘
```

## Component Architecture

### 1. Injected Provider (Page Context)
**Purpose**: Provide standardized Solana wallet API to dApps

**Components**:
- **Wallet Standard Implementation**: Modern wallet discovery and connection
  - Registration with `registerWallet()`
  - Feature detection (connect, disconnect, signTransaction, signMessage)
  - Account management and events

- **Legacy window.solana Provider**: Backward compatibility with Phantom API
  - `connect()`, `disconnect()`, `signTransaction()`, `signAllTransactions()`
  - `signMessage()`, `signAndSendTransaction()`
  - Event emitter (connect, disconnect, accountChanged)

- **RPC Client**: Message passing to content script
  - Request/response correlation with unique IDs
  - Timeout handling
  - Error propagation

**Key Files**: `src/injected/provider.ts`, `src/injected/wallet-standard.ts`, `src/injected/legacy-solana.ts`

### 2. Content Script Bridge (Isolated Context)
**Purpose**: Securely relay messages between page and background

**Components**:
- **Message Relay**: Forward requests from injected script to background
- **Script Injection**: Inject provider script into page context at document_start
- **Event Forwarding**: Relay wallet events back to page

**Key Files**: `src/content/bridge.ts`

### 3. Background Service Worker (Wallet Core)
**Purpose**: Core wallet logic, key management, and blockchain interaction

**Components**:

- **Keyring Service**: Private key and mnemonic management
  - **Development Mode**:
    - Optional seed from .env (DEV_SEED_PHRASE)
    - Unencrypted storage for rapid iteration
    - Auto-generated BIP39 mnemonic if no .env seed
  - **Production Mode**:
    - AES-GCM encryption with user password
    - PBKDF2 key derivation (100k iterations)
    - Lock/unlock state management
    - Auto-lock timeout (15 minutes)
  - HD wallet derivation (BIP44 path: m/44'/501'/accountIndex'/0')
  - Transaction signing with Ed25519

- **RPC Handler**: Process requests from dApps
  - Method routing (connect, disconnect, signTransaction, etc.)
  - Origin validation and allowlist management
  - Transaction approval flow (show popup, await user decision)
  - Error handling and response formatting

- **Solana Connection Manager**: Blockchain interaction
  - Network management (mainnet-beta, devnet, testnet)
  - RPC endpoint configuration
  - Balance queries (SOL + SPL tokens)
  - Transaction simulation and broadcasting
  - Transaction history retrieval

- **State Manager**: Persistent extension state
  - Connected sites (origin allowlist)
  - Network selection
  - Lock/unlock status
  - Account list
  - Settings (auto-lock timeout, default network, etc.)

**Key Files**: `src/background/index.ts`, `src/background/keyring.ts`, `src/background/rpc.ts`, `src/background/state.ts`

### 4. Popup UI (React + LLM)
**Purpose**: User interface for wallet management and LLM-generated components

**Components**:
- **Wallet Dashboard**:
  - Account overview (address, balance)
  - Token list (SOL + SPL tokens)
  - Recent transactions
  - Network selector

- **LLM UI Generator** (Optional/Future):
  - Natural language input for UI generation
  - Dynamic component rendering based on LLM output
  - Context-aware UI suggestions

- **Transaction Approval UI**:
  - Human-readable transaction preview
  - Fee estimation
  - Approve/reject controls
  - Simulation results display

- **Settings & Management**:
  - Network configuration
  - Connected sites management
  - Lock/unlock controls
  - Account import/export (future)
  - Security settings

**Key Files**: `src/popup/popup.tsx`, `src/popup/popup.html`

### 5. External Services
- **Solana Network**: Real blockchain interaction via RPC
  - Mainnet: `https://api.mainnet-beta.solana.com`
  - Devnet: `https://api.devnet.solana.com`
  - Testnet: `https://api.testnet.solana.com`
  - Or custom RPC endpoints

- **LLM API** (Optional): UI generation service
  - Claude API for natural language → component schema
  - Can be added for enhanced UI generation
  - NOT used for core wallet functionality

## Data Flow

### dApp Connection Flow

```
dApp calls window.solana.connect()
    │
    ▼
Injected Provider
    │ window.postMessage({ method: 'connect', ... })
    ▼
Content Script Bridge
    │ chrome.runtime.sendMessage({ method: 'connect', origin: ... })
    ▼
Background RPC Handler
    │ Check if origin is approved
    ▼
Show Approval Popup (if needed)
    │ User approves/rejects
    ▼
Keyring.getPublicKey()
    │
    ▼
Store approved origin
    │
    ▼
Return { publicKey: '...' }
    │
    ▼
Content Script forwards response
    │
    ▼
Injected Provider resolves promise
    │
    ▼
dApp receives publicKey
```

### Transaction Signing Flow

```
dApp calls window.solana.signTransaction(tx)
    │
    ▼
Injected Provider serializes tx
    │ window.postMessage({ method: 'signTransaction', params: { transaction: base64 }, ... })
    ▼
Content Script Bridge
    │ chrome.runtime.sendMessage({ method: 'signTransaction', ... })
    ▼
Background RPC Handler
    │ Validate origin is approved
    ▼
Parse & validate transaction
    │
    ▼
Simulate transaction (optional)
    │
    ▼
Show Transaction Approval Popup
    │ Display human-readable tx details
    │ User approves/rejects
    ▼
Keyring.signTransaction(txBuffer)
    │ Ed25519 signature generation
    ▼
Return signed transaction
    │
    ▼
Content Script forwards response
    │
    ▼
Injected Provider deserializes
    │
    ▼
dApp receives signed transaction
    │
    ▼
dApp sends to network (or wallet does if signAndSendTransaction)
```

### Wallet Dashboard Flow

```
User opens popup
    │
    ▼
Popup UI loads
    │ chrome.runtime.sendMessage({ method: 'getState' })
    ▼
Background returns state
    │ { locked, publicKey, network, balance, ... }
    ▼
If locked, show unlock screen
If unlocked, show dashboard
    │
    ▼
Fetch balance (background)
    │ Connection.getBalance(publicKey)
    ▼
Fetch tokens (background)
    │ Connection.getParsedTokenAccountsByOwner(publicKey)
    ▼
Fetch transactions (background)
    │ Connection.getSignaturesForAddress(publicKey)
    ▼
Update popup UI with data
```

## Key Design Decisions

### Real Wallet, Not Demo
- **Production-Quality Core**: Real BIP39 seeds, real transaction signing, real blockchain interaction
- **Development Convenience**: .env seed option for testing, but production mode uses encryption
- **No Mocks**: All balances, transactions, and signatures are real Solana network data

### Security Architecture
- **Private Key Isolation**: Keys never leave background service worker
- **Multi-Layer Security**:
  - Development: Unencrypted for rapid iteration (with warnings)
  - Production: AES-GCM encryption + PBKDF2 password derivation
- **Transaction Approval**: All signatures require explicit user confirmation
- **Origin Validation**: Allowlist system for connected sites
- **Message Passing**: Secure communication via chrome.runtime (not window.postMessage for sensitive data)

### Solana Standards Compliance
- **Dual Provider Strategy**:
  - Modern: Wallet Standard (@wallet-standard/base)
  - Legacy: window.solana (Phantom API compatibility)
- **Maximum dApp Compatibility**: Support both old and new integration patterns
- **Proper Serialization**: Handle both Transaction and VersionedTransaction

### LLM UI Strategy (Optional Enhancement)
- **LLM for UI Generation Only**: NOT for wallet logic or security decisions
- **Component Schema Approach**: LLM generates React component specifications
- **Graceful Degradation**: Wallet works fully without LLM, LLM only enhances UX
- **Clear Separation**: Core wallet functionality is independent of LLM features

### State Management
- **Persistent State**: chrome.storage.local for wallet state (encrypted in production)
- **Session State**: In-memory for unlocked keyring and active connections
- **UI State**: React hooks for ephemeral popup state
- **Event-Driven**: Background ↔ Popup communication via messages

### Development Philosophy (KISS)
- **Follow Backpack Patterns**: Don't reinvent, use proven architecture
- **Minimal Dependencies**: Only essential packages (web3.js, bip39, tweetnacl)
- **Clear Phases**: Dev mode → Production hardening → Feature expansion
- **Evidence-Based**: Reference real implementations (Backpack, Phantom)

## Technology Stack

### Core Wallet Libraries
- **@solana/web3.js**: Solana blockchain interaction (v1.95.8)
- **bip39**: Mnemonic phrase generation and validation
- **ed25519-hd-key**: HD wallet key derivation (BIP44)
- **tweetnacl**: Ed25519 signing (NaCl crypto library)
- **bs58**: Base58 encoding for Solana addresses

### Wallet Standards
- **@wallet-standard/base**: Core wallet registration (v1.0.1)
- **@wallet-standard/features**: Standard feature interfaces (v1.0.3)
- **@solana/wallet-standard-features**: Solana-specific features (v1.2.0)

### Frontend (Popup UI)
- **React 18**: UI component rendering (v18.2.0)
- **React DOM**: DOM rendering
- **TypeScript**: Type safety (v5.4.5)
- **Vite**: Build tooling and HMR (v5.2.10)
- **@vitejs/plugin-react**: React support for Vite

### Browser Extension
- **Manifest V3**: Modern extension security model
- **Chrome Extension APIs**:
  - storage (persistent encrypted data)
  - runtime (message passing)
  - scripting (dynamic injection)
  - windows (approval popups)
- **@types/chrome**: TypeScript definitions for Chrome APIs

### Security (Production Mode)
- **Web Crypto API**: AES-GCM encryption, PBKDF2 key derivation
- **Secure Random**: crypto.getRandomValues for entropy
- **No External Crypto**: Use browser-native cryptography

### Development Tools
- **TypeScript Compiler**: tsc for type checking
- **ESLint**: Code linting
- **npm**: Package management

## File Structure

```
my-little-wallet/
├── src/
│   ├── manifest.json              # Manifest V3 configuration
│   │
│   ├── popup/
│   │   ├── popup.html            # Popup entry HTML
│   │   ├── popup.tsx             # Main popup component
│   │   └── components/           # UI components (future)
│   │
│   ├── background/               # Service worker (wallet core)
│   │   ├── index.ts              # Entry point, message handling
│   │   ├── keyring.ts            # BIP39/BIP44 key management
│   │   ├── rpc.ts                # RPC request handler
│   │   ├── state.ts              # Persistent state management
│   │   └── connection.ts         # Solana network connection (future)
│   │
│   ├── content/                  # Content script bridge
│   │   └── bridge.ts             # Message relay (page ↔ background)
│   │
│   ├── injected/                 # Injected provider (page context)
│   │   ├── provider.ts           # Main entry, script injection
│   │   ├── wallet-standard.ts    # Wallet Standard implementation
│   │   ├── legacy-solana.ts      # window.solana provider (Phantom API)
│   │   └── rpc-client.ts         # RPC client (postMessage communication)
│   │
│   └── shared/                   # Shared code
│       ├── types.ts              # TypeScript types/interfaces
│       └── constants.ts          # Constants (storage keys, etc.)
│
├── dist/                          # Build output (gitignored)
│   ├── manifest.json
│   ├── background.js
│   ├── content-bridge.js
│   ├── injected-provider.js
│   ├── popup.html
│   └── popup.js
│
├── docs/                          # Research documentation
│   ├── README.md
│   ├── backpack-research.md      # Backpack architecture analysis
│   └── swapkit-research.md       # SwapKit integration notes
│
├── planning/                      # Planning documentation
│   ├── README.md
│   ├── interview.md              # Interview Q&A
│   ├── requirements.md           # Project requirements
│   ├── scope.md                  # In/out of scope
│   ├── architecture.md           # This file
│   ├── milestones.md             # Task roadmap
│   ├── risks.md                  # Risk assessment
│   ├── decisions.md              # Architecture decisions
│   ├── implementation-analysis.md # Code quality assessment
│   └── solana-wallet-technical-reference.md # Technical patterns
│
├── examples/                      # Example integrations (gitignored)
│   └── SwapKit/                  # SwapKit monorepo clone
│
├── .env                           # Development environment (gitignored)
├── .env.example                  # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts                # Vite build configuration
├── PROMPTS.md                    # Prompt log (append-only)
├── CLAUDE.md                     # Agent contract
└── README.md                     # Project overview
```

## Performance Considerations

- Lazy load components for faster initial render
- Cache LLM responses for repeated queries
- Debounce user input to reduce API calls
- Use blockchain data caching (5-minute TTL)
- Minimize bundle size with tree shaking

## Scalability Considerations

- Component schema allows for easy addition of new UI types
- LLM prompt engineering can be improved iteratively
- Blockchain service abstracted for multi-chain future
- Message passing architecture supports complex workflows
