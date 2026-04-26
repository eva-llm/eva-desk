import {
  getNodesLoad,
  getStuckTests,
} from './redis';
import CONF from './config';
import { getTestsByIds } from './db';
import {
  getSlots,
  sleep,
} from './helpers';
import { sprayTests } from './cluster';

export default async () => {
  while (true) {
    await sleep(CONF.tickInterval)

    const stuckTestIds = await getStuckTests();

    if (stuckTestIds.length === 0) {
      continue;
    }

    const nodesLoad = await getNodesLoad();
    
    if (Object.keys(nodesLoad).length === 0) {
      continue;
    }

    const slots = getSlots(nodesLoad);
    const stuckTests = await getTestsByIds(stuckTestIds);

    await sprayTests(stuckTests, slots);
  };
};
