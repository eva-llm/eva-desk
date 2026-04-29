import Redis from 'ioredis';

import CONF from './config';
import {
  QUEUE_TEST_DONE,
  QUEUE_NODE_PING,
  QUEUE_TEST_RUNNING,
} from './constants';

const redis = new Redis(process.env.CLUSTER_REDIS_URL!, {
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export default redis;

export const getStuckTests = async (): Promise<string[]> => {
  const registedNodeIds = new Set(await redis.scan(0, 'MATCH', `${QUEUE_TEST_RUNNING}:*`));

  const diedNodeIds = registedNodeIds.difference(new Set(Object.keys(CONF.nodes)));

  const testIds: string[] = [];

  for (const nodeId of diedNodeIds) {
    const nodeTestIds = await redis.smembers(`${QUEUE_TEST_RUNNING}:${nodeId}`);

    testIds.push(...nodeTestIds);
  }

  return testIds;
}

export const getNodesLoad = async (): Promise<Record<string, number>> => {
  const nodesLoad: Record<string, number> = {};
  const pipeline = redis.pipeline();

  for (const uuid of Object.keys(CONF.nodes)) {
    pipeline.scard(`${QUEUE_TEST_RUNNING}:${uuid}`);
  }

  const results = await pipeline.exec();

  if (!results) {
    return nodesLoad;
  }

  Object.values(CONF.nodes).forEach((host, index) => {
    const [ error, count ] = results[index];

    if (!error) { // NOTE: Don't log now, but skip the node with error
      nodesLoad[host] = count as number;
    }
  });

  return nodesLoad;
}

export const setRunningTests = (nodeId: string, testIds: string[]) => {
  if (testIds.length === 0) {
    return;
  }

  return redis.sadd(`${QUEUE_TEST_RUNNING}:${nodeId}`, ...testIds);
}

export const markTestsDone = (doneTests: Record<string, string[]>) => {
  const pipeline = redis.pipeline();

  for (const [ nodeId, testIds ] of Object.entries(doneTests)) {
    pipeline.srem(`${QUEUE_TEST_RUNNING}:${nodeId}`, ...testIds);
  }

  return pipeline.exec();
}

export const getDoneTests = async (): Promise<Record<string, string[]> | null> => {
  const result = await redis.brpop(QUEUE_TEST_DONE, CONF.tickInterval);

  if (!result) {
    return null;
  }

  const [ , testData ] = result;
  const testsInfo = [testData];

  const otherTestData = await redis.rpop(QUEUE_TEST_DONE, CONF.maxNodeLoad);

  if (otherTestData?.length) {
    testsInfo.push(...otherTestData);
  }

  const doneTests: Record<string, string[]> = {};

  for (const testInfo of testsInfo) {
    const [uuid, testId] = testInfo.split('|') as [string, string];

    if (!doneTests[uuid]) {
      doneTests[uuid] = [];
    }

    doneTests[uuid].push(testId);
  }

  return doneTests;
}

export const cleanOldNodes = (): Promise<number> => {
  return redis.zremrangebyscore(QUEUE_NODE_PING, 0, Date.now() - CONF.tickInterval * 3 * 1000);
}

export const getActiveNodes = (): Promise<string[]> => {
  return redis.zrange(QUEUE_NODE_PING, 0, -1);
}
