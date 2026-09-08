// Minimal EMVCo QR Code (VietQR) TLV parser. Reads just enough to show a
// hint before the server decode confirms it: whether the code is dynamic,
// its amount and currency, and a merchant label. Never treated as the
// source of truth — decodeQrUnregistered is; this only smooths the wait.
//
// Format: repeated {2-digit tag}{2-digit length}{value of that length},
// nested the same way inside template tags like 62 (Additional Data Field
// Template). Reference: EMVCo QR Code Specification for Payment Systems.

export interface VietQrSummary {
  /** Tag 01: "12" = dynamic (amount encoded), "11" = static (kid keys it in). */
  dynamic: boolean;
  /** Tag 54, when present and the QR is dynamic. */
  amount?: number;
  /** Tag 53, mapped from its ISO 4217 numeric code (704 = VND). */
  currency?: string;
  /** Tag 62, sub-tag 08 (purpose of transaction / reference label). */
  merchantLabel?: string;
}

interface TlvNode {
  tag: string;
  value: string;
}

const CURRENCY_NUMERIC: Record<string, string> = {
  "704": "VND",
};

/** Tokenizes one level of EMVCo TLV. Stops (rather than throws) on malformed input. */
function tokenizeTlv(payload: string): TlvNode[] {
  const nodes: TlvNode[] = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(lenStr)) break;
    const len = Number(lenStr);
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length < len) break;
    nodes.push({ tag, value });
    i += 4 + len;
  }
  return nodes;
}

function findTag(nodes: TlvNode[], tag: string): string | undefined {
  return nodes.find((node) => node.tag === tag)?.value;
}

export function parseVietQrSummary(qrString: string): VietQrSummary {
  const top = tokenizeTlv(qrString.trim());

  const dynamic = findTag(top, "01") === "12";

  const amountStr = findTag(top, "54");
  const amount = amountStr !== undefined && amountStr !== "" ? Number(amountStr) : undefined;

  const currencyCode = findTag(top, "53");
  const currency = currencyCode ? (CURRENCY_NUMERIC[currencyCode] ?? currencyCode) : undefined;

  const additionalData = findTag(top, "62");
  const merchantLabel = additionalData ? findTag(tokenizeTlv(additionalData), "08") : undefined;

  return {
    dynamic,
    amount: amount !== undefined && !Number.isNaN(amount) ? amount : undefined,
    currency,
    merchantLabel: merchantLabel || undefined,
  };
}
