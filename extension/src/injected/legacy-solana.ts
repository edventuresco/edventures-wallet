/**
 * Legacy window.solana Provider
 *
 * Implements the Phantom/Solflare-compatible window.solana API
 * for maximum dApp compatibility.
 *
 * This is what dApps expect when they check for window.solana
 */

import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { rpc } from "./rpc-client";
import { RPC_METHODS } from "../shared/constants";

type PublicKeyLike = { toBase58(): string };

export interface SolanaProvider {
  isMyLittleWallet: boolean;
  isPhantom: boolean; // Claim compatibility
  publicKey: PublicKeyLike | null;
  isConnected: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: PublicKeyLike }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, ...args: any[]): void;
}

/**
 * Create and install window.solana provider
 */
export function installLegacySolanaProvider(): SolanaProvider {
  const eventListeners = new Map<string, Set<Function>>();

  const provider: SolanaProvider = {
    isMyLittleWallet: true,
    isPhantom: false, // Don't impersonate, but be compatible
    publicKey: null,
    isConnected: false,

    async connect(opts?: { onlyIfTrusted?: boolean }) {
      console.log("[Provider] connect() called", opts);

      // Handle onlyIfTrusted (auto-connect request)
      if (opts?.onlyIfTrusted && !provider.isConnected) {
        throw new Error("Wallet not connected. User action required.");
      }

      const result = await rpc<{ publicKey: string }>(RPC_METHODS.CONNECT);

      // Update provider state
      provider.publicKey = new PublicKey(result.publicKey);
      provider.isConnected = true;

      // Emit connect event
      provider.emit("connect", provider.publicKey);

      return { publicKey: provider.publicKey };
    },

    async disconnect() {
      console.log("[Provider] disconnect() called");

      await rpc(RPC_METHODS.DISCONNECT);

      // Update provider state
      provider.publicKey = null;
      provider.isConnected = false;

      // Emit disconnect event
      provider.emit("disconnect");
    },

    async signMessage(message: Uint8Array, encoding?: string) {
      console.log("[Provider] signMessage() called", { encoding });

      if (!provider.isConnected) {
        throw new Error("Wallet not connected. Call connect() first.");
      }

      const result = await rpc<{ signature: string }>(RPC_METHODS.SIGN_MESSAGE, {
        message: Array.from(message),
      });

      // Decode base64 signature
      const signatureBytes = Uint8Array.from(atob(result.signature), (c) =>
        c.charCodeAt(0)
      );

      return { signature: signatureBytes };
    },

    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      console.log("[Provider] signTransaction() called");

      if (!provider.isConnected) {
        throw new Error("Wallet not connected. Call connect() first.");
      }

      // Serialize transaction
      const txBuffer = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const txBase64 = Buffer.from(txBuffer).toString("base64");

      // Sign via RPC
      const result = await rpc<{ signedTxBase64: string }>(RPC_METHODS.SIGN_TRANSACTION, {
        txBase64,
      });

      // Deserialize signed transaction
      const signedTxBuffer = Buffer.from(result.signedTxBase64, "base64");

      // Return typed transaction
      if (tx instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(signedTxBuffer) as T;
      } else {
        return Transaction.from(signedTxBuffer) as T;
      }
    },

    async signAllTransactions<T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> {
      console.log("[Provider] signAllTransactions() called", txs.length);

      if (!provider.isConnected) {
        throw new Error("Wallet not connected. Call connect() first.");
      }

      // Serialize all transactions
      const txsBase64 = txs.map((tx) => {
        const txBuffer = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        return Buffer.from(txBuffer).toString("base64");
      });

      // Sign via RPC
      const result = await rpc<{ signedTxsBase64: string[] }>(
        RPC_METHODS.SIGN_ALL_TRANSACTIONS,
        { txsBase64 }
      );

      // Deserialize signed transactions
      return result.signedTxsBase64.map((signedTxBase64, index) => {
        const signedTxBuffer = Buffer.from(signedTxBase64, "base64");
        const originalTx = txs[index];

        if (originalTx instanceof VersionedTransaction) {
          return VersionedTransaction.deserialize(signedTxBuffer) as T;
        } else {
          return Transaction.from(signedTxBuffer) as T;
        }
      });
    },

    on(event: string, handler: Function) {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, new Set());
      }
      eventListeners.get(event)!.add(handler);
    },

    off(event: string, handler: Function) {
      eventListeners.get(event)?.delete(handler);
    },

    emit(event: string, ...args: any[]) {
      console.log(`[Provider] Emitting event: ${event}`, args);
      eventListeners.get(event)?.forEach((handler) => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error in ${event} handler:`, err);
        }
      });
    },
  };

  // Install on window
  (window as any).solana = provider;

  // Announce readiness
  window.dispatchEvent(new Event("solana#initialized"));

  console.log("[Provider] window.solana installed");

  return provider;
}
