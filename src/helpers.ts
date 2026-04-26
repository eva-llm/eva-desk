// NOTE: helpers use config, utils don't, to avoid circular dependencies
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

export const splitAndSortSlots = (slots: Record<string, number>): [ string[], number[] ] => {
  const hosts = Object.keys(slots);
  const sizes = Object.values(slots);

  const sortedIndices = hosts
    .map((_, index) => index)
    .sort((a, b) => sizes[b] - sizes[a]);

  return [
    sortedIndices.map((index) => hosts[index]),
    sortedIndices.map((index) => sizes[index]),
  ];
}

export const switchRunId = () => {
  CONF.currentRunId = CONF.runIdsQueue.shift() ?? null;
  CONF.lastTestId = null;
}

export const sleep = (sec: number) => new Promise((resolve) => setTimeout(resolve, sec * 1000));
