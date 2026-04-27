const mockCleanOldNodes = jest.fn();
const mockGetActiveNodes = jest.fn();
const mockSleep = jest.fn();

jest.mock('../src/redis', () => ({
  cleanOldNodes: mockCleanOldNodes,
  getActiveNodes: mockGetActiveNodes,
}));

jest.mock('../src/helpers', () => ({
  sleep: mockSleep,
}));

import CONF from '../src/config';
import runDiscovery from '../src/discovery';

describe('discovery module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CONF.nodes = [];
    mockSleep.mockResolvedValue(undefined);
  });

  it('should sleep for tickInterval on each iteration', async () => {
    mockCleanOldNodes.mockResolvedValueOnce(0);
    mockGetActiveNodes
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runDiscovery()).rejects.toThrow('stop');

    expect(mockSleep).toHaveBeenCalledWith(CONF.tickInterval);
  });

  it('should call cleanOldNodes on each iteration', async () => {
    mockCleanOldNodes
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockGetActiveNodes
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runDiscovery()).rejects.toThrow('stop');

    expect(mockCleanOldNodes).toHaveBeenCalledTimes(2);
  });

  it('should update CONF.nodes with the result of getActiveNodes', async () => {
    const nodes = ['node-1', 'node-2'];

    mockCleanOldNodes.mockResolvedValueOnce(0);
    mockGetActiveNodes
      .mockResolvedValueOnce(nodes)
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runDiscovery()).rejects.toThrow('stop');

    expect(CONF.nodes).toEqual(nodes);
  });

  it('should update CONF.nodes to empty array when no active nodes', async () => {
    CONF.nodes = ['node-old'];

    mockCleanOldNodes.mockResolvedValueOnce(0);
    mockGetActiveNodes
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runDiscovery()).rejects.toThrow('stop');

    expect(CONF.nodes).toEqual([]);
  });

  it('should update CONF.nodes on each iteration', async () => {
    const firstNodes = ['node-1'];
    const secondNodes = ['node-1', 'node-2'];

    mockCleanOldNodes.mockResolvedValue(0);
    mockGetActiveNodes
      .mockResolvedValueOnce(firstNodes)
      .mockResolvedValueOnce(secondNodes)
      .mockRejectedValueOnce(new Error('stop'));

    await expect(runDiscovery()).rejects.toThrow('stop');

    expect(CONF.nodes).toEqual(secondNodes);
    expect(mockGetActiveNodes).toHaveBeenCalledTimes(3);
  });

  it('should call sleep, cleanOldNodes, and getActiveNodes in order', async () => {
    const callOrder: string[] = [];

    mockSleep.mockImplementation(() => {
      callOrder.push('sleep');
      return Promise.resolve();
    });
    mockCleanOldNodes.mockImplementation(() => {
      callOrder.push('cleanOldNodes');
      return Promise.resolve(0);
    });
    mockGetActiveNodes.mockImplementationOnce(() => {
      callOrder.push('getActiveNodes');
      return Promise.resolve([]);
    }).mockRejectedValueOnce(new Error('stop'));

    await expect(runDiscovery()).rejects.toThrow('stop');

    expect(callOrder.slice(0, 3)).toEqual(['sleep', 'cleanOldNodes', 'getActiveNodes']);
  });
});
