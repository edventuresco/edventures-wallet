/**
 * Injected Solana Provider (window.solana)
 *
 * This script is injected into every web page to provide the window.solana API.
 * It communicates with the content script via window.postMessage, which then
 * forwards requests to the background service worker.
 */

import { registerWalletStandard } from './wallet-standard-adapter';

interface SolanaProvider {
  isMyLittleWallet: boolean;
  publicKey: { toString: () => string } | null;
  isConnected: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
  signTransaction: (transaction: any) => Promise<any>;
  signAndSendTransaction: (transaction: any) => Promise<{ signature: string }>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
}

(function() {
  console.log('[My Little Wallet] Injecting Solana provider...');

  // Event handlers
  const eventHandlers: { [event: string]: Array<(...args: any[]) => void> } = {};

  let publicKey: { toString: () => string } | null = null;

  // Helper to send messages to content script
  function sendMessage(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();

      // Listen for response
      const listener = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (!event.data || event.data.channel !== 'my-little-wallet-response') return;
        if (event.data.id !== id) return;

        window.removeEventListener('message', listener);
        clearTimeout(timeoutId);

        if (event.data.ok) {
          resolve(event.data.result);
        } else {
          const error = new Error(event.data.error || 'Unknown error');
          // Add custom property to identify extension context errors
          if (event.data.error?.includes('Extension context invalidated') ||
              event.data.error?.includes('Extension was reloaded')) {
            (error as any).isContextInvalidated = true;
          }
          reject(error);
        }
      };

      window.addEventListener('message', listener);

      // Send request to content script
      window.postMessage({
        channel: 'my-little-wallet-request',
        id,
        method,
        params,
      }, '*');

      // Timeout after 60 seconds
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', listener);
        reject(new Error('Request timeout - wallet did not respond'));
      }, 60000);
    });
  }

  // Emit event to listeners
  function emit(event: string, ...args: any[]) {
    if (eventHandlers[event]) {
      eventHandlers[event].forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error('[My Little Wallet] Event handler error:', error);
        }
      });
    }
  }

  // Create provider API
  const provider: SolanaProvider = {
    isMyLittleWallet: true,
    publicKey: null,
    isConnected: false,

    async connect() {
      const result = await sendMessage('connect');
      publicKey = {
        toString: () => result.publicKey
      };
      provider.publicKey = publicKey;
      provider.isConnected = true;

      emit('connect', publicKey);
      return { publicKey };
    },

    async disconnect() {
      await sendMessage('disconnect');
      publicKey = null;
      provider.publicKey = null;
      provider.isConnected = false;

      emit('disconnect');
    },

    async signMessage(message: Uint8Array) {
      const result = await sendMessage('signMessage', {
        message: Array.from(message)
      });

      return {
        signature: Uint8Array.from(atob(result.signature), c => c.charCodeAt(0))
      };
    },

    async signTransaction(transaction: any) {
      // Serialize transaction to base64
      const txBuffer = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });
      const txBase64 = btoa(String.fromCharCode(...txBuffer));

      const result = await sendMessage('signTransaction', { txBase64 });

      // Deserialize signed transaction
      const signedBuffer = Uint8Array.from(atob(result.signedTxBase64), c => c.charCodeAt(0));

      // Return signed transaction (would need @solana/web3.js to properly deserialize)
      // For now, return a mock object
      return {
        serialize: () => signedBuffer
      };
    },

    async signAndSendTransaction(transaction: any) {
      // Serialize transaction to base64
      const txBuffer = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      });
      const txBase64 = btoa(String.fromCharCode(...txBuffer));

      // Sign transaction
      const signResult = await sendMessage('signTransaction', { txBase64 });

      // Send signed transaction to network
      const sendResult = await sendMessage('sendTransaction', {
        serializedTransaction: signResult.signedTxBase64
      });

      return {
        signature: sendResult.signature
      };
    },

    on(event: string, handler: (...args: any[]) => void) {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    },

    off(event: string, handler: (...args: any[]) => void) {
      if (!eventHandlers[event]) return;
      const index = eventHandlers[event].indexOf(handler);
      if (index > -1) {
        eventHandlers[event].splice(index, 1);
      }
    },
  };

  // Inject provider into window
  Object.defineProperty(window, 'solana', {
    value: provider,
    writable: false,
    configurable: false,
  });

  console.log('[My Little Wallet] window.solana injected');

  // Register with Wallet Standard (critical for modern dapps like pump.fun)
  registerWalletStandard(provider);

  // Announce provider is ready (legacy support)
  window.dispatchEvent(new Event('solana#initialized'));

  // Custom ready event with metadata
  window.dispatchEvent(new CustomEvent('my-little-wallet:ready', {
    detail: {
      name: 'My Little Wallet',
      version: '0.1.0',
      solana: provider,
    }
  }));

  console.log('[My Little Wallet] Solana provider injected successfully');
})();
