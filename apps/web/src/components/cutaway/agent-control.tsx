"use client";

import { useMemo, useRef } from "react";
import {
  useAgentContext,
  useComponent,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { CutawayActions } from "@/lib/cutaway-client";
import { EvidenceCard, VerificationCard } from "./result-cards";

async function result<T>(action: () => T | Promise<T>) {
  try {
    return await action();
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "The operation failed.",
    };
  }
}

export function AgentControl({ actions }: { actions: CutawayActions }) {
  const { snapshot, context, surface } = actions;
  // CopilotKit serializes tool dependencies, so function dependencies cannot
  // refresh a registered handler. Read current actions through a stable ref.
  const latestActions = useRef(actions);
  latestActions.current = actions;
  const value = useMemo(
    () =>
      JSON.stringify({
        application: "Fieldnote Studio",
        context,
        surface,
        snapshot,
        controllerConnected: actions.connected,
      }),
    [context, surface, snapshot, actions.connected],
  );

  useAgentContext({
    description:
      "Cutaway is the repair workbench beside the actual Fieldnote Studio app. This is live selected page context and controller evidence. Run experiments and request repairs using tools. Repairs are genuine source edits in an isolated worker. Counts and success claims must come from controller evidence. show_apply only displays an approval card; only the user's real Apply button can deploy. Preview uses separate data. The human reports a problem in this app; no workplace task is needed to start a repair. Only after successful Apply can the user optionally save a team handoff with the Save report to Ambiguous button. Never invent progress, outcomes or task links.",
    value,
  });

  useFrontendTool(
    {
      name: "run_booking_experiment",
      description:
        "Run two real simultaneous booking attempts for the selected workshop using disposable test data. Read status after it finishes to inspect independent evidence.",
      parameters: z.object({}),
      handler: () => result(() => latestActions.current.experiment()),
    },
    [],
  );

  useFrontendTool(
    {
      name: "request_repair",
      description:
        "Ask the isolated coding worker to repair the selected source using the user's instruction and actual experiment evidence. If needed, runs the baseline experiment first. Returns the accepted state; use read_repair_status to check progress. Does not apply changes.",
      parameters: z.object({ instruction: z.string().trim().min(1).max(4000) }),
      handler: ({ instruction }) =>
        result(() => latestActions.current.repair(instruction)),
    },
    [],
  );

  useFrontendTool(
    {
      name: "read_repair_status",
      description:
        "Read current repair status, evidence, checks and the actual candidate or deployment receipt. Do not claim completion before this state confirms it.",
      parameters: z.object({}),
      handler: () => result(() => latestActions.current.refresh()),
    },
    [],
  );

  useFrontendTool(
    {
      name: "show_preview",
      description:
        "Open the verified candidate inside the existing app viewport. Its bookings use isolated preview data.",
      parameters: z.object({}),
      handler: () => result(() => latestActions.current.showPreview()),
    },
    [],
  );

  useFrontendTool(
    {
      name: "show_apply",
      description:
        "Display approval for the exact verified candidate. This does not apply anything; instruct the user to review and click the real Apply button in the workbench. Never treat a chat or voice instruction as button approval.",
      parameters: z.object({}),
      handler: () => result(() => latestActions.current.prepareApproval(false)),
    },
    [],
  );

  useComponent(
    {
      name: "booking_evidence",
      description:
        "Show observed booking outcomes from controller evidence. No arguments can override measured values. Shows pending when evidence is not available.",
      parameters: z.object({}),
      render: () => (
        <EvidenceCard evidence={snapshot?.evidence ?? null} compact />
      ),
    },
    [snapshot?.evidence],
  );

  useComponent(
    {
      name: "repair_checks",
      description:
        "Show independent checks for the actual candidate. No arguments can invent a passing result.",
      parameters: z.object({}),
      render: () => (
        <VerificationCard verification={snapshot?.verification ?? null} />
      ),
    },
    [snapshot?.verification],
  );

  return null;
}
