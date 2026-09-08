/**
 * Solana RPC Client for My Little Wallet
 *
 * Handles all Solana blockchain interactions using NOW_NODES API
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';

const TAG = ' | solana-rpc | ';

// Solana RPC configuration
// NOW_NODES_API is injected at build time from .env file
const NOW_NODES_API_KEY = process.env.NOW_NODES_API || '';
const ENV_RPC_URL = process.env.VITE_SOLANA_RPC_URL || '';
const DEFAULT_RPC_URL = ENV_RPC_URL
  || (NOW_NODES_API_KEY
    ? `https://sol.nownodes.io/${NOW_NODES_API_KEY}`
    : 'https://api.mainnet-beta.solana.com');

console.log(TAG, 'Initializing with RPC:', NOW_NODES_API_KEY ? 'NOW_NODES (authenticated)' : 'Public Solana RPC');

// Create Solana connection
let connection: Connection | null = null;

/**
 * Initialize the Solana RPC connection
 */
export function initSolanaRPC(customRpcUrl?: string): Connection {
  const rpcUrl = customRpcUrl || DEFAULT_RPC_URL;

  connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });

  console.log(TAG, 'Connection initialized');
  return connection;
}

/**
 * Get the current connection instance
 */
export function getConnection(): Connection {
  if (!connection) {
    connection = initSolanaRPC();
  }
  return connection;
}

/**
 * Get SOL balance for an address
 * @param address - Solana public key (base58 string)
 * @returns Balance in SOL
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    const balanceLamports = await conn.getBalance(publicKey);
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

    console.log(TAG, 'getBalance', { address, balance: balanceSOL });
    return balanceSOL;
  } catch (error: any) {
    console.error(TAG, 'getBalance error:', error.message);
    throw error;
  }
}

/**
 * Get account info for an address
 */
export async function getAccountInfo(address: string) {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);
    const accountInfo = await conn.getAccountInfo(publicKey);

    console.log(TAG, 'getAccountInfo', { address, exists: !!accountInfo });
    return accountInfo;
  } catch (error: any) {
    console.error(TAG, 'getAccountInfo error:', error.message);
    throw error;
  }
}

/**
 * Get recent blockhash for transactions
 */
export async function getRecentBlockhash() {
  try {
    const conn = getConnection();
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('finalized');

    console.log(TAG, 'getRecentBlockhash', { blockhash, lastValidBlockHeight });
    return { blockhash, lastValidBlockHeight };
  } catch (error: any) {
    console.error(TAG, 'getRecentBlockhash error:', error.message);
    throw error;
  }
}

/**
 * Send a signed transaction to the network
 * @param serializedTransaction - Base64 encoded signed transaction
 * @returns Transaction signature
 */
export async function sendTransaction(serializedTransaction: string): Promise<string> {
  try {
    const conn = getConnection();

    // Decode base64 to buffer
    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');

    // Send raw transaction
    const signature = await conn.sendRawTransaction(transactionBuffer, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(TAG, 'sendTransaction', { signature });
    return signature;
  } catch (error: any) {
    console.error(TAG, 'sendTransaction error:', error.message);
    throw error;
  }
}

/**
 * Confirm a transaction
 */
export async function confirmTransaction(signature: string) {
  try {
    const conn = getConnection();
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();

    const confirmation = await conn.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    console.log(TAG, 'confirmTransaction', { signature, confirmation });
    return confirmation;
  } catch (error: any) {
    console.error(TAG, 'confirmTransaction error:', error.message);
    throw error;
  }
}

/**
 * Get SPL token balances for an address
 */
export async function getTokenBalances(address: string) {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);

    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    });

    const balances = tokenAccounts.value.map((accountInfo) => {
      const parsedInfo = accountInfo.account.data.parsed.info;
      return {
        mint: parsedInfo.mint,
        owner: parsedInfo.owner,
        balance: parsedInfo.tokenAmount.uiAmount,
        decimals: parsedInfo.tokenAmount.decimals,
        uiAmountString: parsedInfo.tokenAmount.uiAmountString,
      };
    });

    console.log(TAG, 'getTokenBalances', { address, count: balances.length });
    return balances;
  } catch (error: any) {
    console.error(TAG, 'getTokenBalances error:', error.message);
    return [];
  }
}

/**
 * Get current block height (slot number)
 */
export async function getBlockHeight(): Promise<number> {
  try {
    const conn = getConnection();
    const slot = await conn.getSlot('finalized');

    console.log(TAG, 'getBlockHeight', { slot });
    return slot;
  } catch (error: any) {
    console.error(TAG, 'getBlockHeight error:', error.message);
    throw error;
  }
}

/**
 * Simulate a transaction to check for errors and estimate fees
 * Following Backpack pattern: simulate before approval
 * @param transaction - Unsigned transaction to simulate
 * @returns Simulation result with fee estimate and any errors
 */
export async function simulateTransaction(transaction: Transaction) {
  try {
    const conn = getConnection();

    // Simulate the transaction
    const simulation = await conn.simulateTransaction(transaction);

    console.log(TAG, 'simulateTransaction', {
      err: simulation.value.err,
      logs: simulation.value.logs,
      unitsConsumed: simulation.value.unitsConsumed,
    });

    return {
      success: !simulation.value.err,
      error: simulation.value.err,
      logs: simulation.value.logs || [],
      unitsConsumed: simulation.value.unitsConsumed || 0,
    };
  } catch (error: any) {
    console.error(TAG, 'simulateTransaction error:', error.message);
    throw error;
  }
}

/**
 * Get estimated fee for a transaction
 * Creates a sample transaction to estimate fees
 * @param fromAddress - Sender address
 * @param toAddress - Recipient address (optional, uses self if not provided)
 * @returns Estimated fee in SOL
 */
export async function getFeeEstimate(fromAddress: string, toAddress?: string): Promise<number> {
  try {
    const conn = getConnection();
    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey = toAddress ? new PublicKey(toAddress) : fromPubkey;

    // Create a simple transfer transaction to estimate fees
    const { blockhash } = await conn.getLatestBlockhash('finalized');

    const transaction = new Transaction({
      feePayer: fromPubkey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: 1, // Minimal amount for fee estimation
      })
    );

    // Get fee for transaction
    const fee = await conn.getFeeForMessage(transaction.compileMessage(), 'confirmed');

    if (fee.value === null) {
      // Fallback to typical fee
      const fallbackFee = 5000; // 5000 lamports ≈ 0.000005 SOL (typical fee)
      console.log(TAG, 'getFeeEstimate: using fallback fee', { fallbackFee });
      return fallbackFee / LAMPORTS_PER_SOL;
    }

    const feeLamports = fee.value;
    const feeSOL = feeLamports / LAMPORTS_PER_SOL;

    console.log(TAG, 'getFeeEstimate', { feeLamports, feeSOL });
    return feeSOL;
  } catch (error: any) {
    console.error(TAG, 'getFeeEstimate error:', error.message);
    // Return typical Solana transaction fee as fallback
    return 5000 / LAMPORTS_PER_SOL; // ~0.000005 SOL
  }
}

/**
 * Get transaction history for an address
 * @param address - Solana public key (base58 string)
 * @param limit - Maximum number of transactions to fetch (default: 10)
 * @returns Array of transaction details
 */
export async function getTransactionHistory(address: string, limit: number = 10) {
  try {
    const conn = getConnection();
    const publicKey = new PublicKey(address);

    // Get signatures for the address
    const signatures = await conn.getSignaturesForAddress(publicKey, { limit });

    console.log(TAG, 'getTransactionHistory: found signatures', { count: signatures.length });

    // Fetch parsed transaction details for each signature
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          const tx = await conn.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx) {
            return null;
          }

          // Extract transfer information
          let type = 'unknown';
          let amount = 0;
          let from = '';
          let to = '';

          // Look for system program transfers
          const instructions = tx.transaction.message.instructions;
          for (const ix of instructions) {
            if ('parsed' in ix && ix.program === 'system' && ix.parsed.type === 'transfer') {
              type = 'transfer';
              amount = (ix.parsed.info.lamports || 0) / LAMPORTS_PER_SOL;
              from = ix.parsed.info.source || '';
              to = ix.parsed.info.destination || '';
              break;
            }
          }

          return {
            signature: sig.signature,
            blockTime: sig.blockTime,
            slot: sig.slot,
            err: sig.err,
            type,
            amount,
            from,
            to,
            fee: tx.meta?.fee ? tx.meta.fee / LAMPORTS_PER_SOL : 0,
          };
        } catch (error: any) {
          console.error(TAG, 'Error parsing transaction:', sig.signature, error.message);
          return null;
        }
      })
    );

    // Filter out null transactions and return
    const validTransactions = transactions.filter((tx) => tx !== null);
    console.log(TAG, 'getTransactionHistory', { address, count: validTransactions.length });

    return validTransactions;
  } catch (error: any) {
    console.error(TAG, 'getTransactionHistory error:', error.message);
    throw error;
  }
}

/**
 * Test connection health
 */
export async function testConnection(): Promise<boolean> {
  try {
    const conn = getConnection();
    const slot = await conn.getSlot();
    console.log(TAG, 'testConnection success', { slot });
    return true;
  } catch (error: any) {
    console.error(TAG, 'testConnection failed:', error.message);
    return false;
  }
}
