/**
 * Prove mainnet RPC is reachable. Does not send SOL.
 * Usage: node scripts/prove-mainnet-rpc.js
 */
const { Connection } = require("@solana/web3.js");
require("dotenv").config();

const url = process.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

async function main() {
  const connection = new Connection(url, "confirmed");
  const version = await connection.getVersion();
  const epoch = await connection.getEpochInfo();
  const { blockhash } = await connection.getLatestBlockhash("finalized");
  console.log(JSON.stringify({
    ok: true,
    rpc: url,
    version,
    epoch: epoch.epoch,
    blockhash: blockhash.slice(0, 12) + "...",
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
