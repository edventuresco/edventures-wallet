// Shared types across all extension contexts

export const CHANNEL = "my-little-wallet";

export type MessageDirection = "to-extension" | "to-page";

export interface BridgeMessage {
  channel: typeof CHANNEL;
  direction: MessageDirection;
  id: string;
  method?: string;
  params?: any;
  ok?: boolean;
  result?: any;
  error?: string;
}

export interface ConnectResult {
  publicKey: string;
}

export interface SignMessageParams {
  message: number[]; // Uint8Array as array for serialization
}

export interface SignMessageResult {
  signature: string; // base64
}

export interface SignTransactionParams {
  txBase64: string;
}

export interface SignTransactionResult {
  signedTxBase64: string;
}

export interface SignAllTransactionsParams {
  txsBase64: string[];
}

export interface SignAllTransactionsResult {
  signedTxsBase64: string[];
}

export interface WalletState {
  publicKey: string | null;
  connectedOrigins: Set<string>;
  isLocked: boolean;
}
