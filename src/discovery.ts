import { QUEUE_NODE_PING } from './constants';
import CONF from './config';
import redis from './redis';

export default () => {
  setInterval(async () => {
    redis.cleanOldNodes();
    CONF.nodes = await redis.getActiveNodes();

    // await redis.zremrangebyscore(QUEUE_NODE_PING, 0, Date.now() - CONF.discoveryInterval * 3);

    // CONF.nodes = await redis.zrange(QUEUE_NODE_PING, 0, -1);
  }, CONF.discoveryInterval);
}
