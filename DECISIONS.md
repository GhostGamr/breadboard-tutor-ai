# Decisions

## ADR-001: Root project naming (corrected)

- **Decision:** The repository root package is named `breadboard`, workspace
  packages are scoped as `@breadboard/shared`, `@breadboard/server`, and
  `@breadboard/extension`, and user-facing text uses **BreadBoard**.
- **Why:** The project is BreadBoard, not TutorAI. The earlier TutorAI naming
  was incorrect and has been replaced consistently in packages, imports,
  scripts, UI, docs, tests, and service identifiers.
- **Status:** Accepted.

## ADR-002: Side panel behavior and activeTab

- **Decision:** The background service worker only calls
  `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on load,
  install, and startup. It does not listen for `chrome.action.onClicked`, call
  `chrome.sidePanel.open`, or track a simulated grant.
- **Why:** `openPanelOnActionClick` is the browser-supported way to open the
  panel from the toolbar action. Chrome's `activeTab` grant comes from the
  toolbar action, context menu, or command; a side panel click cannot grant it.
  Asserting a tracked grant would be unreliable because the worker may not
  receive the assumed event. Capture permission enforcement is deferred to the
  later capture implementation, whose errors must instruct the user to click
  the BreadBoard toolbar action after switching sites.
- **Status:** Implemented for Phase 0 and behavior-tested.

## ADR-003: Provider research is for later phases

- **Decision:** Phase 0 does not wire Gemini. Research for later work established
  `gemini-3.8-flash` as the stable default model, `generateContent` with
  `fileData.fileUri` for YouTube file input, the tutorial video
  `https://www.youtube.com/watch?v=zVpeDyBLgiU` (3:44), and chapter starts at
  70, 94, 122, 169, and 204 seconds.
- **Why:** Provider research is complete, but Phase 0 remains a scaffold. Voice
  must not be described as fully local because browser speech services may
  transmit audio and can fail offline; text remains the fallback.
- **Status:** Research recorded; no provider code in Phase 0.

## ADR-004: No automatic screenshots

- **Decision:** Lesson start and step presentation never take screenshots.
  Capture is an explicit user action in a later phase.
- **Why:** Automatic capture would surprise users and conflict with the
  explicit `activeTab` grant flow.
- **Status:** Implemented for Phase 0.

## ADR-005: Inspectable sandbox state

- **Decision:** The sandbox mirrors full state into `data-sandbox-state` on its
  root and `data-state` on the state element, in addition to readable JSON.
- **Why:** Later guide/check flows need a stable snapshot without depending on
  pixels, and tests can assert state directly.
- **Status:** Implemented in both the extension sandbox and root dev harness.

## ADR-006: Exact-origin CORS

- **Decision:** The server accepts only the exact configured `EXTENSION_ORIGIN`
  plus explicit localhost origins. All other origins receive HTTP 403.
- **Why:** Wildcard CORS would allow arbitrary sites to call the localhost
  server. Exact matching keeps the local API scoped to the extension and dev
  harness.
- **Status:** Implemented and tested.

## ADR-007: React side panel and single manifest source

- **Decision:** The side panel UI is React-based. `extension/manifest.json` is
  the single source of truth and Vite copies it into `extension/dist` during
  builds.
- **Why:** React was explicitly required. A copied manifest avoids stale
  duplicates under `public/` or `dist/`. The root `sandbox/index.html` is a Vite
  dev harness that imports the same sandbox module as the extension page.
- **Status:** Implemented for Phase 0.

## ADR-008: Later Photopea DOM context (verified, not implemented)

- **Context:** The real Photopea app starts at `/#` with no toolbar until
  **New Project** is chosen and the dialog's **Create** action is used.
  Preflight for a lesson should use Photopea, then New Project, then Create.
- **Verified selectors:** toolbar tools are
  `button.toolbtn[title^="Move Tool"]` and
  `button.toolbtn[title^="Type Tool"]`, with the active tool carrying class
  `active` (active state appears as `.toolbtn.active` with title Type Tool
  (T)); the main canvas is `div.pbody > canvas` rather than the first generic
  canvas; Type color is `span.fitem.colorsample.bbtn` under `.colorsample`, has
  no text/title, and needs a semantic registry label; layer rows use `.headL`
  with selected state `.thumb.active` and name `.label`; the Layers tab is
  `div[title="Layers"]` containing a `span.label`; **File** is a button matched
  by exact visible text with no title or aria label; **New Project** is
  initially text, not a button. After the native File click, the New menu item
  is `<div class="enab" title="New Project">...<span class="label">New...</span>...`,
  so the later registry should target visible `[title="New Project"]`; otherwise
  expose the menu by targeting visible exact-text **File**.
- **Observation method:** Parent used native simulated input only to observe
  these elements. The extension must not click them in Phase 0.
- **Decision:** Record this for the later core loop only. Phase 0 does not
  consume these selectors or implement the preflight sequence.
- **Status:** Recorded for a later phase.
