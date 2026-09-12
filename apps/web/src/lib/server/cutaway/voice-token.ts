import { z } from "zod";
import { REALTIME_MODEL, REALTIME_VOICE } from "@/lib/realtime-config";
import { CutawayHttpError } from "./http";

export async function voiceToken() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "stub-replace-me")
    throw new CutawayHttpError(
      "Add OPENAI_API_KEY to .env to connect voice. You can still type.",
      503,
    );
  const response = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          audio: {
            input: {
              turn_detection: null,
              transcription: { model: "gpt-4o-mini-transcribe" },
            },
            output: { voice: REALTIME_VOICE },
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new CutawayHttpError(
      `Voice connection failed (HTTP ${response.status}). Check OpenAI access.`,
      502,
    );
  return Response.json(
    z.object({ value: z.string().min(1) }).parse(await response.json()),
  );
}
