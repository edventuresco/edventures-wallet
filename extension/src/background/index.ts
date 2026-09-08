/**
 * Background Service Worker (Manifest V3)
 *
 * This is the main background script that:
 * - Initializes wallet state on install
 * - Handles RPC requests from content scripts
 * - Manages keypair and signing operations
 * - Maintains connected origins state
 */

import { initializeState } from "./state";
import { handleRPC } from "./rpc";
import { CHANNEL } from "../shared/constants";
import { initSolanaRPC, testConnection } from "./solana-rpc";
import { tryRestoreSession } from "./keyring";

console.log("My Little Wallet background service worker loaded");

// Initialize state and Solana RPC on startup
Promise.all([
  initializeState(),
  initSolanaRPC(),
])
  .then(async () => {
    console.log("Wallet state initialized");
    console.log("Solana RPC initialized");

    // Try to restore session (auto-unlock if session valid)
    const restored = await tryRestoreSession();
    if (restored) {
      console.log("Wallet session restored (unlocked)");
    } else {
      console.log("No valid session (wallet locked)");
    }

    // Test connection
    const connected = await testConnection();
    console.log("Solana RPC connection test:", connected ? "SUCCESS" : "FAILED");
  })
  .catch((error) => {
    console.error("Initialization error:", error);
  });

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle our wallet messages
  if (message.channel !== CHANNEL) {
    return false;
  }

  console.log("[Background] Received message:", message);

  // Extract origin from sender
  const origin = sender.url ? new URL(sender.url).origin : undefined;

  // Handle RPC request
  handleRPC({ ...message, origin })
    .then((result) => {
      console.log("[Background] RPC success:", result);
      sendResponse({ ok: true, result });
    })
    .catch((error) => {
      console.error("[Background] RPC error:", error);
      sendResponse({ ok: false, error: error.message });
    });

  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Handle extension icon click (open popup)
chrome.action.onClicked.addListener(() => {
  chrome.action.openPopup();
});

console.log("Background service worker ready");
