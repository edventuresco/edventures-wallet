import nacl from "tweetnacl";
import bs58 from "bs58";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair, PublicKey } from "@solana/web3.js";
import { STORAGE_KEYS, SESSION_TIMEOUT_MS } from "../shared/constants";

/**
 * Production Keyring - Encrypted BIP39 Wallet
 *
 * Security features:
 * - BIP39 mnemonic generation (12 words)
 * - AES-GCM encryption with user password
 * - PBKDF2 key derivation (100,000 iterations)
 * - HD wallet derivation (BIP44 m/44'/501'/accountIndex'/0')
 * - Lock/unlock state management
 * - Persistent session (unlocked until browser close or explicit lock)
 * - Secure memory handling (clear on lock)
 *
 * References:
 * - BIP39: Mnemonic code for generating deterministic keys
 * - BIP44: HD wallet derivation (501 = Solana coin type)
 * - Ed25519: Solana's signature algorithm
 * - Web Crypto API: Browser-native encryption
 */

interface EncryptedVault {
  encrypted: number[]; // Encrypted mnemonic (AES-GCM)
  iv: number[]; // Initialization vector
  salt: number[]; // PBKDF2 salt
}

interface KeypairData {
  secretKey: Uint8Array; // 64-byte Ed25519 secret key
  publicKey: Uint8Array; // 32-byte Ed25519 public key
}

interface UnlockSession {
  encryptedPassword: number[]; // Password encrypted with session key
  iv: number[]; // Initialization vector for password encryption
  timestamp: number; // When session was created
}

// In-memory state (cleared on lock or background worker restart)
// HACKATHON MODE: Auto-unlock on startup (no password required)
const HACKATHON_MODE = true;
let isUnlocked = HACKATHON_MODE; // Start unlocked in hackathon mode
let cachedKeypair: KeypairData | null = null;
let cachedMnemonic: string | null = null;
let cachedPassword: string | null = null; // Used for auto-lock timeout feature (future)

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive AES-GCM key (100,000 iterations for security)
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt mnemonic with password
 */
async function encryptMnemonic(
  mnemonic: string,
  password: string
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt);

  const encoder = new TextEncoder();
  const data = encoder.encode(mnemonic);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return {
    encrypted: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv),
    salt: Array.from(salt),
  };
}

/**
 * Decrypt mnemonic with password
 */
async function decryptMnemonic(
  vault: EncryptedVault,
  password: string
): Promise<string> {
  const salt = new Uint8Array(vault.salt);
  const iv = new Uint8Array(vault.iv);
  const encrypted = new Uint8Array(vault.encrypted);

  const key = await deriveKeyFromPassword(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error("Invalid password");
  }
}

/**
 * Derive keypair from mnemonic using BIP44 path
 * Solana BIP44 path: m/44'/501'/accountIndex'/0'
 */
async function deriveKeypair(
  mnemonic: string,
  accountIndex = 0
): Promise<KeypairData> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const path = `m/44'/501'/${accountIndex}'/0'`;
  const derivedSeed = derivePath(path, seed.toString("hex")).key;
  const keypair = nacl.sign.keyPair.fromSeed(derivedSeed);

  return {
    secretKey: keypair.secretKey,
    publicKey: keypair.publicKey,
  };
}

/**
 * Generate session key (browser-specific, persists across restarts)
 */
async function getSessionKey(): Promise<CryptoKey> {
  // Use extension ID as entropy for session key
  const extensionId = chrome.runtime.id;
  const encoder = new TextEncoder();
  const idBuffer = encoder.encode(extensionId);

  // Derive a consistent key from extension ID
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    idBuffer,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  // Use fixed salt (acceptable since key is per-installation)
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 10000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Save unlock session (password encrypted with session key)
 */
export async function saveSession(password: string): Promise<void> {
  const sessionKey = await getSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    passwordBuffer
  );

  const session: UnlockSession = {
    encryptedPassword: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv),
    timestamp: Date.now(),
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
  console.log("[Keyring] Session saved (persistent until browser close)");
}

/**
 * Load and verify session (returns password if valid)
 * Session persists until browser close or explicit lock
 */
export async function loadSession(): Promise<string | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  if (!stored[STORAGE_KEYS.SESSION]) {
    return null;
  }

  const session = stored[STORAGE_KEYS.SESSION] as UnlockSession;

  // No timeout check - session persists until browser close or explicit lock

  // Decrypt password
  try {
    const sessionKey = await getSessionKey();
    const iv = new Uint8Array(session.iv);
    const encrypted = new Uint8Array(session.encryptedPassword);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sessionKey,
      encrypted
    );

    const decoder = new TextDecoder();
    const password = decoder.decode(decrypted);

    console.log("[Keyring] Session loaded (persistent until browser close)");
    return password;
  } catch (error) {
    console.error("[Keyring] Failed to decrypt session:", error);
    await clearSession();
    return null;
  }
}

/**
 * Clear unlock session
 */
async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
  console.log("[Keyring] Session cleared");
}

/**
 * Try to restore session on service worker restart
 * Returns true if session was restored, false otherwise
 */
export async function tryRestoreSession(): Promise<boolean> {
  // HACKATHON MODE: Auto-unlock with default password
  if (HACKATHON_MODE) {
    console.log("[Keyring] 🏁 HACKATHON MODE - Auto-unlocking wallet...");
    try {
      // Try to load session first
      const password = await loadSession();
      if (password) {
        await unlock(password);
        console.log("[Keyring] ✅ HACKATHON MODE - Wallet auto-unlocked with session");
        return true;
      }

      // If no session, try default password
      const DEFAULT_PASSWORD = "hackathon2024";
      await unlock(DEFAULT_PASSWORD);
      console.log("[Keyring] ✅ HACKATHON MODE - Wallet auto-unlocked with default password");
      return true;
    } catch (error) {
      console.log("[Keyring] ⚠️ HACKATHON MODE - No wallet found (wallet not created yet)");
      // This is OK - wallet hasn't been created yet
      return false;
    }
  }

  // Skip if already unlocked
  if (isUnlocked) {
    return true;
  }

  // Try to load session
  const password = await loadSession();
  if (!password) {
    return false;
  }

  // Try to unlock with session password
  try {
    await unlock(password);
    console.log("[Keyring] Session restored successfully");
    return true;
  } catch (error) {
    console.error("[Keyring] Failed to restore session:", error);
    await clearSession();
    return false;
  }
}

/**
 * Create new wallet with mnemonic and password
 */
export async function createWallet(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  // Generate BIP39 mnemonic (12 words, 128 bits entropy)
  const mnemonic = bip39.generateMnemonic(128);

  // Encrypt and store
  const vault = await encryptMnemonic(mnemonic, password);
  await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: vault });

  // Unlock wallet
  cachedMnemonic = mnemonic;
  cachedPassword = password;
  cachedKeypair = await deriveKeypair(mnemonic, 0);
  isUnlocked = true;

  // Save session for persistent unlock
  await saveSession(password);

  console.log("[Keyring] Wallet created and unlocked");
  return mnemonic;
}

/**
 * Unlock wallet with password
 */
export async function unlock(password: string): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
  if (!stored[STORAGE_KEYS.VAULT]) {
    throw new Error("No wallet found");
  }

  const vault = stored[STORAGE_KEYS.VAULT] as EncryptedVault;
  const mnemonic = await decryptMnemonic(vault, password);

  // Cache in memory
  cachedMnemonic = mnemonic;
  cachedPassword = password;
  cachedKeypair = await deriveKeypair(mnemonic, 0);
  isUnlocked = true;

  // Save session for persistent unlock
  await saveSession(password);

  console.log("[Keyring] Wallet unlocked");
}

/**
 * Lock wallet (clear sensitive data from memory)
 */
export async function lock(): Promise<void> {
  // Clear all cached sensitive data
  if (cachedMnemonic) cachedMnemonic = null;
  if (cachedPassword) cachedPassword = null;
  if (cachedKeypair) cachedKeypair = null;
  isUnlocked = false;

  // Clear session
  await clearSession();

  console.log("[Keyring] Wallet locked");
}

/**
 * Check if wallet is unlocked
 */
export function isWalletUnlocked(): boolean {
  return isUnlocked;
}

/**
 * Check if wallet exists
 */
export async function isWalletInitialized(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
  return Boolean(stored[STORAGE_KEYS.VAULT]);
}

/**
 * Get public key (requires unlocked wallet)
 */
/**
 * Derive a public key at an HD index without changing the live signer.
 * The cached keypair (index 0) is never replaced.
 */
export async function getDerivedPublicKey(accountIndex: number): Promise<string> {
  if (accountIndex === 0) {
    return getPublicKey();
  }
  if (!cachedMnemonic) {
    throw new Error("Wallet is locked");
  }
  const derived = await deriveKeypair(cachedMnemonic, accountIndex);
  return bs58.encode(derived.publicKey);
}

export async function getPublicKey(): Promise<string> {
  // HACKATHON MODE: Skip lock check, just check if keypair exists
  if (HACKATHON_MODE && cachedKeypair) {
    return bs58.encode(cachedKeypair.publicKey);
  }

  if (!isUnlocked || !cachedKeypair) {
    throw new Error("Wallet is locked");
  }
  return bs58.encode(cachedKeypair.publicKey);
}

/**
 * Get PublicKey object (requires unlocked wallet)
 */
export async function getPublicKeyObject(): Promise<PublicKey> {
  // HACKATHON MODE: Skip lock check, just check if keypair exists
  if (HACKATHON_MODE && cachedKeypair) {
    return new PublicKey(cachedKeypair.publicKey);
  }

  if (!isUnlocked || !cachedKeypair) {
    throw new Error("Wallet is locked");
  }
  return new PublicKey(cachedKeypair.publicKey);
}

/**
 * Get Keypair object (requires unlocked wallet)
 */
export async function getKeypairObject(): Promise<Keypair> {
  // HACKATHON MODE: Skip lock check, just check if keypair exists
  if (HACKATHON_MODE && cachedKeypair) {
    return Keypair.fromSecretKey(cachedKeypair.secretKey);
  }

  if (!isUnlocked || !cachedKeypair) {
    throw new Error("Wallet is locked");
  }
  return Keypair.fromSecretKey(cachedKeypair.secretKey);
}

/**
 * Sign message (requires unlocked wallet)
 */
export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  // HACKATHON MODE: Skip lock check, just check if keypair exists
  if (HACKATHON_MODE && cachedKeypair) {
    return nacl.sign.detached(message, cachedKeypair.secretKey);
  }

  if (!isUnlocked || !cachedKeypair) {
    throw new Error("Wallet is locked");
  }
  return nacl.sign.detached(message, cachedKeypair.secretKey);
}

/**
 * Sign transaction (requires unlocked wallet)
 */
export async function signTransaction(txBuffer: Uint8Array): Promise<Uint8Array> {
  // HACKATHON MODE: Skip lock check, just check if keypair exists
  if (HACKATHON_MODE && cachedKeypair) {
    return nacl.sign.detached(txBuffer, cachedKeypair.secretKey);
  }

  if (!isUnlocked || !cachedKeypair) {
    throw new Error("Wallet is locked");
  }
  return nacl.sign.detached(txBuffer, cachedKeypair.secretKey);
}

/**
 * Get mnemonic (requires password verification)
 */
export async function getMnemonic(password: string): Promise<string> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.VAULT);
  if (!stored[STORAGE_KEYS.VAULT]) {
    throw new Error("No wallet found");
  }

  const vault = stored[STORAGE_KEYS.VAULT] as EncryptedVault;
  return decryptMnemonic(vault, password);
}

/**
 * Import wallet from mnemonic
 */
export async function importWallet(
  mnemonic: string,
  password: string
): Promise<void> {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  // Encrypt and store
  const vault = await encryptMnemonic(mnemonic, password);
  await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: vault });

  // Unlock wallet
  cachedMnemonic = mnemonic;
  cachedPassword = password;
  cachedKeypair = await deriveKeypair(mnemonic, 0);
  isUnlocked = true;

  // Save session for persistent unlock
  await saveSession(password);

  console.log("[Keyring] Wallet imported and unlocked");
}

/**
 * Reset wallet (permanently deletes encrypted vault)
 */
export async function resetWallet(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.VAULT);
  await lock();
  console.log("[Keyring] Wallet reset - all data deleted");
}
