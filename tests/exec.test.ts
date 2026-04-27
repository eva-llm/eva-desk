const mockSprayTests = jest.fn();
const mockGetNodesLoad = jest.fn();
const mockGetNextTests = jest.fn();
const mockGetSlots = jest.fn();
const mockSwitchRunId = jest.fn();
const mockSleep = jest.fn();

jest.mock('../src/cluster', () => ({
  sprayTests: mockSprayTests,
}));

jest.mock('../src/redis', () => ({
  getNodesLoad: mockGetNodesLoad,
}));

jest.mock('../src/db', () => ({
  getNextTests: mockGetNextTests,
}));

jest.mock('../src/helpers', () => ({
  getSlots: mockGetSlots,
  switchRunId: mockSwitchRunId,
  sleep: mockSleep,
}));

import CONF from '../src/config';
import runExec from '../src/exec';

describe('exec module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSleep.mockResolvedValue(undefined);
    CONF.currentRunId = 'run-1';
    CONF.lastTestId = null;
    CONF.maxNodeLoad = 100;
  });

  it('should skip iteration when currentRunId is not set', async () => {
    CONF.currentRunId = null;

    mockSleep.mockRejectedValueOnce(new Error('stop'));

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockGetNodesLoad).not.toHaveBeenCalled();
    expect(mockGetNextTests).not.toHaveBeenCalled();
    expect(mockSprayTests).not.toHaveBeenCalled();
  });

  it('should skip iteration when nodesLoad is empty', async () => {
    mockGetNodesLoad
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockGetSlots).not.toHaveBeenCalled();
    expect(mockGetNextTests).not.toHaveBeenCalled();
    expect(mockSprayTests).not.toHaveBeenCalled();
  });

  it('should skip iteration when total slots are below half of maxNodeLoad', async () => {
    const nodesLoad = { 'node-1': 95, 'node-2': 98 };
    // slots sum = 5 + 2 = 7, maxNodeLoad = 100, threshold = 50
    mockGetNodesLoad
      .mockResolvedValueOnce(nodesLoad)
      .mockRejectedValueOnce(new Error('stop'));
    mockGetSlots.mockReturnValue({ 'node-1': 5, 'node-2': 2 });

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockGetSlots).toHaveBeenCalledWith(nodesLoad);
    expect(mockGetNextTests).not.toHaveBeenCalled();
    expect(mockSprayTests).not.toHaveBeenCalled();
  });

  it('should fetch tests and spray them when slots are sufficient', async () => {
    const nodesLoad = { 'node-1': 50 };
    const slots = { 'node-1': 50 };
    const tests = [{ test_id: 'test-1' }, { test_id: 'test-2' }];

    mockGetNodesLoad
      .mockResolvedValueOnce(nodesLoad)
      .mockRejectedValueOnce(new Error('stop'));
    mockGetSlots.mockReturnValue(slots);
    mockGetNextTests.mockResolvedValue(tests);
    mockSprayTests.mockResolvedValue(['test-2', []]);

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockGetNextTests).toHaveBeenCalledWith(50);
    expect(mockSprayTests).toHaveBeenCalledWith(tests, slots);
  });

  it('should call switchRunId when all tests fit in slots and none remain', async () => {
    const nodesLoad = { 'node-1': 0 };
    const slots = { 'node-1': 100 };
    // tests.length (2) < size (100) and notRunTests is empty
    const tests = [{ test_id: 'test-1' }, { test_id: 'test-2' }];

    mockGetNodesLoad
      .mockResolvedValueOnce(nodesLoad)
      .mockRejectedValueOnce(new Error('stop'));
    mockGetSlots.mockReturnValue(slots);
    mockGetNextTests.mockResolvedValue(tests);
    mockSprayTests.mockResolvedValue(['test-2', []]);

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockSwitchRunId).toHaveBeenCalledTimes(1);
    expect(CONF.lastTestId).toBeNull();
  });

  it('should update CONF.lastTestId and not call switchRunId when notRunTests remain', async () => {
    const nodesLoad = { 'node-1': 0 };
    const slots = { 'node-1': 100 };
    const tests = [{ test_id: 'test-1' }, { test_id: 'test-2' }];
    const notRunTests = [{ test_id: 'test-2' }];

    mockGetNodesLoad
      .mockResolvedValueOnce(nodesLoad)
      .mockRejectedValueOnce(new Error('stop'));
    mockGetSlots.mockReturnValue(slots);
    mockGetNextTests.mockResolvedValue(tests);
    mockSprayTests.mockResolvedValue(['test-1', notRunTests]);

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockSwitchRunId).not.toHaveBeenCalled();
    expect(CONF.lastTestId).toBe('test-1');
  });

  it('should update CONF.lastTestId and not call switchRunId when tests fill all slots', async () => {
    const nodesLoad = { 'node-1': 0 };
    const slots = { 'node-1': 2 };
    // tests.length (2) === size (2), condition false → update lastTestId
    const tests = [{ test_id: 'test-1' }, { test_id: 'test-2' }];

    mockGetNodesLoad
      .mockResolvedValueOnce(nodesLoad)
      .mockRejectedValueOnce(new Error('stop'));
    mockGetSlots.mockReturnValue(slots);
    mockGetNextTests.mockResolvedValue(tests);
    mockSprayTests.mockResolvedValue(['test-2', []]);

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockSwitchRunId).not.toHaveBeenCalled();
    expect(CONF.lastTestId).toBe(null);
  });

  it('should call sleep on every tick', async () => {
    CONF.currentRunId = null;

    mockSleep
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runExec()).rejects.toThrow('stop');

    expect(mockSleep).toHaveBeenCalledTimes(3);
    expect(mockSleep).toHaveBeenCalledWith(CONF.tickInterval);
  });
});
