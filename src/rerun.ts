import {
  getNodesLoad,
  getStuckTests,
} from './redis';
import CONF from './config';
import {
  getTestsByIds,
} from './db';
import {
  getSlots,
  sleep,
  forever,
} from './helpers';
import {
  sprayTests,
} from './cluster';
import {
  type TTestSchema,
} from 'types';


export default () => {
  let stuckTests: TTestSchema[] = []; // NOTE: maybe better to keep in redis

  forever(async () => {
    await sleep(CONF.tickInterval)

    const nodesLoad = await getNodesLoad();
    
    if (Object.keys(nodesLoad).length === 0) {
      return;
    }

    const slots = getSlots(nodesLoad);

    if (stuckTests.length === 0) {
      const stuckTestIds = await getStuckTests();

      if (stuckTestIds.length === 0) {
        return;
      }

      stuckTests = await getTestsByIds(stuckTestIds);
    }

    [, stuckTests] = await sprayTests(stuckTests, slots);
  });
};
