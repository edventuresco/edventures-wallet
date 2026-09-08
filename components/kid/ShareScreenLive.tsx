"use client";

import type { ComponentProps } from "react";
import { ShareScreen } from "@/components/kid/ShareScreen";
import { useShareSend } from "@/components/kid/useShareSend";

/** The share screen with a real approved-share send; a client component because signing needs the device key. */
export function ShareScreenLive(props: Omit<ComponentProps<typeof ShareScreen>, "onShare">) {
  const onShare = useShareSend();
  return <ShareScreen {...props} onShare={onShare} />;
}
