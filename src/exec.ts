import { sprayTests } from './cluster';
import { getNodesLoad } from './redis';
import {
  forever,
  getSlots,
  sleep,
  switchRunId,
} from './helpers';
import CONF from './config';
import { getNextTests } from './db';


export default () => {
  forever(async () => {
    await sleep(CONF.tickInterval);

    if (!CONF.currentRunId) {
      return;
    }

    const nodesLoad = await getNodesLoad();

    if (Object.keys(nodesLoad).length === 0) {
      return;
    }

    const slots = getSlots(nodesLoad);
    const size = Object.values(slots).reduce((sum, el) => sum + el, 0);

    if (size < CONF.maxNodeLoad / 2) {
      return; // NOTE: don't deal with trifles
    }

    const tests = await getNextTests(size);

    const [lastTestId, notRunTests] = await sprayTests(tests, slots);

    if ((tests.length < size) && (notRunTests.length === 0)) {
      switchRunId();
    } else {
      CONF.lastTestId = lastTestId;
    }
  });
}
