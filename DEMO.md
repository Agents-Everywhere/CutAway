# Cutaway demo

Cutaway is a coding agent for authorized operators, embedded in the live
applications people already use. Visitors use the ordinary app. An operator
signs in, points at a problem, asks for a repair, inspects the evidence, tries a
preview and approves an update to the live app. Only Preview uses a separate
test database. Fieldnote Studio is the first demonstrated host, presented as the
studio’s live booking app: a bug can promise the last pottery place to two
customers. Morgan already has a reservation, so the repair must preserve it.

The
[two-minute script](Cutaway-OpenSpec/openspec/changes/build-cutaway-in-app-repair/demo-script.md)
contains the narration and exact screen evidence for each beat. Use the
[README](README.md#run-the-demo) to start the app and reset the synthetic
fixture. The final [video](assets/cutaway-demo.mp4) is 107.8 seconds. The
[run proof](assets/cutaway-run.json) records the applied candidate and new report
task. Model/build waits are shortened visibly; the Apply segment retains its
original speed.

## What the viewer sees

| Beat                  | Operator action                                       | Visible proof                                                                       |
| --------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Recognize the problem | Visitor page → operator sign-in → open Cutaway        | Visitor has no active repair panel; operator sees the launcher and Morgan's booking |
| Investigate           | Notice the bug, select availability, request a repair | Page context and an experiment that actually overbooks                              |
| Review the repair     | Inspect changed source details and checks             | Measured booking outcomes and preserved-record check                                |
| Try it                | Make a booking in Preview                             | Usable repaired UI with separate test data                                          |
| Update the app        | Review and click Apply                                | Live app restarts, conversation retained, Morgan still booked                       |
| Report back           | Optionally save a report after Apply                  | New Ambiguous task created and read back with the verified report                   |

## Technical explanation

The visitor page exposes Fieldnote without an active repair panel. The demo uses
a simple operator password and signed session for `/operator` and the server
repair APIs. Five focused access tests and actual unauthenticated/login requests
passed; an independent substantive review found no blocking issues. Another host
should connect Cutaway to its existing authentication and operator permissions.
This demo gate is not an enterprise identity system.

The Next.js/CopilotKit shell keeps the conversation and optional voice session
beside the host app. A small host connector supplies the selected page element,
record and source binding. A local controller sends candidate source to a fresh
Codex SDK worker in Docker, then runs independent HTTP/database checks outside
the worker's editing boundary. Preview uses a separate database. The operator's
Apply button restarts Fieldnote with the verified candidate and existing active
data. Ambiguous is an optional handoff after the repair: a separate Save report
button creates a task with the measured outcome, then reads the new record back
before showing success. The bug is discovered in Fieldnote; no existing task or
preseeded work order is needed. OpenRouter supplies the configured chat/coding
model; OpenAI Realtime supplies voice when used.

## Is Cutaway specific to Fieldnote?

The intended product is a repair layer for applications people already use.
Fieldnote demonstrates one complete integration. Another host must supply
authorized operator access, page and record context, source access, independent
behavior checks and a build/start/restart adapter. The conversation, isolated
repair worker, preview and approval flow form the reusable layer. The current
connector uses `postMessage` for a web host. Other apps require integration
work; arbitrary apps and other platforms have not been demonstrated by this
repository.

Show that distinction visually: open on visitor Fieldnote without the repair
panel, sign in as an operator, invoke the small launcher, and keep Fieldnote
visible during the repair. A closing caption explains the integration contract
without showing fictional hosts.

## Editorial review

| Requested criterion              | How the script addresses it                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is the technology clear?         | The opening identifies an embedded coding agent. Source edits, independent checks, preview and approved restart explain what it actually does.                                                                           |
| Is it designed for other apps?   | Fieldnote is named as the first integration. The ending names what another app supplies without claiming turnkey support.                                                                                                |
| Is the operator workflow clear?  | An authorized operator signs in, selects, investigates, reviews, tries, approves and saves. Each action has an on-screen result. The app is live in the scenario; Preview is separate, and Apply updates the active app. |
| Are integrations explained?      | Ambiguous appears only after Apply as an optional new task containing the verified report. The technical paragraph explains the model, shell and worker roles.                                                           |
| Is it clear and free of AI slop? | Concrete actions replace slogans and vague benefits. “Two bookings for one place” states the bug; Morgan's reservation states what must survive. No manufactured reactions, testimonials or unsupported speed claims.    |

The human appeal comes from an ordinary responsibility: a studio should honor
the places it has promised. The bug is noticed in the app, not imported from a
task. The operator keeps control, and the customer record provides a visible
thread from the opening to the outcome. Technical details appear when they
explain evidence or a decision. Keep narration in plain language; retain the
host app's own identity throughout.

## From repair to team follow-up

The saved Ambiguous report is the integration point for the team’s next actions.
Its verified outcome can feed a manager’s review, a booking check or an update
for affected customers. The closing scene shows **FROM REPAIR TO FOLLOW-UP ·
Manager review · Booking check · Customer update** after the actual task receipt.
The foundation is the working task creation and readback. The demo does not show
the downstream review, check or customer update executing.

## Scope and delivery

Use real footage and actual controller/provider results. The records and booking
delay are synthetic. Apply updates a running local demo; it does not publish to
production hosting. Preview bookings do not become active bookings. Saving the
Ambiguous report is an external write with its own explicit button. A voice
feature may exist while the recorded request is typed; label the take
accurately. If narration is generated or waits are shortened, disclose that in
the video or its description. Keep the final video at or below 120 seconds.
