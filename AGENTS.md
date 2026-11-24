# BreadBoard repository instructions

## Scope

- BreadBoard is intended to implement the original full phases. Phase 0 is the
  current baseline, not a permanent restriction. Implement later phases when
  they are assigned by the active plan.
- Do not wire Gemini in Phase 0. Provider research is complete for later work:
  use `gemini-3.8-flash` as the stable default when a later phase explicitly
  authorizes provider integration.
- Do not add speech recognition yet unless a later phase explicitly requires
  it. Browser speech services may send audio to a remote service and can fail
  offline, so never describe voice as fully local. Text commands are the
  fallback.
- Future voice commands `Help` and `Check my step` must route to guide and
  check respectively, never to a separate ask flow. Use
  `routeVoiceCommand` from `@breadboard/shared`.
- Do not take screenshots automatically on lesson start or step presentation.
  Captures are explicit user actions.
- An `activeTab` grant requires a toolbar action, context menu, or command. A
  side panel click does not grant it. The toolbar action opens the side panel
  through `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`; do
  not synthesize a tracked grant or call `sidePanel.open` manually.
- When capture is implemented in a later phase, its errors must tell the user
  to click the BreadBoard toolbar action on Photopea or the sandbox page after
  switching sites.
- Do not commit or push until independent QA has verified the work.

## Commands

```bash
npm install
npm run build
npm test
npm run typecheck
npm run lint
npm run format:check
npm run dev:server
npm run dev:extension
npm run dev:sandbox
npm run mock
npm run smoke
```

`npm run build` emits `shared/dist`, `server/dist`, `extension/dist`, and
`sandbox/dist`. Run it before `npm run smoke` or loading the unpacked
extension.

## Layout

- `shared/` — zod schemas and inferred types used by all apps.
- `server/` — Express localhost server; Phase 0 exposes `/health` only.
- `extension/` — Chrome MV3 background service worker, React side panel,
  sandbox page, and the source-of-truth `manifest.json`.
- `sandbox/` — root Vite development harness for the sandbox tools.
- `scripts/` — local smoke checks.

## Conventions

- Strict TypeScript, ESLint, and Prettier are enforced from the repository
  root. Prefer small modules and zod-validated boundaries.
- Keep schema changes in `shared/` and export them from `shared/src/index.ts`.
- The server allows only the exact `EXTENSION_ORIGIN` and explicit localhost
  origins. Never restore wildcard CORS.
- Sandbox state must stay inspectable through `data-sandbox-state` on the root
  and `data-state` on the state element.
