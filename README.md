# BreadBoard MVP

A tutor beside your workspace that identifies a mismatch, explains the correction, and points at a relevant control without taking over the mouse.

## Free demo (recommended)

Requires Node.js 20+ and npm. No API key or extension needed.

```sh
npm install
npm run demo
```

Open **http://127.0.0.1:8787** in Chrome. Keep the terminal running. Use a desktop-sized window and choose **Try the prepared text lesson**.

The practice tutor is deterministic, not a live AI model. It checks actual canvas state and is labeled “Scripted practice.” New video URLs explicitly fall back to the prepared lesson in this mode.

Already built? Run: **node server/dist/index.js --mock**

## Two-minute judge demo

1. Start the prepared lesson. The document is already open; click **Check my step**.
2. Leave **Move** selected. Check again: the tutor identifies the wrong tool and points at **Type**.
3. Click **Type**, then Check. The lesson advances.
4. Enter words in the toolbar **Text** field and click the canvas. Check to confirm creation.
5. Check without changing anything: the colour step remains incomplete.
6. Keep the same text layer selected, change **Color**, and Check. The lesson completes.
7. Before completion, ask “Why isn’t my text showing?” to demonstrate troubleshooting.
8. Optionally use **Speak** and say “Help” or “Check my step.” Text buttons remain available.

Pitch the difference: a second monitor shows the same tutorial; this tutor identifies a mismatch in the learner’s current state and confirms the correction. Do not claim the scripted demo analyzes arbitrary videos.

## Implemented

- Prepared four-step Photopea text lesson and source timestamp links.
- Actual canvas-state verification, mistake recovery, and progress.
- Passive orange pointer with visibility and confidence checks.
- Question input, browser speech output, optional speech recognition.
- Capture only on Help, Check, or Ask; no background screen recording.
- Shared tutor UI in standalone practice studio and Chrome side panel.
- Optional server-side Gemini video extraction and screenshot tutoring.
- Validated requests, fresh captures, rate limits, exact-origin CORS.

## Optional live Photopea mode

Requires Gemini quota and model access. Live API behavior has not been verified in this environment.

1. Copy .env.example to .env at the repository root.
2. Set GEMINI_API_KEY. Keep it private; .env is ignored by Git.
3. GEMINI_MODEL defaults to gemini-3.8-flash per the repository decision. Override with a compatible video/vision model available to your account if needed.
4. Run npm run build.
5. Open chrome://extensions, enable Developer mode, load unpacked **extension/dist**.
6. Put the extension ID in .env: EXTENSION_ORIGIN=chrome-extension://YOUR_ID.
7. Run node server/dist/index.js without --mock. Restart after changing .env.
8. Open Photopea and click the BreadBoard toolbar icon to grant capture and open its panel.
9. Submit a short public Photopea text tutorial (up to 15 minutes) or choose the prepared lesson.

Gemini receives the public video URL during extraction. Explicit live tutoring sends a screenshot, visible controls, lesson, and question. A prior screenshot can verify a colour change. The key stays on the server. Generated lessons are cached in memory; the authored lesson uses a local disk cache. Quota errors are shown rather than silently replaced by fake AI results.

The standalone canvas always uses exact state checks, even with a key. Extension sandbox pages are not capture targets; use localhost practice.

## Voice and pointer

Recognition varies by browser and may send audio to a remote browser speech service. Grant microphone access yourself if you want voice. Text is always available.

“Help” routes to guidance; “Check my step” to verification. Other speech becomes a question. The overlay never clicks or moves your real mouse. It is removed before capture and expires after nine seconds or scrolling/resizing. Keep the toolbar visible.

## Development

```sh
npm run build
npm test
npm run typecheck
npm run lint
npm run format:check
npm run smoke
```

For hot reload, run npm run mock and npm run dev:sandbox in separate terminals; open http://localhost:5173. Server/client default port is 8787; changing PORT requires updating the client URL too.

- shared/: schemas and voice routing
- server/: lesson/session API and providers
- extension/: side panel, capture, pointer, voice, canvas
- sandbox/: standalone studio
- docs/QA.md: verification and limitations

## Limits and troubleshooting

One text-editing workflow, not any website/software. No Coursera authentication, playlists, desktop After Effects, autonomous clicking, or accounts. Photopea selectors may change; vision fallback needs a live model. Live video extraction and microphone input need separate rehearsal. Refresh resets canvas/UI; server sessions expire after an hour.

If offline, run npm run demo. If capture is denied, click the Chrome toolbar icon on Photopea or localhost after switching sites. If port 8787 is occupied, stop the earlier BreadBoard terminal first.
