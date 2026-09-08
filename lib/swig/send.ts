import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createTransferInstruction } from "@solana/spl-token";
import { fetchSwig, getSignInstructions, getSwigWalletAddress } from "@swig-wallet/classic";
import { sendTx } from "@/lib/solana/tx";

/**
 * A role authority (kid device key, keeper key) moves tokens out of the Swig
 * wallet. The authority signs; the fee payer pays. The authority never needs
 * SOL, which is the gasless guarantee.
 */
export async function sponsoredTokenTransfer(input: {
  connection: Connection;
  swigAddress: PublicKey;
  roleId: number;
  authority: Keypair;
  feePayer: Keypair;
  fromAta: PublicKey;
  toAta: PublicKey;
  amount: bigint;
}): Promise<string> {
  const swig = await fetchSwig(input.connection, input.swigAddress);
  const walletAddress = await getSwigWalletAddress(swig);
  const transfer = createTransferInstruction(
    input.fromAta,
    input.toAta,
    walletAddress,
    input.amount,
    [],
    TOKEN_PROGRAM_ID,
  );
  const ixs = await getSignInstructions(swig, input.roleId, [transfer], false, {
    payer: input.feePayer.publicKey,
  });
  return sendTx(input.connection, ixs, input.feePayer, [input.authority]);
}
