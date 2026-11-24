# Scanner verification evidence

See [release verification](../TEST_REPORT.md) for V0.3 and [preview status](SCANNER_PREVIEW.md) for current limitations.

On 2026-11-24 the supplied V0.4 ZIP was independently rerun using Linux Node.js 22.16.0: 49 tests passed, zero failures, zero skips; npm run demo and npm run verify:demo passed. Gemini reported 47/49 on Node.js 18, which is outside the supported engine range. The 18 scanner tests do not resolve the five independent QA findings. The user completed local public-URL pilot scans; the reports have not been independently verified. No public API deployment or real-browser WebMCP test was performed.

The GitHub integration preserves the newer branded documentation and canonical V0.3 sources. New CI evidence applies to the integration commit only.
