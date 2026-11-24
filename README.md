# BreadBoard

**Chrome‑extension tutor that turns a YouTube tutorial into guided practice inside a web app.**  
It reads the tutorial once (Gemini), then while the learner works it can: explain the current step by voice, point to the relevant control with a separate pointer overlay, inspect the learner's current screen when they say “Help” or “Check my step”, diagnose why their attempt differs from the tutorial, guide one correction, answer questions with tutorial timestamps, and then re‑check the next attempt with a fresh screenshot. The learner always keeps control of the real mouse; BreadBoard never clicks for them.

---

## Quick start (no API key required)

```bash
npm install
npm run build          # builds shared, server, extension, sandbox
npm run smoke          # runs the mock‑mode API smoke test
```

In Chrome:

1. Open `chrome://extensions`, enable **Developer mode**, load the unpacked `extension/dist` directory.
2. Open http://127.0.0.1:8787 (server starts on this port).
3. Click **Try the prepared text lesson** – Photopea opens in a new tab with the first task.
4. Follow each instruction in Photopea, use the timestamp links to revisit the video, and choose **Mark step done** to advance.

The prepared lesson works entirely in **mock mode** – no Gemini API key is needed.

---

## Full development workflow

```bash
# install dependencies
npm install

# build everything (shared, server, extension, sandbox)
npm run build

# run the test suite (vitest, 46+ tests after Phase 1)
npm test

# type‑check, lint, format
npm run typecheck
npm run lint
npm run format:check

# start the server (mock mode if MOCK=1 or no GEMINI_API_KEY)
npm run dev:server     # Express on http://127.0.0.1:8787

# watch‑build the extension side‑panel
npm run dev:extension  # Vite watch build to extension/dist

# run the sandbox in dev mode (Vite dev server at http://localhost:5173)
npm run dev:sandbox

# mock‑mode server with deterministic scripted responses
npm run mock

# smoke test – hits /api/lesson, /api/guide, /api/check in mock mode
npm run smoke
```

---

## Phase summary (what’s in the codebase)

| Phase | What’s implemented | Test count |
|------|-------------------|------------|
| **0** | Scaffold: npm workspaces, TS configs, ESLint/Prettier, shared Zod schemas, Express health route (`/health`), MV3 side panel, sandbox page with Move/Type/Brush controls. | 30 tests |
| **1** | Mock lesson cache, session engine, 46 endpoint tests for `/api/lesson`, `/api/guide`, `/api/check`, JPEG‑header validation, deterministic mock‑mode scripted flow (wrong tool → help → Type tool → check → advance). | 46 tests |
| **2‑4** | Planned: real Gemini integration (`gemini-3.8‑flash` default), screenshot capture via `activeTab`, pointer overlay (closed Shadow DOM), voice (push‑to‑talk, TTS), `ask` endpoint with clickable timestamps, full end‑to‑end demo on Photopea, DEMO.md & README polish. | – |

---

## Architecture overview

The browser extension (React side panel) sends a YouTube URL to the Express server, which either parses the lesson with Gemini (or falls back to a cached hand‑authored lesson). The lesson steps are displayed in the side panel. When the learner clicks **Help** or **Check my step**, a screenshot is captured (via `captureVisibleTab` with an `activeTab` grant) and sent to the server. The server uses Gemini to compare the screenshot against the expected step state, returns a diagnosis, spoken guidance text, and a pointer‑overlay target. The pointer is rendered in a closed Shadow DOM and glides to the suggested control without dispatching a click. The **Ask** endpoint answers free‑form questions with timestamped video references and offers **Check my step**. All inputs and Gemini outputs are validated with Zod; the server enforces CORS only to the exact extension origin and localhost. Phase 0 supplies the scaffold (lesson cache, session state, health check). Phase 1 adds the mock‑mode lesson loop, JPEG validation, and regression tests. Phases 2‑4 will add real Gemini integration, voice (push‑to‑talk/TTS), and the full end‑to‑end demo on Photopea.

---

## Commands (full list)

```bash
npm install                              # install all workspaces
npm run build                            # build shared, server, extension, sandbox
npm run dev:server                       # start Express (mock if MOCK=1 or no key)
npm run dev:extension                    # Vite watch build extension/dist
npm run dev:sandbox                      # Vite dev server for sandbox at localhost:5173
npm run mock                             # server in deterministic mock mode
npm run test                             # vitest run (46+ tests after Phase 1)
npm run typecheck                        # TS strict check across workspaces
npm run lint                             # ESLint
npm run format:check                     # Prettier check
npm run smoke                            # mock‑mode API smoke test (lesson → guide → check)
```

---

## Known limitations (honest, no invented claims)

- **No real Gemini integration yet** – the server falls back to mock mode when `GEMINI_API_KEY` is absent or `MOCK=1`. Voice (push‑to‑talk, TTS) is not implemented; text commands are the fallback.
- **CORS is strict** – only the exact `EXTENSION_ORIGIN` (e.g. `chrome-extension://YOUR_ID`) and `localhost:127.0.0.1` are allowed. Other origins get a CORS error.
- **Screenshot capture needs an `activeTab` grant** – click the BreadBoard toolbar action on the practice tab to grant it; a side‑panel click does **not** grant capture.
- **Pointer overlay does not auto‑click** – it merely positions a fixed‑z‑index label; the learner must click themselves.
- **Lesson extraction from YouTube is not wired** – the scaffold provides a hand‑authored fallback (`server/data/lessons/photopea-text-demo.json`) marked “using cached lesson”. Real Gemini video‑understanding is pending Phases 2‑4.
- **No user accounts, payments, multi‑app support, analytics, or auto‑clicking** – these are out of scope for the MVP.
- **Performance / improvement numbers are not claimed** – the pitch states benefits are hypotheses.

---

## Demo script (2‑minute rehearsed flow)

See `DEMO.md` for a precise scripted run‑through of the supported‑mistake demo (Move tool → Help → Type tool → Check → advance to next step → “why is my text not showing?” timestamped answer). The file is generated alongside the code and contains the pre‑flight checklist and recovery plan.

---

## Getting help

- Open an issue on GitHub: <https://github.com/GhostGamr/breadboard-mvp>
- Review `docs/QA.md` for recent quality‑assurance findings.
- Run `npm run smoke` to see the mock‑mode API flow in isolation.

---

*BreadBoard – a hackathon prototype (wHACKiest 2026, Track 2: “Beyond the Browser”).*