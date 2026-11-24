[English](../SCANNER_PREVIEW.md) · [Trang chủ](../../README.vi.md)

# V0.4 Scanner — bản phát triển thử nghiệm

Tạm dừng phát triển sau pilot cục bộ; chưa đủ điều kiện phát hành. Giữ nguyên tag v0.3.0-alpha.1.

## Minh chứng ngày 24/11/2026

- Gemini chạy Node.js 18 (ngoài yêu cầu runtime): 47/49 test, hai lỗi ESM cũ.
- Kiểm thử độc lập ZIP trên Linux Node.js 22.16.0: 49/49 test, demo và verify đạt. CI nhánh tích hợp cần xác minh riêng.
- Người dùng đã thử quét Thế Giới Di Động, Nike, GitHub, example.com; ảnh xác nhận giao diện trả kết quả. Chưa kiểm chứng độc lập qua Internet và chưa có báo cáo JSON từng tiêu chí.
- Điểm AI Readiness phiên bản 1.0.0 là phương pháp riêng, không phải chứng nhận ngành.

| Mã | Lỗi còn tồn tại |
| --- | --- |
| SCAN-001 | Thực thi robots.txt trên mọi request và redirect |
| SCAN-002 | Deadline tuyệt đối và hủy request |
| SCAN-003 | Kiểm tra ngữ nghĩa catalog/manifest |
| SCAN-004 | Phân biệt tín hiệu WebMCP với runtime đã xác minh |
| SCAN-005 | Kiểm tra ngữ nghĩa offer JSON-LD |

Cần rà soát Host/Origin API cục bộ, ngân sách request, độ bao phủ kiểm chứng, chuẩn hóa điểm, Việt hóa kết quả, mẫu trang sản phẩm và WebMCP trình duyệt thật. Chỉ chạy trên loopback; không public API qua tunnel/ngrok hay reverse proxy. Tôn trọng chính sách website.

Khi tiếp tục: viết regression test, sửa các lỗi trên, chạy CI Node 20/22 Windows/Linux và đánh giá bảo mật trước khi phát hành. Không đổi phạm vi đọc dữ liệu công khai hoặc tag V0.3.
