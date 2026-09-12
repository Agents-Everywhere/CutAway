# Cutaway coding worker

Build once from the repository root:

```sh
docker build -f infra/codex-worker/Dockerfile -t cutaway-codex-worker infra/codex-worker
```

The controller starts a fresh container and Codex SDK thread for each repair. It
mounts only the candidate source, request observations, and runtime repair prompt.
The host home, Docker socket, controller source, protected checks, active database,
and project specifications are absent. The nonroot worker uses a read-only image,
temporary home, dropped Linux capabilities, and the SDK's `workspace-write` sandbox
with approval policy `never`. It cannot approve or deploy its own edits.

Docker Desktop needs `seccomp=unconfined` to allow the SDK's nested user namespace
and Bubblewrap sandbox. This does not enable privileged Docker mode or disable
the SDK sandbox. A local smoke check verified workspace writes, rejected writes
to `/opt`, UID 1000, and absent host-home and Docker-socket paths.

The SDK reads `MODEL_PROVIDER`, `CODEX_MODEL`, `CODEX_REASONING_EFFORT`, and only the
selected model credential. For OpenRouter, configure `OPENROUTER_API_KEY`; the SDK
uses its supported custom provider configuration with the Responses endpoint.
An OpenAI key is not required for OpenRouter repairs. Model and reasoning access
remain account-dependent; a provider rejection is shown as a failed repair.

The image supplies locked Codex SDK and target libraries through `npm ci`. The
worker does not install dependencies. After it exits, the controller rejects edits
outside the allowlist and rejects source symlinks before launching build tools.
Build containers receive read-only source, a separate writable output directory,
and no network. Build output never follows a worker-provided `dist` path.

The same image also runs Fieldnote and the protected HTTP checks. Each target has
read-only source and built assets, and only its own database directory mounted
writable. Preview and checks never receive the active database, repository,
controller token, provider credentials, host dependencies, or host home. The
approved target alone receives the active database. Target HTTP ports publish on
host loopback; these containers retain ordinary Docker bridge networking.

The tested source and build digests must still match when the operator applies.
