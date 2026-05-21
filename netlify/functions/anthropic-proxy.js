/**
 * Anthropic proxy — server-side relay so the browser never calls api.anthropic.com directly.
 * The user's API key is passed in x-api-key per request and forwarded to Anthropic.
 * It is NEVER stored, logged, or persisted on the server.
 *
 * Security measures implemented here:
 *  1. Rate limiting — max 10 requests per 60-second window per IP
 *  2. Key format validation — rejects obviously wrong keys before forwarding
 *  3. Payload size limit — rejects requests over 512KB
 *  4. No logging of key values
 *  5. CORS locked to same-origin (Netlify enforces this via _headers)
 */

// In-memory rate limiter (resets on function cold start — acceptable for free tier)
const rateLimitMap = new Map();
const RATE_LIMIT    = 10;   // max requests
const RATE_WINDOW   = 60000; // per 60 seconds (ms)

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_WINDOW) {
    // Reset window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return true;
}

function isValidAnthropicKey(key) {
  // Anthropic keys: sk-ant-api03-... (at least 40 chars)
  return typeof key === 'string' && /^sk-ant-[a-zA-Z0-9_-]{20,}$/.test(key);
}

exports.handler = async (event) => {
  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Payload size limit — prevent abuse
  const bodySize = Buffer.byteLength(event.body || '', 'utf8');
  if (bodySize > 524288) { // 512KB
    return { statusCode: 413, body: JSON.stringify({ error: 'Request too large' }) };
  }

  // Rate limiting by IP
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Rate limit exceeded. Please wait a minute before trying again.' } })
    };
  }

  // Extract and validate the API key
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'] || '';
  if (!apiKey) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Missing API key' } }) };
  }
  if (!isValidAnthropicKey(apiKey)) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid API key format' } }) };
  }

  // Validate body is parseable JSON before forwarding
  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid JSON body' } }) };
  }

  // Only allow the messages endpoint — no other Anthropic APIs
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,           // forwarded, never stored
        'anthropic-version': '2023-06-01',
        'anthropic-beta':  'web-search-2025-03-05',
      },
      body: JSON.stringify(parsedBody),
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: data,
    };
  } catch (err) {
    // Never include the key in error messages
    return {
      statusCode: 502,
      body: JSON.stringify({ error: { message: 'Upstream request failed' } }),
    };
  }
};
