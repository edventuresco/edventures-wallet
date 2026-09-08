/**
 * RPC Client for injected provider
 *
 * Handles communication with background worker via window.postMessage
 * through the content script bridge.
 */

import { CHANNEL } from "../shared/constants";
import type { BridgeMessage } from "../shared/types";

/**
 * Send RPC request to background and wait for response
 */
export function rpc<T>(method: string, params?: any): Promise<T> {
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(`RPC timeout: ${method}`));
    }, 30000);

    // Listen for response
    const onMessage = (event: MessageEvent) => {
      const data = event.data as BridgeMessage;

      // Only handle our wallet messages from extension
      if (
        !data ||
        data.channel !== CHANNEL ||
        data.direction !== "to-page" ||
        data.id !== id
      ) {
        return;
      }

      // Clean up
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);

      // Handle response
      if (data.ok) {
        resolve(data.result as T);
      } else {
        reject(new Error(data.error || "Unknown error"));
      }
    };

    window.addEventListener("message", onMessage);

    // Send request to content script
    window.postMessage(
      {
        channel: CHANNEL,
        direction: "to-extension",
        id,
        method,
        params,
      } as BridgeMessage,
      "*"
    );
  });
}
