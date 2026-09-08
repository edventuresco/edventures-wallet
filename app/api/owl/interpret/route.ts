import { z } from "zod";
import { interpretUtterance } from "@/lib/owl/intent";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Server-only intent endpoint: the Anthropic key never reaches the browser.
 * Returns an OwlIntent. Money-moving intents (propose_send / propose_save)
 * are proposals only — nothing here moves money.
 */
const ContactSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(80),
});

const ContextSchema = z.object({
  kidName: z.string().min(1).max(60),
  owlName: z.string().min(1).max(60),
  balanceDisplay: z.string().min(1).max(40),
  contacts: z.array(ContactSchema).max(100),
  jarBalanceDisplay: z.string().max(40).optional(),
  lastBlockedReason: z.string().max(300).optional(),
});

const BodySchema = z.object({
  text: z.string().min(1).max(500),
  context: ContextSchema,
});

export async function POST(request: Request) {
  if (!(await getUser())) {
    return Response.json({ error: "Sign in first" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const intent = await interpretUtterance(parsed.data);
  return Response.json(intent);
}
