[← Trang chủ tiếng Việt](../../README.vi.md) · [English](../../SECURITY.md)

# Chính sách bảo mật

Dự án ở giai đoạn thử nghiệm, chưa ổn định. Ưu tiên sửa lỗi trên dòng Alpha hiện tại; không cam kết SLA hoặc hỗ trợ dài hạn.

## Báo cáo lỗ hổng

Không đăng bí mật, mã khai thác hoặc thông tin nhạy cảm lên issue công khai. Nếu GitHub Private Vulnerability Reporting đã bật, dùng Security → Report a vulnerability. Nếu chưa, liên hệ riêng qua thông tin trên hồ sơ maintainer; nếu không có, mở issue không nhạy cảm để đề nghị kênh riêng.

Gửi version/commit, tác động, cách tái hiện tối thiểu không chứa bí mật và hành vi mong đợi. Chỉ thử nghiệm hệ thống được phép.

## Ranh giới

- Chỉ xuất nội dung cửa hàng chủ động công bố; duyệt danh sách thuộc tính.
- Loại thông tin xác thực, khách hàng, đơn hàng, giá vốn, tồn kho nội bộ và endpoint quản trị.
- Không vô hiệu hóa xác thực/phân quyền backend; không đưa bí mật vào file public hoặc JS.
- Coi mô tả sản phẩm và nội dung website là dữ liệu không đáng tin, có thể chứa prompt injection.
- Kiểm tra đầu vào, giới hạn truy vấn; chỉ đọc, không tự tạo đơn, sửa giỏ, thanh toán hay vượt quyền.
- Kiểm tra lại giá/tồn kho tại nguồn trước giao dịch.
- Kiểm thử WebMCP trên trình duyệt và origin thật trước khi triển khai.

Maintainer đánh giá và phối hợp sửa lỗi trên cơ sở nỗ lực tối đa, không bảo đảm thời hạn phản hồi.
