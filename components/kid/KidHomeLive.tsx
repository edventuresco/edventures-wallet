"use client";

import type { ComponentProps } from "react";
import { KidHome, type ApprovedSend, type ApprovedShare } from "@/components/kid/KidHome";
import { useKidSend } from "@/components/kid/send/useKidSend";
import { useShareSend } from "@/components/kid/useShareSend";
import type { KidHomeView } from "@/lib/family/kid-home";

/**
 * The kid home with a real `onSend`: the server decides and prepares, this
 * device signs, the server co-signs. Lives in a client component because the
 * send hook needs the device key from IndexedDB.
 */
export function KidHomeLive({
  view,
  approvedSend,
  approvedShare,
  onNameOwl,
  onAskToAdd,
}: {
  view: KidHomeView;
  approvedSend?: ApprovedSend;
  approvedShare?: ApprovedShare;
  onNameOwl: (name: string) => Promise<{ ok: boolean }>;
  onAskToAdd?: ComponentProps<typeof KidHome>["onAskToAdd"];
}) {
  const onSend = useKidSend(approvedSend?.requestId);
  const onShare = useShareSend();
  return <KidHome view={view} onSend={onSend} approvedSend={approvedSend} onShare={onShare} approvedShare={approvedShare} onNameOwl={onNameOwl} onAskToAdd={onAskToAdd} />;
}
