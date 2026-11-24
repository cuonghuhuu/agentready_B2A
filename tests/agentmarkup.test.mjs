import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentMarkupConfig} from '../src/integrations/agentmarkup-next.mjs';

test('AgentMarkup config publishes truthful AgentReady catalog links for a Next.js site',()=>{
  const config=createAgentMarkupConfig({
    siteName:'Sample Shop',
    siteUrl:'https://shop.example',
    siteDescription:'A public product catalog.'
  });
  assert.equal(config.site,'https://shop.example');
  assert.equal(config.name,'Sample Shop');
  assert.equal(config.llmsTxt.replaceExisting,true);
  assert.deepEqual(config.llmsTxt.sections[0].entries.map(entry=>entry.url),[
    'https://shop.example/agentready/catalog.json',
    'https://shop.example/agentready/catalog.md',
    'https://shop.example/agentready/products.jsonld'
  ]);
  assert.equal(config.globalSchemas[0].preset,'webSite');
});

test('AgentMarkup config rejects missing identity and non-origin site URLs',()=>{
  assert.throws(()=>createAgentMarkupConfig({siteName:'',siteUrl:'https://shop.example',siteDescription:'Description'}),/siteName/);
  assert.throws(()=>createAgentMarkupConfig({siteName:'Shop',siteUrl:'https://shop.example/products',siteDescription:'Description'}),/origin/);
});
