"use client";

import { useCallback } from "react";
import { prepareJarMove, submitJarMove } from "@/app/kid/actions";
import { getOrCreateDeviceKey } from "@/lib/device/key";
import type { JarMoveKind } from "@/lib/family/jar-move";

export type JarMoveOutcome = { ok: true; explorerUrl?: string } | { ok: false; message: string };
export type JarMoveHandler = (from: JarMoveKind, to: JarMoveKind, dollars: string) => Promise<JarMoveOutcome>;

const ERR_UNEXPECTED = "That didn't go through, and nothing moved. Try again in a moment.";

/** The `onMove` for the goal screen: the server checks and prepares, this device signs, the server co-signs. */
export function useJarMove(): JarMoveHandler {
  return useCallback(async (from, to, dollars) => {
    try {
      const prepared = await prepareJarMove({ from, to, dollars });
      if (!prepared.ok) return prepared;
      const key = await getOrCreateDeviceKey();
      const signedTxBase64 = await key.signTransaction(prepared.txBase64);
      return await submitJarMove({ from, to, dollars, token: prepared.token, signedTxBase64 });
    } catch {
      return { ok: false, message: ERR_UNEXPECTED };
    }
  }, []);
}
