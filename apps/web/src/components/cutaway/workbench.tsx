"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CopilotChat,
  useAgent,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { HostMessage } from "cutaway-core";
import {
  stageLabels,
  targetContextSchema,
  TARGET_ORIGINS,
  useCutaway,
} from "@/lib/cutaway-client";
import { AgentControl } from "./agent-control";
import { EvidenceCard, VerificationCard } from "./result-cards";
import { VoiceInput } from "./voice-input";

const messageHeader = z.object({
  protocol: z.literal(1),
  type: z.enum(["hello", "open", "context", "restored"]),
});
const restoreMessage = z.object({
  runId: z.string(),
  revision: z.string(),
  eventId: z.string(),
});

function BrandMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 5H9a4 4 0 0 0-4 4v10h10a4 4 0 0 0 4-4V6"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="m5 19 14-14M11 5v8h8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function CutawayWorkbench() {
  const actions = useCutaway();
  const { agent } = useAgent({
    agentId: "default",
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });
  const { snapshot, surface, busy, connected } = actions;
  const context = actions.context?.selected
    ? actions.context
    : (snapshot?.context ?? actions.context);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const chatContainer = useRef<HTMLDivElement>(null);
  const currentOrigin = TARGET_ORIGINS[surface];
  const runId = snapshot?.runId;
  const candidate = snapshot?.candidate;
  const summaryLine =
    candidate?.summary
      .split(/\r?\n/)
      .find((line) => line.trim())
      ?.trim() ?? "";
  const shortSummary =
    summaryLine.length > 180
      ? `${summaryLine.slice(0, 177).trimEnd()}…`
      : summaryLine;
  const applied = snapshot?.stage === "applied" && snapshot.deployment?.healthy;

  const post = useCallback(
    (message: HostMessage) => {
      frame.current?.contentWindow?.postMessage(message, currentOrigin);
    },
    [currentOrigin],
  );

  const restoreContext = useCallback(() => {
    if (!runId) return;
    post({
      protocol: 1,
      type: "restore",
      runId,
      route: context?.route ?? "/workshops/pottery-saturday",
      eventId: context?.eventId ?? "pottery-saturday",
      selectedId: context?.selected?.id ?? null,
    });
  }, [post, runId, context]);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.origin !== currentOrigin
      )
        return;
      const header = messageHeader.safeParse(event.data);
      if (!header.success) return;
      if (header.data.type === "context") {
        const envelope = z
          .object({ context: targetContextSchema })
          .safeParse(event.data);
        if (
          !envelope.success ||
          envelope.data.context.runId !== runId ||
          envelope.data.context.surface !== surface
        )
          return;
        actions.setContext(envelope.data.context);
        setFrameError(null);
        if (envelope.data.context.selected) setSelecting(false);
      } else if (header.data.type === "hello") {
        restoreContext();
      } else if (header.data.type === "open") {
        setOpen(true);
      } else if (header.data.type === "restored") {
        const restored = restoreMessage.safeParse(event.data);
        if (
          !restored.success ||
          restored.data.runId !== runId ||
          !snapshot?.deployment
        )
          return;
        void actions
          .acknowledgeRestore(restored.data)
          .catch((error: unknown) =>
            setFrameError(
              error instanceof Error
                ? error.message
                : "The workshop could not be restored.",
            ),
          );
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [
    actions.setContext,
    actions.acknowledgeRestore,
    currentOrigin,
    runId,
    surface,
    restoreContext,
    snapshot?.deployment,
  ]);

  useEffect(() => {
    if (runId)
      post({ protocol: 1, type: "select", runId, enabled: selecting && !busy });
  }, [post, runId, selecting, busy]);

  const invoke = (operation: () => Promise<unknown>) => {
    void operation().catch(() => {
      /* Shared actions already expose their errors in the workbench. */
    });
  };
  const frameUrl = `${currentOrigin}/workshops/pottery-saturday?runId=${encodeURIComponent(runId ?? "")}&surface=${surface}&release=${encodeURIComponent(surface === "preview" ? (candidate?.digest ?? "") : (snapshot?.deployment?.releaseId ?? ""))}`;
  const error = actions.error ?? frameError;

  return (
    <main className={`ca-shell ${open ? "" : "ca-shell--closed"}`}>
      <AgentControl actions={actions} />
      <button
        type="button"
        className="ca-launcher"
        onClick={() => setOpen(true)}
        aria-label="Open Cutaway assistant"
        aria-expanded={open}
        hidden={open}
      >
        <BrandMark />
        <span>Cutaway</span>
      </button>

      <section className="ca-target" aria-label="Fieldnote Studio application">
        {surface === "preview" && (
          <div className="ca-preview-banner" role="status">
            <strong>
              {applied
                ? "Preview — testing the applied repair"
                : "Preview — this change isn’t live yet"}
            </strong>
            <span>Bookings use separate data.</span>
          </div>
        )}
        <div
          className={`ca-frame-wrap ${selecting ? "ca-frame-wrap--selecting" : ""}`}
        >
          {snapshot ? (
            <iframe
              ref={frame}
              src={frameUrl}
              title={
                surface === "preview"
                  ? "Fieldnote Studio candidate preview"
                  : "Fieldnote Studio current application"
              }
              onLoad={restoreContext}
            />
          ) : (
            <div className="ca-connecting">
              <span className="ca-connecting-mark">f.</span>
              <h1>Opening Fieldnote Studio</h1>
              <p>Connecting to Fieldnote…</p>
            </div>
          )}
          {snapshot?.stage === "applying" && (
            <div className="ca-restart-overlay" role="status">
              <span className="ca-spinner" />
              <h2>Updating Fieldnote</h2>
              <p>Your conversation and reservations stay right here.</p>
            </div>
          )}
        </div>
      </section>

      <aside
        className={`ca-workbench ${candidate ? "ca-workbench--has-candidate" : ""}`}
        aria-label="Cutaway workbench"
        hidden={!open}
      >
        <header className="ca-workbench-heading">
          <div className="ca-brand">
            <span className="ca-brand-mark">
              <BrandMark />
            </span>
            <strong>Cutaway</strong>
          </div>
          <div className="ca-header-actions">
            <a className="ca-operator-link" href="/operator">
              Operator
            </a>
            <button
              type="button"
              className="ca-close"
              onClick={() => setOpen(false)}
              aria-label="Close Cutaway assistant"
            >
              ×
            </button>
          </div>
        </header>
        <div className="ca-version-controls">
          <div className="ca-target-label">
            <span
              className={`ca-dot ${connected ? "ca-dot--connected" : ""}`}
            />
            <span>Fieldnote Studio</span>
          </div>
          <div
            className="ca-surface-switch"
            role="group"
            aria-label="Application version"
          >
            <button
              type="button"
              aria-pressed={surface === "current"}
              onClick={() => actions.setSurface("current")}
              disabled={snapshot?.stage === "applying"}
            >
              Current
            </button>
            <button
              type="button"
              aria-pressed={surface === "preview"}
              disabled={!candidate || busy}
              onClick={() => actions.showPreview()}
            >
              Preview{candidate && <span className="ca-preview-dot" />}
            </button>
          </div>
        </div>
        <div className="ca-mode-controls">
          <button
            type="button"
            className={`ca-button ${selecting ? "ca-button--primary" : ""}`}
            disabled={!connected || busy || surface === "preview"}
            onClick={() => setSelecting(!selecting)}
            aria-pressed={selecting}
          >
            <span aria-hidden="true">⌖</span>
            {selecting ? "Click in the app" : "Select"}
          </button>
          <button
            type="button"
            className="ca-button"
            onClick={() =>
              chatContainer.current
                ?.querySelector<HTMLTextAreaElement>("textarea")
                ?.focus()
            }
          >
            <span aria-hidden="true">⌨</span>Type
          </button>
          <VoiceInput actions={actions} disabled={busy} />
        </div>

        <div className="ca-workbench-content">
          <section
            className={`ca-context ${context?.selected ? "ca-context--selected" : ""} ${candidate ? "ca-context--compact" : ""}`}
            aria-label="Selected page context"
          >
            <span className="ca-context-icon" aria-hidden="true">
              ⌖
            </span>
            <div>
              <span className="ca-eyebrow">
                {context?.selected
                  ? "Selected in Fieldnote"
                  : "Start with what you see"}
              </span>
              <strong>
                {context?.selected?.label ?? "Point to the problem"}
              </strong>
              <p className={candidate ? "ca-stage" : undefined}>
                {candidate && snapshot
                  ? stageLabels[snapshot.stage]
                  : context?.selected
                    ? "Saturday pottery workshop"
                    : "Select a part of the workshop, then tell Cutaway what needs fixing."}
              </p>
            </div>
            {context?.selected && (
              <span className="ca-context-check" aria-label="Context captured">
                ✓
              </span>
            )}
          </section>
          {snapshot && !candidate && (
            <div className="ca-stage" role="status">
              <span
                className={
                  busy ? "ca-spinner ca-spinner--small" : "ca-stage-dot"
                }
              />
              <span>{stageLabels[snapshot.stage]}</span>
            </div>
          )}
          {error && (
            <div className="ca-error" role="alert">
              {error}
            </div>
          )}
          {!snapshot?.evidence && (
            <div className="ca-start-note">
              <h2>Investigate and fix a bug</h2>
              <p>
                Cutaway changes the source, checks the repair, and gives you a
                preview to approve before updating the app.
              </p>
              <button
                type="button"
                className="ca-text-button"
                disabled={!context || busy}
                onClick={() => invoke(actions.experiment)}
              >
                Test the last place <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}
          {snapshot?.evidence && !candidate && (
            <EvidenceCard
              evidence={snapshot.evidence}
              label="Observed result"
            />
          )}
          {snapshot?.evidence && candidate && (
            <details className="ca-previous-evidence">
              <summary>
                Before repair: {snapshot.evidence.successfulResponses}{" "}
                confirmations for {snapshot.evidence.availableBefore} available{" "}
                {snapshot.evidence.availableBefore === 1 ? "place" : "places"}
              </summary>
              <EvidenceCard
                evidence={snapshot.evidence}
                label="Before repair"
              />
            </details>
          )}
          {candidate && (
            <details
              className="ca-repair-disclosure"
              open={!applied && !actions.approval}
            >
              <summary>
                <span>
                  {applied
                    ? "Applied source & checks"
                    : "Proposed source & checks"}
                </span>
                <span className="ca-chip">
                  {candidate.changedPaths.length}{" "}
                  {candidate.changedPaths.length === 1 ? "file" : "files"}
                </span>
              </summary>
              <section className="ca-candidate">
                <p>{shortSummary}</p>
                <details className="ca-source-details">
                  <summary>Repair details &amp; changed source</summary>
                  <p className="ca-source-summary">{candidate.summary}</p>
                  <ul>
                    {candidate.changedPaths.map((path) => (
                      <li key={path}>
                        <code>{path}</code>
                      </li>
                    ))}
                  </ul>
                  <span className="ca-footnote">
                    Candidate {candidate.digest.slice(0, 12)}
                  </span>
                </details>
                <VerificationCard verification={snapshot.verification} />
                {!applied && !actions.approval && (
                  <div className="ca-candidate-actions">
                    <button
                      type="button"
                      className="ca-button"
                      disabled={busy}
                      onClick={() => actions.showPreview()}
                    >
                      Try preview <span aria-hidden="true">↗</span>
                    </button>
                    <button
                      type="button"
                      className="ca-button ca-button--primary"
                      disabled={busy || !snapshot.verification?.passed}
                      onClick={() =>
                        invoke(() => actions.prepareApproval(false))
                      }
                    >
                      Review &amp; apply
                    </button>
                  </div>
                )}
              </section>
            </details>
          )}
          {actions.approval && (
            <section className="ca-approval">
              <span className="ca-eyebrow">Your approval</span>
              <h2>Update this Fieldnote app?</h2>
              <p>
                Apply the verified candidate{" "}
                <code>{actions.approval.candidateDigest.slice(0, 12)}</code>.
                Fieldnote will restart with the existing reservations.
              </p>
              <div className="ca-candidate-actions">
                <button
                  type="button"
                  className="ca-button ca-button--primary"
                  disabled={busy}
                  onClick={() => invoke(() => actions.apply("approve"))}
                >
                  Apply to Fieldnote
                </button>
                <button
                  type="button"
                  className="ca-button"
                  disabled={busy}
                  onClick={() => invoke(() => actions.apply("decline"))}
                >
                  Decline
                </button>
              </div>
            </section>
          )}
          {applied && snapshot.deployment && (
            <section className="ca-complete">
              <span className="ca-eyebrow">Applied to Fieldnote</span>
              <h2>
                <span aria-hidden="true">✓</span> Fieldnote is back.
              </h2>
              <p>
                {snapshot.deployment.existingRecordsPreserved
                  ? "Morgan’s existing reservation is preserved."
                  : "The existing reservation still needs checking."}
              </p>
              <p className="ca-footnote">
                {snapshot.deployment.contextRestored
                  ? "Workshop restored"
                  : "Restoring your workshop…"}{" "}
                · Release {snapshot.deployment.releaseId.slice(0, 10)}
              </p>
            </section>
          )}
          {applied && (
            <section className="ca-workorder">
              <div className="ca-card-heading">
                <span className="ca-eyebrow">Share with the team</span>
                {actions.workOrder && (
                  <button
                    type="button"
                    className="ca-text-button"
                    disabled={busy}
                    onClick={() => invoke(actions.refreshWorkOrder)}
                  >
                    Refresh
                  </button>
                )}
              </div>
              {actions.workOrder ? (
                <>
                  <p className="ca-workorder-title">
                    {actions.workOrder.title}
                  </p>
                  {!snapshot.workOrderReceipt && (
                    <span className="ca-footnote">
                      Task {actions.workOrder.id}
                    </span>
                  )}
                  {actions.workOrder.url && (
                    <a
                      href={actions.workOrder.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ca-text-button"
                    >
                      Open task ↗
                    </a>
                  )}
                </>
              ) : (
                <p className="ca-footnote">
                  Save the repair, checks, and outcome for your team.
                </p>
              )}
              {!snapshot.workOrderReceipt?.saved && (
                <button
                  type="button"
                  className="ca-button ca-report-button"
                  disabled={busy || !snapshot.deployment?.contextRestored}
                  onClick={() => invoke(actions.saveReport)}
                >
                  Save report to Ambiguous
                </button>
              )}
              {snapshot.workOrderReceipt && (
                <p className="ca-report-receipt">
                  {snapshot.workOrderReceipt.saved &&
                  snapshot.workOrderReceipt.readBackAt
                    ? "✓ Report saved and read back"
                    : "App updated; report not saved"}
                  <span>Task {snapshot.workOrderReceipt.taskId}</span>
                </p>
              )}
            </section>
          )}
        </div>
        <div className="ca-conversation" ref={chatContainer}>
          <div className="ca-conversation-label">
            <span>Ask Cutaway</span>
            <span role="status">
              {agent.isRunning
                ? snapshot?.stage === "idle"
                  ? "Reading your request…"
                  : "Responding…"
                : "Knows your selected context"}
            </span>
          </div>
          <CopilotChat
            agentId="default"
            threadId={runId ?? "cutaway-connecting"}
            className="ca-chat"
            labels={{
              welcomeMessageText: "What isn’t working?",
              chatInputPlaceholder: "Describe the problem…",
            }}
          />
        </div>
      </aside>
    </main>
  );
}
