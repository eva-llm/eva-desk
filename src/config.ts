export default {
  discoveryInterval: 10 * 1000,
  port: Number(process.env.PORT || 3000),
  nodes: [] as string[],
  currentRunId: undefined as string | undefined,
  runIdsQueue: [] as string[],
};
