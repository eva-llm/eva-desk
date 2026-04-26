import {
  getNodesLoad,
  getStuckTests,
} from './redis';
import CONF from './config';
import { getTestsByIds } from './db';
import { getSlots } from './helpers';
import { sprayTests } from './cluster';

export default () => {
  setInterval(async () => {
    const stuckTestIds = await getStuckTests();

    if (stuckTestIds.length === 0) {
      return;
    }

    const nodesLoad = await getNodesLoad();
    
    if (Object.keys(nodesLoad).length === 0) {
      return;
    }

    const slots = getSlots(nodesLoad);
    const stuckTests = await getTestsByIds(stuckTestIds);

    sprayTests(stuckTests, slots);
  }, CONF.tickInterval);
};
