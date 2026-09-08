import { z } from "zod";
import { getUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 300;
const ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";

const BodySchema = z.object({
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
});

/**
 * Streams audio/mpeg speech for `text` from ElevenLabs. When ElevenLabs
 * isn't configured, responds 204 so the client falls back to the browser's
 * speechSynthesis instead of erroring.
 */
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

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return new Response(null, { status: 204 });
  }

  const text = parsed.data.text.slice(0, MAX_TEXT_LENGTH);

  let upstream: Response;
  try {
    upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL_ID }),
    });
  } catch (error) {
    console.error("owl.speak: ElevenLabs request failed", error);
    return new Response(null, { status: 204 });
  }

  if (!upstream.ok || !upstream.body) {
    console.error("owl.speak: ElevenLabs responded with an error", upstream.status);
    return new Response(null, { status: 204 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { "content-type": "audio/mpeg" },
  });
}
