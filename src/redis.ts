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

export const getNodesLoad = async (): Promise<Record<string, number>> => {
  const nodesLoad: Record<string, number> = {};
  const pipeline = redis.pipeline();

  for (const nodeId of CONF.nodes) {
    pipeline.scard(`${QUEUE_TEST_RUNNING}:${nodeId}`);
  }

  const results = await pipeline.exec();

  if (!results) {
    return nodesLoad;
  }

  CONF.nodes.forEach((nodeId, index) => {
    const [ error, count ] = results[index];

    if (!error) { // NOTE: Don't log now, but skip the node with error
      nodesLoad[nodeId] = count as number;
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

export const markTestDone = (nodeId: string, testId: string) => {
  return redis.sadd(`${QUEUE_TEST_RUNNING}:${nodeId}`, testId);
}

export const getNextDoneTest = async (): Promise<[string | null, string | null]> => {
  const result = await redis.brpop(QUEUE_TEST_DONE, CONF.discoveryInterval / 1000);

  if (!result) {
    return [null, null];
  }

  const [ , testData ] = result;

  return testData.split('|') as [string, string]; // [host, testId]
}

export const cleanOldNodes = (): Promise<number> => {
  return redis.zremrangebyscore(QUEUE_NODE_PING, 0, Date.now() - CONF.discoveryInterval * 3);
}

export const getActiveNodes = (): Promise<string[]> => {
  return redis.zrange(QUEUE_NODE_PING, 0, -1);
}
