# Cutaway

**Investigate and fix bugs inside the app you’re using.**

[Watch the 1:58 demo](assets/cutaway-demo.mp4) · [Run the app](README.md#run-the-demo) ·
[Inspect the recorded proof](assets/cutaway-run.json) ·
[GitHub repository](https://github.com/Agents-Everywhere/CutAway)

The repository and the included demo video are public. Event submission and the
social post remain separate steps for the team.

## Project description

Cutaway is a coding agent embedded in an existing app for its operators. An
operator selects the part that looks wrong and asks for help by typing or
speaking. Cutaway reproduces the issue, changes real source code in an isolated
worker and runs independent checks that the worker cannot edit. The operator
can try a Preview before approving the exact tested build. The app restarts
with its existing data while the conversation stays open.

Our first host is Fieldnote Studio. Two customers can book the last pottery
place, leaving someone without a seat. Cutaway repairs that race while keeping
Morgan’s existing reservation. After Apply, the operator can create an Ambiguous
task containing the result and verify it by reading the same task back. The
problem starts in the app; no ticket or preseeded task is needed.

Other hosts provide authorized access, page/record context, source, independent
checks and build/restart behavior. Fieldnote demonstrates that contract end to
end and provides a working example for the next integration.

## Evidence for the judging criteria

| Criterion                         | Demonstrated evidence                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Requirements & Functionality | Selection → typed request → reproduced race → source repair → voice follow-up → checks → Preview → Apply → restored app → optional task handoff |
| Innovation & Theme Alignment      | The operator's selected page, record and source binding supply context inside the app where the problem appears                                 |
| Technical Execution & Integration | Isolated worker, direct HTTP/SQLite verification, separate Preview data, source/build-bound approval and actual Ambiguous creation/readback     |
| Usefulness & Agentic Experience   | The operator tries and approves the repair, existing bookings survive, and the verified result can be shared with the team                      |

`npm run verify:cutaway` passed strict workspace types, **113 tests**, lint and
both production builds at `c9ad60c`. Independent reviews covered access,
controller lifecycle, model context and the final UI. The full booking tests
require Docker and the worker image; no provider keys are needed for that suite.
A clean-clone quickstart rehearsal is still outstanding.

The recorded run is `72d41994-606c-4b35-8f33-bb242fa34a18`, with applied source
`02dbc23e452297cc827e7fe059ee5878b1d5856f4c659268b3b953b43a12b09d`.
Its four checks passed and the existing record was preserved. Save report
created Ambiguous task `6e16a5d1-fcd1-40de-af1b-4c92011eede1`; readback completed
at `2026-09-12T19:03:23.866Z`. The provider returned no task URL.

## Technology and attribution

| Technology                              | Role in Cutaway                                                        |
| --------------------------------------- | ---------------------------------------------------------------------- |
| CopilotKit                              | Conversational UI, page context and model-callable actions             |
| OpenRouter                              | Configured Muse model for chat and source repair                       |
| OpenAI                                  | Codex SDK worker integration and Realtime voice                        |
| Ambiguous AI                            | Optional new task containing the completed repair and measured results |
| React, Next.js, Vite, SQLite and Docker | Host UI, builds, persistent bookings and isolated execution            |

Cutaway builds on CopilotKit's MIT-licensed Agents, Everywhere starter at
`86f547d74e8bd32e047226b0e1fb862cca02a5c7`. Inherited pieces include model
adapters, web runtime/context patterns, voice connection and the workplace
adapter. Cutaway adds Fieldnote, operator access, the controller/worker,
protected booking checks, Preview, explicit Apply, context restoration and the
post-repair handoff. The original [LICENSE](LICENSE) remains. Implementation
and runtime repairs are AI-assisted.

## Demo scope

The film shows the workflow of a studio's live app. Execution is local and the
bookings are synthetic; no public hosting, payment or customer email is claimed.
Only signed-in operators receive Cutaway, enforced by server-side sessions as
well as the UI. Another host should use its own operator identity and roles.

All app interactions play at original speed in a fixed view. One labelled break
omits 4m48s of worker waiting. The push-to-talk exchange uses the running voice
integration and an actual OpenAI Realtime answer. See [DEMO.md](DEMO.md) for
recording and narration details.

The Ambiguous task can support a manager's review, booking checks or customer
updates. The demo proves the report handoff; it does not execute those downstream
actions or replace a team's production review requirements.

## Remaining submission steps

- [ ] Confirm the local event window, eligibility and deadline against the
      [organizer guidance](hackathon-rules.md).
- [ ] Rehearse the repository quickstart from a clean clone.
- [x] Make the intended repository and video publicly accessible.
- [ ] Publish the social post with the handles required by the local organizer.
- [ ] Submit through the participant portal and retain its confirmation.

Draft social copy:

> We built Cutaway for Agents, Everywhere: a coding agent inside the app you’re
> already using. In Fieldnote, it reproduces a double booking, repairs the source
> and runs independent checks. The operator tries a preview and approves the
> update; existing bookings survive. A verified Ambiguous task carries the result
> to the team. Built with CopilotKit, OpenRouter and OpenAI, with Ambiguous for the
> handoff.
