import assert from "node:assert/strict";
import test from "node:test";
import type { TaskSnapshot, WorkOrder, WorkOrderReceipt } from "cutaway-core";
import { createWorkOrderService } from "./cutaway/workorder";
import type { WorkplaceTask } from "./workplace";

function applied(): TaskSnapshot {
  return {
    runId: "repair-run",
    stage: "applied",
    sequence: 1,
    context: null,
    evidenceIds: [],
    evidence: null,
    error: null,
    workOrder: null,
    workOrderReceipt: null,
    candidate: {
      runId: "repair-run",
      digest: "repaired-source",
      artifactDigest: "artifact",
      baseReleaseId: "baseline",
      verificationId: "checks",
      changedPaths: ["src/server/reservations.ts"],
      summary: "Check capacity and insert the reservation in one transaction.",
      previewUrl: "http://127.0.0.1:4121",
    },
    verification: {
      id: "checks",
      runId: "repair-run",
      candidateDigest: "repaired-source",
      artifactDigest: "artifact",
      passed: true,
      checks: [
        {
          id: "capacity",
          passed: true,
          detail: "One booking succeeds; the other is sold out.",
          evidenceId: null,
        },
      ],
    },
    deployment: {
      runId: "repair-run",
      releaseId: "repaired-source",
      previousReleaseId: "baseline",
      appliedAt: new Date().toISOString(),
      healthy: true,
      contextRestored: true,
      existingRecordsPreserved: true,
      scope: "local-demo",
    },
  };
}

function fixture() {
  const state = applied();
  const tasks: WorkplaceTask[] = [];
  let connections = 0;
  let creates = 0;
  let corruptRead = false;
  let beforeCreate = () => {};
  const service = createWorkOrderService({
    async controller(path, body) {
      if (path === "state") return Response.json(state);
      assert.equal(path, "report-receipt");
      const saved = body as { workOrder: WorkOrder; receipt: WorkOrderReceipt };
      state.workOrder = saved.workOrder;
      state.workOrderReceipt = saved.receipt;
      return Response.json(state);
    },
    connect() {
      connections++;
      return {
        async close() {},
        workplace: {
          async identity() {
            return {
              id: "operator",
              workspaceId: "studio",
              name: "Studio operator",
            };
          },
          async list(marker) {
            return tasks.filter((task) => task.description.includes(marker));
          },
          async get(id) {
            const task = tasks.find((task) => task.id === id);
            assert.ok(task);
            return {
              ...task,
              ...(corruptRead ? { description: "Not the saved report" } : {}),
            };
          },
          async create(title, description, guard) {
            beforeCreate();
            await guard();
            creates++;
            const task = {
              id: "2d2d66bb-e218-456c-a4b5-4cf59dc6515e",
              title,
              description,
              url: null,
            };
            tasks.push(task);
            return task;
          },
        },
      };
    },
  });
  const save = () =>
    service.saveWorkOrderReport(
      new Request("http://localhost:3100/api/cutaway/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runId: "repair-run",
          candidateDigest: "repaired-source",
        }),
      }),
    );
  return {
    state,
    tasks,
    service,
    save,
    connections: () => connections,
    creates: () => creates,
    corruptRead: (value: boolean) => {
      corruptRead = value;
    },
    beforeCreate: (callback: () => void) => {
      beforeCreate = callback;
    },
  };
}

test("handoff creates a real task after Apply without a preexisting work order, then reuses it", async () => {
  const f = fixture();
  assert.equal(await (await f.service.readWorkOrder()).json(), null);
  assert.equal(f.connections(), 0);
  const receipt = await (await f.save()).json();
  assert.equal(receipt.saved, true);
  assert.ok(receipt.readBackAt);
  assert.equal(f.creates(), 1);
  assert.equal(f.state.workOrder?.id, receipt.taskId);
  assert.match(
    f.state.workOrder!.description,
    /One booking succeeds; the other is sold out/,
  );
  assert.match(
    f.state.workOrder!.description,
    /Changed source: src\/server\/reservations.ts/,
  );
  assert.equal(
    (await (await f.service.readWorkOrder()).json()).id,
    receipt.taskId,
  );
  await f.save();
  assert.equal(f.creates(), 1);
});

test("handoff cannot create a task before verified Apply and context restoration", async () => {
  for (const change of [
    (state: TaskSnapshot) => {
      state.stage = "ready";
    },
    (state: TaskSnapshot) => {
      state.deployment!.contextRestored = false;
    },
    (state: TaskSnapshot) => {
      state.verification!.passed = false;
    },
    (state: TaskSnapshot) => {
      state.deployment!.healthy = false;
    },
    (state: TaskSnapshot) => {
      state.deployment!.existingRecordsPreserved = false;
    },
  ]) {
    const f = fixture();
    change(f.state);
    await assert.rejects(f.save(), /Apply the verified repair/);
    assert.equal(f.connections(), 0);
  }
});

test("a failed readback is not a saved receipt; retry finds the already-created task", async () => {
  const f = fixture();
  f.corruptRead(true);
  await assert.rejects(f.save(), /not been confirmed/);
  assert.equal(f.state.workOrder, null);
  assert.equal(f.state.workOrderReceipt, null);
  assert.equal(f.creates(), 1);
  f.corruptRead(false);
  const receipt = await (await f.save()).json();
  assert.equal(f.creates(), 1);
  assert.equal(receipt.saved, true);
});

test("changing the active repair before the provider write prevents task creation", async () => {
  const f = fixture();
  f.beforeCreate(() => {
    f.state.runId = "another-run";
  });
  await assert.rejects(f.save(), /different repair/);
  assert.equal(f.creates(), 0);
  assert.equal(f.state.workOrderReceipt, null);
});
