import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { createClient } from "@/lib/supabase/client";
import { whoseDevice, type DeviceOwner } from "./actions";
import { base64ToBytes, bytesToBase64 } from "./encoding";

// One key per account, kept in this browser's IndexedDB. Nothing deletes it:
// the key is the root of the account's wallets, and a root that is gone can
// never sign again. Signing out and back in finds the same key; a different
// account on the same browser gets its own.
const DB_NAME = "edventures-wallet";
const STORE = "device";
/** Before keys were per account, the one key lived here. */
const LEGACY_KEY_ID = "signing-key";
const keyIdFor = (userId: string) => `signing-key:${userId}`;

export type DeviceKey = {
  /** base58 public key: the authority we register on the wallet. */
  publicKey: string;
  /** Partially sign a server-built transaction (legacy or versioned); returns base64 of the signed wire bytes. */
  signTransaction(txBase64: string): Promise<string>;
};

const SECRET_LENGTH = 64;

export type StoredSecrets = {
  /** This account's own key, if it has one here. */
  mine: Uint8Array | undefined;
  /** The pre-per-account key, if this browser still has one. */
  legacy: Uint8Array | undefined;
};

export type SecretChoice =
  | { source: "mine"; secret: Uint8Array }
  /** The legacy key becomes this account's: stored under its id, and the legacy slot cleared. */
  | { source: "legacy"; secret: Uint8Array }
  | { source: "new" };

const usable = (secret: Uint8Array | undefined): secret is Uint8Array => secret !== undefined && secret.length === SECRET_LENGTH;

/**
 * Pure: which secret this account signs with. Its own when it has one. The
 * legacy key when that is free or already registered to this account (the
 * browser that set the wallet up keeps its root). Otherwise a new one, so
 * two accounts sharing a browser never share a key.
 */
export function chooseSecret(stored: StoredSecrets, legacyOwner: DeviceOwner | null): SecretChoice {
  if (usable(stored.mine)) return { source: "mine", secret: stored.mine };
  if (usable(stored.legacy) && (legacyOwner === "mine" || legacyOwner === "free")) return { source: "legacy", secret: stored.legacy };
  return { source: "new" };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, id: string): Promise<Uint8Array | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, id: string, value: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadSecret(userId: string): Promise<Uint8Array> {
  const db = await openDb();
  const mine = await idbGet(db, keyIdFor(userId));
  const legacy = usable(mine) ? undefined : await idbGet(db, LEGACY_KEY_ID);
  const legacyOwner = usable(legacy) ? await whoseDevice(Keypair.fromSecretKey(legacy).publicKey.toBase58()) : null;
  const choice = chooseSecret({ mine, legacy }, legacyOwner);
  if (choice.source === "mine") return choice.secret;
  const secret = choice.source === "legacy" ? choice.secret : nacl.sign.keyPair().secretKey;
  await idbPut(db, keyIdFor(userId), secret);
  if (choice.source === "legacy") await idbDelete(db, LEGACY_KEY_ID);
  return secret;
}

/** Loads the signed-in account's key on this device, creating it on first use. It never leaves the browser. */
export async function getOrCreateDeviceKey(): Promise<DeviceKey> {
  const { data } = await createClient().auth.getUser();
  if (!data.user) throw new Error("Sign in before using this device's key.");
  const keypair = Keypair.fromSecretKey(await loadSecret(data.user.id));
  return {
    publicKey: keypair.publicKey.toBase58(),
    async signTransaction(txBase64) {
      const bytes = base64ToBytes(txBase64);
      const versioned = VersionedTransaction.deserialize(bytes);
      if (versioned.version !== "legacy") {
        versioned.sign([keypair]);
        return bytesToBase64(versioned.serialize());
      }
      const tx = Transaction.from(bytes);
      tx.partialSign(keypair);
      return bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false })));
    },
  };
}

export function isValidPubkey(value: string): boolean {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}
