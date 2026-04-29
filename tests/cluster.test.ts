const mockEvalRequest = jest.fn();
const mockSetRunningTests = jest.fn();

jest.mock('../src/request', () => ({
  evalRequest: mockEvalRequest,
}));

jest.mock('../src/redis', () => ({
  setRunningTests: mockSetRunningTests,
}));

import { sprayTests } from '../src/cluster';
import type { TTestSchema } from '../src/types';

const makeTest = (id: string): TTestSchema => ({
  run_id: '00000000-0000-0000-0000-000000000001',
  test_id: id,
  prompt: 'Hello',
  asserts: [{ name: 'equals', criteria: 'Hello' }],
  output: 'Hello',
});

const TEST_1 = makeTest('00000000-0000-0000-0000-000000000011');
const TEST_2 = makeTest('00000000-0000-0000-0000-000000000012');
const TEST_3 = makeTest('00000000-0000-0000-0000-000000000013');
const TEST_4 = makeTest('00000000-0000-0000-0000-000000000014');

const HOST_A = 'http://node-a:3000';
const HOST_B = 'http://node-b:3000';

describe('sprayTests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return [null, []] immediately for an empty tests array', async () => {
    const [lastTestId, remaining] = await sprayTests([], { [HOST_A]: 5 });

    expect(lastTestId).toBeNull();
    expect(remaining).toEqual([]);
    expect(mockEvalRequest).not.toHaveBeenCalled();
    expect(mockSetRunningTests).not.toHaveBeenCalled();
  });

  it('should send all tests to a single host and return the last test_id', async () => {
    mockEvalRequest.mockResolvedValue([TEST_1.test_id, TEST_2.test_id]);
    mockSetRunningTests.mockResolvedValue(2);

    const [lastTestId, remaining] = await sprayTests([TEST_1, TEST_2], { [HOST_A]: 3 });

    expect(mockEvalRequest).toHaveBeenCalledTimes(1);
    expect(mockEvalRequest).toHaveBeenCalledWith(HOST_A, [TEST_1, TEST_2]);
    expect(mockSetRunningTests).toHaveBeenCalledWith(HOST_A, [TEST_1.test_id, TEST_2.test_id]);
    expect(lastTestId).toBe(TEST_2.test_id);
    expect(remaining).toEqual([]);
  });

  it('should distribute tests across multiple hosts using slot sizes', async () => {
    // HOST_A has 3 slots, HOST_B has 1 slot — splitAndSortSlots sorts descending
    mockEvalRequest
      .mockResolvedValueOnce([TEST_1.test_id, TEST_2.test_id, TEST_3.test_id])
      .mockResolvedValueOnce([TEST_4.test_id]);
    mockSetRunningTests.mockResolvedValue(null);

    const [lastTestId, remaining] = await sprayTests(
      [TEST_1, TEST_2, TEST_3, TEST_4],
      { [HOST_A]: 3, [HOST_B]: 1 },
    );

    expect(mockEvalRequest).toHaveBeenCalledTimes(2);
    expect(mockEvalRequest).toHaveBeenNthCalledWith(1, HOST_A, [TEST_1, TEST_2, TEST_3]);
    expect(mockEvalRequest).toHaveBeenNthCalledWith(2, HOST_B, [TEST_4]);
    expect(lastTestId).toBe(TEST_4.test_id);
    expect(remaining).toEqual([]);
  });

  it('should remove a host and requeue its batch when evalRequest throws', async () => {
    mockEvalRequest.mockRejectedValue(new Error('connection refused'));

    const [lastTestId, remaining] = await sprayTests([TEST_1, TEST_2], { [HOST_A]: 5 });

    expect(lastTestId).toBeNull();
    expect(remaining).toEqual([TEST_1, TEST_2]);
    expect(mockSetRunningTests).not.toHaveBeenCalled();
  });

  it('should fall back to another host when the first host fails', async () => {
    mockEvalRequest
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce([TEST_1.test_id, TEST_2.test_id]);
    mockSetRunningTests.mockResolvedValue(null);

    const [lastTestId, remaining] = await sprayTests(
      [TEST_1, TEST_2],
      { [HOST_A]: 5, [HOST_B]: 5 },
    );

    expect(mockEvalRequest).toHaveBeenCalledTimes(2);
    expect(lastTestId).toBe(TEST_2.test_id);
    expect(remaining).toEqual([]);
  });

  it('should skip a host with 0 available slots', async () => {
    mockEvalRequest.mockResolvedValue([TEST_1.test_id]);
    mockSetRunningTests.mockResolvedValue(null);

    const [lastTestId, remaining] = await sprayTests(
      [TEST_1],
      { [HOST_A]: 0, [HOST_B]: 2 },
    );

    // HOST_A has 0 slots so it should be skipped; HOST_B should handle the test
    expect(mockEvalRequest).toHaveBeenCalledWith(HOST_B, [TEST_1]);
    expect(lastTestId).toBe(TEST_1.test_id);
    expect(remaining).toEqual([]);
  });

  it('should call setRunningTests with the started IDs returned by evalRequest', async () => {
    const startedIds = ['id-a', 'id-b'];
    mockEvalRequest.mockResolvedValue(startedIds);
    mockSetRunningTests.mockResolvedValue(null);

    await sprayTests([TEST_1, TEST_2], { [HOST_A]: 5 });

    expect(mockSetRunningTests).toHaveBeenCalledWith(HOST_A, startedIds);
  });

  it('should return remaining tests when all hosts fail', async () => {
    mockEvalRequest.mockRejectedValue(new Error('all down'));

    const [lastTestId, remaining] = await sprayTests(
      [TEST_1, TEST_2, TEST_3],
      { [HOST_A]: 2, [HOST_B]: 2 },
    );

    expect(lastTestId).toBeNull();
    expect(remaining).toEqual([TEST_1, TEST_2, TEST_3]);
  });

  it('should handle a single test correctly', async () => {
    mockEvalRequest.mockResolvedValue([TEST_1.test_id]);
    mockSetRunningTests.mockResolvedValue(null);

    const [lastTestId, remaining] = await sprayTests([TEST_1], { [HOST_A]: 10 });

    expect(lastTestId).toBe(TEST_1.test_id);
    expect(remaining).toEqual([]);
  });
});
