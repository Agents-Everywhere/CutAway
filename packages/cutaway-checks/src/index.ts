import Database from "better-sqlite3";
import type {
  ExperimentEvidence,
  ReservationOutcome,
  Verification,
} from "cutaway-core";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const EVENT_ID = "pottery-saturday";
const MORGAN = {
  id: "existing-morgan",
  event_id: EVENT_ID,
  customer_name: "Morgan Reed",
  customer_email: "morgan@example.test",
  request_id: "seed-morgan",
  created_at: "2026-09-10T14:00:00.000Z",
};
type Row = typeof MORGAN;

export interface BookingCheckOptions {
  targetRoot: string;
  runId: string;
  revision: string;
  mode: "baseline" | "candidate";
  scratchRoot?: string;
  surface?: "current" | "preview";
}

export interface BookingCheckResult {
  passed: boolean;
  evidence: ExperimentEvidence;
  checks: Verification["checks"];
  experiments: ExperimentEvidence[];
}

/** The harness owns its fixtures and reads SQLite directly; it imports no target code. */
function createFixture(databasePath: string, available: number) {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE events (id TEXT PRIMARY KEY, title TEXT NOT NULL, capacity INTEGER NOT NULL);
    CREATE TABLE reservations (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL, request_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );
  `);
  db.prepare("INSERT INTO events VALUES (?, ?, ?)").run(
    EVENT_ID,
    "Saturday pottery workshop",
    available + 1,
  );
  db.prepare(
    `INSERT INTO reservations VALUES (@id, @event_id, @customer_name,
    @customer_email, @request_id, @created_at)`,
  ).run(MORGAN);
  return db;
}

const execute = promisify(execFile);

async function startTarget(options: BookingCheckOptions, databasePath: string) {
  const containerName = `cutaway-check-${randomUUID()}`;
  const child = spawn(
    "docker",
    [
      "run",
      "--rm",
      "--name",
      containerName,
      "--read-only",
      "--user",
      `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=128",
      "--memory=512m",
      "--cpus=1",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=64m",
      "--network=bridge",
      "--publish",
      "127.0.0.1::4120",
      "--mount",
      `type=bind,src=${resolve(options.targetRoot)},dst=/workspace,readonly`,
      "--mount",
      `type=bind,src=${dirname(databasePath)},dst=/data`,
      "--workdir",
      "/workspace",
      "--entrypoint",
      "node",
      "--env",
      "NODE_ENV=test",
      "--env",
      "HOST=0.0.0.0",
      "--env",
      "PORT=4120",
      "--env",
      `DB_PATH=/data/${basename(databasePath)}`,
      "--env",
      `RELEASE_ID=${options.revision}`,
      "--env",
      `RUN_ID=${options.runId}`,
      "--env",
      "SHELL_ORIGIN=http://localhost:3100",
      process.env.CUTAWAY_WORKER_IMAGE ?? "cutaway-codex-worker",
      "--import",
      "tsx",
      "src/server/index.ts",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  let exited = false;
  let startupError: Error | null = null;
  child.stdout.on("data", (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-8_000);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-8_000);
  });
  child.once("error", (error) => {
    startupError = error;
  });
  child.once("exit", () => {
    exited = true;
  });
  const stop = async () => {
    if (exited) return;
    try {
      await execute("docker", ["stop", "--time=2", containerName], {
        timeout: 8_000,
      });
    } catch {
      if (!exited) {
        await execute("docker", ["rm", "--force", containerName], {
          timeout: 8_000,
        });
      }
    }
    for (let attempt = 0; attempt < 50 && !exited; attempt += 1)
      await delay(20);
  };
  try {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      if (startupError) throw startupError;
      if (exited)
        throw new Error(`Fieldnote container exited during checks: ${output}`);
      const match = /FIELDNOTE_READY (\{[^\n]+\})/.exec(output);
      if (match?.[1]) {
        const ready = JSON.parse(match[1]) as {
          port?: unknown;
          revision?: unknown;
        };
        if (ready.port !== 4120 || ready.revision !== options.revision) {
          throw new Error("Fieldnote reported unexpected startup identity.");
        }
        const mapped = await execute(
          "docker",
          ["port", containerName, "4120/tcp"],
          { timeout: 5_000 },
        );
        const portMatch = /^127\.0\.0\.1:(\d+)\s*$/.exec(mapped.stdout);
        if (!portMatch?.[1])
          throw new Error("Fieldnote container has no loopback port mapping.");
        const baseUrl = `http://127.0.0.1:${portMatch[1]}`;
        const health = await fetch(`${baseUrl}/health`, {
          signal: AbortSignal.timeout(2_000),
        });
        const body = (await health.json()) as {
          revision?: unknown;
          ready?: unknown;
        };
        if (
          !health.ok ||
          body.ready !== true ||
          body.revision !== options.revision
        ) {
          throw new Error(
            "Fieldnote health did not confirm the requested revision.",
          );
        }
        return { baseUrl, stop };
      }
      await delay(25);
    }
    throw new Error(`Fieldnote container did not become ready: ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

interface Scenario {
  name: string;
  available: number;
  customers: number;
  sequential?: boolean;
}

async function runScenario(
  options: BookingCheckOptions,
  scenario: Scenario,
): Promise<ExperimentEvidence> {
  const scratchRoot = options.scratchRoot ?? tmpdir();
  await mkdir(scratchRoot, { recursive: true });
  const scratch = await mkdtemp(join(scratchRoot, "cutaway-check-"));
  const databasePath = join(scratch, "bookings.sqlite");
  const fixture = createFixture(databasePath, scenario.available);
  fixture.close();
  let target: Awaited<ReturnType<typeof startTarget>> | undefined;
  try {
    target = await startTarget(options, join(scratch, "bookings.sqlite"));
    const baseUrl = target.baseUrl;
    const startedAt = new Date().toISOString();
    const requests: ReservationOutcome[] = [];
    const actors = ["Avery Park", "Sam Chen", "Jordan Ellis"];
    const send = async (index: number): Promise<ReservationOutcome> => {
      const actor = actors[index] ?? `Customer ${index + 1}`;
      const requestId = randomUUID();
      const response = await fetch(
        `${baseUrl}/api/events/${EVENT_ID}/reservations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: actor,
            customerEmail: `customer-${index}@example.test`,
            requestId,
          }),
          signal: AbortSignal.timeout(5_000),
        },
      );
      const body = (await response.json()) as {
        code?: unknown;
        reservation?: { id?: unknown };
      };
      const reservationId =
        typeof body.reservation?.id === "string" ? body.reservation.id : null;
      return {
        actor,
        requestId,
        status: response.status,
        reservationId,
        result:
          response.status === 201 && reservationId
            ? "confirmed"
            : response.status === 409 && body.code === "SOLD_OUT"
              ? "sold-out"
              : "error",
      };
    };
    if (scenario.sequential) {
      for (let index = 0; index < scenario.customers; index += 1)
        requests.push(await send(index));
    } else {
      requests.push(
        ...(await Promise.all(
          Array.from({ length: scenario.customers }, (_, index) => send(index)),
        )),
      );
    }
    // Finish the container's SQLite writes before reading independently on the host.
    await target.stop();
    target = undefined;
    const db = new Database(databasePath, { readonly: true });
    let rows: Row[];
    try {
      rows = db
        .prepare("SELECT * FROM reservations ORDER BY id")
        .all() as Row[];
    } finally {
      db.close();
    }
    const existingRecordsPreserved = rows.some(
      (row) => JSON.stringify(row) === JSON.stringify(MORGAN),
    );
    const freshRows = rows.filter((row) => row.id !== MORGAN.id);
    const successfulResponses = requests.filter(
      (request) => request.result === "confirmed",
    ).length;
    const correctlyStored = requests.every((request) => {
      const matching = freshRows.filter(
        (row) => row.request_id === request.requestId,
      );
      return request.result === "confirmed"
        ? matching.length === 1 &&
            matching[0]?.id === request.reservationId &&
            matching[0]?.customer_name === request.actor
        : matching.length === 0;
    });
    const passedInvariant =
      freshRows.length <= scenario.available &&
      successfulResponses === freshRows.length &&
      correctlyStored &&
      existingRecordsPreserved;
    return {
      id: `${scenario.name}-${randomUUID()}`,
      runId: options.runId,
      revision: options.revision,
      startedAt,
      completedAt: new Date().toISOString(),
      eventId: EVENT_ID,
      availableBefore: scenario.available,
      requests,
      rowsBefore: 1,
      rowsAfter: rows.length,
      successfulResponses,
      newReservations: freshRows.length,
      existingRecordsPreserved,
      invariant: passedInvariant ? "passed" : "violated",
      artifacts: [],
    };
  } finally {
    await target?.stop();
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function runBookingChecks(
  options: BookingCheckOptions,
): Promise<BookingCheckResult> {
  const evidence = await runScenario(options, {
    name: "two-for-one",
    available: 1,
    customers: 2,
  });
  const checks: Verification["checks"] = [];
  const experiments = [evidence];
  const add = (
    id: string,
    passed: boolean,
    detail: string,
    observed: ExperimentEvidence,
  ) => {
    checks.push({ id, passed, detail, evidenceId: observed.id });
  };
  if (options.mode === "baseline") {
    add(
      "baseline-overbooking",
      evidence.invariant === "violated" &&
        evidence.successfulResponses === 2 &&
        evidence.newReservations === 2,
      `${evidence.successfulResponses} accepted requests and ${evidence.newReservations} stored bookings for 1 place.`,
      evidence,
    );
    const sequential = await runScenario(options, {
      name: "sequential",
      available: 1,
      customers: 2,
      sequential: true,
    });
    experiments.push(sequential);
    add(
      "sequential-booking",
      sequential.invariant === "passed" &&
        sequential.requests[0]?.result === "confirmed" &&
        sequential.requests[1]?.result === "sold-out",
      `Sequential requests returned ${sequential.requests.map((request) => request.status).join(", ")} with ${sequential.newReservations} new row.`,
      sequential,
    );
  } else {
    add(
      "two-for-one",
      evidence.invariant === "passed" &&
        evidence.successfulResponses === 1 &&
        evidence.newReservations === 1 &&
        evidence.requests.filter((request) => request.result === "sold-out")
          .length === 1,
      `${evidence.successfulResponses} accepted, ${evidence.requests.filter((request) => request.result === "sold-out").length} sold out, ${evidence.newReservations} stored for 1 place.`,
      evidence,
    );
    const positive = await runScenario(options, {
      name: "three-for-three",
      available: 3,
      customers: 3,
    });
    experiments.push(positive);
    add(
      "available-capacity",
      positive.invariant === "passed" &&
        positive.successfulResponses === 3 &&
        positive.newReservations === 3,
      `${positive.successfulResponses} accepted requests and ${positive.newReservations} stored bookings for 3 places.`,
      positive,
    );
    const full = await runScenario(options, {
      name: "full-capacity",
      available: 0,
      customers: 1,
    });
    experiments.push(full);
    add(
      "full-capacity",
      full.invariant === "passed" &&
        full.requests[0]?.result === "sold-out" &&
        full.newReservations === 0,
      `Full workshop returned ${full.requests[0]?.status}; ${full.newReservations} new rows.`,
      full,
    );
  }
  add(
    "preserve-morgan",
    experiments.every((experiment) => experiment.existingRecordsPreserved),
    "Compared Morgan’s original ID, name, email, request ID and timestamp directly in SQLite after every scenario.",
    evidence,
  );
  return {
    passed: checks.every((check) => check.passed),
    evidence,
    checks,
    experiments,
  };
}
