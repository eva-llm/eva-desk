import {
  getNextDoneTest,
  markTestDone,
} from './redis';

export default async () => {
  while (true) {
    const [nodeHost, testId] = await getNextDoneTest();

    if (!testId || !nodeHost) {
      continue;
    }

    markTestDone(nodeHost, testId);
  }
}
