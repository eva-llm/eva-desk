const mockGetDoneTests = jest.fn();
const mockMarkTestsDone = jest.fn();

jest.mock('../src/redis', () => ({
  getDoneTests: mockGetDoneTests,
  markTestsDone: mockMarkTestsDone,
}));

import runTesting from '../src/testing';

const freeze = () => new Promise<never>(() => {});

describe('testing module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkTestsDone.mockResolvedValue(null);
  });

  it('should call markTestsDone when getDoneTests returns data', async () => {
    const doneTests = { 'node-1': ['test-1', 'test-2'] };
    let resolve!: () => void;
    const signal = new Promise<void>(r => resolve = r);

    mockGetDoneTests
      .mockResolvedValueOnce(doneTests)
      .mockImplementation(() => { resolve(); return freeze(); });

    runTesting();
    await signal;

    expect(mockMarkTestsDone).toHaveBeenCalledTimes(1);
    expect(mockMarkTestsDone).toHaveBeenCalledWith(doneTests);
  });

  it('should not call markTestsDone when getDoneTests returns null', async () => {
    let resolve!: () => void;
    const signal = new Promise<void>(r => resolve = r);

    mockGetDoneTests
      .mockResolvedValueOnce(null)
      .mockImplementation(() => { resolve(); return freeze(); });

    runTesting();
    await signal;

    expect(mockMarkTestsDone).not.toHaveBeenCalled();
  });

  it('should continue polling after a null result', async () => {
    const doneTests = { 'node-2': ['test-3'] };
    let resolve!: () => void;
    const signal = new Promise<void>(r => resolve = r);
    let callCount = 0;

    mockGetDoneTests.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(null);
      if (callCount === 2) return Promise.resolve(doneTests);
      resolve();
      return freeze();
    });

    runTesting();
    await signal;

    expect(mockGetDoneTests).toHaveBeenCalledTimes(3);
    expect(mockMarkTestsDone).toHaveBeenCalledTimes(1);
    expect(mockMarkTestsDone).toHaveBeenCalledWith(doneTests);
  });

  it('should call markTestsDone for each batch of done tests', async () => {
    const batch1 = { 'node-1': ['test-1'] };
    const batch2 = { 'node-2': ['test-2', 'test-3'] };
    let resolve!: () => void;
    const signal = new Promise<void>(r => resolve = r);
    let callCount = 0;

    mockGetDoneTests.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(batch1);
      if (callCount === 2) return Promise.resolve(batch2);
      resolve();
      return freeze();
    });

    runTesting();
    await signal;

    expect(mockMarkTestsDone).toHaveBeenCalledTimes(2);
    expect(mockMarkTestsDone).toHaveBeenNthCalledWith(1, batch1);
    expect(mockMarkTestsDone).toHaveBeenNthCalledWith(2, batch2);
  });
});
