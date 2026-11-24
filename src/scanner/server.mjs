import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SECURITY_POLICY,
  FetchError,
  ScanRateLimiter,
  SecurityError
} from './network-security.mjs';
import { SCANNER_VERSION, SCAN_SCHEMA_VERSION, scanWebsite } from './engine.mjs';
import { SCORING_DISCLAIMER, SCORING_VERSION } from './scoring.mjs';
import { formatReportMarkdown } from './report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = path.join(__dirname, 'dashboard');
const DEMO_PUBLIC_DIR = path.resolve(__dirname, '../../examples/ecommerce-demo/public');

const DASHBOARD_ROUTES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/assets/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/assets/app.js', ['app.js', 'application/javascript; charset=utf-8']]
]);

const DEMO_ROUTES = new Map([
  ['/demo', ['index.html', 'text/html; charset=utf-8']],
  ['/demo/', ['index.html', 'text/html; charset=utf-8']],
  ['/llms.txt', ['llms.txt', 'text/plain; charset=utf-8']],
  ['/agentready/catalog.json', ['agentready/catalog.json', 'application/json; charset=utf-8']],
  ['/agentready/catalog.md', ['agentready/catalog.md', 'text/markdown; charset=utf-8']],
  ['/agentready/products.jsonld', ['agentready/products.jsonld', 'application/ld+json; charset=utf-8']],
  ['/agentready/webmcp-products.js', ['agentready/webmcp-products.js', 'application/javascript; charset=utf-8']],
  ['/agentready/webmcpify-runtime.js', ['agentready/webmcpify-runtime.js', 'application/javascript; charset=utf-8']],
  ['/agentready/manifest.json', ['agentready/manifest.json', 'application/json; charset=utf-8']]
]);

const BASE_SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer'
};

const DASHBOARD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'";

const MAX_POST_BODY_BYTES = 8 * 1024;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...BASE_SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_POST_BODY_BYTES) {
        req.destroy();
        reject(new FetchError('PAYLOAD_TOO_LARGE', 'Request body exceeds 8 KiB limit.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new SecurityError('INVALID_JSON', 'Request body must be valid JSON.'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function mapErrorToHttp(err) {
  if (err instanceof SecurityError) {
    return {
      statusCode: 400,
      payload: {
        error: {
          code: err.code,
          message: err.message,
          category: 'security_validation'
        }
      }
    };
  }
  if (err instanceof FetchError) {
    const statusCode = err.code === 'PAYLOAD_TOO_LARGE' ? 413 : 502;
    return {
      statusCode,
      payload: {
        error: {
          code: err.code,
          message: err.message,
          category: 'network_fetch'
        }
      }
    };
  }
  return {
    statusCode: 500,
    payload: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected scanner error occurred.',
        category: 'internal'
      }
    }
  };
}

/**
 * Creates the local AgentReady B2A AI Readiness Scanner HTTP server.
 * Defaults strictly to 127.0.0.1 and enforces production SSRF security policy.
 */
export function createScannerServer(options = {}) {
  const rateLimiter = options.rateLimiter || new ScanRateLimiter({
    maxRequestsPerWindow: options.maxScansPerMinute ?? 10,
    windowMs: 60_000,
    maxConcurrent: options.maxConcurrentScans ?? 2
  });

  // Security policy is NEVER configurable by remote HTTP callers.
  // Only programmatic test harness options may supply an alternate policy or dnsLookup.
  const scanSecurityPolicy = options.securityPolicy || DEFAULT_SECURITY_POLICY;
  const dnsLookup = options.dnsLookup || null;

  return http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = urlObj.pathname;
    const clientKey = req.socket?.remoteAddress || 'local';

    // Health / metadata endpoint
    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'agentready-ai-readiness-scanner',
        scannerVersion: SCANNER_VERSION,
        schemaVersion: SCAN_SCHEMA_VERSION,
        scoringVersion: SCORING_VERSION,
        disclaimer: SCORING_DISCLAIMER,
        localOnlyDefault: true,
        ssrfProtectionEnabled: scanSecurityPolicy.blockPrivateNetworks !== false
      });
      return;
    }

    // Synchronous JSON scan endpoint
    if (pathname === '/api/scan' && req.method === 'POST') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        const mapped = mapErrorToHttp(err);
        sendJson(res, mapped.statusCode, mapped.payload);
        return;
      }

      const targetUrl = typeof body?.url === 'string' ? body.url.trim() : '';
      const mode = ['auto', 'commerce', 'general'].includes(body?.mode) ? body.mode : 'auto';
      const format = body?.format === 'markdown' ? 'markdown' : 'json';
      const lang = body?.lang === 'vi' ? 'vi' : 'en';

      const slot = rateLimiter.acquire(clientKey);
      if (!slot.allowed) {
        sendJson(
          res,
          429,
          { error: { code: slot.reason, message: slot.message, category: 'rate_limit' } },
          { 'retry-after': String(slot.retryAfterSec) }
        );
        return;
      }

      try {
        const result = await scanWebsite(targetUrl, {
          mode,
          securityPolicy: scanSecurityPolicy,
          dnsLookup
        });
        if (format === 'markdown') {
          const md = formatReportMarkdown(result, lang);
          res.writeHead(200, {
            ...BASE_SECURITY_HEADERS,
            'content-type': 'text/markdown; charset=utf-8',
            'content-length': Buffer.byteLength(md)
          });
          res.end(md);
        } else {
          sendJson(res, 200, result);
        }
      } catch (err) {
        const mapped = mapErrorToHttp(err);
        sendJson(res, mapped.statusCode, mapped.payload);
      } finally {
        slot.release();
      }
      return;
    }

    // Live SSE scan stream endpoint (real progress events, zero simulation)
    if (pathname === '/api/scan/stream' && req.method === 'GET') {
      const targetUrl = (urlObj.searchParams.get('url') || '').trim();
      const modeParam = urlObj.searchParams.get('mode') || 'auto';
      const mode = ['auto', 'commerce', 'general'].includes(modeParam) ? modeParam : 'auto';

      const slot = rateLimiter.acquire(clientKey);
      if (!slot.allowed) {
        sendJson(
          res,
          429,
          { error: { code: slot.reason, message: slot.message, category: 'rate_limit' } },
          { 'retry-after': String(slot.retryAfterSec) }
        );
        return;
      }

      res.writeHead(200, {
        ...BASE_SECURITY_HEADERS,
        'content-type': 'text/event-stream; charset=utf-8',
        connection: 'keep-alive'
      });

      const sendEvent = (eventName, data) => {
        if (res.writableEnded) return;
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await scanWebsite(targetUrl, {
          mode,
          securityPolicy: scanSecurityPolicy,
          dnsLookup,
          onProgress: (ev) => sendEvent('progress', ev)
        });
        sendEvent('result', result);
      } catch (err) {
        const mapped = mapErrorToHttp(err);
        sendEvent('scan_error', mapped.payload.error);
      } finally {
        slot.release();
        if (!res.writableEnded) res.end();
      }
      return;
    }

    // Static Dashboard routes
    if (req.method === 'GET' && DASHBOARD_ROUTES.has(pathname)) {
      const [file, contentType] = DASHBOARD_ROUTES.get(pathname);
      try {
        const buf = await fs.readFile(path.join(DASHBOARD_DIR, file));
        res.writeHead(200, {
          ...BASE_SECURITY_HEADERS,
          'content-security-policy': DASHBOARD_CSP,
          'content-type': contentType,
          'content-length': buf.length
        });
        res.end(buf);
      } catch {
        sendJson(res, 500, { error: { code: 'ASSET_MISSING', message: 'Dashboard asset unavailable.' } });
      }
      return;
    }

    // Preserved V0.3 Fictional Storefront Demo on /demo (and its public assets)
    if (req.method === 'GET' && DEMO_ROUTES.has(pathname)) {
      const [file, contentType] = DEMO_ROUTES.get(pathname);
      try {
        const buf = await fs.readFile(path.join(DEMO_PUBLIC_DIR, file));
        res.writeHead(200, {
          ...BASE_SECURITY_HEADERS,
          'content-type': contentType,
          'content-length': buf.length
        });
        res.end(buf);
      } catch {
        sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Demo asset not found.' } });
      }
      return;
    }

    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
}
