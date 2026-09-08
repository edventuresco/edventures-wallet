// HMAC-SHA256 for Sqril webhooks. Per the docs (2026-09-07):
//   X-SQRIL-Signature = base64(HMAC-SHA256(webhook_secret, exact_raw_request_body))
// Web Crypto only, so it runs in Node route handlers and edge runtimes alike.

const encoder = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  // Accept standard and URL-safe alphabets; reject anything else.
  const normalised = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalised)) return null;
  try {
    const binary = atob(normalised);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Sign a raw body the way Sqril does; used by tests and the mock webhook firer. */
export async function signWebhookBody(secret: string, rawBody: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return bytesToBase64(new Uint8Array(sig));
}

/** Verify X-SQRIL-Signature against the exact raw body. Constant-time via WebCrypto. */
export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!signature) return false;
  const bytes = base64ToBytes(signature);
  if (!bytes || bytes.length !== 32) return false;
  const key = await importKey(secret);
  return crypto.subtle.verify("HMAC", key, bytes as BufferSource, encoder.encode(rawBody));
}
