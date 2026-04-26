import Fastify from 'fastify';

import CONF from './config';
import discoveryNodes from './discovery';
import updateDoneTests from './testing';
import assignTestsToNodes from './exec';
import registerHandlers from './handlers';
import reRunTestsOfDiedNodes from './rerun';


const fastify = Fastify({
  logger: {    
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

registerHandlers(fastify);

const start = async () => {
  try {
    discoveryNodes();
    updateDoneTests();
    assignTestsToNodes();
    reRunTestsOfDiedNodes();

    const address = await fastify.listen({ 
      port: CONF.port,
      host: '0.0.0.0',
    });

    fastify.log.info(`Server is up at ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

const formatError = (err: unknown): { message: string; stack?: string } => {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }

  if (typeof err === 'object' && err !== null) {
    try {
      return { message: JSON.stringify(err) };
    } catch {
      return { message: 'Circular or unstringifiable object' };
    }
  }

  return { message: String(err) };
};

process.on('unhandledRejection', (err) => {
  const { message, stack } = formatError(err);

  fastify.log.error({ msg: 'Unhandled Rejection', error: message, stack });
});

process.on('uncaughtException', (err) => {
  const { message, stack } = formatError(err);

  fastify.log.error({ msg: 'Uncaught Exception', error: message, stack });
});

start();
