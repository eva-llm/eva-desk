    const response = await request(`http://${HOST}/eval`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(evaTasks.map(task => ({ run_id: runId, ...task }))),
      // NOTE: Optional, for stability
      bodyTimeout: 0, 
      headersTimeout: 0,
    });

    if (response.statusCode !== 200) {
      throw new Error(`Server responded with ${response.statusCode}: ${await response.body.text()}`);
    }

    const result = await response.body.json() as { test_ids: string[] };

    console.log(color.yellow(`${result.test_ids.length} test(s) are started...`));

    