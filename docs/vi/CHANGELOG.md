[← Trang chủ tiếng Việt](../../README.vi.md) · [English](../../CHANGELOG.md)

# Lịch sử thay đổi

## v0.3.0-alpha.1 — 24/11/2026

[Bản phát hành GitHub](https://github.com/cuonghuhuu/agentready_B2A/releases/tag/v0.3.0-alpha.1).

- Chuẩn hóa biến thể công khai, label/SKU, giá, tiền tệ, tồn kho.
- Import file Shopify, WooCommerce Store API và Schema.org JSON-LD.
- Bổ sung fixture giả lập thời trang/điện tử và regression test.
- Kiểm tra bằng chứng công khai, danh sách thuộc tính cho phép, nhãn biến thể.
- Cô lập điều kiện tìm kiếm theo biến thể, giá/tồn kho cùng offer, khoảng giá riêng; từ chối so sánh khác tiền tệ khi thiếu currency.
- Loại JSON-LD riêng tư, kể cả container cha.
- Xử lý minor unit WooCommerce; chống symlink, trùng đường dẫn và ghi đè nguồn/cấu hình.
- 31 test tự động, CI Windows/Linux Node.js 20/22.
- Chưa xác minh build storefront thật hay browser WebMCP; không đồng bộ live.

## v0.2.0 — 24/11/2026

Mốc phát triển: Agent Skill, CLI snapshot, helper AgentMarkup, runtime WebMCPify (giữ thông báo MIT), fixture Chrome Labs, CI đa nền tảng. Không mặc định đây là bản GitHub Release riêng.

## Chưa phát hành

Tài liệu song ngữ, banner và điều hướng. Không thay đổi runtime bản Alpha đã gắn tag.

- Nhánh thử nghiệm V0.4 Scanner chỉ chạy cục bộ, chưa phát hành. Xem [trạng thái QA](SCANNER_PREVIEW.md).
