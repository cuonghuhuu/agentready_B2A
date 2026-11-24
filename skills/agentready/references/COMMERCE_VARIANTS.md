[Tiếng Việt](vi/COMMERCE_VARIANTS.md) · [Home](../README.md)

# Commerce variants (experimental v0.3 slice)

This development slice adds an **optional** `variants` array to the existing published-product snapshot schema. It is not a universal commerce adapter or a live storefront integration.

## Public variant input

Each variant is included **only when `published: true`**. Internal variants are excluded even when their parent product is public.

```json
{
  "id": "tee",
  "name": "Cotton Tee",
  "published": true,
  "url": "/products/tee",
  "price": 490000,
  "currency": "VND",
  "availability": "InStock",
  "variants": [
    {
      "id": "black-m",
      "published": true,
      "sku": "TEE-BLK-M",
      "label": "Black / M",
      "price": 490000,
      "currency": "VND",
      "availability": "InStock",
      "attributes": {"color": "black", "size": "M"}
    }
  ]
}
```

Existing flat products continue to work. The parent product still requires the existing `price`, `currency`, and `availability` fields for compatibility.

Published variant output includes only: `id`, optional `sku` and `label`, `price`, `currency`, `availability`, `url`, and validated `attributes`. Private source fields are dropped. Unpublished variants never appear in public output.

Up to 100 source variants per product and 30 attributes per published variant are accepted. Public variant IDs must be unique per parent, and variant currency must match the parent (variants must share one currency; cross-product price filtering requires explicit currency for mixed-currency catalogs).

## Output and browser tools

- `catalog.json` contains public variant details and same-origin absolute variant URLs.
- `catalog.md` has a short public variant section.
- Standalone JSON-LD emits multiple `Offer` values if variants exist, preserving per-variant public pricing and availability.
- WebMCP search returns compact product summaries, including variant count and price range, while product lookup returns public variant details.
- Search applies query, price, currency and availability to matching variants. Representative price and availability come from the same offer, prioritizing InStock, then PreOrder, then OutOfStock, with lowest price within that tier. Price range is separate. No real-time pricing guarantee is implied.

This is a build-time snapshot. Test actual storefront integration and current source-of-truth stock/prices before treating it as production-ready.

## Run checks

```sh
npm test
npm run demo
npm run verify:demo
```

The fashion and electronics fixtures are **synthetic catalog fixtures**, not complete running storefronts, and must not be described as end-to-end framework integrations.
