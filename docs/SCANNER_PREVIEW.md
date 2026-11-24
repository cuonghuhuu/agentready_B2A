[Tiếng Việt](vi/SCANNER_PREVIEW.md) · [Home](../README.md)

# V0.4 Scanner development preview

Status: **paused after local pilot, not release-ready**. No new tag or npm publication.

## Evidence (2026-11-24)

- Gemini archive: 47/49 tests under unsupported Node.js 18 (two existing temporary-directory ESM failures).
- Independent Linux Node.js 22.16.0 rerun of supplied ZIP: 49/49 tests, demo and verify:demo passed. Scanner runtime files are imported byte-for-byte from that ZIP; existing V0.3 source and tests are unchanged. Hosted CI for the integrated branch is separate.
- User-reported local pilot: screenshots show scans completed for The Gioi Di Dong, Nike, GitHub and example.com. No independent internet reproduction or criterion-level JSON reports have been supplied.
- Scoring version 1.0.0 is a project-defined methodology, not a certification.

## Release blockers

| ID | Open issue |
| --- | --- |
| SCAN-001 | robots policy enforcement must cover all requests and redirects |
| SCAN-002 | Absolute request/scan deadlines and cancellation |
| SCAN-003 | Strict public catalog and manifest semantic validation |
| SCAN-004 | WebMCP static evidence must not count as verified runtime |
| SCAN-005 | JSON-LD offer semantic validation |

Also pending: local API Host/Origin review, request budget accounting, explicit verification coverage and score normalization, complete localization, representative product-page sampling and real browser WebMCP evaluation. Keep the scanner bound to loopback; do not use tunnels, reverse proxies or public deployment. Respect website policies. Do not bypass network safeguards.

## Resume criteria

Reproduce and fix the blockers, add regression tests, run Node 20/22 CI on Windows/Linux, validate real public-site reports with permission and review security before release. Preserve the published V0.3 tag and its read-only public catalog architecture.
