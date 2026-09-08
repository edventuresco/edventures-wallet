# Requirements

## Problem

Traditional Solana wallets have complex, intimidating interfaces that require users to understand technical concepts. Users need a production-quality Solana wallet with an intuitive, LLM-enhanced UI for managing their digital assets.

## User

Solana ecosystem users (both beginners and experienced) who want a standards-compliant browser extension wallet with an LLM-first user interface.

## Core Features (Must-Have)

1. **Real Solana Wallet Functionality**
   - Real BIP39 seed generation and management
   - Real Solana blockchain interactions (not mocked)
   - Transaction signing and sending
   - Account management with HD wallet derivation (BIP44 m/44'/501'/0'/0')
   - Secure key storage (development: .env, production: encrypted with AES-GCM + PBKDF2)

2. **Solana Standards Compliance**
   - Wallet Standard implementation (@wallet-standard/base)
   - Legacy window.solana provider (Phantom compatibility)
   - Proper dApp communication (injected script ↔ content bridge ↔ background worker)
   - Support for both Transaction and VersionedTransaction

3. **LLM-Enhanced UI**
   - Natural language processing for UI component generation
   - Context-aware responses and intelligent component suggestions
   - Dynamic UI generation based on user intent
   - Responsive, modern design with smooth transitions

4. **Browser Extension Foundation**
   - Manifest V3 compliance
   - Multi-context architecture (popup, background service worker, content scripts)
   - Secure message passing between contexts
   - Chrome Storage API for persistent state

5. **Blockchain Integration**
   - Connect to Solana networks (mainnet-beta, devnet, testnet)
   - Display SOL balance and SPL token balances
   - Show transaction history
   - Network switching capability

## Nice-to-Have

- Multi-chain support (beyond Solana)
- NFT display and management
- Portfolio tracking with charts and historical data
- Swap/DEX integration (e.g., Jupiter, Raydium)
- Custom LLM prompts and commands
- Theming support
- Hardware wallet integration
- Multi-account management UI

## Acceptance Criteria (Testable Statements)

### Core Wallet Functionality
1. Extension loads successfully in Chrome browser with Manifest V3
2. Real BIP39 mnemonic phrase is generated on first use
3. Private keys are properly encrypted in production mode
4. Development mode allows using seed from .env for testing
5. Wallet can sign real Solana transactions
6. Wallet can connect to dApps via Wallet Standard
7. Wallet can connect to dApps via legacy window.solana API
8. Transaction signatures are valid and accepted by Solana network

### LLM UI Features
9. User can input natural language query in popup
10. LLM processes query and returns structured UI component specification
11. UI component is dynamically generated based on LLM output
12. Generated UI is responsive and follows modern design patterns

### Blockchain Integration
13. SOL balance is fetched and displayed correctly
14. SPL token balances are fetched and displayed
15. Transaction history is retrieved and shown
16. User can switch between Solana networks (mainnet/devnet/testnet)

### Extension Standards
17. Extension state persists across browser sessions
18. Error states are handled gracefully with user-friendly messages
19. All prompts are logged in PROMPTS.md before implementation
20. Git history shows clear prompt → progress commit pattern

## Security Requirements

### Development Mode
- Seed phrase stored in .env for testing convenience
- Clear warnings that this is development mode
- Not suitable for real funds

### Production Mode
- BIP39 mnemonic encrypted with AES-GCM
- Password-based key derivation using PBKDF2 (100k iterations)
- Lock/unlock state management
- Auto-lock timeout
- No plaintext secrets in storage or logs
- Transaction approval UI required for all signatures
- Origin validation for dApp connections

## Technical Architecture

### Following Industry Best Practices
- Architecture pattern: Backpack wallet reference
- Standards: Solana Wallet Standard + Phantom legacy API
- Security: Web Crypto API, encrypted storage, origin validation
- Build: Vite + TypeScript + React
- Philosophy: KISS - follow established patterns, don't overengineer
