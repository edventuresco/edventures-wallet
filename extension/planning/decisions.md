# Architectural Decision Records

This document tracks major technical and architectural decisions made during the project.

---

## Decision 0001 — Use Manifest V3 for Browser Extension — 2026-01-24

**Context**: Need to choose between Manifest V2 and V3 for browser extension development. V2 is deprecated but still widely used. V3 is newer with stricter security but more complex.

**Options**:
- A: Manifest V2 (simpler, more examples, but deprecated)
- B: Manifest V3 (modern, secure, future-proof, but more complex)

**Decision**: Use Manifest V3

**Rationale**:
- Chrome is phasing out V2 support
- Better security model aligns with wallet use case
- Service worker model is more robust
- Forces us to follow best practices from the start

**Consequences**:
- More complex message passing architecture
- Need to use service workers instead of background pages
- Stricter Content Security Policy requirements
- Better long-term compatibility and security

---

## Decision 0002 — React for UI Framework — 2026-01-24

**Context**: Need to choose UI framework for dynamic component generation. Options include React, Vue, Svelte, or vanilla JS.

**Options**:
- A: React (most popular, large ecosystem, good for dynamic rendering)
- B: Vue (simpler, good reactivity, smaller)
- C: Svelte (smallest bundle, compile-time, modern)
- D: Vanilla JS (no framework overhead, but more complex)

**Decision**: Use React 18

**Rationale**:
- Best ecosystem for dynamic component rendering
- Team familiarity
- Strong TypeScript support
- Good for generative UI patterns
- Extensive component libraries available

**Consequences**:
- Larger bundle size than Svelte
- Need to optimize for extension context
- Familiar patterns make development faster
- Easy to find examples and help

---

## Decision 0003 — Claude API for LLM Integration — 2026-01-24

**Context**: Need to choose LLM provider for natural language processing and UI generation.

**Options**:
- A: Claude (Anthropic) - strong reasoning, good at structured output
- B: GPT-4 (OpenAI) - versatile, well-documented
- C: Open-source model (Llama, Mistral) - free but need hosting

**Decision**: Use Claude API (Anthropic)

**Rationale**:
- Excellent at following structured output formats
- Strong reasoning capabilities for intent understanding
- Good context window for complex prompts
- Reliable JSON output
- Familiar to team

**Consequences**:
- Requires API key and costs per query
- Need to handle API rate limits
- Dependent on external service availability
- Need fallback for API failures

---

## Decision 0004 — Focus on Ethereum for Initial Blockchain Integration — 2026-01-24

**Context**: Need to choose which blockchain to integrate first for MVP demo.

**Options**:
- A: Bitcoin - simpler, just UTXO and balance
- B: Ethereum - more complex but richer ecosystem
- C: Solana - fast, modern, but less familiar

**Decision**: Start with Ethereum

**Rationale**:
- Richer data (tokens, contracts, transactions)
- Better public RPC access (Infura, Alchemy)
- More interesting demo possibilities
- Large user base
- Good JavaScript libraries (ethers.js, web3.js)

**Consequences**:
- More complex than Bitcoin
- Need to handle gas, tokens, contracts
- Better demo potential
- Easier to extend later

---

## Decision 0005 — Prompt-Led Development Methodology — 2026-01-24

**Context**: Hackathon judging criteria includes transparency and auditability of AI agent usage.

**Options**:
- A: Standard git workflow
- B: Prompt-led development with audit trail

**Decision**: Use prompt-led development with strict commit protocol

**Rationale**:
- Perfect for hackathon judging criteria
- Creates transparent development history
- Forces clear thinking about requirements
- Makes agent collaboration explicit
- Provides replayable development story

**Consequences**:
- More commits than usual
- Need discipline to follow protocol
- Excellent documentation by default
- Clear demonstration of AI collaboration
- Additional overhead in commit process

---

## Decision 0006 — Pivot to Solana Browser Extension Wallet — 2026-01-24

**Context**: User clarified the actual project goal is to build a Solana browser extension wallet that connects to dApps, not an LLM-first generative UI wallet. This is a practice project to overcome past struggles with dApp wallet integration.

**Options**:
- A: Continue with LLM-first generative UI approach
- B: Build traditional Solana browser extension wallet with dual compatibility (Wallet Standard + legacy window.solana)
- C: Fork existing wallet (Phantom, Solflare) and modify

**Decision**: Build fresh Solana extension with Wallet Standard + legacy compatibility

**Rationale**:
- User explicitly wants practice with dApp connection mechanisms
- Fresh build provides better learning than forking
- Dual compatibility (modern + legacy) ensures maximum dApp coverage
- Focus on the specific pain points user has experienced
- Clean codebase easier to understand than forked legacy code

**Consequences**:
- Need to implement full browser extension architecture (3-context bridge)
- Must support both Wallet Standard and window.solana provider patterns
- Demo-level security acceptable (focus is on connectivity, not production security)
- Will encounter and solve real edge cases (multi-tab, serialization, concurrency)
- Perfect for hackathon demo showing technical understanding

---

## Decision 0007 — Three-Context Bridge Architecture — 2026-01-24

**Context**: Browser extensions have isolated worlds (content scripts can't directly modify page context). Need architecture to expose wallet provider to dApp pages.

**Options**:
- A: Try to expose from content script directly (won't work due to isolated worlds)
- B: Use page-injected script → content script bridge → background worker
- C: Use externally_connectable manifest pattern

**Decision**: Use 3-context bridge (injected → content → background)

**Rationale**:
- Only reliable way to expose window.solana to page context
- Content script isolation is a security feature, must work with it
- Background worker holds sensitive state (keys, approvals)
- Matches patterns from working wallets (Phantom, Solflare)
- Chrome docs explicitly recommend this pattern for provider injection

**Consequences**:
- More complex message passing (postMessage + chrome.runtime)
- Need to serialize data across context boundaries
- Must handle request/response correlation with unique IDs
- Provides proper security isolation
- Enables multi-tab support naturally

---

## Decision 0008 — Demo-Level Key Storage — 2026-01-24

**Context**: Need to store private keys for wallet functionality. Production wallets use encryption, mnemonics, hardware integration. Hackathon timeframe is 5 hours.

**Options**:
- A: Full production security (encryption, mnemonic, locked state)
- B: Simple chrome.storage.local with base58 encoding, clear warnings
- C: In-memory only (lost on restart)

**Decision**: Simple chrome.storage.local with prominent security warnings

**Rationale**:
- Hackathon focus is on dApp connection, not key security
- User explicitly wants practice with connectivity issues
- Clear warnings prevent false sense of security
- Faster to implement = more time for actual connection logic
- Easy to upgrade to proper security later

**Consequences**:
- NOT production ready - must be clearly documented
- Faster development cycle
- Focus can stay on provider API surface
- Good foundation to add encryption layer later
- Must include prominent "DEMO ONLY" warnings

---

## Decision 0009 — Vite for Build Tooling — 2026-01-24

**Context**: Need bundler for TypeScript extension with multiple entry points (background, content, injected, popup).

**Options**:
- A: Webpack (mature, lots of examples, complex config)
- B: Vite (fast, modern, simpler config, great DX)
- C: Rollup (flexible, manual setup)
- D: esbuild (fastest, minimal features)

**Decision**: Use Vite with rollup-plugin-chrome-extension or manual multi-entry config

**Rationale**:
- Fast dev builds and HMR
- Great TypeScript support out of the box
- Clean multi-entry point configuration
- Modern tooling preferred for learning
- Easier to configure than Webpack

**Consequences**:
- Need to configure multiple entry points manually
- Excellent developer experience
- Fast iteration cycle
- May need rollup plugin for extension-specific builds
- Easy to add React for popup UI

---

## Decision 0010 — Support Both Wallet Standard and Legacy window.solana — 2026-01-24

**Context**: Solana dApps use two discovery mechanisms: modern Wallet Standard (wallet-adapter) and legacy window.solana injection (Phantom pattern).

**Options**:
- A: Wallet Standard only (modern, future-proof, but misses legacy dApps)
- B: window.solana only (simple, but misses newer dApps)
- C: Both (maximum compatibility, more code)

**Decision**: Implement both interfaces

**Rationale**:
- pump.fun and many dApps still check window.solana
- Newer dApps and wallet-adapter use Wallet Standard
- User wants maximum dApp compatibility for practice
- Both interfaces can share same underlying implementation
- Industry trend is dual support (Phantom, Backpack do both)

**Consequences**:
- More provider surface code to maintain
- Maximum dApp compatibility
- Better learning experience (understand both patterns)
- Future-proof (supports migration path)
- Need to keep both interfaces in sync

---

## Decision 0011 — Production-Grade Key Storage (Supersedes Decision 0008) — 2026-01-24

**Context**: After initial implementation with demo-level key storage, project goals clarified to build production-ready wallet with real security from the start, not demo/mock.

**Options**:
- A: Keep chrome.storage.local with simple storage (original Decision 0008)
- B: Implement production-grade encryption (AES-GCM + PBKDF2 + BIP39)
- C: Hybrid approach with development mode flag

**Decision**: Implement full production-grade encryption immediately (Option B)

**Rationale**:
- Project goal is REAL Solana wallet like Backpack, not demo
- "LLM-first UI" refers to UI generation, NOT wallet security
- No shortcuts on security - follow industry best practices from day one
- BIP39 mnemonic standard for recovery phrases
- Encrypted vault storage following Web Crypto API standards
- Lock/unlock state management like production wallets
- User explicitly corrected misconception about demo wallet

**Implementation**:
- AES-GCM 256-bit encryption for mnemonic storage
- PBKDF2 key derivation with 100,000 iterations (Web Crypto API)
- BIP39 12-word seed phrase generation and validation
- BIP44 HD wallet derivation (m/44'/501'/0'/0' for Solana)
- Encrypted vault stored in chrome.storage.local
- Password-protected unlock with secure memory handling
- Auto-lock on background worker restart
- Ed25519 signing via tweetnacl

**Consequences**:
- Production-ready security from start ✅
- Removed all "DEMO WALLET" warnings ✅
- Real BIP39 seeds, real transactions ✅
- Lock/unlock UI required (implemented in Prompt 0004) ✅
- Follows Backpack and industry best practices ✅
- No development shortcuts or .env seeds ✅
- Slightly more complex initial implementation (worth it for real security)
- Foundation for real-world usage

**Status**: ✅ Implemented
- Keyring with AES-GCM encryption: src/background/keyring.ts
- Onboarding flow with password creation: src/popup/popup.tsx
- Unlock screen for locked wallet: src/popup/popup.html (Prompt 0004)
- Updated documentation to reflect production security: INSTALL.md

---
