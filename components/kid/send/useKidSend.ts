"use client";

import { useCallback } from "react";
import { prepareKidSend, submitKidSend } from "@/app/kid/actions";
import { getOrCreateDeviceKey } from "@/lib/device/key";
import type { SendResult } from "./SendFlow";

const ERR_UNEXPECTED = "That didn't go through, and nothing was sent. Try again in a moment.";

/**
 * The `onSend` for `SendFlow`: the server decides and prepares, this device
 * signs, the server co-signs and sends. Pass the `requestId` of a guardian's
 * yes when the kid is sending what was approved, so it is marked used.
 */
export function useKidSend(requestId?: string) {
  return useCallback(
    async (contactId: string, dollars: string): Promise<SendResult> => {
      try {
        const prepared = await prepareKidSend({ contactId, dollars });
        if (!prepared.ok) return prepared;
        const key = await getOrCreateDeviceKey();
        const signedTxBase64 = await key.signTransaction(prepared.txBase64);
        return await submitKidSend({ token: prepared.token, signedTxBase64, contactId, dollars, requestId });
      } catch {
        return { ok: false, message: ERR_UNEXPECTED };
      }
    },
    [requestId],
  );
}
