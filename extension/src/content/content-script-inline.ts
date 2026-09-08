/**
 * Content Script with INLINE provider injection
 *
 * This version injects the provider code SYNCHRONOUSLY before any dapp code runs.
 * This fixes timing issues where dapps (like pump.fun/Privy) check for wallets
 * before our async script loading completes.
 */

import { CHANNEL } from '../shared/constants';

console.log('[My Little Wallet] Content script loaded (inline version)');

// Read the injected provider code from the bundle
// This will be replaced at build time with actual code
const providerCode = `
// INJECTED PROVIDER CODE WILL BE INSERTED HERE BY BUILD PROCESS
`;

// Inject provider code INLINE and SYNCHRONOUSLY
function injectProviderInline() {
  try {
    // Create a script element with inline code (runs synchronously)
    const script = document.createElement('script');
    script.textContent = providerCode;

    // Inject into page BEFORE any other scripts run
    (document.head || document.documentElement).prepend(script);

    console.log('[My Little Wallet] Provider injected inline (synchronous)');
  } catch (error) {
    console.error('[My Little Wallet] Error injecting provider inline:', error);

    // Fallback to async loading if inline fails
    fallbackToAsyncLoading();
  }
}

// Fallback: async loading (original method)
function fallbackToAsyncLoading() {
  console.warn('[My Little Wallet] Falling back to async provider loading');
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected-provider.js');
  script.onload = () => {
    console.log('[My Little Wallet] Provider script loaded (async)');
    script.remove();
  };
  script.onerror = (error) => {
    console.error('[My Little Wallet] Failed to load provider script:', error);
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject IMMEDIATELY - before document is ready
injectProviderInline();

// Listen for messages from injected provider (same as before)
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.channel !== 'my-little-wallet-request') return;

  const { id, method, params } = event.data;

  console.log('[My Little Wallet] Received request from page:', method);

  try {
    const response = await chrome.runtime.sendMessage({
      channel: CHANNEL,
      id,
      method,
      params,
    });

    window.postMessage({
      channel: 'my-little-wallet-response',
      id,
      ok: response.ok,
      result: response.result,
      error: response.error,
    }, '*');
  } catch (error: any) {
    console.error('[My Little Wallet] Error forwarding request:', error);

    window.postMessage({
      channel: 'my-little-wallet-response',
      id,
      ok: false,
      error: error.message || String(error),
    }, '*');
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.channel !== CHANNEL) return false;

  if (message.type === 'event') {
    window.postMessage({
      channel: 'my-little-wallet-event',
      event: message.event,
      data: message.data,
    }, '*');
  }

  return false;
});

console.log('[My Little Wallet] Content script ready (inline mode)');
