[← Trang chủ tiếng Việt](../../README.vi.md) · [English](../../TEST_REPORT.md)

# Báo cáo kiểm thử — AgentReady B2A v0.3.0-alpha.1

Ngày xác minh: 24/11/2026. Bản tiếng Việt tóm lược [bằng chứng gốc](../../TEST_REPORT.md).

| Mốc | Kết quả |
| --- | --- |
| Gemini, Node.js 18.20.4 | 15/15 adapter; toàn bộ 27/29, hai lỗi ESM ở runtime không hỗ trợ |
| Kiểm thử độc lập Linux Node.js 22.16.0 | 29/29; demo, verify, npm pack --dry-run đạt |
| Release Candidate (commit 271936ad) | Thêm 2 regression test; [CI 4/4](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45351442675) |
| Nhánh V0.3 sau PR #4 | [CI 4/4](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45351577333) |
| Main bản Alpha (51229937) | [CI 4/4](https://github.com/cuonghuhuu/agentready_B2A/actions/runs/45351681140) |

CI chạy `npm test`, `npm run demo`, `npm run verify:demo` trên Windows/Linux, Node.js 20/22. Tổng 31 test trong Release Candidate. Hai test mới bảo vệ dữ liệu nguồn và file cấu hình khỏi ghi đè.

## Phạm vi hồi quy

Bằng chứng công khai biến thể; danh sách thuộc tính cho phép; nhãn biến thể không sao chép tùy chọn bị loại; tìm kiếm tránh lẫn thuộc tính/mô tả của biến thể khác; giá và tồn kho cùng offer; JSON-LD loại bản ghi và container riêng tư; tiền tệ WooCommerce; đường dẫn, symlink, nguồn/đích; tương thích catalog phẳng.

## Chưa xác minh

Build storefront thật với AgentMarkup, WebMCP trên trình duyệt thật, API live, đồng bộ giá/tồn kho và khám phá bởi agent bên ngoài. Không kiểm thử giao dịch vì ngoài phạm vi. Test snapshot và mock không thay thế đánh giá triển khai production.
