import {
  HealthResponseSchema,
  TutorStartResponseSchema,
  TutorResponseSchema,
  routeVoiceCommand,
} from '@breadboard/shared';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { z } from 'zod';
import { captureEvidence, showPointer } from './capture';
import { startVoice } from './voice';
import './styles.css';
const SERVER = 'http://127.0.0.1:8787';
async function api(path: string, body?: unknown) {
  const r = await fetch(SERVER + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}
type Session = z.infer<typeof TutorStartResponseSchema>;
type Reply = z.infer<typeof TutorResponseSchema>;
function SidePanel() {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=zVpeDyBLgiU');
  const [session, setSession] = useState<Session>();
  const [step, setStep] = useState<Session['step'] | null>(null);
  const [reply, setReply] = useState<Reply>();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting to local tutor…');
  const [speak, setSpeak] = useState(true);
  const [listening, setListening] = useState(false);
  const [pointer, setPointer] = useState('');
  const lock = useRef(false);
  const stopVoice = useRef<() => void>();
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
    return () => {
      stopVoice.current?.();
      window.speechSynthesis?.cancel();
    };
  }, []);
  async function start(prepared: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy('Preparing lesson…');
    setError('');
    try {
      const s = TutorStartResponseSchema.parse(
        await api('/lesson/start', prepared ? {} : { url }),
      );
      setSession(s);
      setStep(s.step);
      setReply(undefined);
      setPointer('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start lesson');
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  async function act(action: 'guide' | 'check' | 'ask', text = question) {
    if (lock.current || !session || !step || (action === 'ask' && !text.trim()))
      return;
    lock.current = true;
    setBusy('Looking at your workspace…');
    setError('');
    setPointer('');
    window.speechSynthesis?.cancel();
    try {
      const capture = await captureEvidence();
      const result = TutorResponseSchema.parse(
        await api('/' + action, {
          sessionId: session.sessionId,
          lessonId: session.lesson.id,
          stepId: step.id,
          evidence: capture.evidence,
          ...(action === 'ask' ? { question: text.trim() } : {}),
        }),
      );
      setReply(result);
      setStep(result.step);
      if (result.outcome !== 'pass') {
        try {
          setPointer(
            (await showPointer(capture, result))
              ? 'Look for the orange pointer in your workspace.'
              : 'No confident pointer location. Follow the explanation or expose the relevant panel.',
          );
        } catch {
          setPointer('Pointer unavailable. Follow the explanation.');
        }
      }
      if (speak && window.speechSynthesis)
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance(result.spokenText),
        );
      if (action === 'ask') setQuestion('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not inspect workspace');
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  function listen() {
    if (listening) {
      stopVoice.current?.();
      return;
    }
    try {
      setError('');
      setListening(true);
      stopVoice.current = startVoice(
        (text) => {
          setQuestion(text);
          void act(routeVoiceCommand(text) ?? 'ask', text);
        },
        setError,
        () => setListening(false),
      );
    } catch (e) {
      setListening(false);
      setError(e instanceof Error ? e.message : 'Voice unavailable');
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
      {!session ? (
        <>
          <p className="eyebrow">WATCH → TRY → UNDERSTAND</p>
          <h1>
            Get unstuck.
            <br />
            Keep creating.
          </h1>
          <p className="muted">
            A tutorial knows the next step. BreadBoard helps you find what is
            different on your screen.
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
            MVP: short, public Photopea text tutorials. Other websites and
            desktop apps are outside this demo.
          </p>
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
          <div className="launch-links">
            <a href={SERVER} target="_blank" rel="noreferrer">
              Practice canvas ↗
            </a>
            <a href="https://www.photopea.com" target="_blank" rel="noreferrer">
              Photopea ↗
            </a>
          </div>
        </>
      ) : (
        <>
          <div className="lesson-meta">
            <span>
              {session.mock ? 'Scripted practice' : 'AI tutor'}
              {session.cached ? ' · cached lesson' : ''}
            </span>
            <button
              disabled={!!busy}
              onClick={() => {
                stopVoice.current?.();
                setSession(undefined);
                setStep(null);
                window.speechSynthesis?.cancel();
              }}
            >
              Change
            </button>
          </div>
          <h2>{session.lesson.title}</h2>
          {session.fallback && (
            <p className="notice">
              Using the prepared Photopea lesson, not your submitted video. Live
              video analysis requires an API key on the server.
            </p>
          )}
          <progress
            value={step?.index ?? session.lesson.steps.length}
            max={session.lesson.steps.length}
            aria-label="Lesson progress"
          />
          {step ? (
            <section className="current-step">
              <p className="eyebrow">
                STEP {step.index + 1} OF {session.lesson.steps.length} ·{' '}
                {step.source === 'practice' ? 'PREPARATION' : 'FROM THE VIDEO'}
              </p>
              <h3>{step.instruction}</h3>
              {step.seconds !== undefined && (
                <a
                  href={
                    'https://www.youtube.com/watch?v=' +
                    session.lesson.videoId +
                    '&t=' +
                    step.seconds +
                    's'
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Watch source at {Math.floor(step.seconds / 60)}:
                  {String(step.seconds % 60).padStart(2, '0')} ↗
                </a>
              )}
            </section>
          ) : (
            <section className="complete">
              <h2>You made it.</h2>
              <p>Try a second text layer in another colour without hints.</p>
            </section>
          )}
          {reply && (
            <section className={'feedback ' + reply.outcome} aria-live="polite">
              <strong>
                {reply.outcome === 'pass'
                  ? 'Step confirmed ✓'
                  : reply.outcome === 'retry'
                    ? 'Let’s fix this'
                    : reply.outcome === 'answer'
                      ? 'Your answer'
                      : 'Here’s your next move'}
              </strong>
              <p>{reply.diagnosis}</p>
              {pointer && <p className="micro">{pointer}</p>}
            </section>
          )}
          {step && (
            <>
              <div className="actions">
                <button disabled={!!busy} onClick={() => void act('guide')}>
                  Help / show me
                </button>
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => void act('check')}
                >
                  Check my step ✓
                </button>
              </div>
              <label className="field">
                Ask about what you’re doing
                <textarea
                  maxLength={1000}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Why isn’t my text showing?"
                />
              </label>
              <div className="actions">
                <button
                  disabled={!!busy || !question.trim()}
                  onClick={() => void act('ask')}
                >
                  Ask tutor
                </button>
                <button disabled={!!busy} onClick={listen}>
                  {listening ? 'Stop listening' : '🎙 Speak'}
                </button>
              </div>
            </>
          )}
          <label className="voice-toggle">
            <input
              type="checkbox"
              checked={speak}
              onChange={(e) => {
                setSpeak(e.target.checked);
                if (!e.target.checked) window.speechSynthesis?.cancel();
              }}
            />{' '}
            Read answers aloud
          </label>
          <p className="micro">
            Say “Help”, “Check my step”, or ask a question. Voice recognition
            may use a remote speech service.
          </p>
        </>
      )}
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
      <footer>
        Only Help, Check, and Ask capture your workspace. Practice uses canvas
        state; live Photopea sends a screenshot to the AI provider. The pointer
        never clicks for you.
      </footer>
    </main>
  );
}
const container = document.querySelector<HTMLElement>('#sidepanel-root');
if (container) createRoot(container).render(<SidePanel />);
