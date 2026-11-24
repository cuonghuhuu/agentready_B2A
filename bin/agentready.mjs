#!/usr/bin/env node
import path from 'node:path';
import {inspect,init,generate,verify} from '../src/core.mjs';

const args=process.argv.slice(2);
const command=args[0] || 'help';
function flag(name, fallback) {
  const i=args.indexOf(name);
  if (i<0) return fallback;
  if (i+1>=args.length || args[i+1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[i+1];
}
const project=path.resolve(flag('--project', '.'));
const force=args.includes('--force');
function output(o) { console.log(JSON.stringify(o,null,2)); }
try {
  switch (command) {
    case 'inspect': output(await inspect(project)); break;
    case 'init': output(await init(project,{siteName:flag('--site-name'),siteUrl:flag('--site-url'),force})); break;
    case 'generate': output(await generate(project,{force})); break;
    case 'verify': {
      const result=await verify(project);
      output(result);
      if(!result.ok) process.exitCode=1;
      break;
    }
    case 'help':
    default: console.log(`AgentReady B2A (Node >=20; zero base CLI dependencies)

  node bin/agentready.mjs inspect --project <website>
  node bin/agentready.mjs init --project <website> [--site-name "Name"] [--site-url https://example.com]
  node bin/agentready.mjs generate --project <website> [--force]
  node bin/agentready.mjs verify --project <website>

IMPORTANT: generator writes only website/public/llms.txt and website/public/agentready/.
No existing files are overwritten unless --force is passed. --force overwrites only known output files.
Published products must be explicitly marked published:true in a JSON data adapter.
This tool does not automatically connect to private DB or change checkout/payment code.`);
    if(command!=='help') process.exitCode=1;
  }
} catch(error) {
  console.error('[AgentReady]',error.message);
  process.exitCode=1;
}
