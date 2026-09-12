"use client";

import { useMemo, useRef } from "react";
import {
  useAgentContext,
  useComponent,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { CutawayActions } from "@/lib/cutaway-client";
import {
  cutawayToolDescriptions,
  repairFacts,
  selectedPageContext,
} from "@/lib/cutaway-agent-context";
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
        context: selectedPageContext(context),
        surface,
        repair: repairFacts(snapshot),
        controllerConnected: actions.connected,
      }),
    [context, surface, snapshot, actions.connected],
  );

  useAgentContext({
    description:
      "Live selected page context and measured repair facts. For an explicit repair request, call request_repair directly; it includes reproduction. The app refreshes progress automatically. Preview uses separate data; only the operator's Apply button updates Fieldnote. Optional Ambiguous handoff follows Apply.",
    value,
  });

  useFrontendTool(
    {
      name: "run_booking_experiment",
      description: cutawayToolDescriptions.run_booking_experiment,
      parameters: z.object({}),
      handler: () =>
        result(async () =>
          repairFacts(await latestActions.current.experiment()),
        ),
    },
    [],
  );

  useFrontendTool(
    {
      name: "request_repair",
      description: cutawayToolDescriptions.request_repair,
      parameters: z.object({ instruction: z.string().trim().min(1).max(4000) }),
      handler: ({ instruction }) =>
        result(async () =>
          repairFacts(await latestActions.current.repair(instruction)),
        ),
    },
    [],
  );

  useFrontendTool(
    {
      name: "read_repair_status",
      description: cutawayToolDescriptions.read_repair_status,
      parameters: z.object({}),
      handler: () =>
        result(async () => repairFacts(await latestActions.current.refresh())),
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
