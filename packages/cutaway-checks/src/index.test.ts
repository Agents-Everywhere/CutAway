import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runBookingChecks } from "./index.js";

const targetRoot = fileURLToPath(
  new URL("../../../examples/fieldnote", import.meta.url),
);

test("baseline reproduces a genuine race, keeps sequential booking working, and preserves Morgan", async () => {
  const result = await runBookingChecks({
    targetRoot,
    runId: "test-baseline",
    revision: "baseline-test",
    mode: "baseline",
  });
  assert.equal(result.passed, true, JSON.stringify(result.checks));
  assert.equal(result.evidence.invariant, "violated");
  assert.equal(result.evidence.newReservations, 2);
  assert.equal(result.evidence.rowsAfter, 3);
});

test("protected candidate checks reject the unmodified baseline", async () => {
  const result = await runBookingChecks({
    targetRoot,
    runId: "test-candidate",
    revision: "candidate-test",
    mode: "candidate",
  });
  assert.equal(result.passed, false);
  assert.equal(
    result.checks.find((check) => check.id === "two-for-one")?.passed,
    false,
  );
  assert.equal(
    result.checks.find((check) => check.id === "available-capacity")?.passed,
    true,
  );
  assert.equal(
    result.checks.find((check) => check.id === "full-capacity")?.passed,
    true,
  );
  assert.equal(
    result.checks.find((check) => check.id === "preserve-morgan")?.passed,
    true,
  );
});
