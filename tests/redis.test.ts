// Set.prototype.difference is available in Node 22+; polyfill for Node 20
if (typeof (Set.prototype as any).difference !== 'function') {
  (Set.prototype as any).difference = function <T>(other: Set<T>): Set<T> {
    const result = new Set<T>(this as Set<T>);
    for (const item of other) {
      result.delete(item);
    }
    return result;
  };
}

const mockPipeline = {
  scard: jest.fn().mockReturnThis(),
  srem: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

const mockRedis = {
  scan: jest.fn(),
  smembers: jest.fn(),
  pipeline: jest.fn(() => mockPipeline),
  sadd: jest.fn(),
  brpop: jest.fn(),
  rpop: jest.fn(),
  zremrangebyscore: jest.fn(),
  zrange: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => mockRedis),
}));

import CONF from '../src/config';
import {
  getStuckTests,
  getNodesLoad,
  setRunningTests,
  markTestsDone,
  getDoneTests,
  cleanOldNodes,
  getActiveNodes,
} from '../src/redis';
import { QUEUE_TEST_DONE, QUEUE_NODE_PING, QUEUE_TEST_RUNNING } from '../src/constants';

const NODE_1 = 'node-1';
const NODE_2 = 'node-2';
const TEST_ID_1 = 'test-id-1';
const TEST_ID_2 = 'test-id-2';

beforeEach(() => {
  jest.clearAllMocks();
  CONF.nodes = [];
  mockPipeline.scard.mockReturnThis();
  mockPipeline.srem.mockReturnThis();
});

describe('getStuckTests', () => {
  it('returns empty array when scan returns no keys', async () => {
    mockRedis.scan.mockResolvedValue([]);
    const result = await getStuckTests();
    expect(result).toEqual([]);
    expect(mockRedis.smembers).not.toHaveBeenCalled();
  });

  it('returns test IDs for nodes not in CONF.nodes', async () => {
    mockRedis.scan.mockResolvedValue([NODE_1, NODE_2]);
    mockRedis.smembers.mockResolvedValueOnce([TEST_ID_1]).mockResolvedValueOnce([TEST_ID_2]);
    CONF.nodes = [];

    const result = await getStuckTests();

    expect(result).toEqual([TEST_ID_1, TEST_ID_2]);
    expect(mockRedis.smembers).toHaveBeenCalledWith(`${QUEUE_TEST_RUNNING}:${NODE_1}`);
    expect(mockRedis.smembers).toHaveBeenCalledWith(`${QUEUE_TEST_RUNNING}:${NODE_2}`);
  });

  it('skips nodes that are still active in CONF.nodes', async () => {
    mockRedis.scan.mockResolvedValue([NODE_1, NODE_2]);
    mockRedis.smembers.mockResolvedValue([TEST_ID_1]);
    CONF.nodes = [NODE_1, NODE_2];

    const result = await getStuckTests();

    expect(result).toEqual([]);
    expect(mockRedis.smembers).not.toHaveBeenCalled();
  });

  it('only fetches tests for dead nodes, not live ones', async () => {
    mockRedis.scan.mockResolvedValue([NODE_1, NODE_2]);
    mockRedis.smembers.mockResolvedValue([TEST_ID_1]);
    CONF.nodes = [NODE_1];

    const result = await getStuckTests();

    expect(result).toEqual([TEST_ID_1]);
    expect(mockRedis.smembers).toHaveBeenCalledTimes(1);
    expect(mockRedis.smembers).toHaveBeenCalledWith(`${QUEUE_TEST_RUNNING}:${NODE_2}`);
  });

  it('aggregates test IDs from multiple dead nodes', async () => {
    mockRedis.scan.mockResolvedValue([NODE_1, NODE_2]);
    mockRedis.smembers
      .mockResolvedValueOnce([TEST_ID_1])
      .mockResolvedValueOnce([TEST_ID_2]);
    CONF.nodes = [];

    const result = await getStuckTests();

    expect(result).toHaveLength(2);
    expect(result).toContain(TEST_ID_1);
    expect(result).toContain(TEST_ID_2);
  });
});

describe('getNodesLoad', () => {
  it('returns empty object when CONF.nodes is empty', async () => {
    CONF.nodes = [];
    mockPipeline.exec.mockResolvedValue([]);

    const result = await getNodesLoad();

    expect(result).toEqual({});
    expect(mockPipeline.scard).not.toHaveBeenCalled();
  });

  it('returns empty object when pipeline.exec returns null', async () => {
    CONF.nodes = [NODE_1];
    mockPipeline.exec.mockResolvedValue(null);

    const result = await getNodesLoad();

    expect(result).toEqual({});
  });

  it('maps node IDs to their running test counts', async () => {
    CONF.nodes = [NODE_1, NODE_2];
    mockPipeline.exec.mockResolvedValue([
      [null, 3],
      [null, 7],
    ]);

    const result = await getNodesLoad();

    expect(result).toEqual({ [NODE_1]: 3, [NODE_2]: 7 });
    expect(mockPipeline.scard).toHaveBeenCalledWith(`${QUEUE_TEST_RUNNING}:${NODE_1}`);
    expect(mockPipeline.scard).toHaveBeenCalledWith(`${QUEUE_TEST_RUNNING}:${NODE_2}`);
  });

  it('skips nodes that returned an error from the pipeline', async () => {
    CONF.nodes = [NODE_1, NODE_2];
    mockPipeline.exec.mockResolvedValue([
      [new Error('redis error'), 0],
      [null, 5],
    ]);

    const result = await getNodesLoad();

    expect(result).toEqual({ [NODE_2]: 5 });
    expect(result[NODE_1]).toBeUndefined();
  });
});

describe('setRunningTests', () => {
  it('does nothing when testIds is empty', () => {
    const result = setRunningTests(NODE_1, []);
    expect(result).toBeUndefined();
    expect(mockRedis.sadd).not.toHaveBeenCalled();
  });

  it('calls sadd with the correct key and test IDs', () => {
    mockRedis.sadd.mockResolvedValue(2);
    setRunningTests(NODE_1, [TEST_ID_1, TEST_ID_2]);
    expect(mockRedis.sadd).toHaveBeenCalledWith(
      `${QUEUE_TEST_RUNNING}:${NODE_1}`,
      TEST_ID_1,
      TEST_ID_2
    );
  });
});

describe('markTestsDone', () => {
  it('removes test IDs from running sets via pipeline', async () => {
    mockPipeline.exec.mockResolvedValue([[null, 1], [null, 1]]);

    await markTestsDone({ [NODE_1]: [TEST_ID_1], [NODE_2]: [TEST_ID_2] });

    expect(mockPipeline.srem).toHaveBeenCalledWith(
      `${QUEUE_TEST_RUNNING}:${NODE_1}`,
      TEST_ID_1
    );
    expect(mockPipeline.srem).toHaveBeenCalledWith(
      `${QUEUE_TEST_RUNNING}:${NODE_2}`,
      TEST_ID_2
    );
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
  });

  it('handles multiple test IDs per node', async () => {
    mockPipeline.exec.mockResolvedValue([[null, 2]]);

    await markTestsDone({ [NODE_1]: [TEST_ID_1, TEST_ID_2] });

    expect(mockPipeline.srem).toHaveBeenCalledWith(
      `${QUEUE_TEST_RUNNING}:${NODE_1}`,
      TEST_ID_1,
      TEST_ID_2
    );
  });

  it('handles empty input without error', async () => {
    mockPipeline.exec.mockResolvedValue([]);

    await markTestsDone({});

    expect(mockPipeline.srem).not.toHaveBeenCalled();
    expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
  });
});

describe('getDoneTests', () => {
  it('returns null when brpop times out', async () => {
    mockRedis.brpop.mockResolvedValue(null);

    const result = await getDoneTests();

    expect(result).toBeNull();
    expect(mockRedis.rpop).not.toHaveBeenCalled();
  });

  it('returns grouped tests when brpop returns one entry', async () => {
    mockRedis.brpop.mockResolvedValue([QUEUE_TEST_DONE, `${NODE_1}|${TEST_ID_1}`]);
    mockRedis.rpop.mockResolvedValue(null);

    const result = await getDoneTests();

    expect(result).toEqual({ [NODE_1]: [TEST_ID_1] });
    expect(mockRedis.brpop).toHaveBeenCalledWith(QUEUE_TEST_DONE, CONF.tickInterval);
  });

  it('merges additional test entries from rpop', async () => {
    mockRedis.brpop.mockResolvedValue([QUEUE_TEST_DONE, `${NODE_1}|${TEST_ID_1}`]);
    mockRedis.rpop.mockResolvedValue([`${NODE_1}|${TEST_ID_2}`, `${NODE_2}|${TEST_ID_1}`]);

    const result = await getDoneTests();

    expect(result).toEqual({
      [NODE_1]: [TEST_ID_1, TEST_ID_2],
      [NODE_2]: [TEST_ID_1],
    });
    expect(mockRedis.rpop).toHaveBeenCalledWith(QUEUE_TEST_DONE, CONF.maxNodeLoad);
  });

  it('groups multiple test IDs under the same host', async () => {
    mockRedis.brpop.mockResolvedValue([QUEUE_TEST_DONE, `${NODE_1}|${TEST_ID_1}`]);
    mockRedis.rpop.mockResolvedValue([`${NODE_1}|${TEST_ID_2}`]);

    const result = await getDoneTests();

    expect(result).toEqual({ [NODE_1]: [TEST_ID_1, TEST_ID_2] });
  });

  it('skips rpop merge when rpop returns empty array', async () => {
    mockRedis.brpop.mockResolvedValue([QUEUE_TEST_DONE, `${NODE_1}|${TEST_ID_1}`]);
    mockRedis.rpop.mockResolvedValue([]);

    const result = await getDoneTests();

    expect(result).toEqual({ [NODE_1]: [TEST_ID_1] });
  });
});

describe('cleanOldNodes', () => {
  it('removes nodes older than 3 tick intervals', () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    mockRedis.zremrangebyscore.mockResolvedValue(2);

    cleanOldNodes();

    const expectedCutoff = now - CONF.tickInterval * 3 * 1000;
    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(QUEUE_NODE_PING, 0, expectedCutoff);

    jest.spyOn(Date, 'now').mockRestore();
  });
});

describe('getActiveNodes', () => {
  it('returns all members of the node ping sorted set', async () => {
    mockRedis.zrange.mockResolvedValue([NODE_1, NODE_2]);

    const result = await getActiveNodes();

    expect(result).toEqual([NODE_1, NODE_2]);
    expect(mockRedis.zrange).toHaveBeenCalledWith(QUEUE_NODE_PING, 0, -1);
  });

  it('returns empty array when no active nodes exist', async () => {
    mockRedis.zrange.mockResolvedValue([]);

    const result = await getActiveNodes();

    expect(result).toEqual([]);
  });
});
