export default {
  port: Number(process.env.PORT || 3000),
  tickInterval: 10 * 1000,
  maxNodeLoad: Number(process.env.MAX_TESTS_IN_NODE || 1000),
  nodes: [] as string[],
  currentRunId: null as string | null, // NOTE: need to keep in redis also to provide persistence across restarts
  lastTestId: null as string | null,
  runIdsQueue: [] as string[],
};
