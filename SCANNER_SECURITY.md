# AgentReady B2A — Scanner Security Threat Model & Safeguards

## 1. Deployment Posture (Local-First Default)

The AgentReady B2A AI Readiness Scanner is designed and configured as a **local developer tool**:
- `bin/serve-scanner.mjs` binds strictly to loopback **`127.0.0.1`** (default port `4174`).
- **Do not expose the scanner HTTP API to the public internet** without deploying validated edge authentication, distributed rate limiting, egress firewalling, and abuse monitoring.
- Remote HTTP callers **cannot** weaken or override `DEFAULT_SECURITY_POLICY` via request headers, query parameters, or JSON payloads.

## 2. Threat Model & Mandatory Mitigations

| Threat | Attack Vector | Implemented Safeguard (`src/scanner/network-security.mjs`, `server.mjs`) |
| --- | --- | --- |
| **SSRF to Internal/Cloud Metadata** | Submitting `http://127.0.0.1`, `http://169.254.169.254/latest/meta-data/`, `http://[::1]`, `http://metadata.google.internal`, or RFC 1918 IPs | `validateTargetUrl()` and `classifyIpAddress()` block all private, loopback, link-local, metadata, CGNAT, multicast, unspecified, documentation, and reserved IPv4 & IPv6 ranges plus `localhost`/`*.local`/`*.internal` hostnames. |
| **IPv4-Mapped / Transition IPv6 Bypass** | Submitting `::ffff:127.0.0.1`, `::ffff:169.254.169.254`, `64:ff9b::10.0.0.1`, or `2002:7f00:0001::1` | `classifyIpAddress()` unwraps IPv4-mapped (`::ffff:0:0/96`), IPv4-compatible (`::/96`), NAT64 (`64:ff9b::/96`), and 6to4 (`2002::/16`) addresses and validates the embedded IPv4 against all blocked CIDRs. |
| **DNS Rebinding (TOCTOU)** | Attacker DNS returns a public IP during validation and flips to `127.0.0.1` on socket connect, or returns mixed public+private A/AAAA records | `resolveAndValidateHost()` calls `dns.lookup(host, { all: true, verbatim: true })`, validates **every** returned IPv4/IPv6 record (rejecting mixed sets), and **pins** the validated IP into the `http.request`/`https.request` custom `lookup` callback while preserving `Host` and TLS SNI (`servername`). |
| **Open Redirect to Internal Network** | Public URL returns `302 Location: http://169.254.169.254/...` or `file:///etc/passwd` | Automatic redirect following is disabled. Every 301/302/303/307/308 hop (up to `maxRedirects: 5`) re-runs full URL, protocol, port, credential, DNS, and IP validation before connecting. |
| **Protocol / Port / Credential Smuggling** | `file:///etc/passwd`, `ftp://...`, `http://example.com:22`, `https://user:pass@example.com` | Only `http:` and `https:` on ports `80` and `443` are permitted by default. Any URL with `username` or `password` is rejected (`CREDENTIALS_IN_URL`). |
| **Slowloris / Hanging Connections** | Malicious server stalls TCP or response headers indefinitely | Strict per-request timeout (`timeoutMs: 10000`) destroys the socket immediately and raises `REQUEST_TIMEOUT`. |
| **Memory Exhaustion (Oversized Bodies)** | Multi-gigabyte response or chunked stream without `Content-Length` | Hard streaming byte limit (`maxBytes: 2 MiB` default, `512 KiB` for `robots.txt`/`llms.txt`) checks both `Content-Length` and cumulative streamed chunks, destroying the socket on overflow (`RESPONSE_TOO_LARGE`). |
| **Scan Flooding / Crawl Amplification** | Rapid repeated scans or recursive spidering | `ScanRateLimiter` enforces sliding-window rate limits (default 10 scans/min, max 2 concurrent scans, HTTP `429` + `Retry-After`) and `engine.mjs` enforces a hard per-scan request budget (`maxRequestsPerScan: 12`) with no recursive crawling. |
| **Ignoring Site Crawl Preferences** | Probing paths disallowed by site owner | `/robots.txt` is fetched first; `parseRobotsTxt()` evaluates RFC 9309 `Allow`/`Disallow` rules before fetching target or well-known paths. Disallowed probes are skipped and reported as `UNVERIFIED`. |
| **XSS / Prompt Injection from Untrusted Remote Content** | Malicious HTML/JSON-LD/title payloads injected into the Scanner Dashboard | Dashboard uses strict `Content-Security-Policy` (`default-src 'self'; script-src 'self'; style-src 'self'`), `x-content-type-options: nosniff`, `x-frame-options: DENY`, and renders all remote strings strictly via `textContent` / DOM nodes (never `innerHTML`). |
| **Unauthorized Access or Storefront Mutation** | Accessing authenticated routes, submitting forms, or mutating carts/checkout | Scanner issues strictly unauthenticated `GET` requests with zero cookies, zero `Authorization` headers, zero form submissions, and zero checkout/payment interactions. |

## 3. Blocked IPv4 & IPv6 Address Ranges

- **IPv4:** `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`.
- **IPv6:** `::/128`, `::1/128`, `::ffff:0:0/96` (unwrapped IPv4), `::/96` (unwrapped IPv4), `64:ff9b::/96` & `64:ff9b:1::/48`, `100::/64`, `2001::/32` (Teredo), `2001:db8::/32`, `2002::/16` (6to4 unwrapped IPv4), `fc00::/7` (ULA), `fe80::/10` (link-local), `fec0::/10`, `ff00::/8` (multicast).

## 4. Controlled Test Fixtures vs. Production Security

Automated tests in `tests/scanner-*.test.mjs` run against ephemeral loopback HTTP fixtures on `127.0.0.1` by passing an explicit programmatic `securityPolicy` to `scanWebsite()` / `createScannerServer()` inside test files only. Production defaults (`DEFAULT_SECURITY_POLICY`, `bin/agentready.mjs scan`, and `bin/serve-scanner.mjs`) **never** disable `blockPrivateNetworks` or widen `allowedPorts`.
