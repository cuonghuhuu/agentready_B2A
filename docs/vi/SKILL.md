[← Trang chủ tiếng Việt](../../README.vi.md) · [English](../../skills/agentready/SKILL.md)

# Hướng dẫn Agent Skill `agentready`

Bản dịch tham khảo cho người dùng. File cài đặt chính thức vẫn là [SKILL.md](../../skills/agentready/SKILL.md); không đổi skill ID, frontmatter hoặc runtime. Yêu cầu Node.js 20+, repository website có dữ liệu công khai xuất được JSON.

## Quy trình

1. Kiểm tra framework, dữ liệu công khai, test, file đã sinh và thông tin cửa hàng thật; không đoán sản phẩm, giá hay tồn kho.
2. Chỉ khởi tạo file thiếu: `node <skill>/bin/agentready.mjs init --project <target> --site-name "Store" --site-url https://store.example`.
3. Ánh xạ dữ liệu công khai vào `data/agentready-products.json` hoặc dùng `node <skill>/bin/agentready.mjs import --project <target> --source <relative-export.json>` cùng tùy chọn format, currency, trusted-public-source và allow-attributes. Chỉ dùng cờ xác nhận nguồn hoặc tùy chỉnh thuộc tính khi đã duyệt. Chỉ dùng force khi chấp thuận ghi đè. Xem [quy tắc nguồn](ARCHITECTURE.md). Biến thể cần bằng chứng công khai riêng; không suy từ cha hoặc tồn kho.
4. Sinh đầu ra bằng `node <skill>/bin/agentready.mjs generate --project <target>`. Rà soát chính xác file cần thay trước khi force.
5. Next.js có helper AgentMarkup tùy chọn; xác định ownership và build order của llms.txt; không tự nhúng JSON-LD vào trang động.
6. WebMCP tùy chọn tải ES module đã sinh. Chỉ tìm kiếm/tra cứu snapshot. Kiểm thử trình duyệt thật; có thể dùng WebMCPify cho kiểm kê route với manifest phê duyệt.
7. Chạy `node <skill>/bin/agentready.mjs verify --project <target>` và test/build của website. Không nhầm nhất quán file với deploy, live inventory hoặc tương thích trình duyệt.
8. Tham khảo [upstream](../../skills/agentready/references/UPSTREAM.md) và fixture Chrome Labs; báo đúng các test thực hiện.
9. Bàn giao file thay đổi, test/build, endpoint sinh và giới hạn.

Không xuất bí mật, dữ liệu khách hàng, giá vốn, tồn kho riêng tư; không mở endpoint thiếu xác thực, không bypass, không tự thay đổi checkout/cart/payment/account. Duy trì kiến trúc website và phần việc không liên quan. Render JSON-LD trang chi tiết từ cùng nguồn server-side với UI, serialization an toàn, tránh trùng schema.
