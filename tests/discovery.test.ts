const mockCleanOldNodes = jest.fn();
const mockGetActiveNodes = jest.fn();
const mockSleep = jest.fn();
const mockForever = jest.fn();

jest.mock('../src/redis', () => ({
  cleanOldNodes: mockCleanOldNodes,
  getActiveNodes: mockGetActiveNodes,
}));

jest.mock('../src/helpers', () => ({
  sleep: mockSleep,
  forever: mockForever,
}));

import CONF from '../src/config';
import runDiscovery from '../src/discovery';

describe('discovery module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    CONF.nodes = {};
    mockSleep.mockResolvedValue(undefined);
    mockForever.mockImplementation(async (func: () => Promise<void>) => {
      await mockSleep(CONF.tickInterval);
      await func();
    });
  });

  it('should sleep for tickInterval on each iteration', async () => {
    mockCleanOldNodes.mockResolvedValue(0);
    mockGetActiveNodes.mockResolvedValue([]);

    runDiscovery();
    await mockForever.mock.results[0].value;

    expect(mockSleep).toHaveBeenCalledWith(CONF.tickInterval);
  });

  it('should call cleanOldNodes on each iteration', async () => {
    mockCleanOldNodes.mockResolvedValue(0);
    mockGetActiveNodes.mockResolvedValue([]);

    mockForever.mockImplementation(async (func: () => Promise<void>) => {
      await mockSleep(CONF.tickInterval);
      await func();
      await mockSleep(CONF.tickInterval);
      await func();
    });

    runDiscovery();
    await mockForever.mock.results[0].value;

    expect(mockCleanOldNodes).toHaveBeenCalledTimes(2);
  });

  it('should update CONF.nodes with the result of getActiveNodes', async () => {
    mockCleanOldNodes.mockResolvedValue(0);
    mockGetActiveNodes.mockResolvedValue(['key-1|node-1', 'key-2|node-2']);

    runDiscovery();
    await mockForever.mock.results[0].value;

    expect(CONF.nodes).toEqual({'key-1': 'node-1', 'key-2': 'node-2'});
  });

  it('should update CONF.nodes to empty object when no active nodes', async () => {
    CONF.nodes = {'key-old': 'node-old'};

    mockCleanOldNodes.mockResolvedValue(0);
    mockGetActiveNodes.mockResolvedValue([]);

    runDiscovery();
    await mockForever.mock.results[0].value;

    expect(CONF.nodes).toEqual({});
  });

  it('should update CONF.nodes on each iteration', async () => {
    mockCleanOldNodes.mockResolvedValue(0);
    mockGetActiveNodes
      .mockResolvedValueOnce(['key-1|node-1'])
      .mockResolvedValueOnce(['key-1|node-1', 'key-2|node-2']);

    mockForever.mockImplementation(async (func: () => Promise<void>) => {
      await mockSleep(CONF.tickInterval);
      await func();
      await mockSleep(CONF.tickInterval);
      await func();
    });

    runDiscovery();
    await mockForever.mock.results[0].value;

    expect(CONF.nodes).toEqual({'key-1': 'node-1', 'key-2': 'node-2'});
    expect(mockGetActiveNodes).toHaveBeenCalledTimes(2);
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
    mockGetActiveNodes.mockImplementation(() => {
      callOrder.push('getActiveNodes');
      return Promise.resolve([]);
    });

    runDiscovery();
    await mockForever.mock.results[0].value;

    expect(callOrder.slice(0, 3)).toEqual(['sleep', 'cleanOldNodes', 'getActiveNodes']);
  });
});
