import {
  type FastifyInstance,
  type FastifyRequest,
} from 'fastify';
import { uuidv7 } from 'uuidv7';

import CONF from './config';
import { spreadTests } from './cluster';

import {
  CurrentRunResponse,
  EvalResponse,
  HealthResponse,
  NodesResponse,
  TestSchema,
  RunsQueueResponse,
  RunRequest,
  RunResponse,
  type THealthResponse,
  type TEvalResponse,
  type TTestSchema,
  type TRunRequest,
  type TRunResponse,
  type TCurrentRunResponse,
  type TRunsQueueResponse,
  type TNodesResponse,
} from './types';

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
    handler: async (
      request: FastifyRequest<{ Body: TTestSchema[] }>,
    ): Promise<TEvalResponse> => {

      const nodesLoad = redis.getNodesLoad();

      if (Object.keys(nodesLoad).length === 0) {
        return { test_ids: testIds };
      }

      const testConfigs = request.body;
      const testIds: string[] = [];

      for (const testConfig of testConfigs) {
        const testId = uuidv7();

        testConfig.test_id = testId;
        testIds.push(testId);
      }

      spreadTests(testConfigs, getSlots(nodesLoad));

      return { test_ids: testIds };
    }
  });

  fastify.get('/health', {
    schema: {
      response: {
        200: HealthResponse,
      },
    },
    handler: async (): Promise<THealthResponse> => ({ status: 'ok' }),
  });

  fastify.post('/run', {
    schema: {
      body: RunRequest,
      response: {
        200: RunResponse,
      },
    },
    handler: async (
      request: FastifyRequest<{ Body: TRunRequest }>,
    ): Promise<TRunResponse> => {
      const { run_id: runId } = request.body;

      if (CONF.currentRunId) {
        CONF.runIdsQueue.push(runId);

        return { status: 'queued', run_id: runId };
      } else {
        CONF.currentRunId = runId;

        return { status: 'run', run_id: runId };
      }
    }
  });

  fastify.get('/current_run', {
    schema: {
      response: {
        200: CurrentRunResponse,
      },
    },
    handler: async (): Promise<TCurrentRunResponse> => ({ run_id: CONF.currentRunId }),
  });

  fastify.get('/runs_queue', {
    schema: {
      response: {
        200: RunsQueueResponse,
      },
    },
    handler: async (): Promise<TRunsQueueResponse> => ({ run_ids: CONF.runIdsQueue }),
  });

  fastify.get('/nodes', {
    schema: {
      response: {
        200: NodesResponse,
      },
    },
    handler: async (): Promise<TNodesResponse> => ({ nodes: CONF.nodes }),
  });
}
