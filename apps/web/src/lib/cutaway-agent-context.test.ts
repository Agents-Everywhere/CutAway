import assert from "node:assert/strict";
import test from "node:test";
import type { TaskSnapshot, TargetContext } from "cutaway-core";
import { repairFacts, selectedPageContext } from "./cutaway-agent-context";

test("compact agent facts preserve failed checks and actual deployment state without task bodies", () => {
  const snapshot: TaskSnapshot = {
    runId: "run",
    sequence: 500,
    stage: "applied",
    context: null,
    evidenceIds: [],
    evidence: null,
    candidate: {
      runId: "run",
      digest: "source",
      artifactDigest: "artifact",
      baseReleaseId: "before",
      verificationId: "checks",
      summary: "A".repeat(16000),
      changedPaths: ["src/server/reservations.ts"],
      previewUrl: "http://127.0.0.1:4121",
    },
    verification: {
      id: "checks",
      runId: "run",
      candidateDigest: "source",
      artifactDigest: "artifact",
      passed: false,
      checks: [
        {
          id: "preservation",
          passed: false,
          detail: "The existing reservation is missing.",
          evidenceId: "evidence",
        },
      ],
    },
    deployment: {
      runId: "run",
      releaseId: "source",
      previousReleaseId: "before",
      appliedAt: "now",
      healthy: true,
      contextRestored: false,
      existingRecordsPreserved: false,
      scope: "local-demo",
    },
    workOrder: {
      id: "task",
      workspaceId: "workspace",
      title: "Handoff",
      description: "REPORT-BODY".repeat(3000),
      url: null,
    },
    workOrderReceipt: {
      taskId: "task",
      runId: "run",
      candidateDigest: "source",
      reportMarker: "marker",
      saved: false,
      readBackAt: null,
      url: null,
    },
    error: {
      code: "FAILED_CHECK",
      message: "Reservation preservation failed.",
    },
  };
  const facts = repairFacts(snapshot);
  assert.equal(facts?.verification?.passed, false);
  assert.equal(
    facts?.verification?.checks[0].detail,
    "The existing reservation is missing.",
  );
  assert.equal(facts?.deployment?.contextRestored, false);
  assert.equal(facts?.deployment?.existingRecordsPreserved, false);
  assert.equal(facts?.handoff?.saved, false);
  assert.equal(facts?.error, "Reservation preservation failed.");
  assert.deepEqual(
    facts?.candidate?.changedPaths,
    snapshot.candidate!.changedPaths,
  );
  assert.equal(facts?.candidate?.summary.length, 1200);
  assert.doesNotMatch(JSON.stringify(facts), /REPORT-BODY/);
  assert.ok(
    JSON.stringify(facts).length < JSON.stringify(snapshot).length / 10,
  );
});

test("selected page context keeps repair location while leaving action coordinates on the client", () => {
  const context: TargetContext = {
    protocol: 1,
    runId: "run",
    targetId: "fieldnote",
    targetRevision: "source",
    route: "/workshops/pottery-saturday",
    eventId: "pottery-saturday",
    surface: "current",
    selected: {
      id: "booking.capacity",
      label: "Workshop availability",
      sourceKey: "src/server/reservations.ts",
      rect: { x: 10, y: 20, width: 100, height: 50 },
    },
  };
  assert.deepEqual(selectedPageContext(context), {
    route: context.route,
    eventId: context.eventId,
    surface: "current",
    selected: {
      label: "Workshop availability",
      sourceKey: "src/server/reservations.ts",
    },
  });
  assert.equal(context.selected?.rect.width, 100);
  assert.equal(selectedPageContext(null), null);
  assert.equal(repairFacts(null), null);
});
