// The words in a sign-in code email. Pure: the sender (lib/auth/send-code.ts)
// fills in the code and the kid's name; tests read the result.

export type CodeEmailInput = {
  code: string;
  /** Where to type the code: the app's /login, absolute. */
  loginUrl: string;
  /** Set for a kid's invite; the email then speaks to the kid. */
  kidName?: string;
};

export type CodeEmail = { subject: string; text: string; html: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Spaces the digits out so the code reads at a glance: 123456 -> 123 456,
 * 12345678 -> 1234 5678. The length is Supabase's OTP setting, not ours.
 */
export function displayCode(code: string): string {
  const digits = code.trim();
  if (digits.length < 6 || digits.length % 2 !== 0) return digits;
  const half = digits.length / 2;
  return `${digits.slice(0, half)} ${digits.slice(half)}`;
}

export function signInCodeEmail(input: CodeEmailInput): CodeEmail {
  const code = displayCode(input.code);
  const invite = Boolean(input.kidName);
  const subject = invite ? `${input.kidName}, your Edventures Wallet code is ${code}` : `Your Edventures Wallet code is ${code}`;
  const opening = invite
    ? `Hi ${input.kidName}! A grown-up in your family has invited you to Edventures Wallet.`
    : "Here's your code to sign in to Edventures Wallet.";
  const how = invite
    ? `Open ${input.loginUrl} on your own phone or tablet, type in this email address, and enter the code.`
    : `Enter it on the sign-in screen, or open ${input.loginUrl} if you closed it.`;
  const closing = "The code works once and expires soon. If you didn't ask for it, you can ignore this email.";

  const text = [opening, "", `Your code: ${code}`, "", how, "", closing, "", "Edventures Wallet"].join("\n");
  const html = [
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2a24;line-height:1.5">`,
    `<p style="margin:0 0 16px">${escapeHtml(opening)}</p>`,
    `<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:0.2em">${escapeHtml(code)}</p>`,
    `<p style="margin:0 0 16px">${escapeHtml(how).replace(escapeHtml(input.loginUrl), `<a href="${escapeHtml(input.loginUrl)}">${escapeHtml(input.loginUrl)}</a>`)}</p>`,
    `<p style="margin:0 0 16px;color:#5b665f">${escapeHtml(closing)}</p>`,
    `<p style="margin:0;color:#5b665f">Edventures Wallet</p>`,
    `</div>`,
  ].join("");
  return { subject, text, html };
}
