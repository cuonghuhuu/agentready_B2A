import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(THIS_DIR, '..');
const OUTPUT_FILES = [
  'llms.txt',
  'agentready/catalog.json',
  'agentready/catalog.md',
  'agentready/products.jsonld',
  'agentready/webmcp-products.js',
  'agentready/webmcpify-runtime.js',
  'agentready/manifest.json'
];

function assert(condition, message) { if (!condition) throw new Error(message); }
function safeText(value, max = 1500) {
  assert(typeof value === 'string', 'Expected text string');
  return value.trim().slice(0, max);
}
function requireText(value, name, max = 1500) {
  const v = safeText(value, max);
  assert(v.length > 0, `${name} must be a non-empty string`);
  return v;
}
function canonicalSite(input) {
  const u = new URL(requireText(input, 'siteUrl'));
  assert(['http:', 'https:'].includes(u.protocol), 'siteUrl must be http(s)');
  assert(u.username === '' && u.password === '', 'siteUrl must not contain credentials');
  assert(!u.search && !u.hash, 'siteUrl cannot include query or fragment');
  assert(u.pathname === '/' || u.pathname === '', 'siteUrl must be an origin (no path)');
  if (u.protocol === 'http:') {
    assert(['localhost', '127.0.0.1', '[::1]'].includes(u.hostname), 'Use https for non-localhost URLs');
  }
  return u.origin;
}
function safeLocalFile(project, relative) {
  assert(typeof relative === 'string' && !!relative, 'publicProductsPath is required');
  assert(!path.isAbsolute(relative) && !relative.split(/[\\/]+/).includes('..'), 'Source path must remain inside project');
  const root = path.resolve(project);
  const full = path.resolve(root, relative);
  assert(full.startsWith(root + path.sep), 'Source path must remain inside project');
  return full;
}
function validateUrl(url, siteOrigin, name) {
  const u = new URL(requireText(url, name), `${siteOrigin}/`);
  assert(['http:', 'https:'].includes(u.protocol), `${name}: unsupported protocol`);
  assert(u.origin === siteOrigin, `${name}: only same-origin public links are supported`);
  assert(!u.username && !u.password, `${name}: no credentials`);
  return u.pathname + u.search;
}
function markdownEscape(str) {
  return str.replace(/[\\`*_[\]<>|]/g, (x) => `\\${x}`).replace(/\r?\n/g, ' ');
}
function jsonForHtml(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}
function validProduct(product, index, origin) {
  assert(product && typeof product === 'object' && !Array.isArray(product), `product[${index}] must be object`);
  const id = requireText(product.id, `product[${index}].id`, 120);
  assert(/^[a-zA-Z0-9._-]+$/.test(id), `product[${index}].id contains unsafe characters`);
  const name = requireText(product.name, `product[${index}].name`, 250);
  const url = validateUrl(product.url, origin, `product[${index}].url`);
  const description = typeof product.description === 'string' ? safeText(product.description, 700) : '';
  const category = typeof product.category === 'string' ? safeText(product.category, 120) : '';
  const brand = typeof product.brand === 'string' ? safeText(product.brand, 120) : '';
  const sku = typeof product.sku === 'string' ? safeText(product.sku, 100) : '';
  const price = product.price;
  assert(typeof price === 'number' && Number.isFinite(price) && price >= 0, `product[${index}].price must be nonnegative finite number`);
  const currency = requireText(product.currency, `product[${index}].currency`, 3).toUpperCase();
  assert(/^[A-Z]{3}$/.test(currency), `product[${index}].currency must be ISO 4217 3-letter code`);
  const availability = requireText(product.availability, `product[${index}].availability`, 25);
  assert(['InStock', 'OutOfStock', 'PreOrder'].includes(availability), `product[${index}].availability invalid`);
  let image;
  if (product.image !== undefined && product.image !== null && product.image !== '') {
    image = validateUrl(product.image, origin, `product[${index}].image`);
  }
  const attributes = {};
  if (product.attributes !== undefined) {
    assert(product.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes), `product[${index}].attributes must be object`);
    for (const [key, val] of Object.entries(product.attributes)) {
      assert(/^[a-zA-Z0-9_-]{1,50}$/.test(key), `product[${index}] invalid attribute key`);
      assert(typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean', `product[${index}] invalid attribute value`);
      attributes[key] = String(val).slice(0, 200);
    }
  }
  return {id, name, url, description, brand, category, sku, price, currency, availability, ...(image ? {image} : {}), attributes};
}

async function writeNewFile(file, data, {force = false} = {}) {
  await fs.mkdir(path.dirname(file), {recursive:true});
  if (!force) {
    try { await fs.access(file); throw new Error(`Refusing to overwrite ${file}. Use --force to replace generated files.`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  await fs.writeFile(file, data, 'utf8');
}
export async function inspect(project) {
  const target = path.resolve(project);
  let pkg = {};
  try { pkg = JSON.parse(await fs.readFile(path.join(target,'package.json'),'utf8')); } catch { /* not an npm project */ }
  const deps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})};
  const paths = ['app','src/app','pages','src/pages','public','data'];
  const findings = {};
  for (const item of paths) {
    try { findings[item] = (await fs.stat(path.join(target,item))).isDirectory(); } catch { findings[item] = false; }
  }
  return {project:target, framework: deps.next ? 'nextjs' : deps.nuxt ? 'nuxt' : deps.astro ? 'astro' : deps.vite ? 'vite' : 'unknown', packageName:pkg.name ?? null, directories:findings, hasAgentReadyConfig:await exists(path.join(target,'agentready.config.json'))};
}
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }

export async function init(project,{siteName, siteUrl, force=false}={}) {
  const root = path.resolve(project);
  assert(await exists(root), `Project directory does not exist: ${root}`);
  const info = await inspect(root);
  const config = {
    siteName: siteName || info.packageName || 'My Store (EDIT ME)',
    siteUrl: siteUrl || 'http://localhost:3000',
    siteDescription: 'EDIT: Describe the public business, products and services accurately.',
    publicProductsPath: 'data/agentready-products.json',
    mode: 'snapshot',
    webmcp: true
  };
  const configFile=path.join(root,'agentready.config.json');
  const productsFile=path.join(root,'data','agentready-products.json');
  if (force || !await exists(configFile)) await writeNewFile(configFile, JSON.stringify(config,null,2)+'\n',{force});
  if (force || !await exists(productsFile)) await writeNewFile(productsFile, '[]\n',{force});
  return {configFile,productsFile,framework:info.framework};
}

async function loadSite(root) {
  const configPath = path.join(root,'agentready.config.json');
  const config = JSON.parse(await fs.readFile(configPath,'utf8'));
  const origin=canonicalSite(config.siteUrl);
  const siteName=requireText(config.siteName,'siteName',180);
  const siteDescription=requireText(config.siteDescription,'siteDescription',700);
  assert(config.mode === 'snapshot', 'Only snapshot mode supported in v0.1');
  const sourcePath=safeLocalFile(root, config.publicProductsPath);
  // Prevent source symlink escapes, including symlinked parent directories.
  const realRoot=await fs.realpath(root);
  const realSource=await fs.realpath(sourcePath);
  assert(realSource.startsWith(realRoot+path.sep),'Product source must remain inside project (symlinks forbidden outside)');
  const raw=JSON.parse(await fs.readFile(sourcePath,'utf8'));
  assert(Array.isArray(raw) && raw.length <= 5000,'Products file must be array with <= 5000 records');
  const published=raw.filter(p => p?.published === true);
  const products=published.map((p,i)=>validProduct(p,i,origin)).sort((a,b)=>a.id.localeCompare(b.id));
  const ids=new Set();
  for (const product of products) { assert(!ids.has(product.id), `Duplicate product id: ${product.id}`); ids.add(product.id); }
  return {origin,siteName,siteDescription,sourcePath,products,webmcp:config.webmcp===true};
}
function makeJsonLd(site) {
  return {
    '@context':'https://schema.org',
    '@type':'ItemList',
    name:`${site.siteName} public product catalog`,
    itemListElement:site.products.map((p,i)=>({
      '@type':'ListItem',position:i+1,url:site.origin+p.url,
      item:{
        '@type':'Product',name:p.name,url:site.origin+p.url,
        ...(p.description?{description:p.description}:{}),
        ...(p.sku?{sku:p.sku}:{}),
        ...(p.brand?{brand:{'@type':'Brand',name:p.brand}}:{}),
        ...(p.image?{image:site.origin+p.image}:{}),
        offers:{'@type':'Offer',price:p.price,priceCurrency:p.currency,availability:`https://schema.org/${p.availability}`,url:site.origin+p.url}
      }
    }))
  };
}
function makeMarkdown(site) {
  const head=[`# ${markdownEscape(site.siteName)} — Public product catalog`, '', markdownEscape(site.siteDescription), '', `Source: ${site.origin}/agentready/catalog.json`, 'This is a PUBLIC SNAPSHOT. Re-check live price and stock with the store before ordering.', ''];
  for (const p of site.products) {
    head.push(`## ${markdownEscape(p.name)}`, `- Product URL: ${site.origin+p.url}`, `- Brand: ${markdownEscape(p.brand||'Not specified')}`, `- Category: ${markdownEscape(p.category||'Not specified')}`, `- SKU: ${markdownEscape(p.sku||'Not specified')}`, `- Price: ${p.price} ${p.currency}`, `- Availability: ${p.availability}`, ...(p.description?[`- Description: ${markdownEscape(p.description)}`]:[]), ...Object.entries(p.attributes).map(([k,v])=>`- ${k}: ${markdownEscape(v)}`),'');
  }
  return head.join('\n').replace(/\n+$/,'')+'\n';
}
function makeLlms(site) {
  return [
    `# ${site.siteName.replace(/[\r\n#]/g,' ')}`,
    '',
    site.siteDescription.replace(/[\r\n]/g,' '),
    '',
    '## Public machine-readable resources',
    `- [Public product catalog (JSON)](${site.origin}/agentready/catalog.json): Published product information (snapshot).`,
    `- [Public product catalog (Markdown)](${site.origin}/agentready/catalog.md): Concise product descriptions for agents.`,
    `- [Products JSON-LD](${site.origin}/agentready/products.jsonld): Schema.org product offer data (standalone artifact; must integrate in HTML to appear as page structured data).`,
    '',
    '## Important limitations',
    '- The product catalog is a build-time snapshot, not a live inventory or transactional API.',
    '- Checkout and payment require explicit website authentication and user approval.',
    '- llms.txt is voluntary metadata; no external AI agent is required to consume it.',
    ''
  ].join('\n');
}
export async function generate(project,{force=false}={}) {
  const root=path.resolve(project);
  const site=await loadSite(root);
  const pub=path.join(root,'public');
  const catalog={schemaVersion:'agentready.catalog.v0.1',siteName:site.siteName,siteUrl:site.origin,generatedAt:new Date().toISOString(),mode:'snapshot',products:site.products.map(p=>({...p,url:site.origin+p.url,...(p.image?{image:site.origin+p.image}:{})}))};
  const manifest={version:'agentready.v0.1',name:site.siteName,site:site.origin,mode:'snapshot',productCount:site.products.length,publicEndpoints:['/llms.txt','/agentready/catalog.json','/agentready/catalog.md','/agentready/products.jsonld'],webmcp:site.webmcp?{asset:'/agentready/webmcp-products.js',readOnlyTools:['agentready_search_products','agentready_get_product']}:null,security:{mutatingTools:false,checkout:false,authenticationBypass:false}};
  const generated={
    'llms.txt':makeLlms(site),
    'agentready/catalog.json':JSON.stringify(catalog,null,2)+'\n',
    'agentready/catalog.md':makeMarkdown(site),
    'agentready/products.jsonld':jsonForHtml(makeJsonLd(site))+'\n',
    'agentready/webmcp-products.js':await fs.readFile(path.join(ROOT_DIR,'src','webmcp-products.js'),'utf8'),
    'agentready/webmcpify-runtime.js':await fs.readFile(path.join(ROOT_DIR,'src','webmcpify-runtime.js'),'utf8'),
    'agentready/manifest.json':JSON.stringify(manifest,null,2)+'\n'
  };
  // Preflight collisions so a single existing file cannot cause partial writes.
  if (!force) for (const file of OUTPUT_FILES) {
    assert(!await exists(path.join(pub,file)), `Output already exists: public/${file}. Use --force for regeneration.`);
  }
  for (const [file,body] of Object.entries(generated)) await writeNewFile(path.join(pub,file),body,{force});
  return {root,output:OUTPUT_FILES.map(f=>`public/${f}`),productCount:site.products.length,webmcp:site.webmcp,warnings:site.products.length===0?['No published products: add real PUBLIC items and re-run generate --force.']:[]};
}
export async function verify(project) {
  const root=path.resolve(project);
  const pub=path.join(root,'public');
  const errors=[];
  for (const f of OUTPUT_FILES) if (!await exists(path.join(pub,f))) errors.push(`Missing public/${f}`);
  if (errors.length) return {ok:false,errors};
  const site=await loadSite(root);
  const catalog=JSON.parse(await fs.readFile(path.join(pub,'agentready/catalog.json'),'utf8'));
  const schema=JSON.parse(await fs.readFile(path.join(pub,'agentready/products.jsonld'),'utf8'));
  const manifest=JSON.parse(await fs.readFile(path.join(pub,'agentready/manifest.json'),'utf8'));
  const llms=await fs.readFile(path.join(pub,'llms.txt'),'utf8');
  const md=await fs.readFile(path.join(pub,'agentready/catalog.md'),'utf8');
  if (catalog.products.length!==site.products.length) errors.push('Catalog product count differs from public source');
  if (schema.itemListElement.length!==site.products.length) errors.push('JSON-LD count differs from public source');
  if (manifest.productCount!==site.products.length) errors.push('Manifest count differs from public source');
  if (!llms.includes(`${site.origin}/agentready/catalog.json`)) errors.push('Missing catalog link in llms.txt');
  for (const [i,p] of site.products.entries()) {
    if (catalog.products[i]?.id!==p.id||catalog.products[i]?.price!==p.price||catalog.products[i]?.availability!==p.availability) errors.push(`Catalog differs from public source: ${p.id}`);
    if (schema.itemListElement[i]?.item?.offers?.price!==p.price) errors.push(`JSON-LD offer differs from source: ${p.id}`);
    if (!md.includes(`${site.origin+p.url}`)) errors.push(`Markdown missing public URL: ${p.id}`);
  }
  return {ok:errors.length===0,errors,productCount:site.products.length,origin:site.origin,notice:'Local file consistency only. Does NOT prove deployment, real-time inventory, or external agent behavior.'};
}
