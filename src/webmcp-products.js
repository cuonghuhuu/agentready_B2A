/* AgentReady read-only WebMCP adapter.
 * Uses the WebMCPify runtime for feature detection and scoped registration.
 * Loads only the explicitly PUBLIC catalog snapshot; no cart or checkout access.
 * Load as a module after deploying the catalog and webmcpify-runtime.js.
 */
import { createToolScope } from './webmcpify-runtime.js';

if (typeof document !== 'undefined' && document.modelContext && !window.__agentreadyWebMcpRegistered) {
  window.__agentreadyWebMcpRegistered = true;
  const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const failure = message => ({ isError: true, content: [{ type: 'text', text: message }] });
  const lowestPrice = p => p.variants?.length
    ? Math.min(...p.variants.map(v=>v.price)) : p.price;
  const simplify = (p, {details=false}={}) => {
    const variants=Array.isArray(p.variants)?p.variants:[];
    const available=variants.length
      ? (variants.some(v=>v.availability==='InStock')?'InStock':
        variants.some(v=>v.availability==='PreOrder')?'PreOrder':'OutOfStock')
      : p.availability;
    return {
      id:p.id,name:p.name,brand:p.brand,category:p.category,
      price:lowestPrice(p),currency:p.currency,availability:available,
      url:p.url,description:(p.description||'').slice(0,250),
      attributes:p.attributes||{},
      ...(variants.length?{variantCount:variants.length,
        priceRange:{min:lowestPrice(p),max:Math.max(...variants.map(v=>v.price))}}:{}),
      ...(details&&variants.length?{variants}:{})
    };
  };

  async function catalog() {
    const response = await fetch('/agentready/catalog.json', { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('The public catalog is unavailable.');
    const body = await response.json();
    if (body.schemaVersion !== 'agentready.catalog.v0.1' || !Array.isArray(body.products)) {
      throw new Error('Unexpected AgentReady catalog schema.');
    }
    return body.products;
  }

  const guarded = handler => async args => {
    try { return await handler(args || {}); }
    catch { return failure('Unable to access the public product catalog.'); }
  };

  const scope = createToolScope('agentready-product-catalog', [
    {
      name: 'agentready_search_products',
      description: 'Search the website public product snapshot by name, brand, category or description. Returns at most 10 short results. Recheck live price and inventory before a purchase.',
      inputSchema: { type: 'object', properties: {
        query: {type:'string',description:'Search text (1-100 characters)'},
        maxPrice: {type:'number',description:'Optional maximum public price >= 0'},
        limit: {type:'integer',minimum:1,maximum:10,description:'Number of results, default 5'}
      }, required:['query'], additionalProperties:false },
      annotations: { readOnlyHint: true },
      execute: guarded(async ({query,maxPrice,limit}) => {
        if (typeof query !== 'string' || query.trim().length<1 || query.length>100) return failure('Invalid search query.');
        if (maxPrice !== undefined && (typeof maxPrice!=='number' || !Number.isFinite(maxPrice) || maxPrice<0)) return failure('Invalid maxPrice.');
        const max = Number.isInteger(limit) ? Math.min(10,Math.max(1,limit)) : 5;
        const terms=query.trim().toLocaleLowerCase().split(/\s+/);
        const products=await catalog();
        const matches=products.filter(p=>{
          const text=[p.name,p.brand,p.category,p.description, ...Object.values(p.attributes || {}), ...((p.variants||[]).flatMap(v=>[v.label,v.sku,...Object.values(v.attributes||{})]))].join(' ').toLocaleLowerCase();
          return terms.every(t=>text.includes(t)) && (maxPrice===undefined || lowestPrice(p)<=maxPrice);
        });
        return result({totalMatches:matches.length,items:matches.slice(0,max).map(simplify),mode:'public_snapshot'});
      })
    },
    {
      name:'agentready_get_product',
      description:'Get one public product by its exact id, using a published catalog snapshot. This is not a live stock or price confirmation.',
      inputSchema:{type:'object',properties:{id:{type:'string',description:'Public product id'}},required:['id'],additionalProperties:false},
      annotations:{readOnlyHint:true},
      execute:guarded(async ({id})=>{
        if (typeof id!=='string' || !/^[a-zA-Z0-9._-]{1,120}$/.test(id)) return failure('Invalid id.');
        const products=await catalog();
        const product=products.find(p=>p.id===id);
        return product?result({item:simplify(product,{details:true}),mode:'public_snapshot'}):failure('Product not found.');
      })
    }
  ], { validate: false, onError: () => { window.__agentreadyWebMcpRegistered = false; } });

  scope.ready.then(ready => {
    if (!ready) window.__agentreadyWebMcpRegistered = false;
  });
  window.addEventListener('pagehide', () => {
    scope();
    window.__agentreadyWebMcpRegistered = false;
  }, {once:true});
}
