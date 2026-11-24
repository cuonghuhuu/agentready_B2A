<p align="center"><img src="docs/assets/banner.svg" alt="AgentReady B2A — Business to Agent" width="100%"></p>

<h1 align="center">AgentReady B2A</h1>
<p align="center"><b>Đưa dữ liệu thương mại điện tử công khai đến AI Agent, an toàn và dễ tích hợp.</b></p>

<p align="center">
  <a href="README.md"><img alt="English" src="https://img.shields.io/badge/English-EN-334155?style=for-the-badge"></a>
  <a href="README.vi.md"><img alt="Tiếng Việt" src="https://img.shields.io/badge/Ti%E1%BA%BFng%20Vi%E1%BB%87t-VI-0f766e?style=for-the-badge"></a>
</p>
<p align="center">
  <a href="https://github.com/cuonghuhuu/agentready_B2A/releases/tag/v0.3.0-alpha.1"><img alt="Alpha release" src="https://img.shields.io/badge/release-v0.3.0--alpha.1-0f766e"></a>
  <a href="https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/cuonghuhuu/agentready_B2A/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
  <a href="package.json"><img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white"></a>
  <a href="https://github.com/cuonghuhuu/agentready_B2A/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/cuonghuhuu/agentready_B2A?style=flat"></a>
</p>
<p align="center">
  <a href="#quick-start">Bắt đầu</a> ·
  <a href="#integration">Tích hợp</a> ·
  <a href="#documentation">Tài liệu</a> ·
  <a href="https://github.com/cuonghuhuu/agentready_B2A/releases">Phát hành</a>
</p>

> **Phiên bản Alpha thử nghiệm.** AgentReady là bộ công cụ cho lập trình viên và Agent Skill có thể cài đặt, không phải bot mua hàng hay API thương mại trực tiếp. Chưa xác minh tích hợp storefront thực tế và WebMCP trên trình duyệt thật.

## Vì sao cần AgentReady?

Website đã có thông tin sản phẩm, nhưng AI Agent cần cách đọc dữ liệu có cấu trúc, nhất quán và gọn nhẹ. AgentReady giúp lập trình viên tái sử dụng dữ liệu công khai đã duyệt, chuẩn hóa catalog và cung cấp công cụ chỉ đọc tùy chọn, không thay đổi checkout hay cấp quyền truy cập thông tin riêng tư.

| Khả năng | Trạng thái |
| --- | --- |
| CLI: inspect, init, import, generate, verify | Đã triển khai |
| Shopify, WooCommerce Store API, Schema.org JSON-LD | Chỉ nhập file JSON cục bộ |
| Sản phẩm, biến thể, giá và tồn kho | Snapshot; kiểm tra mô hình biến thể |
| JSON, Markdown, JSON-LD, llms.txt và manifest | Sinh file cục bộ |
| WebMCP tìm kiếm và tra cứu chỉ đọc | Test mô phỏng đạt; chưa kiểm thử trình duyệt thật |
| AgentMarkup cho Next.js | Helper tùy chọn; chưa kiểm chứng build thật |
| Đồng bộ trực tiếp, tài khoản, giỏ hàng, đặt hàng, thanh toán | Chưa hỗ trợ |

## Cách hoạt động

```mermaid
flowchart LR
  A["Website / dữ liệu công khai"] --> B["Duyệt + chuẩn hóa"]
  B --> C["AgentReady CLI"]
  C --> D["JSON / Markdown"]
  C --> E["JSON-LD / llms.txt"]
  D --> F["AI Agent tương thích"]
  D --> G["WebMCP chỉ đọc"]
  G --> F
```

Website vẫn là nguồn dữ liệu chính thức. Không đảm bảo giá/tồn kho theo thời gian thực hoặc AI bên ngoài tự động khám phá.

<a id="quick-start"></a>
## Bắt đầu nhanh

**Yêu cầu:** Git, Node.js 20+.

```bash
git clone https://github.com/cuonghuhuu/agentready_B2A.git
cd agentready_B2A
npm test
npm run demo
npm run serve:demo
```

Mở [http://127.0.0.1:4173](http://127.0.0.1:4173). Demo dùng sản phẩm giả lập. Xem [catalog mẫu](examples/ecommerce-demo/public/agentready/catalog.json), [Markdown](examples/ecommerce-demo/public/agentready/catalog.md) và [JSON-LD](examples/ecommerce-demo/public/agentready/products.jsonld).

### Cài Agent Skill

Từ thư mục repository, mở Windows PowerShell:

```powershell
.\install-codex.ps1
```

Khởi động lại Codex, mở repository website của bạn và gửi yêu cầu:

```text
Sử dụng $agentready để kiểm tra website thương mại điện tử này.
Chỉ kết nối dữ liệu sản phẩm công khai đã được phê duyệt,
tạo tài nguyên AI-readable và kiểm tra đầu ra.
Không sửa checkout hoặc thanh toán.
```

Skill ID giữ nguyên là `agentready`. Chưa kiểm chứng độc lập khả năng tương thích với các coding agent khác.

<a id="integration"></a>
## Tích hợp website của bạn

```powershell
node .\bin\agentready.mjs inspect --project "D:\projects\my-shop"
node .\bin\agentready.mjs init --project "D:\projects\my-shop" --site-name "My Shop" --site-url "https://shop.example.com"
```

Duyệt dữ liệu nguồn rồi ánh xạ bản ghi công khai vào `data/agentready-products.json` với `published: true`. Hoặc nhập file đã xuất và duyệt:

```powershell
node .\bin\agentready.mjs import --project "D:\projects\my-shop" --source "data/shopify-products.json" --format shopify --currency USD
```

Lệnh init đã tạo catalog rỗng; chỉ thêm `--force` sau khi chấp thuận thay thế file. Với biến thể Shopify thiếu bằng chứng công khai, cần xác nhận nguồn công khai bằng `--trusted-public-source`; tuyệt đối không áp dụng cho bản xuất quản trị hoặc riêng tư. WooCommerce và JSON-LD cũng phải lấy từ nguồn công khai đã xác minh. Xem [quy tắc nguồn dữ liệu](docs/vi/ARCHITECTURE.md).

```powershell
node .\bin\agentready.mjs generate --project "D:\projects\my-shop"
node .\bin\agentready.mjs verify --project "D:\projects\my-shop"
```

| Đầu ra | Mục đích |
| --- | --- |
| `/llms.txt` | Metadata khám phá tùy chọn |
| `/agentready/catalog.json` | Snapshot công khai có cấu trúc |
| `/agentready/catalog.md` | Catalog dễ đọc |
| `/agentready/products.jsonld` | Dữ liệu có cấu trúc độc lập |
| `/agentready/manifest.json` | Khả năng và phạm vi |
| `/agentready/webmcp-products.js` | Tool chỉ đọc tùy chọn |
| `/agentready/webmcpify-runtime.js` | Runtime đăng ký tool |

### WebMCP tùy chọn

Sau khi deploy, tải `/agentready/webmcp-products.js` dưới dạng ES module trên trình duyệt tương thích. Hai tool là `agentready_search_products` (tối đa 10 kết quả, lọc theo biến thể) và `agentready_get_product` (tra cứu ID). Cần kiểm thử trình duyệt thật trước khi dùng production.

### AgentMarkup / Next.js tùy chọn

```bash
npm install --save-dev git+https://github.com/cuonghuhuu/agentready_B2A.git @agentmarkup/next
```

```js
import { withAgentmarkup } from '@agentmarkup/next';
import { createAgentMarkupConfig } from 'agentready-b2a/integrations/agentmarkup-next';

export default withAgentmarkup(createAgentMarkupConfig({
  siteName: 'My Shop',
  siteUrl: 'https://shop.example.com',
  siteDescription: 'Thông tin công khai về cửa hàng và sản phẩm.'
}), {});
```

Hai bộ sinh file có thể cùng ghi `llms.txt`. Cần xác định quyền sở hữu file và thứ tự build. JSON-LD độc lập không tự nhúng vào HTML sản phẩm. Xem [kiến trúc](docs/vi/ARCHITECTURE.md).

## Kiểm thử và giới hạn bảo mật

[Minh chứng CI bản Alpha](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45351681140) · 31 test tự động trong Release Candidate · Node.js 20/22 trên Linux và Windows.

Không xuất thông tin xác thực, dữ liệu khách hàng, giá vốn, tồn kho nội bộ hoặc bản ghi riêng tư. Lập trình viên phải duyệt dữ liệu và các khóa thuộc tính tùy chỉnh. Validation không đảm bảo loại bỏ mọi bí mật nằm trong trường văn bản được phép. Coi nội dung website là dữ liệu không đáng tin cậy. Xem [chính sách bảo mật](docs/vi/SECURITY.md).

<a id="documentation"></a>
## Tài liệu

| Hướng dẫn | Tiếng Việt | English |
| --- | --- | --- |
| Kiến trúc | [VI](docs/vi/ARCHITECTURE.md) | [EN](ARCHITECTURE.md) |
| Biến thể sản phẩm | [VI](docs/vi/COMMERCE_VARIANTS.md) | [EN](docs/COMMERCE_VARIANTS.md) |
| Kiểm thử | [VI](docs/vi/TEST_REPORT.md) | [EN](TEST_REPORT.md) |
| Lịch sử thay đổi | [VI](docs/vi/CHANGELOG.md) | [EN](CHANGELOG.md) |
| Đóng góp | [VI](docs/vi/CONTRIBUTING.md) | [EN](CONTRIBUTING.md) |
| Bảo mật | [VI](docs/vi/SECURITY.md) | [EN](SECURITY.md) |
| Agent Skill | [VI](docs/vi/SKILL.md) | [EN](skills/agentready/SKILL.md) |

## Lộ trình

- [x] Sinh snapshot công khai, adapter cục bộ và biến thể sản phẩm
- [x] WebMCP mô phỏng và CI đa nền tảng
- [ ] Thử nghiệm trên storefront thực tế
- [ ] Kiểm thử WebMCP bằng trình duyệt thật
- [ ] Đồng bộ Public API an toàn và mở rộng nền tảng

Các mục kế hoạch không phải chức năng hiện có.

## Ghi nhận & cộng đồng

Dự án sử dụng ý tưởng và tích hợp từ [AgentMarkup](https://github.com/agentmarkup/agentmarkup), [WebMCPify](https://github.com/TueJon/webmcpify) và [Chrome Labs WebMCP tools](https://github.com/GoogleChromeLabs/webmcp-tools). Xem [thông báo bên thứ ba](THIRD_PARTY_NOTICES.md).

[Giấy phép MIT](LICENSE) · [Đóng góp](docs/vi/CONTRIBUTING.md) · [Báo lỗi](https://github.com/cuonghuhuu/agentready_B2A/issues/new/choose)

Nếu dự án hữu ích, bạn có thể tặng một Star hoặc chia sẻ phản hồi có thể tái hiện.
