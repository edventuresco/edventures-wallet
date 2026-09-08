# Scope Definition

## In Scope

### Core Wallet Functionality
- **Real Solana Wallet** - Not a demo or read-only wallet
  - BIP39 mnemonic generation and management
  - HD wallet derivation (BIP44 m/44'/501'/0'/0')
  - Real transaction signing and sending to Solana network
  - Real blockchain data (balances, transactions, tokens)
  - Private key security (encrypted storage in production)

### Solana Standards Compliance
- Wallet Standard implementation (@wallet-standard/base)
- Legacy window.solana provider (Phantom API compatibility)
- dApp connectivity and transaction approval workflow
- Support for Transaction and VersionedTransaction
- Multi-network support (mainnet-beta, devnet, testnet)

### LLM-Enhanced UI
- LLM-powered natural language interface for UI generation
- Generative UI component system (NOT for wallet logic)
- Dynamic, context-aware component rendering
- React-based popup interface

### Browser Extension Foundation
- Manifest V3 compliance (Chrome/Firefox)
- Multi-context architecture:
  - Background service worker (wallet core)
  - Content script bridge
  - Injected provider script
  - Popup UI
- Secure message passing between contexts
- Persistent storage via Chrome Storage API

### Development Process
- Prompt-led development methodology
- Comprehensive git audit trail (prompt → progress commits)
- Planning documentation
- Code quality and testing
- Development mode (.env seed) and production mode (encrypted)

### Technical Stack
- TypeScript for type safety
- React 18 for UI
- Vite for build tooling
- @solana/web3.js for blockchain
- BIP39 and ed25519-hd-key for key management
- Web Crypto API for encryption (production mode)

## Out of Scope (MVP Phase)

### Deferred to Post-MVP
- Multi-chain support beyond Solana
- Advanced DeFi integrations (staking, lending, liquidity)
- Hardware wallet integration (Ledger, Trezor)
- NFT gallery and management UI
- Swap/DEX UI (Jupiter, Raydium integration)
- Mobile app or PWA version
- Multi-account UI and account switching
- Social recovery mechanisms
- Multi-signature wallets
- Import/export wallet UI
- Address book management
- Advanced analytics and portfolio tracking
- Customizable LLM personality
- Voice interface
- Browser sync across devices

### Never in Scope
- Custody of user funds (non-custodial wallet only)
- Centralized backup of private keys
- KYC/AML compliance features (wallet is permissionless)

## Development vs Production Scope

### Development Mode (Current Focus)
- Seed phrase in .env for testing convenience
- Unencrypted key storage for rapid iteration
- Auto-unlock for developer experience
- Debug logging enabled
- Clear "Development Mode" warnings

### Production Mode (Future)
- BIP39 mnemonic encrypted with AES-GCM
- Password-based key derivation (PBKDF2, 100k iterations)
- Lock/unlock state management
- Auto-lock timeout (15 minutes)
- No plaintext secrets in storage or logs
- Transaction approval UI required
- Origin validation for dApp connections
- Security audit required before public release

## Phase Breakdown

### Phase 1: MVP (Current)
- Runnable browser extension
- Basic wallet functionality (view, sign, send)
- dApp connectivity (Wallet Standard + legacy)
- Development security model (.env seed)
- LLM UI generation proof of concept

### Phase 2: Production Hardening
- Encrypted key storage
- Lock/unlock workflow
- Transaction approval UI
- Origin allowlist management
- Security audit

### Phase 3: Feature Expansion
- NFT display
- Token management UI
- Swap integration
- Multi-account support
- Enhanced LLM UI capabilities
