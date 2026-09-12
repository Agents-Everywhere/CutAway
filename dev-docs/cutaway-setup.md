# Cutaway setup

Run all commands from the repository root. The [main quickstart](../README.md#run-the-demo)
starts the complete app; this page explains the requirements and development commands.

## Requirements

- **Node.js 22**, matching `.nvmrc`, and npm. With nvm installed, run `nvm use`.
- **Docker** running Linux containers, with the `docker` command available.
- A browser. Voice also needs microphone permission and an OpenAI API key.

The recorded build was exercised on macOS with Docker Desktop. A native SQLite
module is installed by npm; a platform without a matching prebuilt binary needs
its normal C/C++ build tools.

Playwright/Chromium, FFmpeg and PulseAudio are **not required** to run Cutaway or
its standard checks. Playwright and FFmpeg were used to capture and edit the demo.

## Install and configure

```bash
npm ci
cp .env.example .env
docker build -f infra/codex-worker/Dockerfile -t cutaway-codex-worker infra/codex-worker
```

Copy the environment file only on a fresh setup; preserve an existing `.env`.
Before starting, fill in the selected credentials and choose an operator password:

| Setting                                                 | Required for                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `MODEL_PROVIDER=openrouter`, `OPENROUTER_API_KEY`       | The default chat and coding configuration                     |
| `MODEL`, `CODEX_MODEL`                                  | Model identifiers; the example selects Muse for both          |
| `OPENROUTER_REASONING_EFFORT`, `CODEX_REASONING_EFFORT` | The example uses `xhigh` for both                             |
| `CUTAWAY_OPERATOR_PASSWORD`                             | Staff sign-in; an empty value disables Cutaway access         |
| `OPENAI_API_KEY`                                        | Optional Realtime voice; typing works without it              |
| `AMBIGUOUS_API_KEY`                                     | Optional team handoff after Apply; no task needs to be seeded |

Use an OpenRouter account with access to the configured model. The worker reads
`OPENROUTER_API_KEY`; set that exact name. CopilotKit runs with the model provider
in this build and does not require an Intelligence account or Slack setup.

Keep `.env` private. The dev launcher creates its own controller token in ignored
`.cutaway/config`; neither provider keys nor that token belong in browser code.

## Start, use and reset

```bash
npm run dev:cutaway
```

Visit [Fieldnote](http://127.0.0.1:3100) as a customer, then
[sign in as an operator](http://127.0.0.1:3100/operator) to open Cutaway. Select the
availability indicator and ask it to fix the last-place double booking while
preserving existing reservations. The first start builds the Fieldnote target;
wait for the app to appear before selecting it.

The launcher starts Next.js and the controller. The controller owns the current
Fieldnote container and, after a repair, its Preview container. Default loopback
ports are 3100 (web), 4310 (controller), 4120 (current app) and 4121 (Preview).
Use Ctrl+C in the launcher terminal to stop its owned services.

With the launcher still running and the repair settled:

```bash
npm run demo:reset
```

Reset restores defective demo source, resets synthetic bookings and starts a new
repair context. Apply uses the existing active booking database instead. Runtime
candidates and data live under ignored `.data/cutaway/`; the checked-in Fieldnote
source intentionally retains the bug for the next demonstration.

Operator sessions expire after eight hours and use a signed HttpOnly,
SameSite=Strict cookie. Changing the password invalidates existing sessions.
The server enforces access on AI, repair, voice and workplace routes. Another
host app should connect this gate to its own operator identity and permissions.

## Verify changes

Build the Docker image above and keep Docker running, then run:

```bash
npm run verify:cutaway
```

This checks workspace types, runs 113 tests, lints the Cutaway implementation and
builds Fieldnote and the Next.js app. The booking tests start real containers,
send HTTP requests and read SQLite directly. Provider keys are not needed for
this automated suite; real model, voice and Ambiguous access require a live run.

The Next.js production build uses `.next-production` so it can be checked while
the development app is running. `build:cutaway` builds artifacts; it does not
publish or deploy the app. `dev:web` starts only Next.js and is useful only when
the controller is already running separately.

The [validation report](../Cutaway-OpenSpec/references/validation-report.md) and
[curated run proof](../assets/cutaway-run.json) record the demonstrated repair.
A clean-clone rehearsal remains separate from those completed checks.
