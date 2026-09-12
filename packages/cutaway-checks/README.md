# Protected booking checks

`runBookingChecks({ targetRoot, runId, revision, mode, scratchRoot? })` boots the
specified target against fresh synthetic data on an ephemeral port. It returns
`{passed, evidence, checks, experiments}`. The primary evidence is always the
2-customer/1-place experiment; every request includes an independent request ID.

- `mode: 'baseline'` requires actual overbooking plus working sequential bookings.
- `mode: 'candidate'` requires exactly one success/one SOLD_OUT for one place,
  three successes for three places, and rejection when full.
- Both modes compare Morgan's original complete database row after each scenario.

Docker must be running and the `cutaway-codex-worker` image must exist (the controller
builds it during preflight). `CUTAWAY_WORKER_IMAGE` can select another prepared image.
Each check container gets readonly target source and one writable disposable database
directory. It receives no host dependencies, credentials, home or Docker socket.

The harness creates its own SQLite fixtures and compares response IDs, request IDs,
customer names and stored row counts. It imports no target code and reads database
rows independently on the host after the target container finishes writing. Databases and
processes are disposable and do not touch active or preview reservations. The
controller should retain returned evidence before temporary fixture cleanup. These
checks establish the local demo behavior, not production correctness.

Keep this package outside the coding worker mount. The target's `database.ts`,
`index.ts`, `client/connector.ts`, package manifest and configuration are protected.
Only booking-handler and ordinary client source edits are allowed by the controller.
