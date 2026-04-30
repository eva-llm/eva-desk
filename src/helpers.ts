// NOTE: helpers use config, utils don't, to avoid circular dependencies
import {
  type ITestRun,
  type TTestSchema,
} from './types';
import CONF from './config';

export const getSlots = (
  nodesLoad: Record<string, number>,
): Record<string, number> => {
  const slots: Record<string, number> = {};

  for (const [ nodeId, count ] of Object.entries(nodesLoad)) {
    slots[nodeId] = Math.max(0, CONF.maxNodeLoad - count);
  }

  return slots;
}

export const splitAndSortSlots = (slots: Record<string, number>): [string, number][] => {
  return Object.entries(slots).sort((a, b) => b[1] - a[1]);
}

export const switchRunId = () => {
  CONF.currentRunId = CONF.runIdsQueue.shift() ?? null;
  CONF.lastTestId = null;
}

export const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));

export const configs2tests = (testConfigs: ITestRun[]): TTestSchema[] => {
  const tests: TTestSchema[] = [];

  for (const testConfig of testConfigs) {
    const test = JSON.parse(testConfig.test_config) as TTestSchema;

    test.test_id = testConfig.test_id;
    test.run_id = testConfig.run_id;

    tests.push(test)
  }

  return tests;
};

export const forever = async (func: () => Promise<void>) => {
  await func();
  while (true) {
    await sleep(CONF.tickInterval); // NOTE: keep interval value internally
    try {
      await func();
    } catch {} // eslint-disable-line no-empty
  }
}
