import postgres from 'postgres';

import {
  type TTestSchema,
  type ITestRun,
} from './types';
import CONF from './config';
import { configs2tests } from './helpers';
import { UUID_MIN } from './constants';

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

  testConfigs = await sql<ITestRun[]>`
    SELECT *
    FROM ${sql('TestRun')}
    WHERE run_id = ${CONF.currentRunId}
    AND test_id > ${CONF.lastTestId || UUID_MIN}
    ORDER BY test_id
    LIMIT ${size}
  `;

  if (testConfigs.length === 0) {
    return [];
  }

  return configs2tests(testConfigs);
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

  return configs2tests(testConfigs);
}
