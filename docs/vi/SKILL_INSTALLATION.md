# AgentReady B2A — Cài đặt Agent Skill Đa Nền Tảng & Ma Trận Tương Thích

AgentReady B2A cung cấp **Agent Skill tự chứa, độc lập** (`skills/agentready/`) tuân thủ [đặc tả mở Agent Skills](https://agentskills.io/specification) và có thể cài đặt bằng [Vercel Skills CLI](https://github.com/vercel-labs/skills).

- **Định danh Skill:** `agentready`
- **Yêu cầu runtime:** Node.js 20+ (không phụ thuộc thư viện ngoài, không yêu cầu MCP server hay dịch vụ chạy nền)
- **Ranh giới bảo mật:** Chỉ đọc dữ liệu công khai (không truy cập cơ sở dữ liệu nội bộ, dữ liệu khách hàng, giỏ hàng hay thanh toán)

## 1. Cài đặt bằng một lệnh (Windows, Linux, macOS)

Cài đặt toàn cục cho các coding agent tương thích thông qua [Vercel Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g
```

### Cài riêng cho từng agent hoặc theo dự án

```bash
# Cài toàn cục cho từng agent cụ thể
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g -a codex
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g -a claude-code
npx skills add cuonghuhuu/agentready_B2A --skill agentready -g -a antigravity

# Chỉ cài trong repository hiện tại (phạm vi dự án)
npx skills add cuonghuhuu/agentready_B2A --skill agentready
```

### Cài đặt ngoại tuyến dự phòng trên Windows PowerShell (Codex)

Nếu bạn đã clone repository về máy và không dùng `npx`:

```powershell
.\install-codex.ps1
```

## 2. Kích hoạt Skill

Khởi động lại coding agent nếu cần (hoặc chạy `/skills reload` trong Antigravity CLI), mở repository website thương mại điện tử của bạn và kích hoạt:

- **OpenAI Codex CLI** ([tài liệu chính thức](https://developers.openai.com/codex/skills)): nhập `$agentready` hoặc chọn qua `/skills`.
- **Anthropic Claude Code** ([tài liệu chính thức](https://code.claude.com/docs/en/skills)): nhập `/agentready` (xem danh sách bằng `/skills`).
- **Google Antigravity CLI (`agy`)** ([tài liệu chính thức](https://antigravity.google/docs/skills/)): nhập `/agentready` (xem danh sách bằng `/skills`, tải lại bằng `/skills reload`).
- **Kích hoạt tự động:** Các agent tương thích cũng có thể tự chọn `agentready` khi yêu cầu của bạn liên quan đến việc sinh `llms.txt`, `catalog.json`, Schema.org JSON-LD hoặc công cụ WebMCP chỉ đọc cho website thương mại điện tử.

## 3. Cập nhật & Gỡ cài đặt

```bash
# Kiểm tra và cập nhật
npx skills check
npx skills update

# Gỡ cài đặt toàn cục
npx skills remove agentready -g

# Gỡ cài đặt phạm vi dự án
npx skills remove agentready
```

## 4. Ma trận tương thích

> **Lưu ý kiểm chứng trung thực:** Các đường dẫn khám phá và lệnh kích hoạt dưới đây đã được đối chiếu với tài liệu chính thức của từng nhà cung cấp. Bộ kiểm thử tự động trong repository kiểm chứng chuẩn `SKILL.md`, chạy độc lập 5 lệnh (`inspect`, `init`, `import`, `generate`, `verify`) với đường dẫn chứa khoảng trắng/ký tự tiếng Việt và **mô phỏng** cấu trúc thư mục cài đặt. **Chưa chạy thực tế bên trong các binary Codex CLI, Claude Code, Antigravity CLI và chưa chạy `npx skills add` qua mạng trong môi trường sandbox ngoại tuyến này.**

| Agent | Thư mục phạm vi dự án | Thư mục toàn cục (Global) | Lệnh kích hoạt | Tài liệu chính thức | Trạng thái kiểm chứng |
| --- | --- | --- | --- | --- | --- |
| **OpenAI Codex CLI** | `$CWD/.agents/skills/agentready/` tới `$REPO_ROOT/.agents/skills/agentready/` | `$HOME/.agents/skills/agentready/` (Admin: `/etc/codex/skills/`) | `$agentready` hoặc `/skills` | [OpenAI Codex Skills](https://developers.openai.com/codex/skills) | **Đã kiểm thử mô phỏng thư mục + CLI độc lập**; chưa chạy Codex thật trong sandbox |
| **Anthropic Claude Code** | `.claude/skills/agentready/` | `~/.claude/skills/agentready/` | `/agentready` | [Claude Code Skills](https://code.claude.com/docs/en/skills) | **Đã kiểm thử mô phỏng thư mục + CLI độc lập**; chưa chạy Claude Code thật trong sandbox |
| **Google Antigravity CLI (`agy`)** | `<workspace-root>/.agents/skills/agentready/` (hỗ trợ cả `.agent/skills/`) | `~/.gemini/config/skills/agentready/` (CLI còn đọc `~/.gemini/antigravity-cli/skills/` & `~/.gemini/skills/`) | `/agentready` (`/skills`, `/skills reload`) | [Antigravity Skills](https://antigravity.google/docs/skills/) · [Customization Discovery](https://antigravity.google/docs/customization-discovery/) | **Đã kiểm thử mô phỏng thư mục + CLI độc lập**; chưa chạy Antigravity CLI thật trong sandbox |
| **Các client Agent Skills khác** | Theo [đặc tả Agent Skills](https://agentskills.io/specification) | Theo từng client / [Vercel Skills CLI](https://github.com/vercel-labs/skills) | Tùy client | [agentskills.io/specification](https://agentskills.io/specification) | **Đạt kiểm tra chuẩn `SKILL.md` & gói tự chứa**; chưa kiểm thử thực tế từng client |

## 5. Đóng gói tái lập & kiểm tra lệch phiên bản trong CI

Không chỉnh sửa thủ công các file runtime trong `skills/agentready/scripts/`. Sau khi thay đổi mã nguồn chuẩn tại `bin/`, `src/`, `LICENSE`, `THIRD_PARTY_NOTICES.md` hoặc `docs/COMMERCE_VARIANTS.md`, chạy:

```bash
npm run skill:package
npm run skill:check
```

CI GitHub Actions chạy `npm run skill:check` trên Linux, Windows và macOS (Node.js 20 và 22) để phát hiện file đóng gói bị cũ hoặc lệch so với mã nguồn chuẩn.
