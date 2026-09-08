/**
 * Content Script
 *
 * Bridges communication between:
 * - Injected provider (window.solana) in the page
 * - Background service worker
 *
 * Flow:
 * Page → window.postMessage → Content Script → chrome.runtime.sendMessage → Background
 * Background → chrome.runtime.sendMessage → Content Script → window.postMessage → Page
 */

import { CHANNEL } from '../shared/constants';

console.log('[My Little Wallet] Content script loaded');

// Inject the provider script into the page
function injectProviderScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected-provider.js');
    script.onload = () => {
      console.log('[My Little Wallet] Provider script injected');
      script.remove();
    };
    script.onerror = (error) => {
      console.error('[My Little Wallet] Failed to inject provider script:', error);
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[My Little Wallet] Error injecting provider script:', error);
  }
}

// Inject as early as possible
if (document.doctype || document.head) {
  injectProviderScript();
} else {
  // Wait for doctype/head to be available
  const observer = new MutationObserver(() => {
    if (document.doctype || document.head) {
      observer.disconnect();
      injectProviderScript();
    }
  });
  observer.observe(document, { childList: true });
}

/**
 * Check if the extension context is valid
 * This can become invalid when the extension is reloaded
 */
function isExtensionContextValid(): boolean {
  try {
    // Try to access chrome.runtime.id - if this throws, context is invalid
    return !!chrome?.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Send a message to the background script with proper error handling
 */
function sendMessageToBackground(message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check if context is valid before attempting to send
    if (!isExtensionContextValid()) {
      reject(new Error('Extension context invalidated. Please reload the page.'));
      return;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        // Check for runtime errors
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.error('[My Little Wallet] Runtime error:', lastError);
          reject(new Error(lastError.message || 'Unknown runtime error'));
          return;
        }

        // Check if context became invalid during the call
        if (!isExtensionContextValid()) {
          reject(new Error('Extension context invalidated. Please reload the page.'));
          return;
        }

        if (!response) {
          reject(new Error('No response from background script'));
          return;
        }

        resolve(response);
      });
    } catch (error) {
      console.error('[My Little Wallet] Error sending message:', error);
      reject(error);
    }
  });
}

// Listen for messages from injected provider
window.addEventListener('message', (event) => {
  // Only accept messages from our own window
  if (event.source !== window) return;

  // Only process our wallet messages
  if (!event.data || event.data.channel !== 'my-little-wallet-request') return;

  const { id, method, params } = event.data;

  console.log('[My Little Wallet] Received request from page:', method);

  // Handle the request asynchronously
  sendMessageToBackground({
    channel: CHANNEL,
    id,
    method,
    params,
  })
    .then((response) => {
      // Send response back to page
      window.postMessage({
        channel: 'my-little-wallet-response',
        id,
        ok: response.ok,
        result: response.result,
        error: response.error,
      }, '*');
    })
    .catch((error: any) => {
      console.error('[My Little Wallet] Error forwarding request:', error);

      // Provide helpful error message for context invalidation
      let errorMessage = error.message || String(error);
      if (errorMessage.includes('Extension context invalidated')) {
        errorMessage = 'Extension was reloaded. Please refresh this page to reconnect your wallet.';
      }

      // Send error back to page
      window.postMessage({
        channel: 'my-little-wallet-response',
        id,
        ok: false,
        error: errorMessage,
      }, '*');
    });
});

// Listen for messages from background script (for events)
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.channel !== CHANNEL) return false;

  // Forward events to page
  if (message.type === 'event') {
    window.postMessage({
      channel: 'my-little-wallet-event',
      event: message.event,
      data: message.data,
    }, '*');
  }

  return false;
});

console.log('[My Little Wallet] Content script ready');
