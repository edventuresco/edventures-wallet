import { STORAGE_KEYS } from "../shared/constants";

/**
 * State manager for wallet session
 *
 * Tracks:
 * - Connected origins (which websites have wallet access)
 * - Session state (locked/unlocked - TODO for production)
 */

export interface WalletState {
  connectedOrigins: Set<string>;
  isLocked: boolean;
}

const state: WalletState = {
  connectedOrigins: new Set<string>(),
  isLocked: false, // Demo: always unlocked
};

/**
 * Load connected origins from storage on startup
 */
export async function initializeState(): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.CONNECTED_ORIGINS);
  if (stored[STORAGE_KEYS.CONNECTED_ORIGINS]) {
    state.connectedOrigins = new Set(stored[STORAGE_KEYS.CONNECTED_ORIGINS]);
    console.log("Loaded connected origins:", Array.from(state.connectedOrigins));
  }
}

/**
 * Save connected origins to storage
 */
async function saveConnectedOrigins(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CONNECTED_ORIGINS]: Array.from(state.connectedOrigins),
  });
}

/**
 * Check if origin is connected
 */
export function isOriginConnected(origin: string): boolean {
  return state.connectedOrigins.has(origin);
}

/**
 * Connect an origin (grant permission)
 */
export async function connectOrigin(origin: string): Promise<void> {
  state.connectedOrigins.add(origin);
  await saveConnectedOrigins();
  console.log(`Connected origin: ${origin}`);
}

/**
 * Disconnect an origin (revoke permission)
 */
export async function disconnectOrigin(origin: string): Promise<void> {
  state.connectedOrigins.delete(origin);
  await saveConnectedOrigins();
  console.log(`Disconnected origin: ${origin}`);
}

/**
 * Disconnect all origins
 */
export async function disconnectAll(): Promise<void> {
  state.connectedOrigins.clear();
  await saveConnectedOrigins();
  console.log("Disconnected all origins");
}

/**
 * Get all connected origins
 */
export function getConnectedOrigins(): string[] {
  return Array.from(state.connectedOrigins);
}

/**
 * Get current state (for debugging/UI)
 */
export function getState(): WalletState {
  return {
    connectedOrigins: new Set(state.connectedOrigins),
    isLocked: state.isLocked,
  };
}
