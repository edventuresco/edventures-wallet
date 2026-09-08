// Shared constants

export const CHANNEL = "my-little-wallet";

export const RPC_METHODS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  SIGN_MESSAGE: "signMessage",
  SIGN_TRANSACTION: "signTransaction",
  SIGN_ALL_TRANSACTIONS: "signAllTransactions",
  SIGN_AND_SEND_TRANSACTION: "signAndSendTransaction",
  GET_PUBLIC_KEY: "getPublicKey",

  // Wallet management methods
  CHECK_WALLET_INITIALIZED: "checkWalletInitialized",
  CREATE_WALLET: "createWallet",
  UNLOCK_WALLET: "unlockWallet",
  GET_MNEMONIC: "getMnemonic",

  // Solana RPC methods
  GET_BALANCE: "getBalance",
  GET_ACCOUNT_INFO: "getAccountInfo",
  GET_TOKEN_BALANCES: "getTokenBalances",
  GET_RECENT_BLOCKHASH: "getRecentBlockhash",
  SEND_TRANSACTION: "sendTransaction",
  TEST_CONNECTION: "testConnection",
  SIMULATE_TRANSACTION: "simulateTransaction",
  GET_FEE_ESTIMATE: "getFeeEstimate",
  GET_TRANSACTION_HISTORY: "getTransactionHistory",
  GET_FAMILY_ACCOUNTS: "getFamilyAccounts",

  // Agent methods
  AGENT_CHAT: "agentChat",
  AGENT_CONFIRM_ACTION: "agentConfirmAction",
  AGENT_GET_CONTEXT: "agentGetContext",
  AGENT_CLEAR_CONTEXT: "agentClearContext",
} as const;

export const STORAGE_KEYS = {
  VAULT: "encrypted_vault", // Encrypted wallet vault (AES-GCM)
  CONNECTED_ORIGINS: "connected_origins", // Approved dApp origins
  SETTINGS: "wallet_settings", // User settings (network, etc.)
  SESSION: "unlock_session", // Session data for persistent unlock
  AGENT_CONTEXT: "agent_context", // AI agent conversation context
  AGENT_SESSION: "agent_session", // AI agent session data
} as const;

// Session timeout: No timeout - session persists until browser close or explicit lock
// This constant is kept for backward compatibility but not actively used
export const SESSION_TIMEOUT_MS = Infinity;
