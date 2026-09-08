import {
  Connection,
  Keypair,
  SendTransactionError,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export class TxError extends Error {
  constructor(
    message: string,
    public readonly logs: string[],
  ) {
    super(message);
    this.name = "TxError";
  }

  /** The program rejected the transaction (as opposed to the RPC dropping it). */
  get programRejected(): boolean {
    return this.logs.some((l) => /custom program error|failed:/i.test(l));
  }

  /** Swig's custom error code, e.g. 0xbd8, when the Swig program rejected it. */
  get swigErrorCode(): number | null {
    const line = this.logs.find((l) => l.includes("swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB failed"));
    const match = line?.match(/custom program error: 0x([0-9a-f]+)/i);
    return match ? parseInt(match[1], 16) : null;
  }
}

const TRANSIENT = /Blockhash not found|429|Too Many Requests|fetch failed|socket hang up|ECONNRESET|timed out/i;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send instructions with an explicit fee payer. `signers` are the other
 * required signatures (role authorities, mint authorities). On failure the
 * program logs travel with the error so callers can map them to reasons.
 */
export async function sendTx(
  connection: Connection,
  instructions: TransactionInstruction[],
  feePayer: Keypair,
  signers: Keypair[] = [],
): Promise<string> {
  const unique = [feePayer, ...signers.filter((s) => !s.publicKey.equals(feePayer.publicKey))];
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    // A fresh Transaction each attempt so a new blockhash is fetched.
    const tx = new Transaction().add(...instructions);
    tx.feePayer = feePayer.publicKey;
    try {
      return await sendAndConfirmTransaction(connection, tx, unique, { commitment: "confirmed" });
    } catch (error) {
      if (error instanceof SendTransactionError) {
        const logs = (await error.getLogs(connection).catch(() => null)) ?? error.logs ?? [];
        const wrapped = new TxError(error.message, logs);
        if (wrapped.programRejected) throw wrapped;
        lastError = wrapped;
      } else {
        lastError = error;
      }
      const message = (lastError as Error).message ?? "";
      if (!TRANSIENT.test(message) || attempt === 4) throw lastError;
      await delay(1500 * attempt);
    }
  }
  throw lastError;
}
