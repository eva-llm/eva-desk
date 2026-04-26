import { request } from 'undici';

import { type TTestSchema } from './types';


export const sendRequest = async (
  host: string,
  tests: TTestSchema[],
): Promise<string[]> => {

  const response = await request(`${host}/eval`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(tests),
    // NOTE: Optional, for stability
    bodyTimeout: 0, 
    headersTimeout: 0,
  });

  if (response.statusCode !== 200) {
    throw new Error(`Server responded with ${response.statusCode}: ${await response.body.text()}`);
  }

  const result = await response.body.json() as { test_ids: string[] };

  return result.test_ids;
}
