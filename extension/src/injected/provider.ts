/**
 * Injected Provider Entry Point
 *
 * This script runs in the page context and exposes both:
 * 1. Legacy window.solana provider (Phantom-compatible)
 * 2. Wallet Standard registration (modern discovery)
 *
 * This gives maximum dApp compatibility.
 */

import { installLegacySolanaProvider } from "./legacy-solana";
import { registerWalletStandard } from "./wallet-standard";

console.log("🦄 My Little Wallet provider loading...");

// Install legacy window.solana API
installLegacySolanaProvider();

// Register with Wallet Standard
registerWalletStandard();

console.log("🦄 My Little Wallet provider ready!");
console.log("- window.solana: ✓");
console.log("- Wallet Standard: ✓");
