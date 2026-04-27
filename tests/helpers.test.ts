import CONF from '../src/config';
import { getSlots, splitAndSortSlots, switchRunId, sleep } from '../src/helpers';

describe('getSlots', () => {
  beforeEach(() => {
    CONF.maxNodeLoad = 10;
  });

  it('should return available slots for each node', () => {
    const result = getSlots({ 'node-1': 3, 'node-2': 7 });
    expect(result).toEqual({ 'node-1': 7, 'node-2': 3 });
  });

  it('should clamp to 0 when load exceeds maxNodeLoad', () => {
    const result = getSlots({ 'node-1': 15 });
    expect(result).toEqual({ 'node-1': 0 });
  });

  it('should return maxNodeLoad slots when load is 0', () => {
    const result = getSlots({ 'node-1': 0 });
    expect(result).toEqual({ 'node-1': 10 });
  });

  it('should return an empty object for empty input', () => {
    const result = getSlots({});
    expect(result).toEqual({});
  });
});

describe('splitAndSortSlots', () => {
  it('should sort entries by slot count descending', () => {
    const result = splitAndSortSlots({ 'node-a': 5, 'node-b': 1, 'node-c': 9 });
    expect(result).toEqual([['node-c', 9], ['node-a', 5], ['node-b', 1]]);
  });

  it('should return an empty array for empty input', () => {
    expect(splitAndSortSlots({})).toEqual([]);
  });

  it('should handle equal slot values without error', () => {
    const result = splitAndSortSlots({ 'node-x': 4, 'node-y': 4 });
    expect(result).toHaveLength(2);
    expect(result.every(([, v]) => v === 4)).toBe(true);
  });
});

describe('switchRunId', () => {
  beforeEach(() => {
    CONF.currentRunId = null;
    CONF.lastTestId = 'some-test-id';
    CONF.runIdsQueue = [];
  });

  it('should shift the first item from the queue into currentRunId', () => {
    CONF.runIdsQueue = ['run-1', 'run-2'];
    switchRunId();
    expect(CONF.currentRunId).toBe('run-1');
    expect(CONF.runIdsQueue).toEqual(['run-2']);
  });

  it('should set currentRunId to null when queue is empty', () => {
    CONF.currentRunId = 'run-old';
    switchRunId();
    expect(CONF.currentRunId).toBeNull();
  });

  it('should reset lastTestId to null', () => {
    CONF.runIdsQueue = ['run-1'];
    switchRunId();
    expect(CONF.lastTestId).toBeNull();
  });
});

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should resolve after the given number of seconds', async () => {
    const promise = sleep(2);
    jest.advanceTimersByTime(2000);
    await expect(promise).resolves.toBeUndefined();
  });

  it('should not resolve before the timeout elapses', () => {
    let resolved = false;
    sleep(5).then(() => { resolved = true; });
    jest.advanceTimersByTime(4999);
    expect(resolved).toBe(false);
  });
});
