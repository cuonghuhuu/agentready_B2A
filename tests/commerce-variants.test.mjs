import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {generate,verify} from '../src/core.mjs';

async function fixture(t, type) {
  const root=fileURLToPath(new URL('../examples/'+type+'-fixture/',import.meta.url));
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'agentready-variants-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await fs.mkdir(path.join(dir,'data'),{recursive:true});
  await fs.copyFile(path.join(root,'agentready.config.json'),path.join(dir,'agentready.config.json'));
  await fs.copyFile(path.join(root,'data/agentready-products.json'),path.join(dir,'data/agentready-products.json'));
  return dir;
}

test('fashion fixture emits only explicitly public variants and keeps their offers accurate',async t=>{
  const dir=await fixture(t,'fashion');
  const output=await generate(dir);
  assert.equal(output.productCount,1);
  const raw=await fs.readFile(path.join(dir,'public/agentready/catalog.json'),'utf8');
  const catalog=JSON.parse(raw);
  const product=catalog.products[0];
  assert.equal(product.variants.length,2);
  assert.deepEqual(product.variants.map(v=>v.id),['black-m','blue-l']);
  assert.deepEqual(product.variants.map(v=>v.price),[490000,550000]);
  assert(product.variants.every(v=>v.url.startsWith('https://fashion.example/')));
  assert(!raw.includes('supplierCost'));
  assert(!raw.includes('INTERNAL-ONLY'));
  assert(!raw.includes('private-test'));
  const schema=JSON.parse(await fs.readFile(path.join(dir,'public/agentready/products.jsonld'),'utf8'));
  assert.deepEqual(schema.itemListElement[0].item.offers.map(o=>o.price),[490000,550000]);
  const markdown=await fs.readFile(path.join(dir,'public/agentready/catalog.md'),'utf8');
  assert(markdown.includes('Black / Medium'));
  assert.equal((await verify(dir)).ok,true);
});

test('electronics fixture supports multiple products and variant detail offers',async t=>{
  const dir=await fixture(t,'electronics');
  await generate(dir);
  const catalog=JSON.parse(await fs.readFile(path.join(dir,'public/agentready/catalog.json'),'utf8'));
  assert.equal(catalog.products.length,2);
  const phone=catalog.products.find(p=>p.id==='phone-250');
  assert.equal(phone.variants[0].url,'https://electronics.example/products/demo-phone');
  const schema=JSON.parse(await fs.readFile(path.join(dir,'public/agentready/products.jsonld'),'utf8'));
  const phoneSchema=schema.itemListElement.find(x=>x.item.name==='Demo Smartphone');
  assert.equal(phoneSchema.item.offers[1].price,14990000);
  assert.equal((await verify(dir)).ok,true);
});

test('variant ids, prices, URLs and currencies are validated before publication',async t=>{
  const dir=await fixture(t,'fashion');
  const file=path.join(dir,'data/agentready-products.json');
  const original=JSON.parse(await fs.readFile(file,'utf8'));
  async function check(update,pattern) {
    const copy=structuredClone(original);
    update(copy[0].variants);
    await fs.writeFile(file,JSON.stringify(copy));
    await assert.rejects(()=>generate(dir),pattern);
  }
  await check(v=>{v[1].id=v[0].id;},/Duplicate public variant id/);
  await check(v=>{v[1].url='https://attacker.example/private';},/same-origin/);
  await check(v=>{v[1].currency='USD';},/match parent currency/);
  await check(v=>{v[1].price=-1;},/nonnegative finite/);
  await check(v=>{v[1].attributes={__proto__:'unsafe',customerEmail:'secret'};v[1].attributes.customerEmail={secret:true};},/invalid attribute value/);
});

test('WebMCP product search uses public variant pricing and detail omits private fields',async t=>{
  const dir=await fixture(t,'fashion');
  await generate(dir);
  const publicCatalog=JSON.parse(await fs.readFile(path.join(dir,'public/agentready/catalog.json'),'utf8'));
  const registered=[];
  globalThis.document={modelContext:{registerTool:tool=>{registered.push(tool);return Promise.resolve();}}};
  globalThis.window={addEventListener:()=>{}};
  globalThis.fetch=async()=>({ok:true,json:async()=>publicCatalog});
  t.after(()=>{delete globalThis.document;delete globalThis.window;delete globalThis.fetch;});
  await import(pathToFileURL(path.join(dir,'public/agentready/webmcp-products.js')).href+'?variant='+Date.now());
  await new Promise(resolve=>setTimeout(resolve,0));
  const search=registered.find(x=>x.name==='agentready_search_products');
  const get=registered.find(x=>x.name==='agentready_get_product');
  assert(search&&get);
  const match=JSON.parse((await search.execute({query:'cotton',maxPrice:500000})).content[0].text);
  assert.equal(match.totalMatches,1);
  assert.equal(match.items[0].price,490000);
  assert.equal(match.items[0].variantCount,2);
  assert(!Object.hasOwn(match.items[0],'variants'));
  const excluded=JSON.parse((await search.execute({query:'cotton',maxPrice:400000})).content[0].text);
  assert.equal(excluded.totalMatches,0);
  const details=JSON.parse((await get.execute({id:'tee-100'})).content[0].text).item;
  assert.equal(details.variants.length,2);
  assert(!JSON.stringify(details).includes('supplierCost'));
  assert(!JSON.stringify(details).includes('internal-test'));
});
