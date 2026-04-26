import { sleep } from './helpers';
import CONF from './config';
import {
  cleanOldNodes,
  getActiveNodes,
} from './redis';

export default async () => {
  while (true) {
    await sleep(CONF.tickInterval);
    await cleanOldNodes();

    const nodes = await getActiveNodes();

    CONF.nodes = nodes;
  }
}
