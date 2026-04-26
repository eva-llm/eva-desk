import CONF from './config';
import {
  cleanOldNodes,
  getActiveNodes,
} from './redis';

export default () => {
  setInterval(
    () => cleanOldNodes().then(getActiveNodes).then(nodes => CONF.nodes = nodes),
    CONF.tickInterval);
}
