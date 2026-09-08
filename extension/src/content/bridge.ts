/**
 * Content Script Bridge
 *
 * Runs in isolated world, bridges communication between:
 * - Page context (injected provider script)
 * - Background service worker
 *
 * Flow:
 * 1. Inject provider script into page context
 * 2. Listen for window.postMessage from page
 * 3. Forward to background via chrome.runtime.sendMessage
 * 4. Forward response back to page via window.postMessage
 */

import { CHANNEL } from "../shared/constants";
import type { BridgeMessage } from "../shared/types";

console.log("[Content Script] My Little Wallet bridge loaded");

// Inject the provider script into the page context
function injectProvider() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected-provider.js");
  script.type = "module";

  // Insert into page
  (document.head || document.documentElement).appendChild(script);

  // Clean up script tag
  script.onload = () => {
    script.remove();
    console.log("[Content Script] Provider injected successfully");
  };

  script.onerror = () => {
    console.error("[Content Script] Failed to inject provider");
    script.remove();
  };
}

// Inject as early as possible
if (document.doctype || document.documentElement) {
  injectProvider();
} else {
  // Wait for DOM if not ready
  document.addEventListener("DOMContentLoaded", injectProvider);
}

// Listen for messages from page context
window.addEventListener("message", async (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;

  const data = event.data as BridgeMessage;

  // Only handle our wallet messages going to extension
  if (!data || data.channel !== CHANNEL || data.direction !== "to-extension") {
    return;
  }

  const { id, method, params } = data;

  console.log("[Content Script] Forwarding to background:", { id, method, params });

  try {
    // Forward to background service worker
    const response = await chrome.runtime.sendMessage({
      channel: CHANNEL,
      id,
      method,
      params,
    });

    console.log("[Content Script] Response from background:", response);

    // Forward response back to page
    window.postMessage(
      {
        channel: CHANNEL,
        direction: "to-page",
        id,
        ok: response.ok,
        result: response.result,
        error: response.error,
      } as BridgeMessage,
      "*"
    );
  } catch (error: any) {
    console.error("[Content Script] Bridge error:", error);

    // Send error back to page
    window.postMessage(
      {
        channel: CHANNEL,
        direction: "to-page",
        id,
        ok: false,
        error: String(error?.message ?? error),
      } as BridgeMessage,
      "*"
    );
  }
});

console.log("[Content Script] Bridge ready, listening for messages");
