# BreadBoard

Scaffold baseline for BreadBoard, a local-first tutor for Photoshop-style
tasks. Phase 0 has no model provider connected; later phases are expected to
extend this baseline rather than replace it.

## What is included

- **npm workspaces** for `shared`, `server`, and `extension`.
- **Strict TypeScript**, ESLint, and Prettier configured at the repository root.
- **Shared zod schemas** for lessons, timed steps, control metadata, guide and
  check responses, API inputs/outputs, capture contracts, command routing, and
  sandbox state.
- **Express server** bound to localhost with a validated `/health` endpoint and
  exact-origin CORS.
- **Chrome MV3 extension** with a background service worker, React side panel,
  and an interactive Move/Type/Brush sandbox.
- **Root sandbox dev harness** driven by the same sandbox module used in the
  extension build.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run build
npm test
```

To allow the unpacked extension to call the server, copy its ID from
`chrome://extensions` and export the exact origin in the shell **before**
starting the server. The server does not load `.env` automatically.

```bash
export EXTENSION_ORIGIN=chrome-extension://your-extension-id
npm run dev:server
# or, with mock mode reported by /health:
npm run mock
```

The server accepts only `EXTENSION_ORIGIN` and explicit localhost origins
(`http://localhost:8787`, `http://127.0.0.1:8787`, `http://localhost:5173`,
`http://127.0.0.1:5173` by default). Other origins receive HTTP 403.

Build the extension in watch mode:

```bash
npm run dev:extension
```

Then open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select `extension/dist`. Click the BreadBoard toolbar action on
Photopea or the sandbox page to open the side panel. Chrome grants `activeTab`
from the toolbar action (or a future context menu/command), not from a side
panel click. Phase 0 does not synthesize or assert a tracked grant; capture
permission enforcement belongs to the later capture implementation.

Run the sandbox dev page:

```bash
npm run dev:sandbox
```

## Scripts

| Script                                    | Purpose                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `npm run build`                           | Build shared, server, extension, and sandbox bundles. |
| `npm run build:sandbox`                   | Build only the root sandbox harness.                  |
| `npm test`                                | Run the Vitest suite.                                 |
| `npm run typecheck`                       | Type-check every workspace and the sandbox harness.   |
| `npm run lint`                            | Run ESLint.                                           |
| `npm run format` / `npm run format:check` | Format or check formatting.                           |
| `npm run dev:server`                      | Start the localhost server with reload.               |
| `npm run dev:extension`                   | Watch-build the Chrome extension.                     |
| `npm run dev:sandbox`                     | Serve `sandbox/index.html` with Vite.                 |
| `npm run mock`                            | Start the server with mock mode enabled.              |
| `npm run smoke`                           | Check build artifacts and server health.              |

## Phase 0 boundaries

- `/health` is the only server route.
- Voice is not implemented. Browser speech recognition may send audio to a
  browser service and can fail offline, so text is the fallback and voice is
  never described as fully local.
- Future `Help` and `Check my step` commands route to guide and check via
  `routeVoiceCommand`; they do not open a separate ask flow.
- No screenshots are captured automatically on lesson start or step
  presentation. Capture is an explicit user action.
- Host permissions are limited to Photopea and localhost.
- `extension/manifest.json` is the only manifest source. Vite copies it into
  `extension/dist` during builds.

## Research already completed for later phases

- Stable default model: `gemini-3.8-flash`; do not use it in Phase 0.
- YouTube file input is expected to use `generateContent` with
  `fileData.fileUri`.
- Tutorial video: `https://www.youtube.com/watch?v=zVpeDyBLgiU` (3:44 total).
- Chapter starts: 70, 94, 122, 169, and 204 seconds.

See `DECISIONS.md` for the naming decision and other architecture choices.
