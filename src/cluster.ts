import { splitAndSortSlots } from './helpers';
import { setRunningTests } from './redis';
import { sendRequest } from './request';
import { type TTestSchema } from './types';


export const sprayTests = async (
  tests: TTestSchema[],
  slots: Record<string, number>,
): Promise<[string | null, TTestSchema[]]> => {
  let lastTestId: string | null = null;

  if (tests.length === 0) {
    return [lastTestId, tests];
  }

  const queue = [...tests];

  const hostSizes = splitAndSortSlots(slots);

  let i = 0;
  while (queue.length > 0 && hostSizes.length > 0) {
    const idx = i % hostSizes.length;
    const [ host, size ] = hostSizes[idx];

    if (size === 0) {
      hostSizes.splice(idx, 1);
      continue;
    }

    const testsBatch = queue.splice(0, size);

    try {
      const startedIds = await sendRequest(host, testsBatch); // NOTE: one-by-one - eva-run is extra fast "fire & forget"

      await setRunningTests(host, startedIds); // NOTE: maybe need more logic in order to avoid duplications on error here

      lastTestId = testsBatch[testsBatch.length - 1].test_id!;
      i++
    } catch {
      queue.unshift(...testsBatch);
      hostSizes.splice(idx, 1);
    }
  }

  return [lastTestId, queue];
};
