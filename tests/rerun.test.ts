const mockGetNodesLoad = jest.fn();
const mockGetStuckTests = jest.fn();
const mockGetTestsByIds = jest.fn();
const mockGetSlots = jest.fn();
const mockSprayTests = jest.fn();
const mockSleep = jest.fn();
const mockForever = jest.fn();

jest.mock('../src/redis', () => ({
  getNodesLoad: mockGetNodesLoad,
  getStuckTests: mockGetStuckTests,
}));

jest.mock('../src/db', () => ({
  getTestsByIds: mockGetTestsByIds,
}));

jest.mock('../src/helpers', () => ({
  getSlots: mockGetSlots,
  sleep: mockSleep,
  forever: mockForever,
}));

jest.mock('../src/cluster', () => ({
  sprayTests: mockSprayTests,
}));

import runRerun from '../src/rerun';

describe('rerun module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSleep.mockResolvedValue(undefined);
    mockForever.mockImplementation(async (func: () => Promise<void>) => {
      await func();
    });
  });

  it('should skip iteration when nodesLoad is empty', async () => {
    mockGetNodesLoad.mockResolvedValue({});

    runRerun();
    await mockForever.mock.results[0].value;

    expect(mockGetStuckTests).not.toHaveBeenCalled();
    expect(mockSprayTests).not.toHaveBeenCalled();
  });

  it('should skip iteration when nodesLoad has nodes but no stuck tests', async () => {
    const nodesLoad = { 'node-1': 2 };
    const slots = { 'node-1': 8 };

    mockGetNodesLoad.mockResolvedValue(nodesLoad);
    mockGetSlots.mockReturnValue(slots);
    mockGetStuckTests.mockResolvedValue([]);

    runRerun();
    await mockForever.mock.results[0].value;

    expect(mockGetStuckTests).toHaveBeenCalledTimes(1);
    expect(mockGetTestsByIds).not.toHaveBeenCalled();
    expect(mockSprayTests).not.toHaveBeenCalled();
  });

  it('should fetch and spray stuck tests when found', async () => {
    const nodesLoad = { 'node-1': 2 };
    const slots = { 'node-1': 8 };
    const stuckTestIds = ['test-1', 'test-2'];
    const stuckTests = [{ test_id: 'test-1' }, { test_id: 'test-2' }];

    mockGetNodesLoad.mockResolvedValue(nodesLoad);
    mockGetSlots.mockReturnValue(slots);
    mockGetStuckTests.mockResolvedValue(stuckTestIds);
    mockGetTestsByIds.mockResolvedValue(stuckTests);
    mockSprayTests.mockResolvedValue([null, []]);

    runRerun();
    await mockForever.mock.results[0].value;

    expect(mockGetTestsByIds).toHaveBeenCalledWith(stuckTestIds);
    expect(mockSprayTests).toHaveBeenCalledWith(stuckTests, slots);
  });

  it('should carry over remaining tests to next iteration without re-fetching', async () => {
    const nodesLoad = { 'node-1': 9 };
    const slots = { 'node-1': 1 };
    const stuckTestIds = ['test-1', 'test-2'];
    const stuckTests = [{ test_id: 'test-1' }, { test_id: 'test-2' }];
    const remaining = [{ test_id: 'test-2' }];

    mockGetNodesLoad.mockResolvedValue(nodesLoad);
    mockGetSlots.mockReturnValue(slots);
    mockGetStuckTests.mockResolvedValue(stuckTestIds);
    mockGetTestsByIds.mockResolvedValue(stuckTests);
    mockSprayTests
      .mockResolvedValueOnce([null, remaining])
      .mockResolvedValueOnce([null, []]);

    mockForever.mockImplementation(async (func: () => Promise<void>) => {
      await func();
      await func();
    });

    runRerun();
    await mockForever.mock.results[0].value;

    // getStuckTests and getTestsByIds should only be called once
    expect(mockGetStuckTests).toHaveBeenCalledTimes(1);
    expect(mockGetTestsByIds).toHaveBeenCalledTimes(1);
    // sprayTests should be called twice, second time with the leftover tests
    expect(mockSprayTests).toHaveBeenCalledTimes(2);
    expect(mockSprayTests).toHaveBeenNthCalledWith(2, remaining, slots);
  });

  it('should call sleep on every tick', async () => {
    mockGetNodesLoad.mockResolvedValue({});

    mockForever.mockImplementation(async (func: () => Promise<void>) => {
      await func();
      await func();
      await func();
    });

    runRerun();
    await mockForever.mock.results[0].value;

    expect(mockSleep).toHaveBeenCalledTimes(3);
  });

  it('should pass slots derived from nodesLoad to sprayTests', async () => {
    const nodesLoad = { 'node-1': 3, 'node-2': 5 };
    const slots = { 'node-1': 7, 'node-2': 5 };
    const stuckTestIds = ['test-1'];
    const stuckTests = [{ test_id: 'test-1' }];

    mockGetNodesLoad.mockResolvedValue(nodesLoad);
    mockGetSlots.mockReturnValue(slots);
    mockGetStuckTests.mockResolvedValue(stuckTestIds);
    mockGetTestsByIds.mockResolvedValue(stuckTests);
    mockSprayTests.mockResolvedValue([null, []]);

    runRerun();
    await mockForever.mock.results[0].value;

    expect(mockGetSlots).toHaveBeenCalledWith(nodesLoad);
    expect(mockSprayTests).toHaveBeenCalledWith(stuckTests, slots);
  });
});
