export function GET() {
  return Response.json({
    ok: true,
    app: "edventures-wallet",
    policyEngine: process.env.POLICY_ENGINE ?? "mock",
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
  });
}
