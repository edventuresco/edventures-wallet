"use server";

import type { ActionResult, ContactId, KidId, RequestId } from "@/components/parent/contract";

/**
 * Parent server actions. Every screen calls these; nothing in the UI talks to
 * Supabase or Solana directly. Until the backend lands they return a mock
 * success so screens can be built and demoed end to end.
 */

function mockOk(action: string, payload: unknown): ActionResult {
  console.info(`[actions:parent] ${action} (mock)`, payload);
  return { ok: true, mock: true };
}

export async function approveRequest(requestId: RequestId): Promise<ActionResult> {
  return mockOk("approveRequest", { requestId });
}

export async function declineRequest(requestId: RequestId): Promise<ActionResult> {
  return mockOk("declineRequest", { requestId });
}

export async function payAllowanceNow(kidId: KidId): Promise<ActionResult> {
  return mockOk("payAllowanceNow", { kidId });
}

/** Daily ceiling across all recipients. Takes effect immediately (sponsor-enforced). */
export async function setDailyLimit(kidId: KidId, dollars: string): Promise<ActionResult> {
  return mockOk("setDailyLimit", { kidId, dollars });
}

export async function setContactWeeklyLimit(
  kidId: KidId,
  contactId: ContactId,
  dollars: string,
): Promise<ActionResult> {
  return mockOk("setContactWeeklyLimit", { kidId, contactId, dollars });
}

export async function addContact(
  kidId: KidId,
  input: { label: string; address: string; weeklyLimitDollars: string },
): Promise<ActionResult> {
  return mockOk("addContact", { kidId, ...input });
}

export async function removeContact(kidId: KidId, contactId: ContactId): Promise<ActionResult> {
  return mockOk("removeContact", { kidId, contactId });
}
