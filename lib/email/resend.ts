// Outbound email through Resend's HTTP API. Server-only: RESEND_API_KEY
// never reaches the browser. Plain fetch, no SDK: one endpoint, one shape.

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Edventures Wallet <wallet@edventures.co>";

export type OutboundEmail = { to: string; subject: string; text: string; html: string };
export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

/** The From header: RESEND_FROM when set, else the wallet's own address on edventures.co. */
export function emailFrom(): string {
  return (process.env.RESEND_FROM ?? "").trim() || DEFAULT_FROM;
}

export async function sendEmail(email: OutboundEmail): Promise<SendEmailResult> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: emailFrom(), to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) return { ok: false, error: body?.message ?? `Resend answered ${res.status}` };
    return { ok: true, id: body?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
