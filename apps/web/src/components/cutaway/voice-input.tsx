"use client";

import { useEffect, useRef, useState } from "react";
import { RealtimeAgent, RealtimeSession, tool } from "@openai/agents/realtime";
import { z } from "zod";
import type { CutawayActions } from "@/lib/cutaway-client";
import { REALTIME_MODEL } from "@/lib/realtime-config";
import { repairFacts, selectedPageContext } from "@/lib/cutaway-agent-context";

export function VoiceInput({
  actions,
  disabled = false,
}: {
  actions: CutawayActions;
  disabled?: boolean;
}) {
  const latest = useRef(actions);
  latest.current = actions;
  const session = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    "off" | "connecting" | "ready" | "listening"
  >("off");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");

  useEffect(
    () => () => {
      session.current?.close();
    },
    [],
  );

  async function connect() {
    setStatus("connecting");
    setError(null);
    let next: RealtimeSession | null = null;
    try {
      const response = await fetch("/api/cutaway/voice-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const credentials = (await response.json()) as {
        value?: string;
        error?: string;
      };
      if (!response.ok || !credentials.value)
        throw new Error(credentials.error || "Voice could not connect.");
      const safe = async (action: () => unknown) => {
        try {
          return JSON.stringify(await action());
        } catch (problem) {
          return JSON.stringify({
            error:
              problem instanceof Error ? problem.message : "The action failed.",
          });
        }
      };
      const agent = new RealtimeAgent({
        name: "Cutaway",
        instructions:
          "You help the studio operator repair Fieldnote. Answer in one plain-English sentence of at most 16 words unless more detail is requested. Explain what changes for customers; avoid SQL, paths, code and implementation jargon unless asked. Read current state with read_task before answering about a repair, then answer directly without another status call or spoken preamble. Use real experiment and repair tools; never invent results. Do not start a second repair while one is running. Offer preview when verified. An apply request only opens the approval card; only the operator's button can apply. Never claim deployment before state confirms it. Existing bookings must be preserved. No workplace task is needed to start; team handoff is optional after Apply.",
        tools: [
          tool({
            name: "read_task",
            description: "Read selected context and current actual task state.",
            parameters: z.object({}),
            execute: () =>
              safe(async () => ({
                context: selectedPageContext(latest.current.context),
                state: repairFacts(await latest.current.refresh()),
              })),
          }),
          tool({
            name: "run_experiment",
            description: "Reproduce booking behavior on disposable data.",
            parameters: z.object({}),
            execute: () =>
              safe(async () => repairFacts(await latest.current.experiment())),
          }),
          tool({
            name: "start_repair",
            description:
              "Start one actual isolated source repair for the selected app.",
            parameters: z.object({ instruction: z.string() }),
            execute: ({ instruction }) =>
              safe(async () =>
                repairFacts(await latest.current.repair(instruction)),
              ),
          }),
          tool({
            name: "show_candidate",
            description: "Open the verified interactive preview.",
            parameters: z.object({}),
            execute: () => safe(() => latest.current.showPreview()),
          }),
          tool({
            name: "show_apply",
            description:
              "Show the approval card. This does not apply or approve anything.",
            parameters: z.object({}),
            execute: () => safe(() => latest.current.prepareApproval(false)),
          }),
        ],
      });
      next = new RealtimeSession(agent, {
        transport: "webrtc",
        model: REALTIME_MODEL,
        config: {
          audio: {
            input: {
              turnDetection: null,
              transcription: { model: "gpt-4o-mini-transcribe" },
            },
          },
        },
      });
      next.on("history_updated", (history) => {
        const lastUserIndex = history.findLastIndex(
          (item) => item.type === "message" && item.role === "user",
        );
        const assistant = history
          .slice(lastUserIndex + 1)
          .filter(
            (item) => item.type === "message" && item.role === "assistant",
          )
          .at(-1);
        if (assistant?.type === "message")
          setReply(
            assistant.content
              .map((part) =>
                "transcript" in part
                  ? part.transcript || ""
                  : "text" in part
                    ? part.text
                    : "",
              )
              .join(" ")
              .trim(),
          );
        const last = history
          .filter((item) => item.type === "message" && item.role === "user")
          .at(-1);
        if (last?.type === "message")
          setTranscript(
            last.content
              .map((part) =>
                "transcript" in part
                  ? part.transcript || ""
                  : "text" in part
                    ? part.text
                    : "",
              )
              .join(" ")
              .trim(),
          );
      });
      next.on("error", () =>
        setError(
          "Voice encountered a connection problem. You can continue by typing.",
        ),
      );
      await next.connect({ apiKey: credentials.value });
      next.mute(true);
      session.current = next;
      setStatus("ready");
    } catch (problem) {
      next?.close();
      setStatus("off");
      setError(
        problem instanceof Error ? problem.message : "Voice is unavailable.",
      );
    }
  }

  function startTalking() {
    if (!session.current || disabled || status !== "ready") return;
    session.current.interrupt();
    setReply("");
    session.current.transport.sendEvent({ type: "input_audio_buffer.clear" });
    session.current.mute(false);
    setStatus("listening");
  }

  function stopTalking() {
    if (!session.current || status !== "listening") return;
    session.current.mute(true);
    session.current.transport.sendEvent({ type: "input_audio_buffer.commit" });
    session.current.transport.sendEvent({ type: "response.create" });
    setStatus("ready");
  }

  return (
    <div className="cutaway-voice">
      {status === "off" || status === "connecting" ? (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={status === "connecting"}
        >
          {status === "connecting" ? "Connecting voice…" : "Connect voice"}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          aria-pressed={status === "listening"}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            startTalking();
          }}
          onPointerUp={stopTalking}
          onPointerCancel={stopTalking}
          onKeyDown={(event) => {
            if (event.code === "Space" && !event.repeat) {
              event.preventDefault();
              startTalking();
            }
          }}
          onKeyUp={(event) => {
            if (event.code === "Space") {
              event.preventDefault();
              stopTalking();
            }
          }}
        >
          {status === "listening"
            ? "Listening… release to send"
            : "Hold to talk"}
        </button>
      )}
      {transcript && <p className="cutaway-voice-transcript">{transcript}</p>}
      {reply && (
        <p className="cutaway-voice-reply" aria-live="polite">
          {reply}
        </p>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
