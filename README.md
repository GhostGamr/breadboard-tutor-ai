# BreadBoard

BreadBoard opens the web software demonstrated in a YouTube tutorial and displays a collapsible tutor in that tab. The dashboard and toolbar side panel both launch lessons.

## Run the prepared lesson

1. With Node.js 20+ installed, run `npm install` and `npm run demo`.
2. In Chrome, open `chrome://extensions`, enable Developer mode, and load the unpacked `extension/dist` directory.
3. Open or refresh http://127.0.0.1:8787, optionally enter one follow-up task per line, and select **Try the prepared text lesson**. Photopea opens in a new tab with the first task.
4. Follow each instruction in Photopea, use the timestamp links to revisit the video, and choose **Mark step done** to advance. Dashboard follow-up tasks appear after the tutorial. Click the tutor header to collapse or expand it.

The prepared lesson is self-guided and requires no API key. Progress follows the assigned tab across reloads within the browser session.

## Learn from another video

1. Copy `.env.example` to `.env`. Set `GEMINI_API_KEY` and set `EXTENSION_ORIGIN` to `chrome-extension://YOUR_ID` using the ID shown in Chrome Extensions.
2. Run `npm run live`. The default model is `gemini-3.8-flash`.
3. Submit a public tutorial up to 15 minutes long from the dashboard. The analyzer identifies Photopea, Canva, or Figma and extracts timestamped tasks. The corresponding web app opens. Sign in if the software requires an account.
4. Click the BreadBoard toolbar icon on the software tab to grant screenshot access. You can close the side panel and use **Help**, **Check my step**, or **Ask tutor** in the overlay.

These actions send a screenshot to the server-side provider. Starting a lesson or displaying a step takes no screenshot. A successful check advances the lesson. Voice commands use the same tutor actions and may use a remote browser speech service. API keys stay on the server.

## Development

Run `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run smoke`. The dashboard dev server runs with `npm run dev:sandbox` at http://localhost:5173. The tutor API runs on port 8787.
