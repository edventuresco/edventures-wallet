import { Transaction, VersionedTransaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getPublicKey,
  getDerivedPublicKey,
  signMessage as signMessageKeyring,
  signTransaction as signTransactionKeyring,
  isWalletInitialized,
  isWalletUnlocked,
  createWallet,
  unlock,
  getMnemonic,
} from "./keyring";

// HACKATHON MODE: Disable wallet lock checks
const HACKATHON_MODE = true;
import {
  connectOrigin,
  disconnectOrigin,
  isOriginConnected,
} from "./state";
import { RPC_METHODS } from "../shared/constants";
import * as SolanaRPC from "./solana-rpc";
import {
  requestConnectionApproval,
  requestTransactionApproval,
  handleApprovalResponse,
  getPendingApproval,
} from "./approvals";
import { AgentCoordinator } from "../services/agent-coordinator";
import { contextManager } from "../services/context-manager";

/**
 * RPC method router for background service worker
 *
 * Handles requests from content scripts and routes them to appropriate handlers.
 * Each method returns a result or throws an error.
 */

interface RPCRequest {
  channel: string;
  id: string;
  method: string;
  params?: any;
  origin?: string;
}

export async function handleRPC(request: RPCRequest): Promise<any> {
  const { method, params, origin } = request;

  console.log(`[RPC] ${method}`, { origin, params });

  // Route to handler
  switch (method) {
    case RPC_METHODS.CONNECT:
      return handleConnect(origin);

    case RPC_METHODS.DISCONNECT:
      return handleDisconnect(origin);

    case RPC_METHODS.GET_PUBLIC_KEY:
      return handleGetPublicKey(origin);

    case RPC_METHODS.SIGN_MESSAGE:
      return handleSignMessage(origin, params);

    case RPC_METHODS.SIGN_TRANSACTION:
      return handleSignTransaction(origin, params);

    case RPC_METHODS.SIGN_ALL_TRANSACTIONS:
      return handleSignAllTransactions(origin, params);

    case RPC_METHODS.CHECK_WALLET_INITIALIZED:
      return handleCheckWalletInitialized();

    case RPC_METHODS.CREATE_WALLET:
      return handleCreateWallet(params);

    case RPC_METHODS.UNLOCK_WALLET:
      return handleUnlockWallet(params);

    case RPC_METHODS.GET_MNEMONIC:
      return handleGetMnemonic(params);

    case RPC_METHODS.GET_BALANCE:
      return handleGetBalance(params);

    case RPC_METHODS.GET_ACCOUNT_INFO:
      return handleGetAccountInfo(params);

    case RPC_METHODS.GET_TOKEN_BALANCES:
      return handleGetTokenBalances(params);

    case RPC_METHODS.GET_RECENT_BLOCKHASH:
      return handleGetRecentBlockhash();

    case RPC_METHODS.SEND_TRANSACTION:
      return handleSendTransaction(params);

    case RPC_METHODS.TEST_CONNECTION:
      return handleTestConnection();

    case RPC_METHODS.SIMULATE_TRANSACTION:
      return handleSimulateTransaction(params);

    case RPC_METHODS.GET_FEE_ESTIMATE:
      return handleGetFeeEstimate(params);

    case RPC_METHODS.GET_TRANSACTION_HISTORY:
      return handleGetTransactionHistory(params);

    case RPC_METHODS.GET_FAMILY_ACCOUNTS:
      return handleGetFamilyAccounts();

    case "approvalResponse":
      return handleApprovalResponseMethod(params);

    case "approveConnection":
      return handleApproveConnection(request.id, params);

    case "approveTransaction":
      return handleApproveTransaction(request.id, params);

    case "getPendingApproval":
      return handleGetPendingApproval();

    case RPC_METHODS.AGENT_CHAT:
      return handleAgentChat(params);

    case RPC_METHODS.AGENT_CONFIRM_ACTION:
      return handleAgentConfirmAction(params);

    case RPC_METHODS.AGENT_GET_CONTEXT:
      return handleAgentGetContext();

    case RPC_METHODS.AGENT_CLEAR_CONTEXT:
      return handleAgentClearContext();

    default:
      throw new Error(`Unknown RPC method: ${method}`);
  }
}

/**
 * Connect wallet to origin
 */
async function handleConnect(origin?: string): Promise<{ publicKey: string }> {
  if (!origin) throw new Error("Origin is required");

  // Check if already connected
  if (isOriginConnected(origin)) {
    const publicKey = await getPublicKey();
    return { publicKey };
  }

  // Request user approval
  const approved = await requestConnectionApproval(origin);

  if (!approved) {
    throw new Error("User rejected connection request");
  }

  // Connect the origin
  await connectOrigin(origin);

  const publicKey = await getPublicKey();
  return { publicKey };
}

/**
 * Disconnect wallet from origin
 */
async function handleDisconnect(origin?: string): Promise<void> {
  if (!origin) throw new Error("Origin is required");
  await disconnectOrigin(origin);
}

/**
 * Get public key (requires connection)
 */
async function handleGetPublicKey(origin?: string): Promise<{ publicKey: string }> {
  if (!origin) throw new Error("Origin is required");
  if (!isOriginConnected(origin)) {
    throw new Error("Wallet not connected. Call connect() first.");
  }

  const publicKey = await getPublicKey();
  return { publicKey };
}

/**
 * Sign arbitrary message
 */
async function handleSignMessage(
  origin: string | undefined,
  params: { message: number[] }
): Promise<{ signature: string }> {
  if (!origin) throw new Error("Origin is required");
  if (!isOriginConnected(origin)) {
    throw new Error("Wallet not connected. Call connect() first.");
  }
  if (!params?.message) {
    throw new Error("Message is required");
  }

  // Convert array back to Uint8Array
  const message = new Uint8Array(params.message);

  // Sign the message
  const signature = await signMessageKeyring(message);

  // Return base64 signature
  return { signature: Buffer.from(signature).toString("base64") };
}

/**
 * Sign transaction
 */
async function handleSignTransaction(
  origin: string | undefined,
  params: { txBase64: string }
): Promise<{ signedTxBase64: string }> {
  if (!origin) throw new Error("Origin is required");
  if (!isOriginConnected(origin)) {
    throw new Error("Wallet not connected. Call connect() first.");
  }
  if (!params?.txBase64) {
    throw new Error("Transaction is required");
  }

  // Decode transaction
  const txBuffer = Buffer.from(params.txBase64, "base64");

  // Try to deserialize as legacy or versioned transaction
  let transaction: Transaction | VersionedTransaction;
  try {
    // Try VersionedTransaction first (newer format)
    transaction = VersionedTransaction.deserialize(txBuffer);
  } catch {
    // Fallback to legacy Transaction
    transaction = Transaction.from(txBuffer);
  }

  // Request user approval
  const from = await getPublicKey();
  const approved = await requestTransactionApproval(origin, {
    txBase64: params.txBase64,
    from,
  });

  if (!approved) {
    throw new Error("User rejected transaction");
  }

  // Get message bytes to sign
  let messageBytes: Uint8Array;
  if (transaction instanceof VersionedTransaction) {
    messageBytes = transaction.message.serialize();
  } else {
    messageBytes = transaction.serializeMessage();
  }

  // Sign transaction message
  // Note: signature is generated but not added to transaction in this demo
  // Production: properly add signature to transaction before serializing
  await signTransactionKeyring(messageBytes);

  // Return the transaction (demo: without signature properly added)
  // Production wallets need to properly add signatures before returning
  const signedTxBuffer = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
  return { signedTxBase64: Buffer.from(signedTxBuffer).toString("base64") };
}

/**
 * Sign multiple transactions
 */
async function handleSignAllTransactions(
  origin: string | undefined,
  params: { txsBase64: string[] }
): Promise<{ signedTxsBase64: string[] }> {
  if (!origin) throw new Error("Origin is required");
  if (!isOriginConnected(origin)) {
    throw new Error("Wallet not connected. Call connect() first.");
  }
  if (!params?.txsBase64 || !Array.isArray(params.txsBase64)) {
    throw new Error("Transactions array is required");
  }

  // Sign each transaction
  const signedTxsBase64 = await Promise.all(
    params.txsBase64.map(async (txBase64) => {
      const result = await handleSignTransaction(origin, { txBase64 });
      return result.signedTxBase64;
    })
  );

  return { signedTxsBase64 };
}

/**
 * Check if wallet is initialized
 */
async function handleCheckWalletInitialized(): Promise<{ initialized: boolean }> {
  const initialized = await isWalletInitialized();
  return { initialized };
}

/**
 * Create new wallet with password
 */
async function handleCreateWallet(params: { password: string }): Promise<{ mnemonic: string }> {
  if (!params?.password) {
    throw new Error("Password is required");
  }
  const mnemonic = await createWallet(params.password);
  return { mnemonic };
}

/**
 * Unlock existing wallet with password
 */
async function handleUnlockWallet(params: { password: string }): Promise<{ publicKey: string }> {
  if (!params?.password) {
    throw new Error("Password is required");
  }
  await unlock(params.password);
  const publicKey = await getPublicKey();
  return { publicKey };
}

/**
 * Get mnemonic (requires password verification)
 */
async function handleGetMnemonic(params: { password: string }): Promise<{ mnemonic: string }> {
  if (!params?.password) {
    throw new Error("Password is required");
  }
  const mnemonic = await getMnemonic(params.password);
  return { mnemonic };
}

/**
 * Get SOL balance for an address
 */
async function handleGetBalance(params: { address?: string }): Promise<{ balance: number }> {
  const address = params?.address || await getPublicKey();
  const balance = await SolanaRPC.getBalance(address);
  return { balance };
}

const MAYA_INDEX = 1;
const JAR_INDEX = 2;
const JAR_TARGET_SOL = 0.01;
const MAX_SEND_SOL = parseFloat(process.env.VITE_AGENT_MAX_TRANSACTION_SOL || "0.05") || 0.05;

async function handleGetFamilyAccounts(): Promise<{
  parent: string;
  maya: string;
  jar: string;
  jarTargetSol: number;
  mayaBalance: number;
  jarBalance: number;
}> {
  const parent = await getPublicKey();
  const maya = await getDerivedPublicKey(MAYA_INDEX);
  const jar = await getDerivedPublicKey(JAR_INDEX);
  const [mayaBalance, jarBalance] = await Promise.all([
    SolanaRPC.getBalance(maya),
    SolanaRPC.getBalance(jar),
  ]);
  return {
    parent,
    maya,
    jar,
    jarTargetSol: JAR_TARGET_SOL,
    mayaBalance,
    jarBalance,
  };
}

/**
 * Get account info for an address
 */
async function handleGetAccountInfo(params: { address?: string }): Promise<any> {
  const address = params?.address || await getPublicKey();
  const accountInfo = await SolanaRPC.getAccountInfo(address);
  return { accountInfo };
}

/**
 * Get SPL token balances for an address
 */
async function handleGetTokenBalances(params: { address?: string }): Promise<{ tokens: any[] }> {
  const address = params?.address || await getPublicKey();
  const tokens = await SolanaRPC.getTokenBalances(address);
  return { tokens };
}

/**
 * Get recent blockhash for transactions
 */
async function handleGetRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const result = await SolanaRPC.getRecentBlockhash();
  return result;
}

/**
 * Send a transaction (supports two modes)
 * 1. Broadcast pre-signed transaction: { serializedTransaction: string }
 * 2. Create, sign and send: { from, to, amount }
 */
async function handleSendTransaction(params: any): Promise<{ signature: string }> {
  // Mode 1: Broadcast pre-signed transaction
  if (params?.serializedTransaction) {
    const signature = await SolanaRPC.sendTransaction(params.serializedTransaction);
    return { signature };
  }

  // Mode 2: Create, sign, and send new transaction
  if (params?.from && params?.to && params?.amount !== undefined) {
    const from = params.from;
    const to = params.to;
    const amount = params.amount;

    if (typeof amount !== "number" || amount <= 0) {
      throw new Error("Amount must be a positive number");
    }
    if (amount > MAX_SEND_SOL) {
      throw new Error(`Send cap is ${MAX_SEND_SOL} SOL`);
    }

    // Create transaction
    const { blockhash } = await SolanaRPC.getRecentBlockhash();
    const fromPubkey = new PublicKey(from);
    const toPubkey = new PublicKey(to);
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: fromPubkey,
    }).add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    // Sign transaction
    const messageBytes = transaction.serializeMessage();
    const signature = await signTransactionKeyring(messageBytes);

    // Add signature to transaction
    transaction.addSignature(fromPubkey, Buffer.from(signature));

    // Serialize and broadcast
    const serialized = transaction.serialize();
    const txSignature = await SolanaRPC.sendTransaction(serialized.toString('base64'));

    return { signature: txSignature };
  }

  throw new Error("Invalid sendTransaction parameters. Provide either serializedTransaction or from/to/amount.");
}

/**
 * Test Solana RPC connection
 */
async function handleTestConnection(): Promise<{ connected: boolean }> {
  const connected = await SolanaRPC.testConnection();
  return { connected };
}

/**
 * Simulate a transaction to check for errors and estimate fees
 */
async function handleSimulateTransaction(params: {
  from: string;
  to: string;
  amount: number;
}): Promise<{ success: boolean; error?: any; fee?: number }> {
  if (!params?.from || !params?.to || params?.amount === undefined) {
    throw new Error("from, to, and amount are required");
  }

  // Create transaction for simulation
  const { blockhash } = await SolanaRPC.getRecentBlockhash();
  const fromPubkey = new PublicKey(params.from);
  const toPubkey = new PublicKey(params.to);
  const lamports = Math.floor(params.amount * LAMPORTS_PER_SOL);

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: fromPubkey,
  }).add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports,
    })
  );

  // Simulate transaction
  const simulation = await SolanaRPC.simulateTransaction(transaction);

  // Estimate fee from simulation
  let fee = 0.000005; // Default fee
  if (simulation.unitsConsumed) {
    // Typical Solana fee calculation
    fee = (simulation.unitsConsumed * 0.000001) || 0.000005;
  }

  return {
    success: simulation.success,
    error: simulation.error,
    fee,
  };
}

/**
 * Get estimated transaction fee
 */
async function handleGetFeeEstimate(params: { address: string }): Promise<{ fee: number }> {
  if (!params?.address) {
    throw new Error("Address is required");
  }

  const fee = await SolanaRPC.getFeeEstimate(params.address);
  return { fee };
}

/**
 * Get transaction history for an address
 */
async function handleGetTransactionHistory(params: { address?: string; limit?: number }): Promise<{ transactions: any[] }> {
  const address = params?.address || await getPublicKey();
  const limit = params?.limit || 10;
  const transactions = await SolanaRPC.getTransactionHistory(address, limit);
  return { transactions };
}

/**
 * Handle approval response from approval popup
 */
async function handleApprovalResponseMethod(params: {
  requestId: string;
  approved: boolean;
}): Promise<{ success: boolean }> {
  if (!params?.requestId) {
    throw new Error("Request ID is required");
  }

  handleApprovalResponse(params.requestId, params.approved);
  return { success: true };
}

/**
 * Handle connection approval from popup
 */
async function handleApproveConnection(
  requestId: string,
  params: { approved: boolean }
): Promise<{ success: boolean }> {
  if (!requestId) {
    throw new Error("Request ID is required");
  }

  handleApprovalResponse(requestId, params.approved);
  return { success: true };
}

/**
 * Handle transaction approval from popup
 */
async function handleApproveTransaction(
  requestId: string,
  params: { approved: boolean }
): Promise<{ success: boolean }> {
  if (!requestId) {
    throw new Error("Request ID is required");
  }

  handleApprovalResponse(requestId, params.approved);
  return { success: true };
}

/**
 * Get pending approval request
 */
async function handleGetPendingApproval(): Promise<{
  requestId: string;
  type: 'connection' | 'transaction';
  origin: string;
  data?: any;
} | null> {
  return getPendingApproval();
}

/**
 * Agent singleton instance
 */
let agentCoordinator: AgentCoordinator | null = null;

async function getAgentCoordinator(): Promise<AgentCoordinator> {
  // Security guard: Require wallet to be unlocked before creating agent
  // HACKATHON MODE: Skip wallet lock check
  if (!HACKATHON_MODE && !isWalletUnlocked()) {
    throw new Error('Wallet is locked. Please unlock your wallet before using the agent.');
  }

  if (!agentCoordinator) {
    // Initialize context manager
    await contextManager.init();

    // Get API key from environment or storage
    const apiKey = process.env.VITE_OPENAI_API_KEY || '';

    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY environment variable.');
    }

    agentCoordinator = new AgentCoordinator(
      {
        openaiApiKey: apiKey,
        model: process.env.VITE_OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxTokens: parseInt(process.env.VITE_OPENAI_MAX_TOKENS || '1500'),
        temperature: parseFloat(process.env.VITE_OPENAI_TEMPERATURE || '0.7'),
      },
      contextManager
    );
  }

  return agentCoordinator;
}

/**
 * Handle agent chat message
 */
async function handleAgentChat(params: { message: string; mode?: 'voice' | 'text'; tools?: any[] }): Promise<any> {
  console.log('[Agent] Processing message:', params.message);
  console.log('[Agent] Mode:', params.mode);
  console.log('[Agent] Tools passed:', params.tools?.length || 0);

  // Security guard: Require wallet to be unlocked before agent chat
  // HACKATHON MODE: Skip wallet lock check
  if (!HACKATHON_MODE && !isWalletUnlocked()) {
    throw new Error("Wallet is locked. Please unlock your wallet before using the agent.");
  }

  if (!params?.message) {
    throw new Error("Message is required");
  }

  try {
    console.log('[Agent] Getting coordinator...');
    const coordinator = await getAgentCoordinator();
    console.log('[Agent] Coordinator ready, processing message...');
    const response = await coordinator.processMessage(
      params.message,
      params.mode || 'text',
      params.tools  // Pass tools to coordinator
    );
    console.log('[Agent] Response:', response.text);
    return response;
  } catch (error: any) {
    console.error('[Agent] Error:', error);
    throw error;
  }
}

/**
 * Handle agent action confirmation
 */
async function handleAgentConfirmAction(params: { actionId: string; approved: boolean }): Promise<any> {
  // Security guard: Require wallet to be unlocked before confirming actions
  // HACKATHON MODE: Skip wallet lock check
  if (!HACKATHON_MODE && !isWalletUnlocked()) {
    throw new Error("Wallet is locked. Please unlock your wallet before using the agent.");
  }

  if (!params?.actionId) {
    throw new Error("Action ID is required");
  }

  const coordinator = await getAgentCoordinator();
  const response = await coordinator.confirmAction(params.actionId, params.approved);

  return response;
}

/**
 * Get agent conversation context
 */
async function handleAgentGetContext(): Promise<any> {
  await contextManager.init();
  const sessionInfo = contextManager.getSessionInfo();
  const preferences = contextManager.getPreferences();
  const walletCache = contextManager.getWalletCache();

  return {
    session: sessionInfo,
    preferences,
    walletCache,
  };
}

/**
 * Clear agent conversation context
 */
async function handleAgentClearContext(): Promise<{ success: boolean }> {
  await contextManager.clear();
  return { success: true };
}
