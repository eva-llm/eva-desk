import postgres from 'postgres';

import {
  type TTestSchema,
  type ITestRun,
} from './types';
import CONF from './config';


const sql = postgres(process.env.DATABASE_URL!, {
  max: 10, 
  idle_timeout: 20,
  connect_timeout: 10,
});

export const getNextTests = async (size: number): Promise<TTestSchema[]> => {
  if (!CONF.currentRunId) {
    return [];
  }

  let testConfigs: ITestRun[];

  if (CONF.lastTestId) {
    testConfigs = await sql<ITestRun[]>`
      SELECT *
      FROM ${sql('TestRun')}
      WHERE run_id = ${CONF.currentRunId}
      ORDER BY test_id
      LIMIT ${size}
    `;
  } else {
    testConfigs = await sql<ITestRun[]>`
      SELECT *
      FROM ${sql('TestRun')}
      WHERE run_id = ${CONF.currentRunId}
      ORDER BY test_id
      LIMIT ${size}
    `;
  }

  if (testConfigs.length === 0) {
    return [];
  }

  CONF.lastTestId = testConfigs[testConfigs.length - 1].test_id;

  const tests: TTestSchema[] = [];

  for (const testConfig of testConfigs) {
    const test = JSON.parse(testConfig.test_config) as TTestSchema;

    test.test_id = testConfig.test_id;
    test.run_id = testConfig.run_id;

    tests.push(test)
  }

  return tests;
}

export const getTestsByIds = async (testIds: string[]): Promise<TTestSchema[]> => {
  let testConfigs: ITestRun[];

  testConfigs = await sql<ITestRun[]>`
    SELECT *
    FROM ${sql('TestRun')}
    WHERE test_id IN ${sql(testIds)}
  `;

  if (testConfigs.length === 0) {
    return [];
  }

  const tests: TTestSchema[] = [];

  for (const testConfig of testConfigs) {
    const test = JSON.parse(testConfig.test_config) as TTestSchema;

    test.test_id = testConfig.test_id;
    test.run_id = testConfig.run_id;

    tests.push(test)
  }

  return tests;
}
