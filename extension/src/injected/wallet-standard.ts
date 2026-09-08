/**
 * Wallet Standard Registration
 *
 * Registers wallet with @wallet-standard for modern dApp discovery.
 * This is the "proper" way wallets should be discovered by dApps using wallet-adapter.
 *
 * Note: For hackathon simplicity, this provides a minimal implementation.
 * Production wallets should implement full Standard Wallet interface.
 */

import { PublicKey } from "@solana/web3.js";
import { rpc } from "./rpc-client";
import { RPC_METHODS } from "../shared/constants";

/**
 * Register with Wallet Standard
 *
 * This makes the wallet discoverable by wallet-adapter and other
 * standard-compliant dApps.
 *
 * For full implementation, see:
 * - @wallet-standard/base
 * - @wallet-standard/features
 * - @solana/wallet-standard-features
 */
export function registerWalletStandard(): void {
  console.log("[Wallet Standard] Registering wallet");

  // Create wallet object following Standard Wallet interface
  const wallet = {
    version: "1.0.0" as const,
    name: "My Little Wallet" as const,
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjOUE0NUZGIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn6aEPC90ZXh0Pgo8L3N2Zz4=",
    chains: ["solana:mainnet", "solana:devnet", "solana:testnet"] as const,

    features: {
      "standard:connect": {
        version: "1.0.0" as const,
        connect: async () => {
          console.log("[Wallet Standard] connect() called");
          const result = await rpc<{ publicKey: string }>(RPC_METHODS.CONNECT);
          return {
            accounts: [
              {
                address: result.publicKey,
                publicKey: new PublicKey(result.publicKey).toBytes(),
                chains: ["solana:mainnet", "solana:devnet", "solana:testnet"],
                features: ["solana:signTransaction", "solana:signMessage"],
              },
            ],
          };
        },
      },
      "standard:disconnect": {
        version: "1.0.0" as const,
        disconnect: async () => {
          console.log("[Wallet Standard] disconnect() called");
          await rpc(RPC_METHODS.DISCONNECT);
        },
      },
      "standard:events": {
        version: "1.0.0" as const,
        on: (event: string, _listener: (...args: any[]) => void) => {
          console.log("[Wallet Standard] on() called", event);
          // Minimal implementation for hackathon
          return () => {}; // Return unsubscribe function
        },
      },
      "solana:signMessage": {
        version: "1.0.0" as const,
        signMessage: async (input: { account: any; message: Uint8Array }) => {
          console.log("[Wallet Standard] signMessage() called");
          const result = await rpc<{ signature: string }>(RPC_METHODS.SIGN_MESSAGE, {
            message: Array.from(input.message),
          });
          const signatureBytes = Uint8Array.from(atob(result.signature), (c) =>
            c.charCodeAt(0)
          );
          return [{ signedMessage: input.message, signature: signatureBytes }];
        },
      },
      "solana:signTransaction": {
        version: "1.0.0" as const,
        signTransaction: async (input: { account: any; transaction: Uint8Array }) => {
          console.log("[Wallet Standard] signTransaction() called");
          const txBase64 = Buffer.from(input.transaction).toString("base64");
          const result = await rpc<{ signedTxBase64: string }>(
            RPC_METHODS.SIGN_TRANSACTION,
            { txBase64 }
          );
          const signedTx = Buffer.from(result.signedTxBase64, "base64");
          return [{ signedTransaction: signedTx }];
        },
      },
    },

    accounts: [],
  };

  // Register wallet with window.navigator.wallets (Wallet Standard registry)
  try {
    // Check if registry exists
    if (!(window as any).navigator.wallets) {
      console.warn(
        "[Wallet Standard] window.navigator.wallets not found. Wallet Standard may not be available."
      );
      return;
    }

    const registry = (window as any).navigator.wallets;

    // Register wallet
    if (typeof registry.register === "function") {
      registry.register(wallet);
      console.log("[Wallet Standard] Wallet registered successfully");
    } else {
      console.warn("[Wallet Standard] Registry.register() not available");
    }
  } catch (error) {
    console.error("[Wallet Standard] Registration failed:", error);
  }
}
