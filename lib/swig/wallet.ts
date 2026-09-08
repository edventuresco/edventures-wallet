import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  Actions,
  Swig,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getSwigWalletAddress,
  getUpdateAuthorityInstructions,
  updateAuthorityAddActions,
} from "@swig-wallet/classic";
import { sendTx } from "@/lib/solana/tx";
import { rootActions } from "./actions";

/**
 * Create a Swig whose only role is `root` with full permissions. `payer`
 * funds rent and fees. Whether `root` must also sign is one of the spike's
 * questions: the parent's device key is the root and our fee payer is the
 * payer, so pass them separately and see.
 */
export async function createWallet(input: {
  connection: Connection;
  payer: Keypair;
  root: PublicKey;
  extraSigners?: Keypair[];
}): Promise<{ id: Uint8Array; swigAddress: PublicKey; walletAddress: PublicKey; signature: string }> {
  const id = new Uint8Array(32);
  crypto.getRandomValues(id);
  const swigAddress = findSwigPda(id);
  const ix = await getCreateSwigInstruction({
    payer: input.payer.publicKey,
    id,
    actions: rootActions(),
    authorityInfo: createEd25519AuthorityInfo(input.root),
  });
  const signature = await sendTx(input.connection, [ix], input.payer, input.extraSigners ?? []);
  const swig = await fetchSwig(input.connection, swigAddress);
  const walletAddress = await getSwigWalletAddress(swig);
  return { id, swigAddress, walletAddress, signature };
}

export async function loadWallet(connection: Connection, swigAddress: PublicKey): Promise<Swig> {
  return fetchSwig(connection, swigAddress);
}

/** The role `authority` holds on this Swig, or null when it holds none: the on-chain truth of "is this key on the wallet". */
export function roleIdOrNull(swig: Swig, authority: PublicKey): number | null {
  const role = swig.findRolesByEd25519SignerPk(authority)[0];
  return role ? role.id : null;
}

export function roleIdFor(swig: Swig, authority: PublicKey): number {
  const id = roleIdOrNull(swig, authority);
  if (id === null) throw new Error(`No role for authority ${authority.toBase58()}`);
  return id;
}

/** Root adds a limited role for `authority`. The fee payer pays; root signs. */
export async function addRole(input: {
  connection: Connection;
  swigAddress: PublicKey;
  root: Keypair;
  feePayer: Keypair;
  authority: PublicKey;
  actions: Actions;
}): Promise<{ roleId: number; signature: string }> {
  const swig = await fetchSwig(input.connection, input.swigAddress);
  const rootRoleId = roleIdFor(swig, input.root.publicKey);
  const ixs = await getAddAuthorityInstructions(
    swig,
    rootRoleId,
    createEd25519AuthorityInfo(input.authority),
    input.actions,
    { payer: input.feePayer.publicKey },
  );
  const signature = await sendTx(input.connection, ixs, input.feePayer, [input.root]);
  await swig.refetch();
  return { roleId: roleIdFor(swig, input.authority), signature };
}

/** Root appends actions to an existing role, e.g. a new whitelisted contact. */
export async function addActionsToRole(input: {
  connection: Connection;
  swigAddress: PublicKey;
  root: Keypair;
  feePayer: Keypair;
  roleId: number;
  actions: Actions;
}): Promise<string> {
  const swig = await fetchSwig(input.connection, input.swigAddress);
  const rootRoleId = roleIdFor(swig, input.root.publicKey);
  const ixs = await getUpdateAuthorityInstructions(
    swig,
    rootRoleId,
    input.roleId,
    updateAuthorityAddActions(input.actions),
    { payer: input.feePayer.publicKey },
  );
  return sendTx(input.connection, ixs, input.feePayer, [input.root]);
}
