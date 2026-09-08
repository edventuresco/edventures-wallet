"use client";

import { useCallback } from "react";
import { prepareShareSend, submitShareSend } from "@/app/kid/actions";
import { getOrCreateDeviceKey } from "@/lib/device/key";
import type { SendResult } from "@/components/kid/send/SendFlow";

const ERR_UNEXPECTED = "That didn't go through, and nothing was shared. Try again in a moment.";

/** The `onSend` for a share: the server checks the guardian's yes and prepares, this device signs, the server co-signs. */
export function useShareSend() {
  return useCallback(async (contactId: string, dollars: string): Promise<SendResult> => {
    try {
      const prepared = await prepareShareSend({ contactId, dollars });
      if (!prepared.ok) return prepared;
      const key = await getOrCreateDeviceKey();
      const signedTxBase64 = await key.signTransaction(prepared.txBase64);
      return await submitShareSend({ token: prepared.token, signedTxBase64, contactId, dollars });
    } catch {
      return { ok: false, message: ERR_UNEXPECTED };
    }
  }, []);
}
