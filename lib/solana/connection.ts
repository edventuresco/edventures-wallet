import { Connection } from "@solana/web3.js";

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    const url = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    connection = new Connection(url, "confirmed");
  }
  return connection;
}
