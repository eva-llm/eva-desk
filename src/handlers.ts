import { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';

import CONF from './config';
import { spreadTests } from './cluster';

export default (fastify: FastifyInstance) => {
  fastify.post('/eval', {
    schema: {
      body: {
        type: 'array',
        items: TestSchema,
      },
      response: {
        200: EvalResponse,
      },
    },
    handler: async (request: FastifyRequest<{ Body: TTestSchema[] }>): Promise<TEvalResponse> => {
      const testConfigs = request.body;
      const testIds: string[] = [];

      for (const testConfig of testConfigs) {
        const testId = uuidv7();

        testConfig.test_id = testId;
        testIds.push(testId);
      }

      spreadTests(testConfigs, );

      return { test_ids: testIds };
    }
  });

  fastify.get('/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
    handler: async () => ({ status: 'ok' }),
  });

  fastify.post('/run', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            run_id: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { run_id: runId } = request.body;

      if (CONF.currentRunId) {
        CONF.runIdsQueue.push(runId);

        return { status: 'queued', runId };
      } else {
        CONF.currentRunId = runId;

        return { status: 'run', runId };
      }
    }
  });

  fastify.get('/current_run', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            current_run: { type: 'string' },
          },
        },
      },
    },
    handler: async () => ({ current_run: CONF.currentRunId }),
  });

  fastify.get('/runs_queue', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            runs_queue: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async () => ({ runs_queue: CONF.runIdsQueue }),
  });

  fastify.get('/nodes', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            nodes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async () => ({ nodes: CONF.nodes }),
  })
}
