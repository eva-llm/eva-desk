const mockGetDoneTests = jest.fn();
const mockMarkTestsDone = jest.fn();

jest.mock('../src/redis', () => ({
  getDoneTests: mockGetDoneTests,
  markTestsDone: mockMarkTestsDone,
}));

import runTesting from '../src/testing';

describe('testing module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call markTestsDone when getDoneTests returns data', async () => {
    const doneTests = { 'node-1': ['test-1', 'test-2'] };

    mockGetDoneTests
      .mockResolvedValueOnce(doneTests)
      .mockRejectedValueOnce(new Error('stop'));

    mockMarkTestsDone.mockResolvedValue(null);

    await expect(runTesting()).rejects.toThrow('stop');

    expect(mockMarkTestsDone).toHaveBeenCalledTimes(1);
    expect(mockMarkTestsDone).toHaveBeenCalledWith(doneTests);
  });

  it('should not call markTestsDone when getDoneTests returns null', async () => {
    mockGetDoneTests
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runTesting()).rejects.toThrow('stop');

    expect(mockMarkTestsDone).not.toHaveBeenCalled();
  });

  it('should continue polling after a null result', async () => {
    const doneTests = { 'node-2': ['test-3'] };

    mockGetDoneTests
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(doneTests)
      .mockRejectedValueOnce(new Error('stop'));

    mockMarkTestsDone.mockResolvedValue(null);

    await expect(runTesting()).rejects.toThrow('stop');

    expect(mockGetDoneTests).toHaveBeenCalledTimes(3);
    expect(mockMarkTestsDone).toHaveBeenCalledTimes(1);
    expect(mockMarkTestsDone).toHaveBeenCalledWith(doneTests);
  });

  it('should call markTestsDone for each batch of done tests', async () => {
    const batch1 = { 'node-1': ['test-1'] };
    const batch2 = { 'node-2': ['test-2', 'test-3'] };

    mockGetDoneTests
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2)
      .mockRejectedValueOnce(new Error('stop'));

    mockMarkTestsDone.mockResolvedValue(null);

    await expect(runTesting()).rejects.toThrow('stop');

    expect(mockMarkTestsDone).toHaveBeenCalledTimes(2);
    expect(mockMarkTestsDone).toHaveBeenNthCalledWith(1, batch1);
    expect(mockMarkTestsDone).toHaveBeenNthCalledWith(2, batch2);
  });
});
