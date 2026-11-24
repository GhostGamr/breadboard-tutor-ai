import { TutorEvidenceSchema, type TutorDecision } from '@breadboard/shared';
import { inspectPage, pointOnPage } from './page-context';

const permissionHint =
  'Click the BreadBoard toolbar action on the lesson’s software tab (Photopea for the prepared lesson) after switching sites, then try again.';
export async function captureEvidence(tabId: number, url: string) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id !== tabId || tab.url !== url)
      throw new Error('Return to the lesson tab before capturing.');
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

    const ratio = Math.min(1, 1440 / bitmap.width);
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * ratio),
      Math.round(bitmap.height * ratio),
    );
    canvas
      .getContext('2d')!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const bytes = new Uint8Array(
      await (
        await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 })
      ).arrayBuffer(),
    );
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return {
      tabId: tab.id,
      url: tab.url,
      evidence: TutorEvidenceSchema.parse({
        ...context,
        captureId: crypto.randomUUID(),
        capturedAt,
        jpegBase64: btoa(binary),
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
