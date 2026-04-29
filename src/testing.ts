import {
  getDoneTests,
  markTestsDone,
} from './redis';


export default () => {
  (async () => {
    while (true) {
      const doneTests = await getDoneTests();

      if (!doneTests) {
        continue;
      }

      await markTestsDone(doneTests);
    }
  })();
}
