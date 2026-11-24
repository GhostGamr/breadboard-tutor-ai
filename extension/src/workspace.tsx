import { routeVoiceCommand } from '@breadboard/shared';
import { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { startVoice } from './voice';
import styles from './styles.css?inline';

import type { Workspace } from './workspace-state';
async function message(kind: string, question?: string) {
  const reply = await chrome.runtime.sendMessage({ kind, question });
  if (!reply?.ok)
    throw new Error(
      reply?.error || 'Reload the page to reconnect to BreadBoard.',
    );
  return reply.data;
}
function Tutor({
  workspace,
  host,
}: {
  workspace: Workspace;
  host: HTMLElement;
}) {
  const { lesson, mock } = workspace.session;
  const [tasks, setTasks] = useState(workspace.tasks);
  const [step, setStep] = useState(workspace.step);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [question, setQuestion] = useState('');
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const stop = useRef<() => void>();
  const lock = useRef(false);
  useEffect(() => () => stop.current?.(), []);
  async function act(kind: string, text = question) {
    if (lock.current || (!step && kind !== 'finish-task')) return;
    lock.current = true;
    setBusy(true);
    setFeedback('');
    try {
      if (['guide', 'check', 'ask'].includes(kind)) {
        host.style.visibility = 'hidden';
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      }
      const result = await message(kind, text);
      setStep(result.step);
      if (result.tasks) setTasks(result.tasks);
      setFeedback(result.diagnosis || '');
      if (kind === 'ask') setQuestion('');
      if (speak && result.spokenText)
        speechSynthesis.speak(new SpeechSynthesisUtterance(result.spokenText));
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Tutor unavailable.',
      );
    } finally {
      host.style.visibility = 'visible';
      lock.current = false;
      setBusy(false);
    }
  }
  function listen() {
    if (listening) {
      stop.current?.();
      return;
    }
    try {
      setListening(true);
      stop.current = startVoice(
        (text) => void act(routeVoiceCommand(text) ?? 'ask', text),
        setFeedback,
        () => setListening(false),
      );
    } catch (error) {
      setListening(false);
      setFeedback(String(error));
    }
  }
  return (
    <aside className="agent" aria-label="BreadBoard tutor">
      <button
        className="agent-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        BreadBoard tutor {open ? '−' : '+'}
      </button>
      {open && (
        <div className="agent-body">
          <h2>{lesson.title}</h2>
          {step ? (
            <>
              <p className="eyebrow">
                Step {step.index + 1} of {lesson.steps.length}
              </p>
              <h3>{step.instruction}</h3>
              {step.seconds !== undefined && (
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={
                    'https://www.youtube.com/watch?v=' +
                    lesson.videoId +
                    '&t=' +
                    step.seconds +
                    's'
                  }
                >
                  Watch at {Math.floor(step.seconds / 60)}:
                  {String(step.seconds % 60).padStart(2, '0')}
                </a>
              )}
              {mock ? (
                <>
                  <p className="micro">
                    Self-guided lesson · Mark each step when you finish it.
                  </p>
                  <button disabled={busy} onClick={() => void act('next')}>
                    Mark step done
                  </button>
                </>
              ) : (
                <>
                  <div className="actions">
                    <button disabled={busy} onClick={() => void act('guide')}>
                      Help
                    </button>
                    <button disabled={busy} onClick={() => void act('check')}>
                      Check my step
                    </button>
                  </div>
                  <label className="field">
                    Ask about this step
                    <textarea
                      value={question}
                      maxLength={1000}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                  </label>
                  <div className="actions">
                    <button
                      disabled={busy || !question.trim()}
                      onClick={() => void act('ask')}
                    >
                      Ask tutor
                    </button>
                    <button disabled={busy} onClick={listen}>
                      {listening ? 'Stop listening' : 'Speak'}
                    </button>
                  </div>
                  <label>
                    <input
                      type="checkbox"
                      checked={speak}
                      onChange={(e) => setSpeak(e.target.checked)}
                    />
                    Read answers aloud
                  </label>
                  <p className="micro">
                    Help, Check and Ask send a screenshot of this tab to the AI
                    tutor. Voice recognition may use a remote service.
                  </p>
                </>
              )}
            </>
          ) : tasks.length ? (
            <>
              <p className="eyebrow">
                Follow-up task · {tasks.length} remaining
              </p>
              <h3>{tasks[0]}</h3>
              <button disabled={busy} onClick={() => void act('finish-task')}>
                Mark task done
              </button>
            </>
          ) : (
            <h3>Lesson complete</h3>
          )}
          <p role="status">{busy ? 'Working…' : feedback}</p>
        </div>
      )}
    </aside>
  );
}
async function mount() {
  const workspace: Workspace | undefined = await message('restore');
  if (!workspace) return;
  const host = document.createElement('div');
  host.style.cssText =
    'all:initial;position:fixed;bottom:16px;right:16px;z-index:2147483647';
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.kind === 'capture-finished') host.style.visibility = 'visible';
  });
  const shadow = host.attachShadow({ mode: 'closed' });
  const css = document.createElement('style');
  css.textContent = styles;
  const root = document.createElement('div');
  shadow.append(css, root);
  document.documentElement.append(host);
  createRoot(root).render(<Tutor workspace={workspace} host={host} />);
}
void mount().catch(console.error);
