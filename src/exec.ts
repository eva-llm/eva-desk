import { sprayTests } from './cluster';
import CONF from './config';


export default () => {
  setInterval(() => {
    if (!CONF.currentRunId) {
      return;
    }

    const nodesLoad = redis.getNodesLoad();
    const size = Object.keys(nodesLoad).length;

    if (size === 0) {
      return;
    }

    const slots = getSlots(nodesLoad);
    const tests = db.getTests(size);

    if (tests.length < size) {
      redis.finishRun();
    }

    if (tests.length === 0) {
      return;
    }

    sprayTests(tests, slots);
  }, CONF.discoveryInterval);
}
