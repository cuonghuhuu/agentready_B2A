[← Trang chủ tiếng Việt](../../README.vi.md) · [English](../../CONTRIBUTING.md)

# Hướng dẫn đóng góp

Đọc [kiến trúc](ARCHITECTURE.md), [bảo mật](SECURITY.md) và [thông báo bên thứ ba](../../THIRD_PARTY_NOTICES.md). Mở issue trước khi mở rộng lớn. Giữ thay đổi nhỏ, tránh refactor hoặc sửa checkout không liên quan.

```bash
git clone https://github.com/cuonghuhuu/agentready_B2A.git
cd agentready_B2A
npm test
npm run demo
npm run verify:demo
```

Yêu cầu Node.js 20+. Tạo fork hoặc feature branch; triển khai một thay đổi có regression test và tài liệu; chạy kiểm thử; mở PR mô tả kết quả, rủi ro và rollback. Không commit bí mật, dataset độc quyền, dữ liệu khách hàng/đơn hàng. Giữ tương thích khi khả thi, giải thích thay đổi schema/CLI.

Ưu tiên dependency và adapter có ranh giới rõ ràng. Kiểm tra giấy phép bên thứ ba và giữ thông báo bản quyền. Cập nhật cả tài liệu Anh–Việt khi nội dung thay đổi.

Dùng GitHub Issues cho lỗi thông thường; không công bố chi tiết lỗ hổng khai thác được. Ghi rõ test nào thực chạy, mock hay browser thật. Không diễn giải CI xanh thành tương thích toàn bộ nền tảng.
