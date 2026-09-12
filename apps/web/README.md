# Cutaway web shell

This Next.js app presents Fieldnote Studio and mounts Cutaway for signed-in
operators. Cutaway keeps the conversation and selected page context available
while its controller investigates, repairs, previews and restarts Fieldnote.

Use the [repository quickstart](../../README.md#run-the-demo) to install Node 22
dependencies, build the Docker worker image and configure root `.env`. Start the
complete application from the repository root:

```bash
npm run dev:cutaway
```

Open [Fieldnote](http://127.0.0.1:3100) or the
[operator sign-in](http://127.0.0.1:3100/operator). The operator password is
`CUTAWAY_OPERATOR_PASSWORD` in ignored root `.env`. The default model provider
uses `OPENROUTER_API_KEY`; `OPENAI_API_KEY` adds voice and `AMBIGUOUS_API_KEY`
adds optional report handoff after Apply.

`npm run dev:web` starts this Next.js process alone. It does **not** start the
controller or Fieldnote, so it is not the complete demo command.

## Main boundaries

| Location                                   | Responsibility                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/app/page.tsx`, `src/app/operator/`    | Customer view and operator sign-in                                            |
| `src/components/cutaway/workbench.tsx`     | Host app viewport, evidence, Preview, approval and conversation               |
| `src/components/cutaway/agent-control.tsx` | Selected page context and model-callable actions                              |
| `src/components/cutaway/voice-input.tsx`   | Real push-to-talk and Realtime tools                                          |
| `src/lib/cutaway-client.ts`                | Controller snapshots and browser actions                                      |
| `src/lib/server/cutaway/`                  | Operator sessions, controller access, voice credentials and Ambiguous handoff |
| `src/app/api/copilotkit/`                  | Authenticated conversational model endpoint                                   |
| `src/app/api/cutaway/`                     | Authenticated reads and actions; Apply remains a separate operator decision   |

The customer page does not mount the model provider or Cutaway workbench. The
server also checks the operator session on every AI, repair, voice and workplace
API. Closing the panel keeps its conversation and voice session mounted.

Fieldnote runs on a separate local origin and supplies selected context through
its small connector. Its current and Preview containers have different booking
databases. The source, checks, build and restart behavior are managed by
[`apps/controller`](../controller/) and the host adapter, not by this UI.

## Development checks

From the root, with Docker running and the worker image built:

```bash
npm run verify:cutaway
```

For a focused web change, `npm run typecheck --workspace web` and
`npm run test --workspace web` run the web checks. The full command also covers
the controller, independent booking tests and production builds. See
[setup details](../../dev-docs/cutaway-setup.md) for lifecycle and reset behavior.

## Inherited reference code

The repository retains incident cards, follow-up adapters, the standalone
`/voice` example and `/api/mobile-copilotkit` from the starter. They are reference
infrastructure; the homepage now runs Cutaway's Fieldnote workflow. Their
provider routes share the operator access gate. There is no incident selector
on the current homepage, and Cutaway does not require a pre-existing workplace
task or expose raw Ambiguous write tools to chat.

Attribution and the reusable host contract are in the [root README](../../README.md).
