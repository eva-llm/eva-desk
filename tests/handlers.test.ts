const mockSprayTests = jest.fn();
const mockGetSlots = jest.fn();
const mockGetNodesLoad = jest.fn();
const mockUuidv7 = jest.fn();

jest.mock('../src/cluster', () => ({ sprayTests: mockSprayTests }));
jest.mock('../src/helpers', () => ({ getSlots: mockGetSlots }));
jest.mock('../src/redis', () => ({ getNodesLoad: mockGetNodesLoad }));
jest.mock('uuidv7', () => ({ uuidv7: mockUuidv7 }));

import Fastify, { type FastifyInstance } from 'fastify';
import registerHandlers from '../src/handlers';
import CONF from '../src/config';
import type { TTestSchema } from '../src/types';

const RUN_ID = '00000000-0000-0000-0000-000000000001';
const TEST_ID_1 = '00000000-0000-0000-0000-000000000011';
const TEST_ID_2 = '00000000-0000-0000-0000-000000000012';

const makeAuditTest = (override: Partial<TTestSchema> = {}): TTestSchema => ({
  run_id: RUN_ID,
  prompt: 'Hello',
  asserts: [{ name: 'equals', criteria: 'Hello' }],
  output: 'World',
  ...override,
} as TTestSchema);

let app: FastifyInstance;

beforeEach(async () => {
  jest.clearAllMocks();

  CONF.currentRunId = null;
  CONF.nodes = [];
  CONF.runIdsQueue = [];

  app = Fastify();
  registerHandlers(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ─── POST /eval ───────────────────────────────────────────────────────────────

describe('POST /eval', () => {
  it('returns 400 when cluster is busy (currentRunId is set)', async () => {
    CONF.currentRunId = RUN_ID;
    CONF.nodes = ['http://node-a:3000'];

    const res = await app.inject({
      method: 'POST',
      url: '/eval',
      payload: [makeAuditTest()],
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ message: 'Cluster is busy' });
  });

  it('returns 400 when there are no nodes', async () => {
    CONF.currentRunId = null;
    CONF.nodes = [];

    const res = await app.inject({
      method: 'POST',
      url: '/eval',
      payload: [makeAuditTest()],
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ message: 'No nodes to run tests' });
  });

  it('assigns a test_id to each test via uuidv7 and returns them', async () => {
    CONF.nodes = ['http://node-a:3000'];
    mockUuidv7.mockReturnValueOnce(TEST_ID_1).mockReturnValueOnce(TEST_ID_2);
    mockGetNodesLoad.mockResolvedValue({ 'http://node-a:3000': 0 });
    mockGetSlots.mockReturnValue({ 'http://node-a:3000': 10 });
    mockSprayTests.mockReturnValue(undefined);

    const tests = [makeAuditTest(), makeAuditTest()];

    const res = await app.inject({
      method: 'POST',
      url: '/eval',
      payload: tests,
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ test_ids: [TEST_ID_1, TEST_ID_2] });
    expect(mockUuidv7).toHaveBeenCalledTimes(2);
  });

  it('calls sprayTests with test configs (including injected test_id) and slots', async () => {
    CONF.nodes = ['http://node-a:3000'];
    mockUuidv7.mockReturnValueOnce(TEST_ID_1);
    const nodesLoad = { 'http://node-a:3000': 5 };
    const slots = { 'http://node-a:3000': 5 };
    mockGetNodesLoad.mockResolvedValue(nodesLoad);
    mockGetSlots.mockReturnValue(slots);
    mockSprayTests.mockReturnValue(undefined);

    const test = makeAuditTest();

    await app.inject({
      method: 'POST',
      url: '/eval',
      payload: [test],
    });

    expect(mockGetNodesLoad).toHaveBeenCalledTimes(1);
    expect(mockGetSlots).toHaveBeenCalledWith(nodesLoad);
    expect(mockSprayTests).toHaveBeenCalledWith(
      [expect.objectContaining({ test_id: TEST_ID_1 })],
      slots,
    );
  });

  it('does not await sprayTests (fire-and-forget)', async () => {
    CONF.nodes = ['http://node-a:3000'];
    mockUuidv7.mockReturnValueOnce(TEST_ID_1);
    mockGetNodesLoad.mockResolvedValue({});
    mockGetSlots.mockReturnValue({});

    let resolveSpray!: () => void;
    mockSprayTests.mockReturnValue(
      new Promise<void>((resolve) => { resolveSpray = resolve; })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/eval',
      payload: [makeAuditTest()],
    });

    // Response arrives before sprayTests resolves
    expect(res.statusCode).toBe(200);
    resolveSpray();
  });
});

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns { status: "ok" }', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });
});

// ─── POST /run ────────────────────────────────────────────────────────────────

describe('POST /run', () => {
  it('sets currentRunId and returns status "run" when no run is active', async () => {
    CONF.currentRunId = null;

    const res = await app.inject({
      method: 'POST',
      url: '/run',
      payload: { run_id: RUN_ID },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'run', run_id: RUN_ID });
    expect(CONF.currentRunId).toBe(RUN_ID);
  });

  it('queues the run_id and returns status "queued" when a run is already active', async () => {
    const ACTIVE_RUN = '00000000-0000-0000-0000-000000000002';
    const NEW_RUN = '00000000-0000-0000-0000-000000000003';
    CONF.currentRunId = ACTIVE_RUN;

    const res = await app.inject({
      method: 'POST',
      url: '/run',
      payload: { run_id: NEW_RUN },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'queued', run_id: NEW_RUN });
    expect(CONF.runIdsQueue).toContain(NEW_RUN);
    expect(CONF.currentRunId).toBe(ACTIVE_RUN); // unchanged
  });

  it('appends multiple run_ids to the queue in order', async () => {
    const RUN_A = '00000000-0000-0000-0000-000000000010';
    const RUN_B = '00000000-0000-0000-0000-000000000020';
    CONF.currentRunId = RUN_ID;

    await app.inject({ method: 'POST', url: '/run', payload: { run_id: RUN_A } });
    await app.inject({ method: 'POST', url: '/run', payload: { run_id: RUN_B } });

    expect(CONF.runIdsQueue).toEqual([RUN_A, RUN_B]);
  });
});

// ─── GET /current_run ─────────────────────────────────────────────────────────

describe('GET /current_run', () => {
  it('returns null run_id when no run is active', async () => {
    CONF.currentRunId = null;

    const res = await app.inject({ method: 'GET', url: '/current_run' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ run_id: null });
  });

  it('returns the active run_id', async () => {
    CONF.currentRunId = RUN_ID;

    const res = await app.inject({ method: 'GET', url: '/current_run' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ run_id: RUN_ID });
  });
});

// ─── GET /runs_queue ──────────────────────────────────────────────────────────

describe('GET /runs_queue', () => {
  it('returns an empty array when the queue is empty', async () => {
    CONF.runIdsQueue = [];

    const res = await app.inject({ method: 'GET', url: '/runs_queue' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ run_ids: [] });
  });

  it('returns queued run_ids', async () => {
    const RUN_A = '00000000-0000-0000-0000-000000000010';
    const RUN_B = '00000000-0000-0000-0000-000000000020';
    CONF.runIdsQueue = [RUN_A, RUN_B];

    const res = await app.inject({ method: 'GET', url: '/runs_queue' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ run_ids: [RUN_A, RUN_B] });
  });
});

// ─── GET /nodes ───────────────────────────────────────────────────────────────

describe('GET /nodes', () => {
  it('returns an empty array when no nodes are registered', async () => {
    CONF.nodes = [];

    const res = await app.inject({ method: 'GET', url: '/nodes' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ nodes: [] });
  });

  it('returns the registered nodes', async () => {
    CONF.nodes = ['http://node-a:3000', 'http://node-b:3000'];

    const res = await app.inject({ method: 'GET', url: '/nodes' });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      nodes: ['http://node-a:3000', 'http://node-b:3000'],
    });
  });
});
