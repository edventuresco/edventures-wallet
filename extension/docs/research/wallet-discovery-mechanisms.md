# Wallet Discovery Mechanisms Research

**Date:** 2026-01-24
**Author:** Research based on Backpack and wallet standards
**Purpose:** Understand how Solana wallets register and announce themselves to dapps

---

## Executive Summary

This document analyzes how Solana wallets like Backpack make themselves discoverable to dapps (like pump.fun) and identifies gaps in My Little Wallet's current implementation.

**Key Finding:** My Little Wallet is missing critical wallet announcement mechanisms, specifically **Wallet Standard registration**, which prevents dapps from detecting the wallet in their connection UI.

---

## How Wallet Discovery Works

### 1. Legacy Window Injection (`window.solana`)

**What it is:**
- The oldest and most basic method
- Wallet injects a `window.solana` object with standard methods

**My Little Wallet Implementation:**
```typescript
// ✅ CURRENT: src/content/injected-provider.ts:176-180
Object.defineProperty(window, 'solana', {
  value: provider,
  writable: false,
  configurable: false,
});
```

**Status:** ✅ Implemented correctly

---

### 2. Initialization Event (`solana#initialized`)

**What it is:**
- Event fired when the wallet provider is ready
- Allows dapps to listen for wallet availability

**My Little Wallet Implementation:**
```typescript
// ✅ CURRENT: src/content/injected-provider.ts:183
window.dispatchEvent(new Event('solana#initialized'));
```

**Status:** ✅ Implemented correctly

---

### 3. Wallet Standard Registration ⚠️ **MISSING**

**What it is:**
- Modern standard for multi-wallet support
- Allows dapps to discover and switch between multiple wallets
- Required by most modern Solana dapps (including pump.fun)

**How Backpack Does It:**
```typescript
// backpack/packages/provider-injection/src/index.ts:107
import { initialize } from '@coral-xyz/wallet-standard';
initialize(solana);
```

**What `initialize()` does (from wallet-standard):**
```typescript
// wallet-standard/src/register.ts:11-14
export function registerWallet(wallet: Wallet): void {
    const callback = ({ register }) => register(wallet);
    window.dispatchEvent(new RegisterWalletEvent(callback));
    window.addEventListener('wallet-standard:app-ready', ({ detail: api }) =>
        callback(api)
    );
}
```

**Status:** ❌ **NOT IMPLEMENTED** - This is the critical missing piece!

---

### 4. Wallet Identification Properties

**What it is:**
- Properties that identify the wallet uniquely
- Prevents conflicts with other wallets

**How Backpack Does It:**
```typescript
// backpack/packages/provider-injection/src/index.ts:1-4
Object.defineProperty(globalThis, "_backpack_injected_provider", {
  value: true,
  writable: false
});

// Provider object
{
  isBackpack: true,
  isPhantom: false, // Optional: for compatibility
  // ... other standard methods
}
```

**My Little Wallet Implementation:**
```typescript
// ✅ CURRENT: src/content/injected-provider.ts:83
{
  isMyLittleWallet: true,
  // ... methods
}
```

**Status:** ✅ Partially implemented (needs global flag)

---

### 5. EIP-6963 (Ethereum Standard) - Optional for Solana

**What it is:**
- Multi-wallet discovery standard for Ethereum
- Some cross-chain wallets implement this

**How Backpack Does It:**
```typescript
// For Ethereum wallets
const info = {
  uuid: uuidV4(),
  name: "Backpack",
  icon: "data:image/svg+xml...",
  rdns: "app.backpack",
};

function announceProvider() {
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info, provider: backpackEthereum }),
    })
  );
}

window.addEventListener("eip6963:requestProvider", announceProvider);
announceProvider();
```

**Status:** ⚠️ Not applicable for Solana-only wallet (but good to know for future EVM support)

---

## Why My Little Wallet Isn't Detected by pump.fun

### Root Cause Analysis

1. **Missing Wallet Standard Registration**
   - Modern dapps like pump.fun use `@wallet-adapter/base` or `@solana/wallet-adapter`
   - These adapters listen for `wallet-standard:register-wallet` events
   - Without this event, the wallet won't appear in connection UI

2. **Event Flow Breakdown:**

   **Expected Flow (Backpack):**
   ```
   Page Load
   → Content script injects provider
   → Provider sets window.solana
   → Provider calls initialize(wallet) from @wallet-standard/wallet
   → Fires 'wallet-standard:register-wallet' event
   → Dapp's wallet adapter detects wallet
   → Wallet appears in connection UI
   ```

   **Current Flow (My Little Wallet):**
   ```
   Page Load
   → Content script injects provider
   → Provider sets window.solana
   → Provider fires 'solana#initialized'
   → ❌ NO Wallet Standard registration
   → ❌ Dapp never detects wallet
   → ❌ Wallet doesn't appear in UI
   ```

3. **Detection Methods Used by pump.fun:**
   - Wallet Standard API (primary)
   - Legacy `window.solana` detection (fallback)
   - Event listeners for wallet registration

---

## Implementation Recommendations

### Priority 1: Add Wallet Standard Support

**Required Changes:**

1. **Install dependencies:**
   ```bash
   npm install @wallet-standard/base @wallet-standard/wallet
   ```

2. **Create Wallet Standard adapter:**
   ```typescript
   // src/content/wallet-standard-adapter.ts
   import { registerWallet } from '@wallet-standard/wallet';
   import type { Wallet } from '@wallet-standard/base';

   export function initializeWalletStandard(solanaProvider: any) {
     const wallet: Wallet = {
       version: '1.0.0',
       name: 'My Little Wallet',
       icon: 'data:image/svg+xml,...', // Your wallet icon
       chains: ['solana:mainnet', 'solana:devnet', 'solana:testnet'],
       features: {
         'standard:connect': {
           version: '1.0.0',
           connect: async () => {
             const result = await solanaProvider.connect();
             return {
               accounts: [
                 {
                   address: result.publicKey.toString(),
                   publicKey: new Uint8Array(result.publicKey.toBytes()),
                   chains: ['solana:mainnet'],
                   features: ['solana:signTransaction', 'solana:signMessage'],
                 }
               ]
             };
           }
         },
         'standard:disconnect': {
           version: '1.0.0',
           disconnect: async () => {
             await solanaProvider.disconnect();
           }
         },
         'solana:signTransaction': {
           version: '1.0.0',
           supportedTransactionVersions: ['legacy', 0],
           signTransaction: async (input) => {
             return await solanaProvider.signTransaction(input);
           }
         },
         'solana:signMessage': {
           version: '1.0.0',
           signMessage: async (input) => {
             return await solanaProvider.signMessage(input.message);
           }
         }
       }
     };

     registerWallet(wallet);
   }
   ```

3. **Update injected-provider.ts:**
   ```typescript
   // After creating the provider
   Object.defineProperty(window, 'solana', {
     value: provider,
     writable: false,
     configurable: false,
   });

   // ✨ NEW: Register with Wallet Standard
   initializeWalletStandard(provider);

   // Announce provider is ready
   window.dispatchEvent(new Event('solana#initialized'));
   ```

### Priority 2: Add Global Identification Flag

```typescript
// src/content/injected-provider.ts (top of file)
Object.defineProperty(globalThis, "_my_little_wallet_injected", {
  value: true,
  writable: false
});
```

### Priority 3: Enhanced Event Announcements

```typescript
// Add multiple announcement mechanisms
function announceWallet() {
  // 1. Legacy Solana event
  window.dispatchEvent(new Event('solana#initialized'));

  // 2. Custom wallet ready event
  window.dispatchEvent(new CustomEvent('my-little-wallet:ready', {
    detail: {
      name: 'My Little Wallet',
      version: '0.1.0',
      solana: window.solana,
    }
  }));
}

// Announce on load
announceWallet();

// Re-announce if requested (some dapps do this)
window.addEventListener('solana#requestProvider', announceWallet);
```

---

## Testing Strategy

### 1. Enhanced Sandbox Dapp

Add wallet detection diagnostics:

```javascript
// Wallet Detection Test
function testWalletDetection() {
  console.group('🔍 Wallet Detection Audit');

  // Check window.solana
  console.log('window.solana exists:', !!window.solana);
  console.log('window.solana.isMyLittleWallet:', window.solana?.isMyLittleWallet);

  // Check Wallet Standard
  console.log('Wallet Standard API:', !!window.navigator?.wallets);

  // Listen for registration events
  window.addEventListener('wallet-standard:register-wallet', (e) => {
    console.log('✅ Wallet Standard registration detected:', e.detail);
  });

  // Check global flags
  console.log('Global injection flag:', globalThis._my_little_wallet_injected);

  console.groupEnd();
}

// Run on page load
window.addEventListener('load', testWalletDetection);
```

### 2. Real-World Testing

Test on these dapps (in order of complexity):
1. **sandbox/index.html** - Basic connection test
2. **jup.ag** - Jupiter aggregator (uses wallet-adapter)
3. **pump.fun** - Token creation (strict wallet requirements)
4. **raydium.io** - DEX (multi-wallet support)

---

## Comparison: My Little Wallet vs Backpack

| Feature | My Little Wallet | Backpack | Priority |
|---------|------------------|----------|----------|
| `window.solana` injection | ✅ Yes | ✅ Yes | - |
| `solana#initialized` event | ✅ Yes | ✅ Yes | - |
| Wallet Standard registration | ❌ No | ✅ Yes | 🔥 **HIGH** |
| Global identification flag | ⚠️ Partial | ✅ Yes | Medium |
| Multi-wallet support | ❌ No | ✅ Yes | Medium |
| Re-announcement on request | ❌ No | ⚠️ Unknown | Low |
| EIP-6963 (Ethereum) | ❌ No | ✅ Yes | Low (future) |

---

## Implementation Checklist

- [ ] Install `@wallet-standard/base` and `@wallet-standard/wallet`
- [ ] Create Wallet Standard adapter module
- [ ] Implement wallet registration in injected-provider
- [ ] Add global injection flag
- [ ] Add enhanced event announcements
- [ ] Update sandbox dapp with detection diagnostics
- [ ] Test on sandbox dapp
- [ ] Test on jup.ag
- [ ] Test on pump.fun
- [ ] Document wallet discovery in README

---

## References

- [Wallet Standard Specification](https://github.com/wallet-standard/wallet-standard)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Backpack Source Code](https://github.com/coral-xyz/backpack)
- [EIP-6963: Multi Injected Provider Discovery](https://eips.ethereum.org/EIPS/eip-6963)

---

## Conclusion

The primary reason My Little Wallet is not detected by pump.fun and other modern dapps is the **lack of Wallet Standard registration**. Implementing the Wallet Standard API (Priority 1) will immediately make the wallet discoverable in modern Solana dapp connection UIs.

The fix is straightforward and involves:
1. Adding the `@wallet-standard` packages
2. Creating a standards-compliant wallet object
3. Calling `registerWallet()` after injecting `window.solana`

This should take ~2-3 hours to implement and test.
