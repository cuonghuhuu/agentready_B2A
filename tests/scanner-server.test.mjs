import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createScannerServer } from '../src/scanner/server.mjs';
import { DEFAULT_SECURITY_POLICY, ScanRateLimiter } from '../src/scanner/network-security.mjs';

function httpRequest(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method,
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8')
          });
        });
      }
    );
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

function startServer(t, options = {}) {
  return new Promise((resolve) => {
    const server = createScannerServer(options);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      t.after(() => new Promise((done) => server.close(done)));
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test('dashboard serves Scanner UI with strict CSP and preserves V0.3 fictional storefront demo on /demo', async (t) => {
  const { baseUrl } = await startServer(t);

  const root = await httpRequest(`${baseUrl}/`);
  assert.equal(root.statusCode, 200);
  assert.match(root.headers['content-type'], /text\/html/);
  assert.match(root.headers['content-security-policy'], /default-src 'self'/);
  assert.match(root.body, /Website AI Readiness Scanner/);

  const demo = await httpRequest(`${baseUrl}/demo`);
  assert.equal(demo.statusCode, 200);
  assert.match(demo.body, /Fictional Shop Demo/);

  const demoCatalog = await httpRequest(`${baseUrl}/agentready/catalog.json`);
  assert.equal(demoCatalog.statusCode, 200);
  const parsed = JSON.parse(demoCatalog.body);
  assert(Array.isArray(parsed.products) && parsed.products.length > 0);

  const health = await httpRequest(`${baseUrl}/api/health`);
  assert.equal(health.statusCode, 200);
  const healthJson = JSON.parse(health.body);
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.ssrfProtectionEnabled, true);
  assert.equal(healthJson.localOnlyDefault, true);
});

test('scanner API handles SSRF blocks, malformed JSON, SSE scan_error, and rate limits cleanly', async (t) => {
  const limiter = new ScanRateLimiter({ maxRequestsPerWindow: 3, windowMs: 60_000, maxConcurrent: 2 });
  const { baseUrl } = await startServer(t, { rateLimiter: limiter });

  // Malformed JSON -> 400
  const badJson = await httpRequest(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad json'
  });
  assert.equal(badJson.statusCode, 400);
  assert.equal(JSON.parse(badJson.body).error.code, 'INVALID_JSON');

  // SSRF target via POST /api/scan -> 400 security_validation
  const ssrf1 = await httpRequest(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/' })
  });
  assert.equal(ssrf1.statusCode, 400);
  assert.equal(JSON.parse(ssrf1.body).error.code, 'SSRF_BLOCKED_IP');

  // Credentials in URL via POST /api/scan -> 400
  const cred = await httpRequest(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://user:pass@example.com/' })
  });
  assert.equal(cred.statusCode, 400);
  assert.equal(JSON.parse(cred.body).error.code, 'CREDENTIALS_IN_URL');

  // SSRF target via SSE stream -> emits scan_error event
  const sse = await httpRequest(`${baseUrl}/api/scan/stream?url=${encodeURIComponent('http://127.0.0.1/')}`);
  assert.equal(sse.statusCode, 200);
  assert.match(sse.headers['content-type'], /text\/event-stream/);
  assert.match(sse.body, /event: scan_error/);
  assert.match(sse.body, /SSRF_BLOCKED_IP/);

  // 4th request exceeds rate limit (3/min) -> 429
  const limited = await httpRequest(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/' })
  });
  assert.equal(limited.statusCode, 429);
  assert.equal(JSON.parse(limited.body).error.code, 'RATE_LIMITED');
  assert(Number(limited.headers['retry-after']) >= 1);
});

test('SSE stream emits real progress and final result events against controlled fixture', async (t) => {
  const fixtureServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main><h1>Fixture</h1></main></body></html>');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => fixtureServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((done) => fixtureServer.close(done)));
  const fixturePort = fixtureServer.address().port;

  const { baseUrl } = await startServer(t, {
    securityPolicy: {
      ...DEFAULT_SECURITY_POLICY,
      blockPrivateNetworks: false,
      allowedPorts: [fixturePort]
    }
  });

  const sse = await httpRequest(
    `${baseUrl}/api/scan/stream?url=${encodeURIComponent(`http://127.0.0.1:${fixturePort}/`)}`
  );
  assert.equal(sse.statusCode, 200);
  assert.match(sse.body, /event: progress/);
  assert.match(sse.body, /event: result/);
  assert.match(sse.body, /"scoringVersion":"1\.0\.0"/);
});
