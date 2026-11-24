import { HealthResponseSchema } from '@breadboard/shared';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

const HEALTH_URL = 'http://localhost:8787/health';

interface Status {
  kind: 'idle' | 'checking' | 'success' | 'error';
  message: string;
}

function SidePanel(): JSX.Element {
  const [status, setStatus] = useState<Status>({
    kind: 'idle',
    message: 'Not checked',
  });

  async function checkHealth() {
    setStatus({ kind: 'checking', message: 'Checking…' });

    try {
      const response = await fetch(HEALTH_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = HealthResponseSchema.parse(await response.json());
      setStatus({
        kind: 'success',
        message: `${payload.service} is ${payload.status} (v${payload.version})`,
      });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <main className="panel">
      <h1>BreadBoard</h1>
      <p className="muted">
        Phase 0 scaffold — no model provider is connected yet.
      </p>

      <section>
        <h2>Local server</h2>
        <button type="button" onClick={checkHealth}>
          Check health
        </button>
        <pre data-testid="health-result">{status.message}</pre>
      </section>

      <section>
        <h2>Active tab</h2>
        <p className="muted">
          The toolbar action opens this panel through Chrome side panel
          behavior. The <code>activeTab</code> grant comes from that toolbar
          action or a future context menu/command, not from clicks in the side
          panel. Capture permission will be enforced by the later capture
          implementation.
        </p>
      </section>

      <section>
        <h2>Sandbox</h2>
        <a href="sandbox.html">Open the Move / Type / Brush sandbox</a>
        <p className="muted">
          Screenshots are never taken automatically on lesson start or step
          presentation. Voice is not implemented; browser speech services may
          send audio off-device, so text commands are the fallback.
        </p>
      </section>
    </main>
  );
}

const container = document.querySelector<HTMLElement>('#sidepanel-root');
if (!container) throw new Error('Side panel root element is missing.');

createRoot(container).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
