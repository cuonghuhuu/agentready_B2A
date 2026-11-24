[← Trang chủ tiếng Việt](../../README.vi.md) · [English](../COMMERCE_VARIANTS.md)

# Biến thể sản phẩm — v0.3 Alpha

Mảng `variants` tùy chọn bổ sung cho snapshot sản phẩm. Đây không phải tích hợp storefront live.

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

Chỉ xuất biến thể có `published:true`, kể cả khi sản phẩm cha công khai. Sản phẩm không biến thể vẫn tương thích. Sản phẩm cha cần `price`, `currency`, `availability`.

Đầu ra biến thể: ID, SKU và label tùy chọn, giá, tiền tệ, tồn kho, URL cùng origin và thuộc tính đã kiểm tra. Tối đa 100 biến thể mỗi sản phẩm, 30 thuộc tính mỗi biến thể; ID/SKU công khai không trùng trong cùng sản phẩm. Tiền tệ biến thể phải khớp cha. Lọc catalog nhiều tiền tệ yêu cầu `currency` khi dùng `maxPrice`.

JSON chứa chi tiết biến thể, Markdown có phần biến thể, JSON-LD độc lập có nhiều Offer. WebMCP search áp dụng điều kiện trên cùng biến thể và trả tóm tắt offer phù hợp; lookup trả đầy đủ biến thể công khai. Giá đại diện chọn cùng offer với tồn kho, ưu tiên InStock → PreOrder → OutOfStock, rồi giá thấp nhất trong nhóm.

```bash
npm test
npm run demo
npm run verify:demo
```

Fixture thời trang và điện tử là dữ liệu giả lập, không phải website hoàn chỉnh. Kiểm tra giá và tồn kho tại nguồn trước khi mua.
