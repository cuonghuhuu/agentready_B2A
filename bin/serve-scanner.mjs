#!/usr/bin/env node
import { createScannerServer } from '../src/scanner/server.mjs';

const port = Number(process.env.PORT || 4174);
const host = '127.0.0.1'; // Localhost-only default; do not expose public scanning API without validated abuse controls.

const server = createScannerServer();
server.listen(port, host, () => {
  console.log(`AgentReady AI Readiness Scanner (local): http://${host}:${port}`);
  console.log(`Preserved V0.3 Fictional Storefront Demo: http://${host}:${port}/demo`);
});
