const mockListen = jest.fn();
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();

const mockFastifyInstance = {
  listen: mockListen,
  log: {
    info: mockLogInfo,
    error: mockLogError,
  },
};

const mockFastify = jest.fn(() => mockFastifyInstance);
const mockDiscoveryNodes = jest.fn();
const mockUpdateDoneTests = jest.fn();
const mockAssignTestsToNodes = jest.fn();
const mockReRunTestsOfDiedNodes = jest.fn();
const mockRegisterHandlers = jest.fn();

jest.mock('fastify', () => ({ __esModule: true, default: mockFastify }));
jest.mock('../src/discovery', () => ({ __esModule: true, default: mockDiscoveryNodes }));
jest.mock('../src/testing', () => ({ __esModule: true, default: mockUpdateDoneTests }));
jest.mock('../src/exec', () => ({ __esModule: true, default: mockAssignTestsToNodes }));
jest.mock('../src/handlers', () => ({ __esModule: true, default: mockRegisterHandlers }));
jest.mock('../src/rerun', () => ({ __esModule: true, default: mockReRunTestsOfDiedNodes }));
jest.mock('../src/config', () => ({ __esModule: true, default: { port: 3000 } }));

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('server', () => {
  let processExitSpy: jest.SpyInstance;

  beforeAll(() => {
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
  });

  afterAll(() => {
    processExitSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('module initialization', () => {
    beforeEach(async () => {
      mockListen.mockResolvedValue('http://0.0.0.0:3000');
      jest.isolateModules(() => {
        require('../src/server');
      });
      await flushPromises();
    });

    it('creates a fastify instance with logger config', () => {
      expect(mockFastify).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: expect.objectContaining({ level: 'info' }),
        })
      );
    });

    it('registers handlers with the fastify instance', () => {
      expect(mockRegisterHandlers).toHaveBeenCalledWith(mockFastifyInstance);
    });

    it('calls discoveryNodes', () => {
      expect(mockDiscoveryNodes).toHaveBeenCalledTimes(1);
    });

    it('calls updateDoneTests', () => {
      expect(mockUpdateDoneTests).toHaveBeenCalledTimes(1);
    });

    it('calls assignTestsToNodes', () => {
      expect(mockAssignTestsToNodes).toHaveBeenCalledTimes(1);
    });

    it('calls reRunTestsOfDiedNodes', () => {
      expect(mockReRunTestsOfDiedNodes).toHaveBeenCalledTimes(1);
    });

    it('listens on all interfaces with the configured port', () => {
      expect(mockListen).toHaveBeenCalledWith({ port: 3000, host: '0.0.0.0' });
    });

    it('logs the server address after successful listen', () => {
      expect(mockLogInfo).toHaveBeenCalledWith('Server is up at http://0.0.0.0:3000');
    });
  });

  describe('start() error handling', () => {
    it('logs the error and calls process.exit(1) on listen failure', async () => {
      const err = new Error('listen failed');
      mockListen.mockRejectedValue(err);

      jest.isolateModules(() => {
        require('../src/server');
      });
      await flushPromises();

      expect(mockLogError).toHaveBeenCalledWith(err);
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('process event handlers', () => {
    let processOnSpy: jest.SpyInstance;

    const getHandler = (event: string): ((err: unknown) => void) => {
      const call = processOnSpy.mock.calls.find((c) => c[0] === event);
      if (!call) throw new Error(`No handler registered for '${event}'`);
      return call[1] as (err: unknown) => void;
    };

    beforeEach(async () => {
      mockListen.mockResolvedValue('http://0.0.0.0:3000');
      processOnSpy = jest.spyOn(process, 'on');

      jest.isolateModules(() => {
        require('../src/server');
      });
      await flushPromises();
    });

    afterEach(() => {
      processOnSpy.mockRestore();
    });

    describe('unhandledRejection', () => {
      it('logs Error instances with message and stack', () => {
        const err = new Error('async error');
        getHandler('unhandledRejection')(err);

        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'Unhandled Rejection',
          error: err.message,
          stack: err.stack,
        });
      });

      it('logs plain objects as JSON strings', () => {
        const obj = { code: 500, reason: 'internal' };
        getHandler('unhandledRejection')(obj);

        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'Unhandled Rejection',
          error: JSON.stringify(obj),
          stack: undefined,
        });
      });

      it('handles circular objects gracefully', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        getHandler('unhandledRejection')(circular);

        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'Unhandled Rejection',
          error: 'Circular or unstringifiable object',
          stack: undefined,
        });
      });

      it('handles primitive values', () => {
        getHandler('unhandledRejection')('something went wrong');

        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'Unhandled Rejection',
          error: 'something went wrong',
          stack: undefined,
        });
      });
    });

    describe('uncaughtException', () => {
      it('logs Error instances with message and stack', () => {
        const err = new Error('sync error');
        getHandler('uncaughtException')(err);

        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'Uncaught Exception',
          error: err.message,
          stack: err.stack,
        });
      });

      it('logs plain objects as JSON strings', () => {
        const obj = { code: 500 };
        getHandler('uncaughtException')(obj);

        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'Uncaught Exception',
          error: JSON.stringify(obj),
          stack: undefined,
        });
      });

      it('handles primitive values', () => {
        getHandler('uncaughtException')(42);

        expect(mockLogError).toHaveBeenCalledWith({
          msg: 'Uncaught Exception',
          error: '42',
          stack: undefined,
        });
      });
    });
  });
});
