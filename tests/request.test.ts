const mockRequest = jest.fn();

jest.mock('undici', () => ({
  request: mockRequest,
}));

import { evalRequest } from '../src/request';
import type { TTestSchema } from '../src/types';

const MOCK_HOST = 'http://localhost:3000';

const mockTest: TTestSchema = {
  run_id: '00000000-0000-0000-0000-000000000001',
  prompt: 'Hello',
  asserts: [{ name: 'equals', criteria: 'Hello' }],
  output: 'Hello',
};

const makeBodyMock = (data: unknown, text = 'error') => ({
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(text),
});

describe('evalRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should POST to /eval and return test_ids on success', async () => {
    const testIds = [
      '00000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000011',
    ];

    mockRequest.mockResolvedValue({
      statusCode: 200,
      body: makeBodyMock({ test_ids: testIds }),
    });

    const result = await evalRequest(MOCK_HOST, [mockTest]);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(
      `${MOCK_HOST}/eval`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([mockTest]),
      }),
    );
    expect(result).toEqual(testIds);
  });

  it('should throw when the server responds with a non-200 status', async () => {
    mockRequest.mockResolvedValue({
      statusCode: 500,
      body: makeBodyMock(null, 'Internal Server Error'),
    });

    await expect(evalRequest(MOCK_HOST, [mockTest])).rejects.toThrow(
      'Server responded with 500: Internal Server Error',
    );
  });

  it('should throw when the server responds with 400', async () => {
    mockRequest.mockResolvedValue({
      statusCode: 400,
      body: makeBodyMock(null, 'Bad Request'),
    });

    await expect(evalRequest(MOCK_HOST, [mockTest])).rejects.toThrow(
      'Server responded with 400: Bad Request',
    );
  });

  it('should send an empty array when tests is empty', async () => {
    mockRequest.mockResolvedValue({
      statusCode: 200,
      body: makeBodyMock({ test_ids: [] }),
    });

    const result = await evalRequest(MOCK_HOST, []);

    expect(mockRequest).toHaveBeenCalledWith(
      `${MOCK_HOST}/eval`,
      expect.objectContaining({ body: JSON.stringify([]) }),
    );
    expect(result).toEqual([]);
  });

  it('should propagate network errors from undici', async () => {
    mockRequest.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(evalRequest(MOCK_HOST, [mockTest])).rejects.toThrow('ECONNREFUSED');
  });
});
