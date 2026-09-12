# Cutaway submission notes

**Cutaway — fix the app without leaving it.**

The repair workflow and repository checks pass. The final [video](assets/cutaway-demo.mp4) is 107.8 seconds and validated.
The demo presents Fieldnote as the studio’s live booking app, with Preview as
the separate test environment. No public repository, video publication, social
post or event submission is claimed here. See the [demo guide](DEMO.md) and
[validation report](Cutaway-OpenSpec/references/validation-report.md).

## Project description

Cutaway is a coding agent embedded in the live applications people already use.
An authorized operator points to a problem in that app, asks Cutaway to
investigate, inspects a real source repair and independent checks, then tries a
separate preview before approving an update to the live app. Only the preview
uses separate test data; Apply updates the active app while preserving its
existing records. The conversation stays beside the app while it restarts. After
the repair, an optional Save report action creates an Ambiguous task with the
verified outcome. There is no preseeded task or ticket prerequisite.

Fieldnote Studio is the first integration. Its last pottery place can be booked
twice because of a real concurrency bug. The demo reproduces that defect,
repairs the source and preserves Morgan's existing reservation through Apply.
Another app supplies its page context, source, independent checks and restart
adapter. Fieldnote is the first integration; other applications need their own
integration and behavior checks.

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
| Technical Execution & Integration | Isolated worker, independent HTTP/SQLite checks, separate preview data, exact-candidate approval and verified task persistence; 111 tests and production builds pass |
| Usefulness & Agentic Experience   | The operator can inspect and try a repair, decides when to apply it, keeps existing bookings and can share the result in a new team task                             |

Final successful run: `a51579d0-af28-416c-a1cd-46640270a707`.
Applied candidate: `24f0dd7a14ff02ea248f6f4dd128aafb8fd6bf0b8a3b804f079234a33c040733`.
After Apply, Save report created new Ambiguous task
`316ac4e9-2889-4406-853a-5ca2ee3843fe`; its report was read back at
`2026-09-12T17:41:38.202Z`. The provider returned no URL, so no task link is
invented here.

## Repository readiness

- [x] README explains setup, accounts, start/reset, architecture and
      limitations.
- [x] `npm run verify:cutaway` passes strict types, 111 tests, lint and both
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
- [x] Final video is 107.8 seconds; full decoding, encoded-audio transcription and key-frame visual checks passed.
- [x] Deliver [assets/cutaway-demo.mp4](assets/cutaway-demo.mp4) and [curated run proof](assets/cutaway-run.json). Public publication remains a separate action.

The scenario represents the studio’s live app. The recording runs locally with
synthetic bookings; no public production hosting is claimed or required. The
filmed request is typed. Voice was exercised separately through a real OpenAI
connection using generated microphone audio. The final genuine voice connection
also remained connected through Apply without a reconnect; the microphone was
idle, and no speech is claimed for the final take. Video narration, if used, is
generated, and shortened waits must be disclosed. No payment or email is sent by
the booking fixture.

## From repair to team follow-up

The verified Ambiguous report can feed a manager’s review, a booking check or an
update for affected customers. This is the purpose of the existing report
handoff: carry the repair evidence into the team’s work. The demo proves creation
and readback of the task; those downstream actions are not shown executing.

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
