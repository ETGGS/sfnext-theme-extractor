exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // The user's API key is passed in the request header from the browser.
  // It never touches our server storage — we just forward it to Anthropic.
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];

  if (!apiKey) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing x-api-key header' })
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: event.body,
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
};
