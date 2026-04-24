import Redis from 'ioredis';

export default new Redis(process.env.CLUSTER_REDIS_URL!, {
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
