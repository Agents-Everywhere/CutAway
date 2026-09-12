# Fieldnote Studio

A small original workshop booking app used by the Cutaway repair demo. React and
Vite render the page; a Node HTTP server and SQLite own actual reservations.

From the repository root, install with `npm install`, then:

```bash
npm run build --workspace fieldnote
npm run start --workspace fieldnote
```

Open http://127.0.0.1:4120/workshops/pottery-saturday. These commands run the original
source. Cutaway builds and runs generated candidates inside its restricted Docker
containers; use the controller for candidate execution. The process reports
`FIELDNOTE_READY {"port":4120,"revision":"..."}` when listening; `PORT=0` chooses a
free listening port. Docker checks map the container port to an ephemeral host port.

| Variable              | Default                  | Purpose                                  |
| --------------------- | ------------------------ | ---------------------------------------- |
| `HOST`                | `127.0.0.1`              | Listen address; containers use `0.0.0.0` |
| `FIELDNOTE_DIST_PATH` | `dist` under target root | Location of static build output          |
| `PORT`                | `4120`                   | Target HTTP port                         |
| `DB_PATH`             | `.data/fieldnote.sqlite` | Active or disposable SQLite database     |
| `RELEASE_ID`          | `fieldnote-baseline`     | Revision exposed by health and connector |
| `RUN_ID`              | `standalone`             | Cutaway run identity                     |
| `SHELL_ORIGIN`        | `http://localhost:3100`  | Exact parent origin allowed by connector |

The frame URL accepts `?runId=<id>&surface=current` or `surface=preview`; the URL run
ID overrides the default run ID. The connector sends protocol 1 hello, context,
and restored messages, and accepts select and restore messages only from its
configured parent window and origin. Stable element IDs are `booking.capacity`,
`booking.submit`, and `booking.reservations`. No unrelated browser data is collected.

## API

- `GET /health` → `{revision, ready}`
- `GET /api/events/pottery-saturday` → `{id, title, capacity, reserved, available}`
- `GET /api/events/pottery-saturday/reservations` → `{reservations: [...]}`
- `POST /api/events/pottery-saturday/reservations` accepts
  `{customerName, customerEmail, requestId}`; returns `201 {reservation}` or
  `409 {code: "SOLD_OUT", message}`.

A new database seeds capacity 2 and Morgan Reed's existing reservation, leaving
one place. Startup never resets existing reservations. Demo reset is a separate
controller operation. No payment or email is sent.

Reservation handling lives in `src/server/reservations.ts`. Its synthetic provider
round trip sends no payment or email. Runtime changes must preserve the documented
API and existing reservations.

Protected checks live outside this app in `packages/cutaway-checks`; they exercise
real parallel HTTP requests and independently inspect database rows. Run
`npm test --workspace cutaway-checks` and `npm run typecheck --workspace fieldnote`.
The illustration and page were created for this demo; there are no external assets.
