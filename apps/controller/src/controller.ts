import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import { runBookingChecks } from "cutaway-checks";
import type {
  ApprovalIntent,
  Stage,
  TargetContext,
  TaskSnapshot,
  WorkOrder,
  WorkOrderReceipt,
} from "cutaway-core";
import {
  artifactDigest,
  buildTarget,
  changedSource,
  copySource,
  sourceDigest,
} from "./workspace.js";
import {
  command,
  startTarget,
  stopTarget,
  type TargetProcess,
} from "./processes.js";
import { runCodingWorker } from "./worker.js";

const activeStages = new Set<Stage>([
  "reproducing",
  "editing",
  "verifying",
  "applying",
  "resetting",
]);

export class ControllerError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

function initialSnapshot(): TaskSnapshot {
  return {
    runId: randomUUID(),
    stage: "idle",
    sequence: 0,
    context: null,
    evidenceIds: [],
    evidence: null,
    verification: null,
    workOrder: null,
    candidate: null,
    deployment: null,
    workOrderReceipt: null,
    error: null,
  };
}

function existingReservation(database: string): string {
  const db = new Database(database, { readonly: true });
  try {
    const row: unknown = db
      .prepare("SELECT * FROM reservations WHERE id = ?")
      .get("existing-morgan");
    if (!row) throw new Error("The existing Morgan reservation is missing.");
    return JSON.stringify(row);
  } finally {
    db.close();
  }
}

export class CutawayController {
  private snapshot = initialSnapshot();
  private current: TargetProcess | null = null;
  private preview: TargetProcess | null = null;
  private baselineRoot = "";
  private candidateRoot: string | null = null;
  private activeDatabase = "";
  private intent: ApprovalIntent | null = null;
  private readonly sessionRoot: string;

  constructor(private readonly repository: string) {
    this.sessionRoot = join(
      repository,
      ".data/cutaway",
      `session-${randomUUID()}`,
    );
  }

  get state(): TaskSnapshot {
    return structuredClone(this.snapshot);
  }
  private get runRoot(): string {
    return join(this.sessionRoot, this.snapshot.runId);
  }
  private get shellOrigin(): string {
    return process.env.CUTAWAY_SHELL_ORIGIN ?? "http://127.0.0.1:3100";
  }

  private update(patch: Partial<TaskSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      sequence: this.snapshot.sequence + 1,
    };
  }

  private settled(): void {
    if (activeStages.has(this.snapshot.stage))
      throw new ControllerError(
        "BUSY",
        "Wait for the current operation to finish.",
      );
  }

  private async inBackground(
    stage: Stage,
    operation: () => Promise<void>,
  ): Promise<void> {
    this.update({ stage, error: null });
    try {
      await operation();
    } catch (error) {
      let message =
        error instanceof Error ? error.message : "The operation failed.";
      for (const key of [
        "OPENAI_API_KEY",
        "OPENROUTER_API_KEY",
        "AMBIGUOUS_API_KEY",
        "CUTAWAY_CONTROLLER_TOKEN",
      ]) {
        const secret = process.env[key];
        if (secret) message = message.replaceAll(secret, "[redacted]");
      }
      this.update({
        stage: "failed",
        error: { code: "OPERATION_FAILED", message: message.slice(-4_000) },
      });
    }
  }

  async initialize(): Promise<void> {
    await this.inBackground("resetting", async () => {
      await mkdir(this.runRoot, { recursive: true });
      this.baselineRoot = join(this.runRoot, "baseline");
      await mkdir(join(this.runRoot, "current-data"), { recursive: true });
      this.activeDatabase = join(
        this.runRoot,
        "current-data",
        "bookings.sqlite",
      );
      await copySource(
        join(this.repository, "examples/fieldnote"),
        this.baselineRoot,
      );
      await buildTarget(this.baselineRoot, this.repository);
      const releaseId = await sourceDigest(this.baselineRoot);
      this.current = await startTarget({
        root: this.baselineRoot,
        database: this.activeDatabase,
        port: 4120,
        releaseId,
        runId: this.snapshot.runId,
        shellOrigin: this.shellOrigin,
        logPath: join(this.runRoot, "current.log"),
      });
      existingReservation(this.activeDatabase);
      this.update({ stage: "idle" });
    });
  }

  experiment(options: {
    eventId: string;
    participants: 2;
    surface: "current" | "preview";
  }): TaskSnapshot {
    this.settled();
    const target = options.surface === "preview" ? this.preview : this.current;
    if (!target)
      throw new ControllerError(
        "TARGET_UNAVAILABLE",
        "The requested target is not ready.",
      );
    if (options.eventId !== "pottery-saturday")
      throw new ControllerError(
        "UNKNOWN_EVENT",
        "Select the pottery workshop.",
        400,
      );
    void this.inBackground("reproducing", async () => {
      const mode =
        options.surface === "preview" || this.snapshot.deployment
          ? "candidate"
          : "baseline";
      const result = await runBookingChecks({
        targetRoot: target.root,
        runId: this.snapshot.runId,
        revision: target.releaseId,
        mode,
        scratchRoot: join(this.runRoot, `experiment-${randomUUID()}`),
        surface: options.surface,
      });
      await writeFile(
        join(this.runRoot, `evidence-${result.evidence.id}.json`),
        JSON.stringify(result, null, 2),
      );
      this.update({
        stage: this.snapshot.deployment
          ? "applied"
          : this.snapshot.candidate
            ? "ready"
            : "reproduced",
        evidence: result.evidence,
        evidenceIds: [...this.snapshot.evidenceIds, result.evidence.id],
      });
    });
    return this.state;
  }

  repair(options: {
    instruction: string;
    context: TargetContext;
    evidenceId: string;
  }): TaskSnapshot {
    this.settled();
    if (this.snapshot.candidate || this.snapshot.deployment)
      throw new ControllerError(
        "RESET_REQUIRED",
        "Reset the demo before starting another repair.",
      );
    if (
      !this.current ||
      options.context.runId !== this.snapshot.runId ||
      options.context.targetRevision !== this.current.releaseId ||
      options.context.surface !== "current"
    ) {
      throw new ControllerError(
        "STALE_CONTEXT",
        "Reload the current workshop before requesting a repair.",
      );
    }
    const evidence = this.snapshot.evidence;
    if (
      !evidence ||
      evidence.id !== options.evidenceId ||
      evidence.invariant !== "violated"
    ) {
      throw new ControllerError(
        "REPRODUCTION_REQUIRED",
        "Run the two-customer experiment before requesting a repair.",
      );
    }
    const base = this.current;
    this.update({ context: options.context });
    void this.inBackground("editing", async () => {
      const candidateRoot = join(this.runRoot, `candidate-${randomUUID()}`);
      this.candidateRoot = candidateRoot;
      await copySource(base.root, candidateRoot);
      const result = await runCodingWorker({
        repository: this.repository,
        candidateRoot,
        scratchRoot: join(this.runRoot, "worker"),
        input: {
          runId: this.snapshot.runId,
          instruction: options.instruction,
          context: options.context,
          evidence,
        },
      });
      const changedPaths = await changedSource(base.root, candidateRoot);
      const diffs: string[] = [];
      for (const path of changedPaths) {
        const before = join(base.root, path);
        const after = join(candidateRoot, path);
        const beforeExists = await access(before).then(
          () => true,
          () => false,
        );
        const afterExists = await access(after).then(
          () => true,
          () => false,
        );
        diffs.push(
          await command(
            "git",
            [
              "diff",
              "--no-index",
              "--",
              beforeExists ? before : "/dev/null",
              afterExists ? after : "/dev/null",
            ],
            {
              cwd: this.repository,
              allowedExitCodes: [0, 1],
            },
          ),
        );
      }
      await writeFile(join(this.runRoot, "repair.diff"), diffs.join("\n"));
      this.update({ stage: "verifying" });
      await buildTarget(candidateRoot, this.repository);
      const digest = await sourceDigest(candidateRoot);
      const builtDigest = await artifactDigest(candidateRoot);
      const checked = await runBookingChecks({
        targetRoot: candidateRoot,
        runId: this.snapshot.runId,
        revision: digest,
        mode: "candidate",
        scratchRoot: join(this.runRoot, "verification"),
        surface: "preview",
      });
      const verification = {
        id: randomUUID(),
        runId: this.snapshot.runId,
        candidateDigest: digest,
        artifactDigest: builtDigest,
        passed: checked.passed,
        checks: checked.checks,
      };
      await writeFile(
        join(this.runRoot, "verification.json"),
        JSON.stringify({ verification, evidence: checked.evidence }, null, 2),
      );
      this.update({ verification });
      if (!checked.passed)
        throw new Error(
          "The edited source failed independent booking checks. Apply is unavailable.",
        );
      await mkdir(join(this.runRoot, "preview-data"), { recursive: true });
      const previewDatabase = join(
        this.runRoot,
        "preview-data",
        "bookings.sqlite",
      );
      const db = new Database(this.activeDatabase);
      try {
        await db.backup(previewDatabase);
      } finally {
        db.close();
      }
      this.preview = await startTarget({
        root: candidateRoot,
        database: previewDatabase,
        port: 4121,
        releaseId: digest,
        runId: this.snapshot.runId,
        shellOrigin: this.shellOrigin,
        logPath: join(this.runRoot, "preview.log"),
      });
      this.update({
        stage: "ready",
        evidenceIds: [...this.snapshot.evidenceIds, checked.evidence.id],
        candidate: {
          runId: this.snapshot.runId,
          digest,
          artifactDigest: builtDigest,
          baseReleaseId: base.releaseId,
          verificationId: verification.id,
          changedPaths,
          summary: result.summary,
          previewUrl: `${this.preview.url}/?runId=${this.snapshot.runId}&surface=preview`,
        },
      });
    });
    return this.state;
  }

  approval(candidateDigest: string, _saveReport: boolean): ApprovalIntent {
    this.settled();
    const candidate = this.snapshot.candidate;
    if (
      !candidate ||
      !this.snapshot.verification?.passed ||
      candidate.digest !== candidateDigest ||
      this.snapshot.deployment
    ) {
      throw new ControllerError(
        "CANDIDATE_UNAVAILABLE",
        "Only the displayed verified candidate can be approved.",
      );
    }
    this.intent = {
      id: randomUUID(),
      runId: this.snapshot.runId,
      candidateDigest: candidate.digest,
      artifactDigest: candidate.artifactDigest,
      verificationId: candidate.verificationId,
      baseReleaseId: candidate.baseReleaseId,
      workOrderReport: null,
    };
    this.update({ stage: "awaiting-approval" });
    return structuredClone(this.intent);
  }

  apply(
    approvalIntentId: string,
    decision: "approve" | "decline",
  ): TaskSnapshot {
    this.settled();
    if (!this.intent || this.intent.id !== approvalIntentId)
      throw new ControllerError(
        "APPROVAL_REQUIRED",
        "Review the candidate and use its Apply button.",
      );
    const intent = this.intent;
    this.intent = null;
    if (decision === "decline") {
      this.update({ stage: "ready" });
      return this.state;
    }
    const candidate = this.snapshot.candidate;
    const root = this.candidateRoot;
    if (
      !candidate ||
      !root ||
      this.current?.releaseId !== intent.baseReleaseId ||
      candidate.digest !== intent.candidateDigest
    ) {
      throw new ControllerError(
        "STALE_APPROVAL",
        "The candidate changed; request a new approval.",
      );
    }
    void this.inBackground("applying", async () => {
      if (
        (await sourceDigest(root)) !== intent.candidateDigest ||
        (await artifactDigest(root)) !== intent.artifactDigest
      ) {
        throw new Error(
          "The verified candidate changed. Apply was stopped before restarting the app.",
        );
      }
      const before = existingReservation(this.activeDatabase);
      await stopTarget(this.current);
      this.current = null;
      this.current = await startTarget({
        root,
        database: this.activeDatabase,
        port: 4120,
        releaseId: candidate.digest,
        runId: this.snapshot.runId,
        shellOrigin: this.shellOrigin,
        logPath: join(this.runRoot, "current.log"),
      });
      const preserved = existingReservation(this.activeDatabase) === before;
      if (!preserved)
        throw new Error("Morgan’s existing reservation changed during Apply.");
      this.update({
        // The shell acknowledges the restored iframe before this becomes applied.
        stage: "applying",
        deployment: {
          runId: this.snapshot.runId,
          releaseId: candidate.digest,
          previousReleaseId: candidate.baseReleaseId,
          appliedAt: new Date().toISOString(),
          healthy: true,
          contextRestored: false,
          existingRecordsPreserved: true,
          scope: "local-demo",
        },
      });
    });
    return this.state;
  }

  restored(runId: string, revision: string, eventId: string): TaskSnapshot {
    const deployment = this.snapshot.deployment;
    if (
      runId !== this.snapshot.runId ||
      revision !== deployment?.releaseId ||
      eventId !== "pottery-saturday"
    ) {
      throw new ControllerError(
        "STALE_RESTORE",
        "This frame does not match the applied release.",
      );
    }
    this.update({
      stage: "applied",
      deployment: { ...deployment, contextRestored: true },
    });
    return this.state;
  }

  reportReceipt(receipt: WorkOrderReceipt, workOrder: WorkOrder): TaskSnapshot {
    if (
      this.snapshot.stage !== "applied" ||
      !this.snapshot.deployment?.contextRestored ||
      !this.snapshot.deployment.healthy ||
      !this.snapshot.deployment.existingRecordsPreserved ||
      !this.snapshot.verification?.passed ||
      receipt.runId !== this.snapshot.runId ||
      receipt.candidateDigest !== this.snapshot.candidate?.digest ||
      receipt.taskId !== workOrder.id ||
      !receipt.saved ||
      !receipt.readBackAt ||
      receipt.reportMarker !==
        `Cutaway repair ${receipt.runId}/${receipt.candidateDigest}` ||
      !workOrder.description.includes(receipt.reportMarker) ||
      (this.snapshot.workOrder !== null &&
        this.snapshot.workOrder.id !== workOrder.id)
    ) {
      throw new ControllerError(
        "STALE_REPORT",
        "The report does not match this applied repair.",
      );
    }
    this.update({ workOrder, workOrderReceipt: receipt });
    return this.state;
  }

  async reset(): Promise<TaskSnapshot> {
    this.settled();
    this.update({ stage: "resetting" });
    await this.close();
    this.snapshot = initialSnapshot();
    this.candidateRoot = null;
    this.intent = null;
    await this.initialize();
    return this.state;
  }

  async close(): Promise<void> {
    await Promise.all([stopTarget(this.current), stopTarget(this.preview)]);
    this.current = null;
    this.preview = null;
  }
}
