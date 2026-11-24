import {
  TutorStartResponseSchema,
  TutorResponseSchema,
  workspaces,
} from '@breadboard/shared';
import { z } from 'zod';
import { installSidePanelBehavior } from './sidepanel-behavior';
import { captureEvidence, showPointer } from './capture';
import { api } from './api';

import type { Workspace } from './workspace-state';

installSidePanelBehavior(chrome);
const key = (id: number) => 'lesson:' + id;

async function launch(value: unknown, taskInput: unknown) {
  const session = TutorStartResponseSchema.parse(value);
  const tasks = z
    .array(z.string().trim().min(1).max(2000))
    .max(1000)
    .default([])
    .parse(taskInput);
  // Store the assignment before navigation so the editor can restore it on load.
  const tab = await chrome.tabs.create({ url: 'about:blank' });
  if (tab.id === undefined)
    throw new Error('Could not create a workspace tab.');
  try {
    await chrome.storage.session.set({
      [key(tab.id)]: { session, step: session.step, tasks },
    });
    await chrome.tabs.update(tab.id, {
      url: workspaces[session.lesson.software].url,
    });
  } catch (error) {
    await chrome.tabs.remove(tab.id);
    throw error;
  }
}
chrome.tabs.onRemoved.addListener((id) => {
  void chrome.storage.session.remove(key(id));
});

const local = new Set([
  'http://127.0.0.1:8787',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]);
function respond(promise: Promise<unknown>, send: (reply: unknown) => void) {
  promise.then(
    (data) => send({ ok: true, data }),
    (error) =>
      send({
        ok: false,
        error: error instanceof Error ? error.message : 'Tutor unavailable.',
      }),
  );
  return true;
}
chrome.runtime.onMessageExternal.addListener((msg, sender, send) => {
  if (
    sender.origin &&
    local.has(sender.origin) &&
    sender.frameId === 0 &&
    msg?.kind === 'launch'
  )
    return respond(launch(msg.session, msg.tasks), send);
  return false;
});
async function workspaceAction(
  msg: { kind: string; question?: string },
  sender: chrome.runtime.MessageSender,
) {
  const id = sender.tab?.id;
  if (id === undefined || sender.frameId !== 0) return;
  const entry = key(id);
  const workspace: Workspace | undefined = (
    await chrome.storage.session.get(entry)
  )[entry];
  if (!workspace) return;
  const { session, step } = workspace;
  const origin = new URL(workspaces[session.lesson.software].url).origin;
  if (
    sender.origin !== origin &&
    !(
      session.lesson.software === 'photopea' &&
      sender.origin === 'https://photopea.com'
    )
  )
    return;
  if (msg.kind === 'restore') return workspace;
  if (msg.kind === 'finish-task' && !step && workspace.tasks.length) {
    workspace.tasks.shift();
    await chrome.storage.session.set({ [entry]: workspace });
    return { step: null, tasks: workspace.tasks };
  }
  if (!step) throw new Error('Lesson complete.');
  if (msg.kind === 'next' && session.mock) {
    workspace.step = session.lesson.steps[step.index + 1] ?? null;
    await chrome.storage.session.set({ [entry]: workspace });
    return { step: workspace.step };
  }
  if (!['guide', 'check', 'ask'].includes(msg.kind)) return;
  const capture = await captureEvidence(id, sender.url!);
  await chrome.tabs.sendMessage(
    id,
    { kind: 'capture-finished' },
    { documentId: sender.documentId },
  );
  const result = TutorResponseSchema.parse(
    await api('/' + msg.kind, {
      sessionId: session.sessionId,
      lessonId: session.lesson.id,
      stepId: step.id,
      evidence: capture.evidence,
      ...(msg.kind === 'ask' ? { question: msg.question } : {}),
    }),
  );
  workspace.step = result.step;
  await chrome.storage.session.set({ [entry]: workspace });
  if (result.target) await showPointer(capture, result).catch(() => false);
  return result;
}
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.kind === 'launch') {
    if (sender.url === chrome.runtime.getURL('sidepanel.html'))
      return respond(launch(msg.session, msg.tasks), send);
    return;
  }
  return respond(workspaceAction(msg, sender), send);
});
