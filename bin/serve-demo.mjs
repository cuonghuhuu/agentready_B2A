#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../examples/ecommerce-demo/public');
const port=Number(process.env.PORT||4173);
const allow=new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/llms.txt',['llms.txt','text/plain; charset=utf-8']],
  ['/agentready/catalog.json',['agentready/catalog.json','application/json; charset=utf-8']],
  ['/agentready/catalog.md',['agentready/catalog.md','text/markdown; charset=utf-8']],
  ['/agentready/products.jsonld',['agentready/products.jsonld','application/ld+json; charset=utf-8']],
  ['/agentready/webmcp-products.js',['agentready/webmcp-products.js','application/javascript; charset=utf-8']],
  ['/agentready/webmcpify-runtime.js',['agentready/webmcpify-runtime.js','application/javascript; charset=utf-8']],
  ['/agentready/manifest.json',['agentready/manifest.json','application/json; charset=utf-8']]
]);
http.createServer(async(req,res)=>{
  const route=allow.get(new URL(req.url,'http://localhost').pathname);
  if(!route||req.method!=='GET') {res.writeHead(404);res.end('Not found');return;}
  try {
    const buf=await fs.readFile(path.join(dir,route[0]));
    res.writeHead(200,{'content-type':route[1], 'cache-control':'no-store', 'x-content-type-options':'nosniff'});
    res.end(buf);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`AgentReady demo: http://127.0.0.1:${port}`));
