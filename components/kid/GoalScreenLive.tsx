"use client";

import type { ComponentProps } from "react";
import { GoalScreen } from "@/components/kid/GoalScreen";
import { useJarMove } from "@/components/kid/useJarMove";

/** The goal screen with real jar moves; lives in a client component because signing needs the device key. */
export function GoalScreenLive(props: Omit<ComponentProps<typeof GoalScreen>, "onMove">) {
  const onMove = useJarMove();
  return <GoalScreen {...props} onMove={onMove} />;
}
