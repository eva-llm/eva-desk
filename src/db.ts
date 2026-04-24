import postgres from 'postgres';

import { type ITestRun } from './types';


const sql = postgres(process.env.DATABASE_URL!, {
  max: 10, 
  idle_timeout: 20,
  connect_timeout: 10,
});

export const getTests = (runId: string) => sql<ITestRun[]>`
    SELECT *
    FROM ${sql('TestRun')}
    WHERE id = ${runId}
`;
