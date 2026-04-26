import { splitAndSortSlots } from './helpers';
import { setRunningTests } from './redis';
import { sendRequest } from './request';
import { type TTestSchema } from './types';


export const sprayTests = (
  tests: TTestSchema[],
  slots: Record<string, number>,
) => {
  const [ hosts, sizes ] = splitAndSortSlots(slots);
  const promises = [];

  let offset = 0;
  for (let i = 0; i < hosts.length; i++) {

    const host = hosts[i];
    const size = sizes[i];

    const testsBatch = tests.slice(offset, offset + size);
    const promiseFunc = (host: string, testsBatch: TTestSchema[]) => sendRequest(host, testsBatch)
      .then(testIds => setRunningTests(host, testIds));

    promises.push(promiseFunc(host, testsBatch));
    offset += size;
  }

  return Promise.all(promises);
};
