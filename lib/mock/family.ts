import type { FamilyOverviewProps, KidSummary } from "@/components/parent/contract";
import { dollarsToUnits, toView } from "@/lib/money/usdc";

/**
 * Fixture family for building screens. Placeholder names only; nothing here
 * is a real person or a real address.
 */

const money = (dollars: string) => toView(dollarsToUnits(dollars));
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
const agoHours = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

const kidOne: KidSummary = {
  id: "kid_one",
  name: "Alex",
  icon: "otter",
  ageBand: "9-11",
  balance: money("7.50"),
  savings: { balance: money("12.00"), goalTitle: "Headphones", goalTarget: money("40.00") },
  allowance: { amount: money("5.00"), cadence: "weekly", nextRunISO: inDays(3) },
  rules: {
    dailyLimit: money("10.00"),
    sentToday: money("2.00"),
    weeklyTotal: money("10.00"),
    people: [
      { id: "c_parent", label: "Mum", icon: "parent", weeklyLimit: money("5.00"), status: "active", onchainSynced: true },
      { id: "c_sib", label: "Sam", icon: "bunny", weeklyLimit: money("3.00"), status: "active", onchainSynced: true },
      { id: "c_gran", label: "Grandma", icon: "person", weeklyLimit: money("2.00"), status: "active", onchainSynced: true },
    ],
    apps: [],
    lines: ["$5.00 every Monday", "Can send to Mum, Sam, Grandma", "Up to $10.00 a day"],
  },
  lastEvent: {
    id: "e1",
    kidId: "kid_one",
    kind: "saved",
    summary: "You put $2.00 in your jar",
    amount: money("2.00"),
    occurredAtISO: agoHours(5),
  },
};

const kidTwo: KidSummary = {
  id: "kid_two",
  name: "Sam",
  icon: "bunny",
  ageBand: "6-8",
  balance: money("3.25"),
  allowance: { amount: money("3.00"), cadence: "weekly", nextRunISO: inDays(3) },
  rules: {
    dailyLimit: money("5.00"),
    sentToday: money("0.00"),
    weeklyTotal: money("5.00"),
    people: [
      { id: "c_parent2", label: "Mum", icon: "parent", weeklyLimit: money("3.00"), status: "active", onchainSynced: true },
      { id: "c_sib2", label: "Alex", icon: "otter", weeklyLimit: money("2.00"), status: "active", onchainSynced: true },
      { id: "c_req", label: "Grandma", icon: "person", weeklyLimit: money("2.00"), status: "requested", onchainSynced: false },
    ],
    apps: [],
    lines: ["$3.00 every Monday", "Can send to Mum, Alex", "Up to $5.00 a day"],
  },
  lastEvent: {
    id: "e2",
    kidId: "kid_two",
    kind: "blocked",
    summary: "Grandma isn't on your list yet. You asked Mum to add her.",
    occurredAtISO: agoHours(1),
  },
};

export function getMockFamily(): FamilyOverviewProps {
  return {
    familyName: "The Demo Family",
    kids: [kidOne, kidTwo],
    pendingRequests: [
      {
        id: "req_1",
        kidId: "kid_two",
        kidName: "Sam",
        type: "add_contact",
        summary: "Sam wants to add Grandma to their list",
        createdAtISO: agoHours(1),
        status: "pending",
      },
    ],
  };
}
