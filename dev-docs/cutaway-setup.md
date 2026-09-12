# Cutaway dependencies

Use the existing checkout and Node 22, as specified in `.nvmrc`.
On this Mac, Node 22 is installed alongside the existing default Node version:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm ci
npx playwright install chromium
npm run verify
```

Cutaway's additional dependencies are pinned in the root package manifests:

| Dependency                                | Purpose                               |
| ----------------------------------------- | ------------------------------------- |
| `@openai/codex-sdk`                       | Run the coding worker                 |
| `better-sqlite3` and its TypeScript types | Store workshop reservations           |
| `vite`                                    | Build the Fieldnote target frontend   |
| `@playwright/test` and Chromium           | Exercise and capture the browser flow |

Docker Desktop is installed on this machine. Start it before using containers.
FFmpeg, FFprobe, and PulseAudio utilities are installed through Homebrew:

```bash
brew install node@22 ffmpeg pulseaudio
open -a Docker
```

Provider credentials are configured separately in the ignored root `.env`,
following `.env.example`. The recorded demo uses typed input and generated
narration. The real OpenAI Realtime voice path was also exercised separately.

Set `CUTAWAY_OPERATOR_PASSWORD` in that same ignored `.env`. Ordinary visitors
open `/` and see Fieldnote's booking app. Staff sign in at `/operator` to mount
Cutaway in the app. All AI, control, voice, and workplace API routes require
the signed operator session; hiding the launcher is not the security boundary.
The session expires after eight hours and is stored in an HttpOnly,
SameSite=Strict cookie. Changing the password invalidates existing sessions.
This hackathon integration uses one shared staff password. A deployed host
would connect the same server-side gate to its own operator identity and role.

Setup verified on 12 September 2026: workspace typechecks and offline tests,
Docker's test container, SQLite write/read, Codex SDK loading, Chromium launch
and page rendering, and FFmpeg H.264/AAC encoding and decoding all passed.
Existing locked package versions were preserved and `@ag-ui/client` remains
deduplicated at `0.0.59`. Later live model, voice, repair and Ambiguous checks are
recorded in the [validation report](../Cutaway-OpenSpec/references/validation-report.md).
