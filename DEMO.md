# Cutaway demo

Cutaway lets authorized operators investigate and fix bugs inside the app
they're using, by typing or speaking. It edits real source code, runs
independent checks, offers a preview and asks for approval before applying the
exact tested version.

The [final video](assets/cutaway-demo.mp4) is **118 seconds (1:58)**. It starts
with that purpose, compares the usual ticket-to-deployment workflow, then
follows one operator through a real repair. The
[run proof](assets/cutaway-run.json) records the actual candidate, four checks,
deployment and new Ambiguous task. Use the [README](README.md#run-the-demo) to
run the app and the
[script](Cutaway-OpenSpec/openspec/changes/build-cutaway-in-app-repair/demo-script.md)
for the narration and evidence timings.

## What the viewer sees

| Step               | Action and proof                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Understand Cutaway | Investigation, source repair, tests and approval are stated first; text and voice are both supported                                             |
| Compare workflows  | A typical repair moves through a ticket, reproduction, code review, tests and deployment; Cutaway supplies the selected page and record directly |
| Report the bug     | A signed-in Fieldnote operator selects availability and types the request; customers do not get repair controls                                  |
| Reproduce it       | Two confirmations and two database rows for one remaining place                                                                                  |
| Ask by voice       | Real push-to-talk asks “What changed?”, calls `read_task` and receives the actual Realtime answer                                                |
| Check the repair   | Four checks outside the coding worker verify capacity, valid bookings, full-capacity rejection and Morgan's original record                      |
| Try it first       | Preview is explicitly not live; Avery's test booking appears there while Current still contains only Morgan                                      |
| Apply              | The enabled approval identifies the exact tested version; Fieldnote restarts and Morgan's booking remains                                        |
| Share the result   | Optional Save report creates a new Ambiguous task and reads the verified report back                                                             |

The comparison concerns context reconstruction and handoffs. It does not promise
to remove a team's production review requirements or imply instant repairs.

## How it works

The Next.js/CopilotKit shell keeps selected page context, conversation and voice
beside the host app. A fresh Codex SDK worker edits candidate source in Docker.
The controller owns checks outside that worker, separate preview data, the
tested candidate identity and target restart. Apply reuses the existing active
database. Ambiguous receives an optional report only after successful Apply; a
new task is created and read back before Saved appears. OpenRouter supplies the
configured Muse model at unchanged `xhigh` reasoning; OpenAI Realtime supplies
voice.

A simple password and signed session restrict the demo to operators, including
its repair/provider APIs. Another host should use its own identity and roles.
The app now has a 480 px workbench, 15 px body text, 16 px chat text, compact
cards and a real Reading indicator. Compact model context and direct repair
routing remove unnecessary planning and polling turns.

## Other apps and team workflows

Fieldnote is the first host integration. Other apps provide authorized access,
page/record context, source, independent checks and a build/restart adapter. The
repair, preview and approval flow is reusable; arbitrary apps have not all been
tested by this repository.

The saved Ambiguous report is the existing integration point for manager review,
booking checks or customer updates. The film demonstrates the report handoff;
those downstream actions are not shown executing.

## Editorial review

| Requested criterion             | What the final film establishes                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Technical clarity               | Cutaway's purpose comes first; source editing, independent checks and exact-version approval follow                                        |
| Beyond Fieldnote                | Fieldnote is named as the first integration, with the host contract explained here                                                         |
| Operator workflow               | Selection → request → reproduction → voice follow-up → checks → Preview/Current → Apply → report                                           |
| Integrations                    | Actual Realtime speech and an actual post-repair Ambiguous task/readback contribute to the workflow                                        |
| Human appeal and clear language | The concern is someone arriving without a seat, and preserving Morgan's promise; no fabricated reactions, hype or unsupported speed claims |

## Recording and validation

The camera remains fixed and all app actions play at original speed. One
labelled break at 46–48 seconds omits 4m48s of inactive worker waiting. There is
no timelapse, zoom, replay or inserted freeze. Coral provides the different,
brighter stock narration, paced at 1.12× for the edit. The actual voice exchange
is unaltered and has no narration over it: stock Samantha input is supplied only
while the real push-to-talk control is pressed; the answer is live OpenAI
Realtime Marin speech.

Full decoding, encoded-audio transcription, frame review and independent movie
review passed. No subjective human listening review is claimed. Execution is
local with synthetic bookings; no payment, customer email or public production
hosting is implied. The
[validation report](Cutaway-OpenSpec/references/validation-report.md) contains
the final identifiers and file hash.
