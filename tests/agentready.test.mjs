import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspect,init,generate,verify} from '../src/core.mjs';
const demo=fileURLToPath(new URL('../examples/ecommerce-demo/',import.meta.url));
async function fixture(t) {
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'agentready-test-'));
  t.after(()=>fs.rm(tmp,{force:true,recursive:true}));
  await fs.mkdir(path.join(tmp,'data'),{recursive:true});
  await fs.copyFile(path.join(demo,'agentready.config.json'),path.join(tmp,'agentready.config.json'));
  await fs.copyFile(path.join(demo,'data','agentready-products.json'),path.join(tmp,'data','agentready-products.json'));
  return tmp;
}

test('demo source emits only published products, with consistent prices and schema',async t=>{
  const dir=await fixture(t);
  const result=await generate(dir);
  assert.equal(result.productCount,2);
  assert.equal(result.output.length,7);
  assert(result.output.includes('public/agentready/webmcpify-runtime.js'));
  const catalog=JSON.parse(await fs.readFile(path.join(dir,'public/agentready/catalog.json'),'utf8'));
  assert.equal(catalog.products.length,2);
  assert(catalog.products.every(p=>p.id!=='private-03'));
  assert(catalog.products.every(p=>!Object.hasOwn(p,'published')));
  assert.equal((await verify(dir)).ok,true);
  const markdown=await fs.readFile(path.join(dir,'public/agentready/catalog.md'),'utf8');
  assert.equal(markdown.endsWith('\n\n'),false);
  const schema=JSON.parse(await fs.readFile(path.join(dir,'public/agentready/products.jsonld'),'utf8'));
  assert.equal(schema.itemListElement[0].item['@type'],'Product');
  assert.equal(schema.itemListElement[0].item.offers['@type'],'Offer');
  const llms=await fs.readFile(path.join(dir,'public/llms.txt'),'utf8');
  assert(llms.includes('Public product catalog'));
});

test('safe: refuse overwrite without explicit --force',async t=>{
  const dir=await fixture(t);
  await generate(dir);
  await assert.rejects(()=>generate(dir),/Refusing|already exists/);
  await generate(dir,{force:true});
  assert.equal((await verify(dir)).ok,true);
});

test('safe: reject external or malicious product URLs, unsafe paths and duplicate IDs',async t=>{
  const dir=await fixture(t);
  const configPath=path.join(dir,'agentready.config.json');
  const productPath=path.join(dir,'data/agentready-products.json');
  const base=JSON.parse(await fs.readFile(configPath,'utf8'));
  const original=JSON.parse(await fs.readFile(productPath,'utf8'));
  base.publicProductsPath='../private.json';
  await fs.writeFile(configPath,JSON.stringify(base));
  await assert.rejects(()=>generate(dir),/remain inside project/);
  base.publicProductsPath='data/agentready-products.json';
  await fs.writeFile(configPath,JSON.stringify(base));
  original[0].url='https://evil.example/steal';
  await fs.writeFile(productPath,JSON.stringify(original));
  await assert.rejects(()=>generate(dir),/only same-origin/);
  original[0].url='/products/valid';
  original[1].id=original[0].id;
  await fs.writeFile(productPath,JSON.stringify(original));
  await assert.rejects(()=>generate(dir),/Duplicate product id/);
});

test('safe: exposed data is explicitly allowlisted, no private customer fields',async t=>{
  const dir=await fixture(t);
  const filepath=path.join(dir,'data/agentready-products.json');
  const products=JSON.parse(await fs.readFile(filepath,'utf8'));
  products[0].customerEmail='private@example.com';
  products[0].costPrice=125;
  products[0].internalNotes='SECRET';
  await fs.writeFile(filepath,JSON.stringify(products));
  await generate(dir);
  const generated=await fs.readFile(path.join(dir,'public/agentready/catalog.json'),'utf8');
  assert(!generated.includes('private@example.com'));
  assert(!generated.includes('SECRET'));
  assert(!generated.includes('costPrice'));
});

test('detect Next.js and initialize empty private-to-public adapter', async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'agentready-init-'));
  t.after(()=>fs.rm(dir,{force:true,recursive:true}));
  await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name:'shop-demo',dependencies:{next:'^16.0.0'}}));
  assert.equal((await inspect(dir)).framework,'nextjs');
  const r=await init(dir,{siteName:'Sample Shop',siteUrl:'https://shop.example'});
  assert.equal(r.framework,'nextjs');
  assert.deepEqual(JSON.parse(await fs.readFile(r.productsFile,'utf8')),[]);
  assert.equal((await generate(dir)).productCount,0);
});

test('WebMCP adapter delegates registration to the WebMCPify runtime',async t=>{
  const dir=await fixture(t);
  await generate(dir);
  const code=await fs.readFile(path.join(dir,'public/agentready/webmcp-products.js'),'utf8');
  const runtime=await fs.readFile(path.join(dir,'public/agentready/webmcpify-runtime.js'),'utf8');
  assert.match(code,/from ['"]\.\/webmcpify-runtime\.js['"]/);
  assert.match(code,/createToolScope\(/);
  assert.match(runtime,/github\.com\/TueJon\/webmcpify/);
  assert.match(runtime,/Copyright \(c\) 2026 Jonas T/);
});

test('read-only WebMCP adapter registers two safe tools in simulated browser',async t=>{
  const dir=await fixture(t);
  await generate(dir);
  const catalog=JSON.parse(await fs.readFile(path.join(dir,'public/agentready/catalog.json'),'utf8'));
  const regs=[];
  globalThis.document={modelContext:{registerTool:(tool,opts)=>{regs.push({tool,opts});return Promise.resolve();}}};
  globalThis.window={addEventListener:()=>{}};
  globalThis.fetch=async uri=>{assert.equal(uri,'/agentready/catalog.json');return {ok:true,json:async()=>catalog};};
  t.after(()=>{delete globalThis.document;delete globalThis.window;delete globalThis.fetch;});
  await import(`${pathToFileURL(path.join(dir,'public/agentready/webmcp-products.js')).href}?test=${Date.now()}`);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(regs.length,2);
  assert(regs.every(r=>r.tool.annotations.readOnlyHint===true));
  const search=regs.find(r=>r.tool.name==='agentready_search_products').tool;
  const found=await search.execute({query:'woody',maxPrice:1000000});
  const parsed=JSON.parse(found.content[0].text);
  assert.equal(parsed.totalMatches,1);
  assert.equal(parsed.items[0].id,'woody-01');
  assert.equal(parsed.items[0].price,850000);
  assert.equal(parsed.items[0].availability,'InStock');
  assert.equal((await search.execute({query:''})).isError,true);
  assert.equal((await regs.find(r=>r.tool.name==='agentready_get_product').tool.execute({id:'private-03'})).isError,true);
});

test('no-WebMCP browser is a harmless no-op',async t=>{
  globalThis.document={};
  globalThis.window={};
  t.after(()=>{delete globalThis.document;delete globalThis.window;});
  await import(`${pathToFileURL(path.resolve('src/webmcp-products.js')).href}?fallback=${Date.now()}`);
});

test('safe: force generation cannot overwrite the configured product source', async t => {
  const dir = await fixture(t);
  const configPath = path.join(dir, 'agentready.config.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const original = await fs.readFile(path.join(dir, config.publicProductsPath), 'utf8');
  config.publicProductsPath = 'public/agentready/catalog.json';
  const source = path.join(dir, config.publicProductsPath);
  await fs.mkdir(path.dirname(source), { recursive: true });
  await fs.writeFile(source, original);
  await fs.writeFile(configPath, JSON.stringify(config));
  await assert.rejects(() => generate(dir, { force: true }), /Source and generated output must not resolve to the same file/);
  assert.equal(await fs.readFile(source, 'utf8'), original);
  await assert.rejects(() => fs.access(path.join(dir, 'public/llms.txt')), { code: 'ENOENT' });
});
