/**
 * What a Receive QR encodes: a Solana Pay transfer request for this wallet
 * and the family's dollar (the USDC mint), so a wallet app that scans it
 * knows where and what to send. Plain text of the address stays next to
 * it for anyone copying by hand.
 */
export function receiveUri(walletAddress: string, mint: string, label = "Edventures Wallet"): string {
  // Solana Pay wants percent-encoding (a space is %20); URLSearchParams would write "+".
  return `solana:${walletAddress}?spl-token=${encodeURIComponent(mint)}&label=${encodeURIComponent(label)}`;
}

/** "DxwK…usd1": enough of an address to recognise it, not enough to mistype. */
export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 4)}…${address.slice(-4)}`;
}
