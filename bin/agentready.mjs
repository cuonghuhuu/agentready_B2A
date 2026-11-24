#!/usr/bin/env node
import path from 'node:path';
import {inspect,init,generate,verify} from '../src/core.mjs';
import {importCatalog} from '../src/adapters.mjs';
import {scanWebsite, formatReportMarkdown} from '../src/scanner/index.mjs';

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
const trustedPublicSource=args.includes('--trusted-public-source');
function output(o) { console.log(JSON.stringify(o,null,2)); }
try {
  switch (command) {
    case 'inspect': output(await inspect(project)); break;
    case 'init': output(await init(project,{siteName:flag('--site-name'),siteUrl:flag('--site-url'),force})); break;
    case 'import': {
      const rawAllowed=flag('--allow-attributes');
      const allowedAttributes=rawAllowed!==undefined ? rawAllowed.split(',').map(s=>s.trim()).filter(Boolean) : undefined;
      output(await importCatalog(project,{source:flag('--source'),format:flag('--format','auto'),currency:flag('--currency'),force,trustedPublicSource,allowedAttributes}));
      break;
    }
    case 'generate': output(await generate(project,{force})); break;
    case 'verify': {
      const result=await verify(project);
      output(result);
      if(!result.ok) process.exitCode=1;
      break;
    }
    case 'scan': {
      const targetUrl=flag('--url');
      if(!targetUrl) throw new Error('Missing required --url <https://example.com>');
      const mode=flag('--mode', 'auto');
      const format=flag('--format', 'json');
      const lang=flag('--lang', 'en');
      const result=await scanWebsite(targetUrl, { mode });
      if (format === 'markdown') {
        console.log(formatReportMarkdown(result, lang));
      } else {
        output(result);
      }
      break;
    }
    case 'help':
    default: console.log(`AgentReady B2A (Node >=20; zero base CLI dependencies)

  node bin/agentready.mjs inspect --project <website>
  node bin/agentready.mjs init --project <website> [--site-name "Name"] [--site-url https://example.com]
  node bin/agentready.mjs import --project <website> --source <file> [--format auto|shopify|woocommerce|jsonld] [--currency USD] [--trusted-public-source] [--allow-attributes color,size] [--force]
  node bin/agentready.mjs generate --project <website> [--force]
  node bin/agentready.mjs verify --project <website>
  node bin/agentready.mjs scan --url <https://example.com> [--mode auto|commerce|general] [--format json|markdown] [--lang en|vi]

IMPORTANT: generator writes only website/public/llms.txt and website/public/agentready/.
No existing files are overwritten unless --force is passed. --force overwrites only known output files.
Published products must be explicitly marked published:true in a JSON data adapter.
The scanner is local-first, read-only, SSRF-protected, and does not access private endpoints or perform checkout/mutations.`);
    if(command!=='help') process.exitCode=1;
  }
} catch(error) {
  console.error('[AgentReady]',error.message);
  process.exitCode=1;
}
