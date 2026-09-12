# Cutaway demo

Cutaway lets authorized operators investigate and fix bugs inside the app
they're using, by typing or speaking. It edits real source code, runs
independent checks, offers a preview and asks for approval before applying the
exact tested version.

The [final video](assets/cutaway-demo.mp4) is **118 seconds (1:58)**. It starts
with that purpose, compares a conventional workflow **without Cutaway**, then
follows one operator through a real repair. The
[run proof](assets/cutaway-run.json) records the actual candidate, four checks,
deployment and new Ambiguous task. Use the [README](README.md#run-the-demo) to
run the app and the
[script](Cutaway-OpenSpec/openspec/changes/build-cutaway-in-app-repair/demo-script.md)
for the narration and evidence timings.

## Video description

**Cutaway — fix bugs from inside the live app**

You’re using an app and discover a bug. Usually, fixing it means explaining the
problem in a ticket, helping someone reproduce it, and moving through code
changes, testing and deployment. Cutaway brings that repair workflow directly
into the app.

Cutaway is an embedded coding agent for authorized operators. Select the affected
part of the page, then type or speak to investigate the problem and request a fix.
Cutaway receives the page and record context, reproduces the bug, edits real
source code in an isolated worker, and runs independent checks.

In this demo, a Fieldnote Studio operator discovers that two customers can book
the last available pottery place. Someone could arrive expecting a seat that
doesn’t exist. Watch the operator investigate, review the repair, try it in an
interactive Preview with separate test data, and explicitly approve the tested
version for the live app. Fieldnote restarts with Morgan’s existing reservation
preserved, while Cutaway’s conversation stays open.

Afterward, the operator saves the verified result to Ambiguous, where it can
support manager reviews, booking checks and customer updates through connected
workflows.

Fieldnote is the first integration. Cutaway is designed to work across apps
through host-specific context, permissions, checks and deployment adapters.
Regular visitors use the app normally; repair controls and APIs are restricted
to authorized operators.

## What the viewer sees

| Step               | Action and proof                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand Cutaway | Investigation, source repair, tests and approval are stated first; text and voice are both supported                                                                   |
| Compare workflows  | Without Cutaway, a conventional repair moves through a ticket, reproduction, code review, tests and deployment. Cutaway supplies the selected page and record directly |
| Report the bug     | A signed-in Fieldnote operator selects availability and types the request; customers do not get repair controls                                                        |
| Reproduce it       | Two confirmations and two database rows for one remaining place                                                                                                        |
| Ask by voice       | Real push-to-talk asks “What changed?”, calls `read_task` and receives the actual Realtime answer                                                                      |
| Check the repair   | Four checks outside the coding worker verify capacity, valid bookings, full-capacity rejection and Morgan's original record                                            |
| Try it first       | Preview is explicitly not live; Avery's test booking appears there while Current still contains only Morgan                                                            |
| Apply              | The enabled approval identifies the exact tested version; Fieldnote restarts and Morgan's booking remains                                                              |
| Share the result   | Optional Save report creates a new Ambiguous task and reads the verified report back                                                                                   |

The unchanged narration says “A typical repair starts with a ticket.” That
phrase describes the **without Cutaway** example; the following sentence
introduces Cutaway. This written comparison makes that distinction explicit. It concerns
context reconstruction and handoffs: the agent receives the selected app context
and performs the investigation and source repair while the operator retains
Preview and approval. Team production reviews remain a host-specific requirement;
the film does not claim instant repairs.

## How it works

See the [architecture and sequence diagrams](ARCHITECTURE.md) for the host adapter,
protected checks, data separation and approval boundary.

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
