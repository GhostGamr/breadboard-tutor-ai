import {
  TutorEvidenceSchema,
  type TutorDecision,
  type TutorEvidence,
} from '@breadboard/shared';
import { inspectPage, pointOnPage } from './page-context';

const permissionHint =
  'Click the BreadBoard toolbar icon on Photopea or the practice page after switching sites, then try again.';
export const isExtension = () =>
  typeof chrome !== 'undefined' && !!chrome.runtime?.id;
export function allowedPage(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      (u.protocol === 'https:' &&
        ['www.photopea.com', 'photopea.com'].includes(u.hostname)) ||
      (u.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(u.hostname))
    );
  } catch {
    return false;
  }
}
export async function captureEvidence(): Promise<{
  evidence: TutorEvidence;
  tabId?: number;
  url?: string;
}> {
  if (!isExtension()) {
    const context = inspectPage();
    const canvas = document.querySelector<HTMLCanvasElement>('#artboard');
    if (!canvas || !context.sandbox)
      throw new Error(
        'Open the practice canvas or use the Chrome extension on Photopea.',
      );
    return {
      evidence: TutorEvidenceSchema.parse({
        ...context,
        captureId: crypto.randomUUID(),
        capturedAt: Date.now(),
        jpegBase64: canvas.toDataURL('image/jpeg', 0.65).split(',')[1],
      }),
    };
  }
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url || !allowedPage(tab.url))
      throw new Error(
        'This MVP supports Photopea and the localhost practice canvas only.',
      );
    const [{ result: context }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: inspectPage,
    });
    if (!context) throw new Error('Could not inspect the active page.');
    const capturedAt = Date.now();
    const data = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 65,
    });
    const [after] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (after?.id !== tab.id || after.url !== tab.url)
      throw new Error('The active tab changed during capture. Try again.');
    const bitmap = await createImageBitmap(await (await fetch(data)).blob());
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 1440 / bitmap.width);
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas
      .getContext('2d')!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return {
      tabId: tab.id,
      url: tab.url,
      evidence: TutorEvidenceSchema.parse({
        ...context,
        captureId: crypto.randomUUID(),
        capturedAt,
        jpegBase64: canvas.toDataURL('image/jpeg', 0.6).split(',')[1],
      }),
    };
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : 'Capture failed'}. ${permissionHint}`,
    );
  }
}
export async function showPointer(
  capture: Awaited<ReturnType<typeof captureEvidence>>,
  decision: TutorDecision,
) {
  if (!isExtension())
    return pointOnPage(
      decision.target,
      decision.confidence,
      decision.needsUserToExposePanel,
      capture.evidence.viewport,
    );
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== capture.tabId || tab.url !== capture.url) return false;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: pointOnPage,
    args: [
      decision.target,
      decision.confidence,
      decision.needsUserToExposePanel,
      capture.evidence.viewport,
    ],
  });
  return !!result;
}
