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

## v0.3.0-alpha.2 — 24/11/2026

- Skill tự chứa, runtime độc lập, giấy phép và tài liệu tham chiếu.
- Đóng gói tái lập, CI kiểm tra đồng bộ; 35 test (31 cũ + 4 mới).
- PR #8 đạt 6/6 job Node 20/22 trên Windows/Linux/macOS.
- Hướng dẫn cài đặt song ngữ; chưa kiểm chứng cài qua mạng và kích hoạt agent thật.
- [Đã phát hành Alpha 2](https://github.com/cuonghuhuu/agentready_B2A/releases/tag/v0.3.0-alpha.2); giữ nguyên release Alpha 1 và nhánh Scanner V0.4.

[Ghi chú phát hành Alpha 2](../RELEASE_ALPHA2.md).
