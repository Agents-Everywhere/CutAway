# Cutaway submission notes

**Cutaway — fix the app without leaving it.**

The final [video](assets/cutaway-demo.mp4) is **118 seconds (1:58)**. It shows a
real typed repair request and voice follow-up, readable evidence, a preview,
explicit Apply and a new Ambiguous report. Full decoding, encoded-audio
transcription and frame review passed. The app view stays fixed, and every
interaction plays at original speed; one labelled break omits 4m48s of worker
waiting. Publication and event submission remain separate actions.

## Project description

Cutaway lets authorized operators investigate and fix bugs from inside the app
they're using, by typing or speaking. It edits real source code, tests the
repair outside the coding worker, offers a preview and asks for approval before
applying the exact verified version. The conversation stays open while the app
restarts against its existing data.

In Fieldnote Studio, two customers can book the last pottery place. The operator
selects the workshop's availability and asks Cutaway to reproduce and repair the
bug without losing Morgan's booking. Preview uses separate test data; the update
becomes live only after Apply. Afterward, the operator can create an Ambiguous
task containing the verified result and read it back. No preseeded task is
needed.

Fieldnote is the first host integration. Other apps supply authorized access,
page/record context, source, independent checks and a build/restart adapter.

## Who it helps and why the app matters

Visitors use Fieldnote without an active repair panel. An authorized operator
signs in to use Cutaway inside the same app. The demo adds a simple
password/signed-session gate; another host should use its own identity and
operator permissions. Five focused access tests, actual request checks and an
independent substantive review passed.

The operator is responsible for workshop bookings and wants to stop promising
the same place twice. Selecting the actual availability indicator gives Cutaway
the workshop, element and source binding. The operator discovers the problem in
the app and supplies the repair request directly. Preview and approval happen
beside the app the operator already recognizes, with the existing customer
record visible before and after repair.

## Technology and attribution

| Technology                          | Contribution                                                             |
| ----------------------------------- | ------------------------------------------------------------------------ |
| CopilotKit                          | Existing web shell, page context, agent tools and controlled UI          |
| OpenRouter                          | Configured Muse model for chat and runtime coding                        |
| OpenAI                              | Codex SDK worker integration and separate Realtime voice                 |
| Ambiguous AI                        | Optional task creation after repair, with a verified report and readback |
| React/Next.js, Vite, SQLite, Docker | Application UI, target build/data and isolated execution                 |

Inherited infrastructure comes from CopilotKit's MIT-licensed Agents, Everywhere
starter at `86f547d74e8bd32e047226b0e1fb862cca02a5c7`: model adapters, web
runtime/context patterns, voice connection and approved workplace adapter.
Cutaway adds [Fieldnote](examples/fieldnote/README.md), the repair
controller/worker, protected booking checks, candidate preview, explicit Apply,
restart/context restoration and the repair-report handoff. The original
[LICENSE](LICENSE) remains. Source implementation and runtime repairs are
AI-assisted.

## Evidence for the judging criteria

| Official criterion                | Cutaway evidence                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Requirements & Functionality | Real selection → request → reproduction → source repair → checks → preview → Apply → restored app → optional new-task report readback                                |
| Innovation & Theme Alignment      | The coding agent starts from the current app element and workshop; the host app remains the main surface                                                             |
| Technical Execution & Integration | Isolated worker, independent HTTP/SQLite checks, separate preview data, exact-candidate approval and verified task persistence; 113 tests and production builds pass |
| Usefulness & Agentic Experience   | The operator can inspect and try a repair, decides when to apply it, keeps existing bookings and can share the result in a new team task                             |

Final successful run: `72d41994-606c-4b35-8f33-bb242fa34a18`. Applied candidate:
`02dbc23e452297cc827e7fe059ee5878b1d5856f4c659268b3b953b43a12b09d`. After Apply,
Save report created new Ambiguous task `6e16a5d1-fcd1-40de-af1b-4c92011eede1`;
its report was read back at `2026-09-12T19:03:23.866Z`. The provider returned no
URL, so no task link is invented here.

## Repository readiness

- [x] README explains setup, accounts, start/reset, architecture and
      limitations.
- [x] `npm run verify:cutaway` passes strict types, 113 tests, lint and both
      production builds.
- [x] Whole-change code and restart review returned GREEN.
- [x] `.env`, local tokens, generated databases, candidate source and raw
      recordings are ignored.
- [x] Synthetic data, local update scope and other-app integration work are
      described.
- [ ] Rehearse the published repository quickstart from a clean clone.
- [ ] Publish the intended project repository and record its public URL.

## Demo delivery

- [x] Capture the final workflow: bug discovered in Fieldnote, real source
      repair, then optional new Ambiguous task creation and readback.
- [x] Show Fieldnote before opening Cutaway; preserve the distinction between
      host and assistant.
- [x] Show operator review, usable preview, explicit Apply and the resulting
      update to the running app.
- [x] Prepare plain-language narration and proof shots covering the five
      requested review criteria.
- [x] Verify the visitor/operator access gate: five focused tests, actual denied
      requests, successful login and independent review.
- [x] Include the captured real operator sign-in in the final edit.
- [x] Validate the 118-second readable video: full decoding, encoded narration
      and fixed-frame visual continuity passed.
- [x] Deliver [assets/cutaway-demo.mp4](assets/cutaway-demo.mp4) and
      [curated run proof](assets/cutaway-run.json). Public publication remains a
      separate action.

The camera uses a fixed full-frame view with no zoom, timelapse, replay or
inserted freeze. One labelled editorial break skips inactive worker waiting.
Coral provides the brighter stock narration, paced at 1.12× for the edit. The
real voice exchange is unaltered: a stock macOS Samantha question is supplied
only while actual push-to-talk is pressed, and the answer comes from the live
OpenAI Realtime session using Marin. No human-recorded operator voice or
subjective listening review is claimed.

The scenario represents the studio's live app. Execution is local and bookings
are synthetic; no public production hosting, payment or customer email is
claimed. The conventional workflow comparison concerns context reconstruction
and handoffs, not a promise to remove a team's production review requirements.

## From repair to team follow-up

The verified Ambiguous report can feed a manager’s review, a booking check or an
update for affected customers. This is the purpose of the existing report
handoff: carry the repair evidence into the team’s work. The demo proves
creation and readback of the task; those downstream actions are not shown
executing.

## Publication and event checks

The team must confirm its city-specific event window and eligibility against the
[organizer guidance](hackathon-rules.md). The implementation notes distinguish
inherited code from Cutaway work; they do not establish the organizer's official
build window.

- [ ] Confirm build eligibility and the local submission deadline.
- [ ] Inspect final public files and the movie for secrets before publishing.
- [ ] Publish the repository and video, then insert their actual links.
- [ ] Add sponsor handles required by the local organizer and publish the social
      post.
- [ ] Submit through the participant portal and retain its confirmation.

Draft social copy, to accompany the real repository and video links:

> We built Cutaway for Agents, Everywhere: a coding agent inside an app you
> already use. In our Fieldnote demo, it reproduces a double booking, edits the
> source, runs independent checks and offers a preview. The operator approves
> the update to the live app; existing bookings survive. After the repair, the
> operator can create an Ambiguous task with the verified result. Built with
> CopilotKit, OpenRouter and OpenAI, with Ambiguous for the work-order handoff.
