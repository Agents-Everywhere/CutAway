# Contributing to Cutaway

Start with the [quickstart](README.md#run-the-demo) and
[setup details](dev-docs/cutaway-setup.md). The project uses Node 22, npm workspaces
and a Docker image shared by the coding worker, target app and booking checks.

## Keep the demonstration reproducible

Fieldnote's checked-in source deliberately contains the booking race. Cutaway
repairs a runtime copy; its resulting candidate, databases and recordings are
ignored. A change that permanently removes the baseline bug also removes the
scenario the demo and independent tests are meant to exercise.

Preserve the operator's explicit Apply step, separate Preview data and existing
booking records. The coding worker must not gain access to the controller,
protected checks or active database. Keep new host-specific behavior in that
host's context, source/check and lifecycle adapters.

## Check a change

Build the worker image once, keep Docker running, and run:

```bash
npm run verify:cutaway
```

This runs workspace typechecks, tests, lint and production builds. The booking
tests use real HTTP requests and SQLite reads in disposable containers; model
and workplace credentials are not required. Add focused tests for behavior
changes at these boundaries. Keep library versions and `@ag-ui/client`
deduplication consistent with [AGENTS.md](AGENTS.md).

Before a pull request, check `git diff --check`, describe the user-visible change
and its validation, and update the relevant setup or architecture notes. Keep
credentials, generated databases, candidate source and raw recordings out of Git.
Do not present a scripted result as a live model, repair or provider outcome.

The [submission notes](SUBMISSION.md) distinguish inherited starter code from
Cutaway's implementation. Preserve the original MIT license and attribution.
