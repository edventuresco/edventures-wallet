import Anthropic from "@anthropic-ai/sdk";

/**
 * The owl is the kid's helper: it answers questions out loud and in text,
 * and can *propose* a send or a save, but money never moves from voice
 * alone — the kid always confirms a proposal on screen. See
 * docs/design/EDVENTURES-WALLET-UI-SPEC.md §1 and §4 (LessonCard / owl guidance).
 */

export type OwlContext = {
  kidName: string;
  owlName: string;
  balanceDisplay: string;
  contacts: Array<{ id: string; label: string }>;
  jarBalanceDisplay?: string;
  lastBlockedReason?: string;
};

export type OwlIntent =
  | { kind: "say"; text: string }
  | { kind: "propose_send"; contactId: string; dollars: string; say: string }
  | { kind: "propose_save"; dollars: string; say: string }
  | { kind: "explain_blocked"; text: string };

/**
 * Fast, capable-enough model for a single-turn intent classification with
 * at most one tool call. See the claude-api skill: intent extraction from a
 * short kid utterance doesn't need Opus-tier reasoning, and low latency
 * matters for a voice UI.
 */
const MODEL_ID = "claude-sonnet-5";
const MAX_SAY_LENGTH = 300;

const DOLLAR_AMOUNT_RE = /^\d+(?:\.\d{1,2})?$/;

function isValidDollarAmount(value: string): boolean {
  return DOLLAR_AMOUNT_RE.test(value.trim());
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function fallbackSay(context: OwlContext): { kind: "say"; text: string } {
  return {
    kind: "say",
    text: `I didn't quite get that, ${context.kidName}. Try asking about your balance, sending, or saving.`,
  };
}

/**
 * Deterministic rule-based interpreter, used when ANTHROPIC_API_KEY is
 * missing (or the API call fails) so the app still works without keys.
 * Handles: "how much...", "send $X to NAME", "save $X" / "put $X in my jar",
 * and "why didn't that work".
 */
const BLOCKED_RE = /\bwhy\s+(?:didn'?t|did\s+not|can'?t|cannot|won'?t|wouldn'?t)\s+(?:that|it|this)?\s*work\b/i;
const BALANCE_RE = /how much/i;
const SEND_RE = /\bsend\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:dollars?)?\s+to\s+([a-z][a-z\s'-]*)/i;
const SAVE_RE = /\b(?:save|put)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:dollars?)?(?:\s+(?:in|into)\s+(?:my\s+)?(?:jar|savings))?/i;

export function interpretWithRules(text: string, context: OwlContext): OwlIntent {
  const trimmed = text.trim();

  if (!trimmed) {
    return fallbackSay(context);
  }

  if (BLOCKED_RE.test(trimmed)) {
    return {
      kind: "explain_blocked",
      text: context.lastBlockedReason ?? "I don't see a reason on file — ask a grown-up to check your rules.",
    };
  }

  if (BALANCE_RE.test(trimmed)) {
    return { kind: "say", text: `You have ${context.balanceDisplay}.` };
  }

  const sendMatch = trimmed.match(SEND_RE);
  if (sendMatch) {
    const dollars = sendMatch[1];
    const name = sendMatch[2].trim().replace(/[.!?]+$/, "");
    const contact = context.contacts.find((c) => c.label.toLowerCase() === name.toLowerCase());
    if (!contact) {
      return { kind: "say", text: `${name} isn't on your list yet.` };
    }
    return {
      kind: "propose_send",
      contactId: contact.id,
      dollars,
      say: `Send $${dollars} to ${contact.label}?`,
    };
  }

  const saveMatch = trimmed.match(SAVE_RE);
  if (saveMatch) {
    const dollars = saveMatch[1];
    return { kind: "propose_save", dollars, say: `Put $${dollars} in your jar?` };
  }

  return fallbackSay(context);
}

function buildSystemPrompt(context: OwlContext): string {
  const contactList = context.contacts.length > 0 ? context.contacts.map((c) => c.label).join(", ") : "(nobody yet)";
  const lines = [
    `You are ${context.owlName}, a friendly owl helper inside a kids' money app called Edventures Wallet.`,
    `You're talking with ${context.kidName}. Answer in one short, warm sentence. No jargon. Always say amounts in plain dollars, never in code or symbols.`,
    `${context.kidName}'s balance is ${context.balanceDisplay}.`,
    context.jarBalanceDisplay ? `Their savings jar has ${context.jarBalanceDisplay}.` : null,
    `Sending or saving money only proposes the action — ${context.kidName} still confirms it on screen. Money never moves just because you said so.`,
    `Never invent a contact. The only people ${context.kidName} can send to are: ${contactList}. If the person named is not on that list, call explain and say they're not on the list yet.`,
    context.lastBlockedReason ? `If asked why something didn't work, the reason on file is: ${context.lastBlockedReason}.` : null,
    "Always call exactly one tool that best matches what they said.",
  ];
  return lines.filter((line): line is string => Boolean(line)).join(" ");
}

function buildTools(context: OwlContext): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [
    {
      name: "get_balance",
      description:
        "Answer when the kid asks how much money they have, their balance, or what's in their wallet or savings. Takes no arguments.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];

  if (context.contacts.length > 0) {
    tools.push({
      name: "send_to_contact",
      description:
        "Use only when the kid asks to send, pay, give, or transfer money to a person who is in their contacts list. Never call this for someone who is not in the list — use explain instead.",
      input_schema: {
        type: "object",
        properties: {
          contactId: {
            type: "string",
            enum: context.contacts.map((c) => c.id),
            description: "The id of the matching contact from the contacts list.",
          },
          dollars: {
            type: "string",
            description: 'Dollar amount as a plain number string, e.g. "2" or "2.50". No dollar sign.',
          },
          say: {
            type: "string",
            description: 'One short, warm sentence confirming what will happen, e.g. "Send $2 to Grandma?"',
          },
        },
        required: ["contactId", "dollars", "say"],
        additionalProperties: false,
      },
    });
  }

  tools.push(
    {
      name: "add_to_savings",
      description: "Use when the kid asks to save money, put money in their jar or savings, or set money aside.",
      input_schema: {
        type: "object",
        properties: {
          dollars: {
            type: "string",
            description: 'Dollar amount as a plain number string, e.g. "3". No dollar sign.',
          },
          say: {
            type: "string",
            description: 'One short, warm sentence confirming the save, e.g. "Put $3 in your jar?"',
          },
        },
        required: ["dollars", "say"],
        additionalProperties: false,
      },
    },
    {
      name: "explain",
      description:
        "Use for anything else: greetings, general questions, thanks, or explaining why a recent money action didn't work. Also use this when a named person is not in the kid's contacts list. Always one short, warm sentence.",
      input_schema: {
        type: "object",
        properties: {
          text: { type: "string", description: "One short sentence to say to the kid." },
          blocked: {
            type: "boolean",
            description: "True only when explaining why a recent money action was blocked by a family rule.",
          },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
  );

  return tools;
}

function toolResultToIntent(toolUse: Anthropic.ToolUseBlock, context: OwlContext): OwlIntent {
  const input = (toolUse.input ?? {}) as Record<string, unknown>;

  switch (toolUse.name) {
    case "get_balance":
      return { kind: "say", text: `You have ${context.balanceDisplay}.` };

    case "send_to_contact": {
      const contactId = typeof input.contactId === "string" ? input.contactId : "";
      const dollars = typeof input.dollars === "string" ? input.dollars.trim() : "";
      const say = typeof input.say === "string" ? truncate(input.say, MAX_SAY_LENGTH) : "";
      const contact = context.contacts.find((c) => c.id === contactId);
      if (!contact) {
        return { kind: "say", text: "That person isn't on your list yet." };
      }
      if (!isValidDollarAmount(dollars) || !say) {
        return { kind: "say", text: "I didn't catch the amount. Try saying it again?" };
      }
      return { kind: "propose_send", contactId: contact.id, dollars, say };
    }

    case "add_to_savings": {
      const dollars = typeof input.dollars === "string" ? input.dollars.trim() : "";
      const say = typeof input.say === "string" ? truncate(input.say, MAX_SAY_LENGTH) : "";
      if (!isValidDollarAmount(dollars) || !say) {
        return { kind: "say", text: "I didn't catch the amount. Try saying it again?" };
      }
      return { kind: "propose_save", dollars, say };
    }

    case "explain":
    default: {
      const text =
        typeof input.text === "string" && input.text.trim()
          ? truncate(input.text, MAX_SAY_LENGTH)
          : fallbackSay(context).text;
      return input.blocked === true ? { kind: "explain_blocked", text } : { kind: "say", text };
    }
  }
}

async function interpretWithClaude(text: string, context: OwlContext): Promise<OwlIntent> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 512,
    system: buildSystemPrompt(context),
    tools: buildTools(context),
    messages: [{ role: "user", content: text }],
  });

  const toolUse = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  if (toolUse) {
    return toolResultToIntent(toolUse, context);
  }

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (textBlock?.text) {
    return { kind: "say", text: truncate(textBlock.text, MAX_SAY_LENGTH) };
  }

  return fallbackSay(context);
}

/**
 * Interprets a kid's utterance into an OwlIntent. Uses Claude (tool use;
 * the model picks at most one of get_balance / send_to_contact /
 * add_to_savings / explain) when ANTHROPIC_API_KEY is set, falling back to
 * the deterministic rule-based interpreter otherwise or if the API call
 * fails, so the app always works without keys.
 */
export async function interpretUtterance(input: { text: string; context: OwlContext }): Promise<OwlIntent> {
  const { text, context } = input;
  const trimmed = text.trim();

  if (!trimmed) {
    return fallbackSay(context);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return interpretWithRules(trimmed, context);
  }

  try {
    return await interpretWithClaude(trimmed, context);
  } catch (error) {
    console.error("owl.intent: Claude call failed, falling back to rules", error);
    return interpretWithRules(trimmed, context);
  }
}
