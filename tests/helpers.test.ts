import CONF from '../src/config';
import { getSlots, splitAndSortSlots, switchRunId, sleep, forever } from '../src/helpers';

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

describe('forever', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    CONF.tickInterval = 5;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call func immediately on start', async () => {
    const func = jest.fn().mockResolvedValue(undefined);
    forever(func);
    await Promise.resolve();
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should call func again after each tick interval', async () => {
    const func = jest.fn().mockResolvedValue(undefined);
    forever(func);
    await Promise.resolve();
    expect(func).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(CONF.tickInterval * 1000);
    expect(func).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(CONF.tickInterval * 1000);
    expect(func).toHaveBeenCalledTimes(3);
  });

  it('should swallow errors thrown in the loop body', async () => {
    let callCount = 0;
    const func = jest.fn().mockImplementation(async () => {
      if (++callCount > 1) throw new Error('loop error');
    });

    forever(func);
    await Promise.resolve();
    expect(func).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(CONF.tickInterval * 1000);
    expect(func).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(CONF.tickInterval * 1000);
    expect(func).toHaveBeenCalledTimes(3);
  });

  it('should propagate an error thrown by the first call', async () => {
    const func = jest.fn().mockRejectedValue(new Error('initial error'));
    await expect(forever(func)).rejects.toThrow('initial error');
  });
});
