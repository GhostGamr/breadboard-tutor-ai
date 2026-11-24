import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TutorEvidence } from '@breadboard/shared';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';
import { mockProvider, type TutorProvider } from './provider.js';
import { seed } from './seed.js';

let cacheDir: string;
beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'breadboard-test-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(cacheDir, { recursive: true, force: true });
});

const jpeg =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
const evidence = (): TutorEvidence => ({
  jpegBase64: jpeg,
  capturedAt: Date.now(),
  captureId: randomUUID(),
  viewport: { width: 900, height: 600 },
  controls: [],
});
function control(
  key: TutorEvidence['controls'][number]['registryKey'],
  isActive = false,
) {
  return {
    registryKey: key,
    id: key,
    label: key,
    isActive,
    rect: { x: 10, y: 10, width: 25, height: 25 },
  };
}
async function setup(provider?: TutorProvider) {
  const agent = request(createApp({ cacheDir, provider }));
  const { body } = await agent.post('/lesson/start').send({}).expect(200);
  const ids = {
    sessionId: body.sessionId,
    lessonId: body.lesson.id,
    stepId: body.step.id,
  };
  return {
    agent,
    ids,
    send: (path: string, e: TutorEvidence, extra = {}) =>
      agent.post(path).send({ ...ids, evidence: e, ...extra }),
  };
}

describe('lesson start', () => {
  it('uses canonical source identity across restarts and recovers from invalid cache', async () => {
    const start = (url?: string) =>
      request(createApp({ cacheDir })).post('/lesson/start').send({ url });
    const first = (await start().expect(200)).body;
    expect(first).toMatchObject({
      lesson: seed,
      source: 'seed',
      cached: false,
      mock: true,
      fallback: false,
      step: seed.steps[0],
    });
    expect(
      first.lesson.steps.map((s: { seconds?: number }) => s.seconds),
    ).toEqual([undefined, 70, 94, 122]);
    expect(
      (await start(`https://youtu.be/${seed.videoId}`).expect(200)).body,
    ).toMatchObject({ source: 'cache', cached: true, fallback: false });
    const files = await readdir(cacheDir);
    expect(files).toHaveLength(1);
    await writeFile(join(cacheDir, files[0]), '{}');
    expect((await start().expect(200)).body).toMatchObject({
      lesson: seed,
      source: 'seed',
      fallback: true,
    });
    await start('https://www.youtube.com/watch?v=abcdefghijk').expect(422);
    await start('https://example.com/watch?v=zVpeDyBLgiU').expect(400);
  });
});

describe('tutor evidence loop', () => {
  async function atTextStep() {
    const api = await setup();
    for (const c of [control('project-canvas'), control('type-tool', true)]) {
      const { body } = await api
        .send('/check', { ...evidence(), controls: [c] })
        .expect(200);
      expect(body.outcome).toBe('pass');
      api.ids.stepId = body.step.id;
    }
    return api;
  }
  function layerControl(id: string, colour?: string, x = 10): TutorEvidence {
    const c = control('text-layer', true);
    return {
      ...evidence(),
      controls: [
        {
          ...c,
          rect: { ...c.rect, x },
          selectedTextLayer: { id, kind: 'text', text: 'Example', colour },
        },
      ],
    };
  }

  it('answers missing-text questions with observed tools and conditional visibility checks', async () => {
    const { send } = await atTextStep();
    const question = 'Why is my text not showing?';
    for (const key of ['move-tool', 'type-tool'] as const) {
      const { body } = await send(
        '/ask',
        { ...evidence(), controls: [control(key, true)] },
        { question },
      ).expect(200);
      expect(body.spokenText).toContain(
        key === 'move-tool' ? 'Move is active' : 'Type is active',
      );
      expect(body.spokenText).toMatch(
        /check whether the text layer is hidden/i,
      );
      expect(body.spokenText).toMatch(/contrasting colour/i);
      expect(body.timestampRef.seconds).toBe(94);
    }
    expect(
      (
        await send('/ask', evidence(), {
          question: 'When is the next train?',
        }).expect(200)
      ).body.spokenText,
    ).toMatch(/can help with this Photopea text lesson/i);
  });

  it('retains layer identity when learning a missing colour on a later check', async () => {
    const { send, ids } = await atTextStep();
    ids.stepId = (
      await send('/check', layerControl('A')).expect(200)
    ).body.step.id;
    for (const [id, colour] of [
      ['B', '#ffffff'],
      ['B', '#000000'],
      ['A', '#aaaaaa'],
      ['A', '#aaaaaa'],
    ]) {
      expect(
        (await send('/check', layerControl(id, colour)).expect(200)).body
          .outcome,
      ).toBe('retry');
    }
    expect(
      (await send('/check', layerControl('A', '#ffffff')).expect(200)).body
        .completed,
    ).toBe(true);
  });

  it('retries contradictory DOM and sandbox tool evidence in either direction', async () => {
    const { send, ids } = await setup();
    ids.stepId = (
      await send('/check', {
        ...evidence(),
        controls: [control('project-canvas')],
      }).expect(200)
    ).body.step.id;
    for (const tool of ['type', 'move'] as const) {
      const { body } = await send('/check', {
        ...evidence(),
        controls: [control(tool === 'type' ? 'move-tool' : 'type-tool', true)],
        sandbox: {
          projectCanvasVisible: true,
          tool,
          layers: [],
          selectedLayerId: null,
        },
      }).expect(200);
      expect(body).toMatchObject({ outcome: 'retry', step: { index: 1 } });
    }
  });

  it('ignores offscreen selected layers for text and colour checks', async () => {
    const { send, ids } = await atTextStep();
    expect(
      (await send('/check', layerControl('A', '#ffffff', 900)).expect(200)).body
        .outcome,
    ).toBe('retry');
    ids.stepId = (
      await send('/check', layerControl('A', '#ffffff')).expect(200)
    ).body.step.id;
    expect(
      (await send('/check', layerControl('A', '#000000', -50)).expect(200)).body
        .outcome,
    ).toBe('retry');
  });

  it('checks JPEG component counts, segment sizes and scan membership', async () => {
    const { send } = await setup();
    for (const [marker, offset, value] of [
      [0xc0, 9, 0],
      [0xda, 4, 0],
      [0xc0, 9, 2],
      [0xda, 4, 2],
      [0xda, 5, 9],
      [0xc0, 3, 12],
      [0xda, 3, 9],
    ]) {
      const bytes = Buffer.from(jpeg, 'base64');
      const i = bytes.indexOf(Buffer.from([0xff, marker]));
      expect(i).toBeGreaterThan(0);
      bytes[i + offset] = value;
      await send('/guide', {
        ...evidence(),
        jpegBase64: bytes.toString('base64'),
      }).expect(400);
    }
    await send('/guide', evidence()).expect(200);
  });

  it('rejects unsupported JPEG frame and scan headers before tutoring', async () => {
    const { send } = await setup();
    const progressive =
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wgALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/aAAgBAQAAAAFU/wD/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAIAQEAAAAQ/wD/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==';
    for (const [fixture, marker, offset, value] of [
      [jpeg, 0xc0, 4, 0],
      [jpeg, 0xc0, 4, 12],
      [progressive, 0xc2, 4, 10],
      [jpeg, 0xc0, 11, 0x01],
      [jpeg, 0xc0, 11, 0x10],
      [jpeg, 0xc0, 11, 0x51],
      [jpeg, 0xc0, 11, 0x15],
      [jpeg, 0xc0, 12, 4],
      [jpeg, 0xc0, 1, 0xc3],
      [jpeg, 0xda, 6, 0x20],
      [jpeg, 0xda, 6, 0x02],
      [jpeg, 0xda, 7, 1],
      [jpeg, 0xda, 8, 62],
      [jpeg, 0xda, 9, 1],
      [progressive, 0xda, 6, 0x40],
      [progressive, 0xda, 6, 0x01],
      [progressive, 0xda, 7, 1],
      [progressive, 0xda, 8, 64],
      [progressive, 0xda, 9, 0x31],
      [progressive, 0xda, 9, 0x0e],
    ] as const) {
      const bytes = Buffer.from(fixture, 'base64');
      const i = bytes.indexOf(Buffer.from([0xff, marker]));
      expect(i).toBeGreaterThan(0);
      bytes[i + offset] = value;
      await send('/guide', {
        ...evidence(),
        jpegBase64: bytes.toString('base64'),
      }).expect(400);
    }
    for (const jpegBase64 of [jpeg, progressive])
      await send('/guide', { ...evidence(), jpegBase64 }).expect(200);
  });

  it('rejects fresh captures from before session or step entry, allowing 250 ms clock skew', async () => {
    const start = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
    const { send, ids } = await setup();
    await send('/guide', { ...evidence(), capturedAt: start - 251 }).expect(
      400,
    );
    await send('/guide', { ...evidence(), capturedAt: start - 250 }).expect(
      200,
    );
    clock.mockReturnValue(start + 5000);
    ids.stepId = (
      await send('/check', {
        ...evidence(),
        controls: [control('project-canvas')],
      }).expect(200)
    ).body.step.id;
    await send('/check', { ...evidence(), capturedAt: start + 4749 }).expect(
      400,
    );
    await send('/guide', { ...evidence(), capturedAt: start + 4750 }).expect(
      200,
    );
  });

  it('requires observed state, answers at the current timestamp and advances only on passing checks', async () => {
    const { send, ids } = await setup();
    const check = async (e: TutorEvidence, outcome: string) => {
      const { body } = await send('/check', e).expect(200);
      expect(body.outcome).toBe(outcome);
      if (body.step) ids.stepId = body.step.id;
      return body;
    };
    await check(evidence(), 'retry');
    const first = await check(
      { ...evidence(), controls: [control('project-canvas')] },
      'pass',
    );
    expect(first.timestampRef).toBeUndefined();
    const tools = (move: boolean, type: boolean) => ({
      ...evidence(),
      controls: [control('move-tool', move), control('type-tool', type)],
    });
    expect(
      (await send('/guide', tools(true, false)).expect(200)).body,
    ).toMatchObject({
      outcome: 'guide',
      diagnosis: expect.stringMatching(/Move is active/),
      target: { controlId: 'type-tool' },
      step: { index: 1 },
    });
    await check(tools(true, false), 'retry');
    await check(tools(false, false), 'retry');
    await check(tools(false, true), 'pass');
    expect(
      (
        await send('/ask', evidence(), {
          question: 'Where do I type the text?',
        }).expect(200)
      ).body,
    ).toMatchObject({
      outcome: 'answer',
      spokenText: expect.stringMatching(/canvas/),
      timestampRef: { videoId: seed.videoId, seconds: 94 },
      step: { index: 2 },
    });
    await check(tools(false, true), 'retry');
    const text = (id: string, colour: string): TutorEvidence => ({
      ...evidence(),
      sandbox: {
        projectCanvasVisible: true,
        tool: 'type',
        selectedLayerId: id,
        layers: [{ kind: 'text', id, text: 'Sample', colour }],
      },
    });
    await check(text('one', '#abcdef'), 'pass');
    await check(text('one', '#ABCDEF'), 'retry');
    await check(text('two', '#112233'), 'retry');
    expect(await check(text('one', '#112233'), 'pass')).toMatchObject({
      completed: true,
      step: null,
    });
    await send('/check', evidence()).expect(409);
  });

  it('rejects malformed, stale, repeated and misbound evidence', async () => {
    const { agent, send, ids } = await setup();
    const e = evidence();
    for (const patch of [
      { jpegBase64: 'bm90LWpwZWc=' },
      { jpegBase64: '/9j/2Q==' },
      { jpegBase64: 'A'.repeat(524292) },
      { viewport: { width: 0, height: 1 } },
      { capturedAt: Date.now() - 31000 },
      {
        controls: Array.from({ length: 81 }, (_, i) => ({
          ...control('type-tool'),
          id: `c${i}`,
        })),
      },
      { sandbox: { snapshot: { unexpected: true } } },
      { snapshot: {} },
    ])
      await agent
        .post('/check')
        .send({ ...ids, evidence: { ...e, ...patch } })
        .expect(400);
    await send('/guide', e, { question: 'unexpected' }).expect(400);
    await send('/ask', e).expect(400);
    await send('/guide', e, { lessonId: 'another' }).expect(409);
    await send('/guide', e, { stepId: 'another' }).expect(409);
    await send('/guide', e).expect(200);
    await send('/check', e).expect(409);
    await agent
      .post('/guide')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400, { error: 'Invalid request body' });
    await agent
      .post('/guide')
      .send({ data: 'x'.repeat(700000) })
      .expect(413);
    await agent
      .post('/guide')
      .set('Origin', 'https://example.com')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(403);
  });
  it('limits each session independently', async () => {
    const { send, agent, ids } = await setup();
    for (let i = 0; i < 20; i++) await send('/guide', evidence()).expect(200);
    await send('/guide', evidence()).expect(429);
    const { body } = await agent.post('/lesson/start').send({}).expect(200);
    await agent
      .post('/guide')
      .send({ ...ids, sessionId: body.sessionId, evidence: evidence() })
      .expect(200);
  });
  it('locks during provider calls and revalidates freshness before advancing', async () => {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>((r) => {
      enter = r;
    });
    const wait = new Promise<void>((r) => {
      release = r;
    });
    const { send } = await setup({
      async evaluate(context) {
        enter();
        await wait;
        return mockProvider.evaluate(context);
      },
    });
    const e = { ...evidence(), controls: [control('project-canvas')] };
    const pending = send('/check', e).then((r) => r);
    await entered;
    await send('/check', evidence()).expect(409);
    vi.spyOn(Date, 'now').mockReturnValue(e.capturedAt + 31000);
    release();
    expect((await pending).status).toBe(400);
    expect(
      (
        await send('/check', {
          ...e,
          ...{ captureId: randomUUID(), capturedAt: Date.now() },
        }).expect(200)
      ).body.step.index,
    ).toBe(1);
  });
  it('rejects provider decisions that cannot be grounded in this request', async () => {
    const { send } = await setup({
      async evaluate(context) {
        return {
          ...(await mockProvider.evaluate(context)),
          target: { controlId: 'invented' },
        };
      },
    });
    await send('/check', evidence()).expect(502);
  });
});
