const catalogEntries = [
  ['Public product catalog (JSON)', '/agentready/catalog.json', 'Published product snapshot; confirm live price and availability before ordering.'],
  ['Public product catalog (Markdown)', '/agentready/catalog.md', 'Concise public product descriptions.'],
  ['Product structured data (JSON-LD)', '/agentready/products.jsonld', 'Standalone ItemList output; add per-product JSON-LD to dynamic product pages separately.']
];

function requiredText(value, key) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} must be a non-empty string.`);
  return value.trim();
}

/** Create the configuration passed to @agentmarkup/next's withAgentmarkup(). */
export function createAgentMarkupConfig({siteName, siteUrl, siteDescription}) {
  const name = requiredText(siteName, 'siteName');
  const description = requiredText(siteDescription, 'siteDescription');
  let url;
  try { url = new URL(requiredText(siteUrl, 'siteUrl')); }
  catch { throw new Error('siteUrl must be a valid origin URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('siteUrl must be an http(s) origin without credentials, path, query, or fragment.');
  }
  const origin = url.origin;

  return {
    site: origin,
    name,
    description,
    llmsTxt: {
      replaceExisting: true,
      instructions: 'The AgentReady commerce catalog is a public build-time snapshot. Confirm current price and availability with the store before ordering.',
      sections: [{
        title: 'Public commerce catalog',
        entries: catalogEntries.map(([title, path, entryDescription]) => ({
          title,
          url: `${origin}${path}`,
          description: entryDescription
        }))
      }]
    },
    globalSchemas: [{preset: 'webSite', name, url: origin}]
  };
}
