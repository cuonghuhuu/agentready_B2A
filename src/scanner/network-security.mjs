import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export const SCANNER_USER_AGENT = 'AgentReadyScanner/0.4 (+https://github.com/cuonghuhuu/agentready_B2A; read-only)';

export const DEFAULT_SECURITY_POLICY = Object.freeze({
  allowedProtocols: ['http:', 'https:'],
  allowedPorts: [80, 443],
  blockPrivateNetworks: true,
  maxRedirects: 5,
  timeoutMs: 10_000,
  maxBytes: 2 * 1024 * 1024, // 2 MiB default cap
  maxRequestsPerScan: 12
});

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
  'instance-data'
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.localdomain'
];

export class SecurityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.details = details;
  }
}

export class FetchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FetchError';
    this.code = code;
    this.details = details;
  }
}

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return (((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0)) >>> 0;
}

function inCidrV4(ipInt, baseIp, prefixLen) {
  const baseInt = ipv4ToInt(baseIp);
  if (baseInt === null) return false;
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

const BLOCKED_V4_RANGES = [
  ['0.0.0.0', 8, 'unspecified/current-network'],
  ['10.0.0.0', 8, 'private-rfc1918'],
  ['100.64.0.0', 10, 'cgnat-rfc6598'],
  ['127.0.0.0', 8, 'loopback'],
  ['169.254.0.0', 16, 'link-local-and-metadata'],
  ['172.16.0.0', 12, 'private-rfc1918'],
  ['192.0.0.0', 24, 'ietf-protocol-assignments'],
  ['192.0.2.0', 24, 'documentation-test-net-1'],
  ['192.88.99.0', 24, '6to4-relay-anycast'],
  ['192.168.0.0', 16, 'private-rfc1918'],
  ['198.18.0.0', 15, 'benchmarking-rfc2544'],
  ['198.51.100.0', 24, 'documentation-test-net-2'],
  ['203.0.113.0', 24, 'documentation-test-net-3'],
  ['224.0.0.0', 4, 'multicast'],
  ['240.0.0.0', 4, 'reserved-and-broadcast']
];

function expandIpv6(rawIp) {
  const ip = rawIp.split('%')[0].toLowerCase();
  if (!net.isIPv6(ip)) return null;

  // Handle embedded IPv4 suffix (e.g., ::ffff:127.0.0.1 or 64:ff9b::10.0.0.1)
  let working = ip;
  const lastColon = working.lastIndexOf(':');
  const tail = working.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4Int = ipv4ToInt(tail);
    if (v4Int === null) return null;
    const hi = ((v4Int >>> 16) & 0xffff).toString(16);
    const lo = (v4Int & 0xffff).toString(16);
    working = `${working.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const halves = working.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => '0'),
    ...right
  ];
  if (groups.length !== 8) return null;

  const nums = groups.map((g) => parseInt(g, 16));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

function groupsToIpv4(hi, lo) {
  return `${(hi >>> 8) & 0xff}.${hi & 0xff}.${(lo >>> 8) & 0xff}.${lo & 0xff}`;
}

/**
 * Classifies an IPv4 or IPv6 address and returns whether it is blocked for public scanning.
 */
export function classifyIpAddress(rawIp) {
  if (typeof rawIp !== 'string' || !rawIp.trim()) {
    return { valid: false, blocked: true, family: 0, reason: 'invalid-ip' };
  }
  const ip = rawIp.trim().replace(/^\[|\]$/g, '');
  const family = net.isIP(ip.split('%')[0]);

  if (family === 4) {
    const ipInt = ipv4ToInt(ip);
    if (ipInt === null) {
      return { valid: false, blocked: true, family: 4, reason: 'invalid-ipv4' };
    }
    for (const [base, prefix, reason] of BLOCKED_V4_RANGES) {
      if (inCidrV4(ipInt, base, prefix)) {
        return { valid: true, blocked: true, family: 4, reason };
      }
    }
    return { valid: true, blocked: false, family: 4, reason: 'public-ipv4' };
  }

  if (family === 6) {
    const g = expandIpv6(ip);
    if (!g) {
      return { valid: false, blocked: true, family: 6, reason: 'invalid-ipv6' };
    }
    // Unspecified ::
    if (g.every((x) => x === 0)) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-unspecified' };
    }
    // Loopback ::1
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0 && g[6] === 0 && g[7] === 1) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-loopback' };
    }
    // IPv4-mapped ::ffff:0:0/96
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
      const embedded = groupsToIpv4(g[6], g[7]);
      const v4Check = classifyIpAddress(embedded);
      if (v4Check.blocked) {
        return { valid: true, blocked: true, family: 6, reason: `ipv4-mapped-${v4Check.reason}` };
      }
    }
    // IPv4-compatible ::/96 (deprecated)
    if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
      const embedded = groupsToIpv4(g[6], g[7]);
      const v4Check = classifyIpAddress(embedded);
      if (v4Check.blocked) {
        return { valid: true, blocked: true, family: 6, reason: `ipv4-compatible-${v4Check.reason}` };
      }
    }
    // NAT64 well-known prefix 64:ff9b::/96 and local 64:ff9b:1::/48
    if (g[0] === 0x0064 && g[1] === 0xff9b) {
      const embedded = groupsToIpv4(g[6], g[7]);
      const v4Check = classifyIpAddress(embedded);
      if (v4Check.blocked || g[2] === 0x0001) {
        return { valid: true, blocked: true, family: 6, reason: 'ipv6-nat64-restricted' };
      }
    }
    // Unique local fc00::/7
    if ((g[0] & 0xfe00) === 0xfc00) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-unique-local' };
    }
    // Link-local fe80::/10
    if ((g[0] & 0xffc0) === 0xfe80) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-link-local' };
    }
    // Site-local deprecated fec0::/10
    if ((g[0] & 0xffc0) === 0xfec0) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-site-local' };
    }
    // Multicast ff00::/8
    if ((g[0] & 0xff00) === 0xff00) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-multicast' };
    }
    // Documentation 2001:db8::/32
    if (g[0] === 0x2001 && g[1] === 0x0db8) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-documentation' };
    }
    // Teredo 2001::/32
    if (g[0] === 0x2001 && g[1] === 0x0000) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-teredo' };
    }
    // 6to4 2002::/16 (embeds IPv4 in g[1], g[2])
    if (g[0] === 0x2002) {
      const embedded = groupsToIpv4(g[1], g[2]);
      const v4Check = classifyIpAddress(embedded);
      if (v4Check.blocked) {
        return { valid: true, blocked: true, family: 6, reason: `ipv6-6to4-${v4Check.reason}` };
      }
    }
    // Discard-only 100::/64
    if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) {
      return { valid: true, blocked: true, family: 6, reason: 'ipv6-discard' };
    }
    return { valid: true, blocked: false, family: 6, reason: 'public-ipv6' };
  }

  return { valid: false, blocked: true, family: 0, reason: 'unrecognized-ip' };
}

/**
 * Validates a URL string against protocol, credential, port, and hostname rules.
 */
export function validateTargetUrl(rawUrl, policy = DEFAULT_SECURITY_POLICY) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new SecurityError('INVALID_URL', 'A non-empty public website URL is required.');
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    throw new SecurityError('INVALID_URL', 'URL exceeds maximum allowed length (2048 characters).');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SecurityError('INVALID_URL', 'Malformed URL. Provide a valid http:// or https:// URL.');
  }

  const allowedProtocols = policy.allowedProtocols || DEFAULT_SECURITY_POLICY.allowedProtocols;
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new SecurityError(
      'DISALLOWED_PROTOCOL',
      `Protocol "${parsed.protocol}" is not allowed. Only http: and https: are permitted.`,
      { protocol: parsed.protocol }
    );
  }

  if (parsed.username || parsed.password) {
    throw new SecurityError(
      'CREDENTIALS_IN_URL',
      'URLs containing embedded credentials (username or password) are rejected.'
    );
  }

  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const effectivePort = parsed.port ? Number(parsed.port) : defaultPort;
  const allowedPorts = policy.allowedPorts || DEFAULT_SECURITY_POLICY.allowedPorts;
  if (!Number.isInteger(effectivePort) || effectivePort < 1 || effectivePort > 65535) {
    throw new SecurityError('DISALLOWED_PORT', `Invalid port "${parsed.port}".`);
  }
  if (allowedPorts !== '*' && !allowedPorts.includes(effectivePort)) {
    throw new SecurityError(
      'DISALLOWED_PORT',
      `Port ${effectivePort} is not permitted. Allowed ports: ${allowedPorts.join(', ')}.`,
      { port: effectivePort }
    );
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new SecurityError('INVALID_URL', 'URL must include a valid hostname.');
  }

  const blockPrivate = policy.blockPrivateNetworks !== false;
  if (blockPrivate) {
    if (
      BLOCKED_HOSTNAMES.has(hostname) ||
      BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      throw new SecurityError(
        'SSRF_BLOCKED_HOST',
        `Hostname "${hostname}" is blocked by SSRF policy.`,
        { hostname }
      );
    }

    const literalFamily = net.isIP(hostname);
    if (literalFamily !== 0) {
      const check = classifyIpAddress(hostname);
      if (check.blocked) {
        throw new SecurityError(
          'SSRF_BLOCKED_IP',
          `IP address "${hostname}" is blocked (${check.reason}).`,
          { ip: hostname, reason: check.reason }
        );
      }
    }
  }

  // Strip fragment before network requests
  parsed.hash = '';
  return {
    url: parsed,
    href: parsed.href,
    hostname,
    port: effectivePort,
    protocol: parsed.protocol
  };
}

/**
 * Resolves DNS and validates every returned IPv4/IPv6 address, returning a pinned IP
 * to prevent DNS rebinding between validation and socket connect.
 */
export async function resolveAndValidateHost(hostname, policy = DEFAULT_SECURITY_POLICY, dnsLookup = null) {
  const blockPrivate = policy.blockPrivateNetworks !== false;
  const literalFamily = net.isIP(hostname);

  if (literalFamily !== 0) {
    if (blockPrivate) {
      const check = classifyIpAddress(hostname);
      if (check.blocked) {
        throw new SecurityError(
          'SSRF_BLOCKED_IP',
          `IP address "${hostname}" is blocked (${check.reason}).`,
          { ip: hostname, reason: check.reason }
        );
      }
    }
    return {
      address: hostname,
      family: literalFamily,
      allAddresses: [{ address: hostname, family: literalFamily }]
    };
  }

  const lookupFn = dnsLookup || ((host) => dns.lookup(host, { all: true, verbatim: true }));
  let records;
  try {
    records = await lookupFn(hostname);
  } catch (err) {
    throw new FetchError(
      'DNS_RESOLUTION_FAILED',
      `Failed to resolve hostname "${hostname}": ${err.message}`,
      { hostname, cause: err.code || err.message }
    );
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new FetchError('DNS_RESOLUTION_FAILED', `No DNS records returned for "${hostname}".`, { hostname });
  }

  for (const record of records) {
    const addr = record?.address;
    const check = classifyIpAddress(addr);
    if (!check.valid) {
      throw new SecurityError(
        'SSRF_INVALID_RESOLVED_IP',
        `Hostname "${hostname}" resolved to invalid IP "${addr}".`,
        { hostname, ip: addr }
      );
    }
    if (blockPrivate && check.blocked) {
      throw new SecurityError(
        'SSRF_BLOCKED_IP',
        `Hostname "${hostname}" resolved to blocked IP "${addr}" (${check.reason}).`,
        { hostname, ip: addr, reason: check.reason }
      );
    }
  }

  const primary = records[0];
  return {
    address: primary.address,
    family: primary.family || net.isIP(primary.address),
    allAddresses: records.map((r) => ({ address: r.address, family: r.family || net.isIP(r.address) }))
  };
}

/**
 * Performs a single pinned HTTP/HTTPS GET request without following redirects automatically.
 * Pins the pre-validated IP address in the socket lookup callback to prevent DNS rebinding.
 */
function executePinnedRequest(validated, resolved, options) {
  const { timeoutMs, maxBytes, headers } = options;
  const isHttps = validated.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    let settled = false;
    let totalBytes = 0;
    const chunks = [];
    const startedAt = Date.now();

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const reqOptions = {
      protocol: validated.protocol,
      hostname: validated.hostname,
      port: validated.port,
      path: `${validated.url.pathname}${validated.url.search}`,
      method: 'GET',
      headers: {
        'user-agent': SCANNER_USER_AGENT,
        accept: headers?.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,text/plain;q=0.7,*/*;q=0.5',
        'accept-encoding': 'identity',
        ...headers
      },
      // Pin the exact pre-validated IP so Node never re-resolves DNS on connect (anti-DNS-rebinding)
      lookup: (_host, lookupOpts, cb) => {
        if (typeof lookupOpts === 'function') {
          cb = lookupOpts;
          lookupOpts = {};
        }
        if (lookupOpts && lookupOpts.all) {
          cb(null, [{ address: resolved.address, family: resolved.family }]);
        } else {
          cb(null, resolved.address, resolved.family);
        }
      },
      ...(isHttps ? { servername: net.isIP(validated.hostname) ? undefined : validated.hostname } : {})
    };

    const req = transport.request(reqOptions, (res) => {
      const contentLength = Number(res.headers['content-length']);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        req.destroy();
        res.destroy();
        fail(
          new FetchError(
            'RESPONSE_TOO_LARGE',
            `Response Content-Length (${contentLength} bytes) exceeds limit (${maxBytes} bytes).`,
            { contentLength, maxBytes, url: validated.href }
          )
        );
        return;
      }

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          req.destroy();
          res.destroy();
          fail(
            new FetchError(
              'RESPONSE_TOO_LARGE',
              `Response body exceeded maximum allowed size (${maxBytes} bytes).`,
              { receivedBytes: totalBytes, maxBytes, url: validated.href }
            )
          );
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (settled) return;
        settled = true;
        const buffer = Buffer.concat(chunks);
        resolve({
          url: validated.href,
          statusCode: res.statusCode || 0,
          statusMessage: res.statusMessage || '',
          headers: res.headers,
          body: buffer.toString('utf8'),
          byteLength: buffer.length,
          resolvedIp: resolved.address,
          durationMs: Date.now() - startedAt
        });
      });

      res.on('error', (err) => {
        fail(new FetchError('NETWORK_ERROR', `Response stream error: ${err.message}`, { url: validated.href, cause: err.code }));
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      fail(
        new FetchError(
          'REQUEST_TIMEOUT',
          `Request timed out after ${timeoutMs} ms.`,
          { timeoutMs, url: validated.href }
        )
      );
    });

    req.on('error', (err) => {
      if (err instanceof SecurityError || err instanceof FetchError) {
        fail(err);
      } else {
        fail(new FetchError('NETWORK_ERROR', `Network request failed: ${err.message}`, { url: validated.href, cause: err.code }));
      }
    });

    req.end();
  });
}

/**
 * SSRF-hardened HTTP(S) GET fetcher with DNS rebinding defense, manual redirect
 * revalidation, strict timeouts, and streaming response size limits.
 */
export async function safeFetch(rawUrl, options = {}) {
  const policy = {
    ...DEFAULT_SECURITY_POLICY,
    ...(options.securityPolicy || {})
  };
  const maxRedirects = options.maxRedirects ?? policy.maxRedirects;
  const timeoutMs = options.timeoutMs ?? policy.timeoutMs;
  const maxBytes = options.maxBytes ?? policy.maxBytes;
  const dnsLookup = options.dnsLookup || null;
  const headers = options.headers || {};

  const redirectChain = [];
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validated = validateTargetUrl(currentUrl, policy);
    const resolved = await resolveAndValidateHost(validated.hostname, policy, dnsLookup);

    const response = await executePinnedRequest(validated, resolved, {
      timeoutMs,
      maxBytes,
      headers
    });

    const isRedirect = [301, 302, 303, 307, 308].includes(response.statusCode);
    if (isRedirect && response.headers.location) {
      if (hop >= maxRedirects) {
        throw new FetchError(
          'TOO_MANY_REDIRECTS',
          `Exceeded maximum redirect limit (${maxRedirects}).`,
          { maxRedirects, redirectChain }
        );
      }
      let nextUrl;
      try {
        nextUrl = new URL(response.headers.location, validated.href).href;
      } catch {
        throw new SecurityError('INVALID_REDIRECT', `Invalid redirect Location header: "${response.headers.location}".`);
      }
      redirectChain.push({
        from: validated.href,
        to: nextUrl,
        statusCode: response.statusCode,
        resolvedIp: resolved.address
      });
      currentUrl = nextUrl;
      continue;
    }

    return {
      ...response,
      initialUrl: rawUrl,
      finalUrl: validated.href,
      redirectChain
    };
  }

  throw new FetchError('TOO_MANY_REDIRECTS', `Exceeded maximum redirect limit (${maxRedirects}).`);
}

/**
 * Simple in-memory sliding-window rate limiter + concurrency guard for the local scanner server.
 */
export class ScanRateLimiter {
  constructor({ maxRequestsPerWindow = 10, windowMs = 60_000, maxConcurrent = 2 } = {}) {
    this.maxRequestsPerWindow = maxRequestsPerWindow;
    this.windowMs = windowMs;
    this.maxConcurrent = maxConcurrent;
    this.buckets = new Map();
    this.activeCount = 0;
  }

  acquire(clientKey = 'local') {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = (this.buckets.get(clientKey) || []).filter((ts) => ts > cutoff);

    if (timestamps.length >= this.maxRequestsPerWindow) {
      const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + this.windowMs - now) / 1000));
      return {
        allowed: false,
        reason: 'RATE_LIMITED',
        retryAfterSec,
        message: `Rate limit exceeded (${this.maxRequestsPerWindow} scans per ${Math.round(this.windowMs / 1000)}s). Retry in ${retryAfterSec}s.`
      };
    }

    if (this.activeCount >= this.maxConcurrent) {
      return {
        allowed: false,
        reason: 'CONCURRENCY_LIMITED',
        retryAfterSec: 2,
        message: `Maximum concurrent scans (${this.maxConcurrent}) already running. Please wait and retry.`
      };
    }

    timestamps.push(now);
    this.buckets.set(clientKey, timestamps);
    this.activeCount += 1;

    let released = false;
    return {
      allowed: true,
      release: () => {
        if (released) return;
        released = true;
        this.activeCount = Math.max(0, this.activeCount - 1);
      }
    };
  }
}
