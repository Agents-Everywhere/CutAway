import assert from "node:assert/strict";
import test from "node:test";
import { CutawayController } from "./controller.js";
import type { WorkOrder, WorkOrderReceipt } from "cutaway-core";

const workOrder: WorkOrder = {
  id: "task",
  workspaceId: "studio",
  title: "Repair handoff",
  description: "Cutaway repair repair-run/repaired-source",
  url: null,
};
const receipt: WorkOrderReceipt = {
  taskId: "task",
  runId: "repair-run",
  candidateDigest: "repaired-source",
  reportMarker: "Cutaway repair repair-run/repaired-source",
  saved: true,
  readBackAt: new Date().toISOString(),
  url: null,
};

function controller() {
  const value = new CutawayController("/unused-test-repository");
  Object.assign(value, {
    snapshot: {
      ...value.state,
      runId: "repair-run",
      stage: "applied",
      candidate: { digest: "repaired-source" },
      verification: { passed: true },
      deployment: {
        healthy: true,
        contextRestored: true,
        existingRecordsPreserved: true,
      },
    },
  });
  return value;
}

test("handoff task and receipt bind together only to the current applied repair", () => {
  const value = controller();
  assert.throws(
    () => value.reportReceipt({ ...receipt, runId: "stale" }, workOrder),
    /does not match/,
  );
  assert.equal(value.state.workOrder, null);
  const state = value.reportReceipt(receipt, workOrder);
  assert.equal(state.workOrder?.id, "task");
  assert.equal(state.workOrderReceipt?.taskId, "task");
  assert.throws(
    () =>
      value.reportReceipt(
        { ...receipt, taskId: "other" },
        { ...workOrder, id: "other" },
      ),
    /does not match/,
  );
});

test("reset clears the handoff and starts a new operator-discovered repair", async () => {
  const value = controller();
  value.reportReceipt(receipt, workOrder);
  value.close = async () => {};
  value.initialize = async () => {};
  const state = await value.reset();
  assert.notEqual(state.runId, receipt.runId);
  assert.equal(state.workOrder, null);
  assert.equal(state.workOrderReceipt, null);
  assert.equal(state.candidate, null);
});
