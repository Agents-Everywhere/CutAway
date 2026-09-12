"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type {
  ApprovalIntent,
  ExperimentEvidence,
  Stage,
  Surface,
  TargetContext,
  TaskSnapshot,
  WorkOrder,
} from "cutaway-core";

export const TARGET_ORIGINS = {
  current: "http://127.0.0.1:4120",
  preview: "http://127.0.0.1:4121",
} satisfies Record<Surface, string>;

export const targetContextSchema = z.object({
  protocol: z.literal(1),
  runId: z.string().min(1),
  targetId: z.literal("fieldnote"),
  targetRevision: z.string().min(1),
  route: z
    .string()
    .startsWith("/")
    .refine((route) => !route.startsWith("//")),
  eventId: z.string().min(1),
  selected: z
    .object({
      id: z.enum([
        "booking.capacity",
        "booking.submit",
        "booking.reservations",
      ]),
      label: z.string().min(1).max(200),
      sourceKey: z.string().min(1).max(300),
      rect: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })
    .nullable(),
  surface: z.enum(["current", "preview"]),
});

const activeStages = new Set<Stage>([
  "reproducing",
  "editing",
  "verifying",
  "applying",
  "resetting",
]);

export const stageLabels: Record<Stage, string> = {
  idle: "Ready when you are",
  reproducing: "Testing the last place…",
  reproduced: "Problem reproduced",
  editing: "Working on the source…",
  verifying: "Checking the repair…",
  ready: "Ready to try",
  previewing: "Trying the preview",
  "awaiting-approval": "Waiting for your approval",
  applying: "Updating Fieldnote…",
  applied: "Fieldnote updated",
  blocked: "Needs attention",
  failed: "Needs attention",
  resetting: "Resetting the demo…",
};

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/cutaway/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (payload === null && !response.ok) {
    throw new Error(
      `Cutaway is temporarily unavailable (${response.status}). The connection will retry automatically.`,
    );
  }
  if (!response.ok) {
    const parsed = z
      .object({
        message: z.string().optional(),
        error: z
          .union([z.string(), z.object({ message: z.string() })])
          .optional(),
      })
      .safeParse(payload);
    const detail = parsed.success
      ? (parsed.data.message ??
        (typeof parsed.data.error === "string"
          ? parsed.data.error
          : parsed.data.error?.message))
      : null;
    throw new Error(
      detail ?? `Cutaway could not complete this request (${response.status}).`,
    );
  }
  return payload as T;
}

export function useCutaway() {
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(null);
  const [context, setContext] = useState<TargetContext | null>(null);
  const [surface, setSurface] = useState<Surface>("current");
  const [approval, setApproval] = useState<ApprovalIntent | null>(null);
  const [pending, setPending] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const refresh = useCallback(async () => {
    const next = await request<TaskSnapshot>("state");
    setSnapshot(next);
    setConnectionError(null);
    return next;
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request<TaskSnapshot>("state");
        if (!stopped) {
          setSnapshot(next);
          setConnectionError(null);
        }
      } catch (error) {
        if (!stopped)
          setConnectionError(
            error instanceof Error
              ? error.message
              : "Controller is unavailable.",
          );
      } finally {
        if (!stopped) timer = setTimeout(poll, 1200);
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    setApproval(null);
  }, [snapshot?.candidate?.digest, snapshot?.runId]);

  const run = useCallback(async <T>(operation: () => Promise<T>) => {
    setPending(true);
    setActionError(null);
    try {
      return await operation();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
      throw error;
    } finally {
      setPending(false);
    }
  }, []);

  const experiment = useCallback(
    async () =>
      run(async () => {
        if (!context)
          throw new Error(
            "Wait for Fieldnote to connect, then select the capacity indicator.",
          );
        await request("experiments", {
          eventId: context.eventId,
          participants: 2,
          surface,
        });
        return refresh();
      }),
    [context, surface, refresh, run],
  );

  const repair = useCallback(
    async (instruction: string) =>
      run(async () => {
        if (!context?.selected)
          throw new Error(
            "Select the part of Fieldnote you want to repair first.",
          );
        if (context.surface !== "current")
          throw new Error("Switch to Current before starting a repair.");
        const capturedContext = context;
        let state = snapshotRef.current;
        if (
          !state?.evidence ||
          state.evidence.eventId !== capturedContext.eventId ||
          state.evidence.revision !== capturedContext.targetRevision
        ) {
          if (state?.stage !== "reproducing") {
            await request("experiments", {
              eventId: capturedContext.eventId,
              participants: 2,
              surface: "current",
            });
          }
          const deadline = Date.now() + 30_000;
          do {
            await new Promise((resolve) => setTimeout(resolve, 800));
            state = await refresh();
            if (state.stage === "failed" || state.stage === "blocked")
              throw new Error(
                state.error?.message ?? "The experiment could not complete.",
              );
          } while (state.stage === "reproducing" && Date.now() < deadline);
        }
        const evidence: ExperimentEvidence | null = state.evidence;
        if (!evidence)
          throw new Error(
            "The experiment is still running. Wait for its results before requesting a repair.",
          );
        await request("repairs", {
          instruction,
          context: capturedContext,
          evidenceId: evidence.id,
        });
        return refresh();
      }),
    [context, refresh, run],
  );

  const showPreview = useCallback(() => {
    if (!snapshotRef.current?.candidate)
      throw new Error("The candidate is not ready to preview yet.");
    setSurface("preview");
    return {
      surface: "preview",
      candidateDigest: snapshotRef.current.candidate.digest,
    };
  }, []);

  const prepareApproval = useCallback(
    async (saveReport: boolean) =>
      run(async () => {
        const candidate = snapshotRef.current?.candidate;
        if (!candidate || !snapshotRef.current?.verification?.passed)
          throw new Error("A verified candidate is required before Apply.");
        const intent = await request<ApprovalIntent>("approval-intents", {
          candidateDigest: candidate.digest,
          saveReport,
        });
        setApproval(intent);
        await refresh();
        return intent;
      }),
    [refresh, run],
  );

  const apply = useCallback(
    async (decision: "approve" | "decline") =>
      run(async () => {
        if (!approval)
          throw new Error("Review the candidate before applying it.");
        await request("apply", { approvalIntentId: approval.id, decision });
        setApproval(null);
        if (decision === "approve") setSurface("current");
        return refresh();
      }),
    [approval, refresh, run],
  );

  const refreshWorkOrder = useCallback(
    async () =>
      run(async () => {
        const order = await request<WorkOrder | null>("workorder");
        await refresh();
        return order;
      }),
    [refresh, run],
  );

  const acknowledgeRestore = useCallback(
    async (restored: { runId: string; revision: string; eventId: string }) => {
      await request("restored", restored);
      return refresh();
    },
    [refresh],
  );

  const saveReport = useCallback(
    async () =>
      run(async () => {
        const state = snapshotRef.current;
        if (!state?.deployment)
          throw new Error(
            "Apply the verified repair before saving its report.",
          );
        await request("report", {
          runId: state.runId,
          candidateDigest: state.deployment.releaseId,
        });
        return refresh();
      }),
    [refresh, run],
  );

  return {
    snapshot,
    context,
    setContext,
    surface,
    setSurface,
    approval,
    experiment,
    repair,
    showPreview,
    prepareApproval,
    apply,
    refresh,
    refreshWorkOrder,
    acknowledgeRestore,
    saveReport,
    workOrder: snapshot?.workOrder ?? null,
    busy: pending || (snapshot !== null && activeStages.has(snapshot.stage)),
    connected: snapshot !== null && connectionError === null,
    error: actionError ?? snapshot?.error?.message ?? connectionError,
  };
}

export type CutawayActions = ReturnType<typeof useCutaway>;
