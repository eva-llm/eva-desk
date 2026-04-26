import { sprayTests } from './cluster';
import { getNodesLoad } from './redis';
import {
  getSlots,
  switchRunId,
} from './helpers';
import CONF from './config';
import { getTests } from './db';


export default () => {
  setInterval(async () => {
    if (!CONF.currentRunId) {
      return;
    }

    const nodesLoad = await getNodesLoad();

    if (Object.keys(nodesLoad).length === 0) {
      return;
    }

    const slots = getSlots(nodesLoad);
    const size = Object.values(slots).reduce((sum, el) => sum + el, 0);
    const tests = await getTests(size);

    if (tests.length < size) {
      switchRunId();
    }

    if (tests.length === 0) {
      return;
    }

    sprayTests(tests, slots);
  }, CONF.tickInterval);
}
