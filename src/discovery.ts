import {
  forever,
} from './helpers';
import CONF from './config';
import {
  cleanOldNodes,
  getActiveNodes,
} from './redis';

export default () => {
  forever(async () => {
    await cleanOldNodes();

    const nodes = await getActiveNodes();

    CONF.nodes = nodes.reduce<Record<string, string>>((acc, key) => {
      const [uuid, host] = key.split('|');

      acc[uuid] = host;

      return acc;
    }, {});
  });
}
