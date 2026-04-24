import { parsePromptfoo } from '@eva-llm/eva-parser';


export const spreadTests = (tests: string[], slots: string[]) => {
    const [ hosts, sizes ] = splitAndSortSlots(slots);

    for (let i = 0; i < tests.length; i++) {
        const host = hosts[i % hosts.length];
        const size = sizes[i % sizes.length];

        const testsBatch = tests.splice(0, hosts.length * sizes.length);


        const testIds = sendRequest(testBatch);

        redis.setRunningTests(host, testIds);
    }
};
