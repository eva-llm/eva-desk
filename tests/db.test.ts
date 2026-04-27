const mockQueryResult = jest.fn();
const mockSql = jest.fn((stringsOrArg: any, ...rest: any[]) => {
  if (Array.isArray(stringsOrArg) && 'raw' in stringsOrArg) {
    return mockQueryResult();
  }
  return stringsOrArg;
});

jest.mock('postgres', () => ({
  __esModule: true,
  default: jest.fn(() => mockSql),
}));

import CONF from '../src/config';
import { getNextTests, getTestsByIds } from '../src/db';

const RUN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const TEST_ID_1 = 'bbbbbbbb-0000-0000-0000-000000000001';
const TEST_ID_2 = 'bbbbbbbb-0000-0000-0000-000000000002';
const UUID_MIN = '00000000-0000-0000-0000-000000000000';

const makeTestConfig = (overrides: Record<string, unknown> = {}) => ({
  prompt: 'test prompt',
  asserts: [],
  provider: 'openai',
  model: 'gpt-4',
  ...overrides,
});

const makeTestRun = (testId: string, runId: string, config: Record<string, unknown> = {}) => ({
  test_id: testId,
  run_id: runId,
  test_config: JSON.stringify(makeTestConfig(config)),
});

describe('getNextTests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CONF.currentRunId = RUN_ID;
    CONF.lastTestId = null;
  });

  it('should return [] when currentRunId is null', async () => {
    CONF.currentRunId = null;
    const result = await getNextTests(10);
    expect(result).toEqual([]);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('should return [] when query returns no rows', async () => {
    mockQueryResult.mockResolvedValueOnce([]);
    const result = await getNextTests(10);
    expect(result).toEqual([]);
  });

  it('should return parsed tests from query results', async () => {
    const row = makeTestRun(TEST_ID_1, RUN_ID);
    mockQueryResult.mockResolvedValueOnce([row]);

    const result = await getNextTests(10);

    expect(result).toHaveLength(1);
    expect(result[0].test_id).toBe(TEST_ID_1);
    expect(result[0].run_id).toBe(RUN_ID);
    expect(result[0].prompt).toBe('test prompt');
    expect(result[0].asserts).toEqual([]);
  });

  it('should attach test_id and run_id from ITestRun onto the parsed test', async () => {
    const row = makeTestRun(TEST_ID_1, RUN_ID, { test_id: 'should-be-overwritten' });
    mockQueryResult.mockResolvedValueOnce([row]);

    const result = await getNextTests(10);

    expect(result[0].test_id).toBe(TEST_ID_1);
    expect(result[0].run_id).toBe(RUN_ID);
  });

  it('should return multiple parsed tests', async () => {
    const rows = [
      makeTestRun(TEST_ID_1, RUN_ID),
      makeTestRun(TEST_ID_2, RUN_ID),
    ];
    mockQueryResult.mockResolvedValueOnce(rows);

    const result = await getNextTests(10);

    expect(result).toHaveLength(2);
    expect(result[0].test_id).toBe(TEST_ID_1);
    expect(result[1].test_id).toBe(TEST_ID_2);
  });

  it('should query using UUID_MIN when lastTestId is null', async () => {
    CONF.lastTestId = null;
    mockQueryResult.mockResolvedValueOnce([]);

    await getNextTests(5);

    const calls = mockSql.mock.calls;
    const templateCall = calls.find(([arg]) => Array.isArray(arg) && 'raw' in arg) as any[];
    expect(templateCall).toBeDefined();
    // template values: [0]=strings, [1]=sql('TestRun'), [2]=run_id, [3]=lastTestId|UUID_MIN, [4]=size
    expect(templateCall[2]).toBe(RUN_ID);
    expect(templateCall[3]).toBe(UUID_MIN);
  });

  it('should query using lastTestId when it is set', async () => {
    const lastId = 'cccccccc-0000-0000-0000-000000000099';
    CONF.lastTestId = lastId;
    mockQueryResult.mockResolvedValueOnce([]);

    await getNextTests(5);

    const calls = mockSql.mock.calls;
    const templateCall = calls.find(([arg]) => Array.isArray(arg) && 'raw' in arg) as any[];
    expect(templateCall[3]).toBe(lastId);
  });
});

describe('getTestsByIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return [] when query returns no rows', async () => {
    mockQueryResult.mockResolvedValueOnce([]);
    const result = await getTestsByIds([TEST_ID_1]);
    expect(result).toEqual([]);
  });

  it('should return parsed tests from query results', async () => {
    const row = makeTestRun(TEST_ID_1, RUN_ID);
    mockQueryResult.mockResolvedValueOnce([row]);

    const result = await getTestsByIds([TEST_ID_1]);

    expect(result).toHaveLength(1);
    expect(result[0].test_id).toBe(TEST_ID_1);
    expect(result[0].run_id).toBe(RUN_ID);
    expect(result[0].prompt).toBe('test prompt');
  });

  it('should attach test_id and run_id from ITestRun onto the parsed test', async () => {
    const row = makeTestRun(TEST_ID_1, RUN_ID, { run_id: 'should-be-overwritten' });
    mockQueryResult.mockResolvedValueOnce([row]);

    const result = await getTestsByIds([TEST_ID_1]);

    expect(result[0].test_id).toBe(TEST_ID_1);
    expect(result[0].run_id).toBe(RUN_ID);
  });

  it('should return multiple parsed tests', async () => {
    const rows = [
      makeTestRun(TEST_ID_1, RUN_ID),
      makeTestRun(TEST_ID_2, RUN_ID),
    ];
    mockQueryResult.mockResolvedValueOnce(rows);

    const result = await getTestsByIds([TEST_ID_1, TEST_ID_2]);

    expect(result).toHaveLength(2);
    expect(result[0].test_id).toBe(TEST_ID_1);
    expect(result[1].test_id).toBe(TEST_ID_2);
  });

  it('should pass the provided test IDs into the query', async () => {
    mockQueryResult.mockResolvedValueOnce([]);

    const ids = [TEST_ID_1, TEST_ID_2];
    await getTestsByIds(ids);

    const calls = mockSql.mock.calls;
    // sql(testIds) helper call — the array passed should be our ids
    const idCall = calls.find(([arg]) => Array.isArray(arg) && !('raw' in arg)) as any[];
    expect(idCall[0]).toEqual(ids);
  });
});
