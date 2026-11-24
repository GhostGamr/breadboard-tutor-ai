import {
  HealthResponseSchema,
  TutorStartResponseSchema,
  workspaces,
} from '@breadboard/shared';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import './styles.css';
function SidePanel() {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=zVpeDyBLgiU');
  const [tasks, setTasks] = useState('');
  const [opened, setOpened] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting to local tutor…');
  const lock = useRef(false);
  useEffect(() => {
    api('/health')
      .then((v) =>
        setStatus(
          HealthResponseSchema.parse(v).mockMode
            ? 'Practice mode · no API credits'
            : 'Live AI connected',
        ),
      )
      .catch(() => setStatus('Server offline · run npm run demo'));
  }, []);
  async function start(prepared: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy('Preparing lesson…');
    setError('');
    setOpened('');
    try {
      const extensionId = document.documentElement.dataset.breadboardExtension;
      if (!globalThis.chrome?.runtime?.id && !extensionId)
        throw new Error(
          'Load extension/dist in Chrome Extensions, then refresh this dashboard to open the tutor in your software.',
        );
      const s = TutorStartResponseSchema.parse(
        await api('/lesson/start', prepared ? {} : { url }),
      );
      const message = {
        kind: 'launch',
        session: s,
        tasks: tasks
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      };
      const response = extensionId
        ? await chrome.runtime.sendMessage(extensionId, message)
        : await chrome.runtime.sendMessage(message);
      if (!response?.ok)
        throw new Error(response?.error || 'Could not open the workspace.');
      setOpened('Lesson opened in ' + workspaces[s.lesson.software].name + '.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start lesson');
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  return (
    <main className="panel">
      <header className="brand">
        <span className="brand-mark">b.</span>
        <div>
          <strong>BreadBoard</strong>
          <small>Your learn-by-doing companion</small>
        </div>
      </header>
      <p className="connection">{status}</p>
      <h1>Start a tutorial</h1>
      <p className="muted">
        Open the software from your tutorial and follow each step with
        BreadBoard in the same tab.
      </p>
      <label className="field">
        YouTube tutorial
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
        />
      </label>
      <p className="micro">
        Live mode supports public Photopea, Canva and Figma tutorials up to 15
        minutes. The prepared Photopea lesson works without an API key.
      </p>
      <label className="field">
        Follow-up tasks (optional)
        <textarea
          maxLength={2000}
          value={tasks}
          onChange={(e) => setTasks(e.target.value)}
          placeholder="One task per line"
        />
      </label>
      <button
        className="primary wide"
        disabled={!!busy}
        onClick={() => void start(false)}
      >
        Learn from this video →
      </button>
      <button
        className="wide"
        disabled={!!busy}
        onClick={() => void start(true)}
      >
        Try the prepared text lesson
      </button>
      {opened && <p role="status">{opened}</p>}
      {busy && (
        <p role="status" className="notice">
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  );
}
const container = document.querySelector<HTMLElement>('#sidepanel-root');
if (container) createRoot(container).render(<SidePanel />);
