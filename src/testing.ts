import { QUEUE_TEST_DONE, QUEUE_TEST_RUNNING } from './constants';
import redis from './redis';

export default async () => {
  while (true) {
    const [nodeHost, testId] = redis.getNextDoneTest();

    if (!testId) {
      continue;
    }

    redis.markTestsDone(nodeHost, testId);
  }
}
