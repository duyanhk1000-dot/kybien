# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS) & TIẾN ĐỘ DỰ ÁN
## DỰ ÁN: NỀN TẢNG KỲ BIẾN (KYBIEN.BLOGSPOT.COM HYBRID CHESS PLATFORM)
*Cập nhật gần nhất: Tháng 10/2026*

---

### 1. GIỚI THIỆU TỔNG QUAN (INTRODUCTION)
#### 1.1. Mục đích
Tài liệu quy định kiến trúc kỹ thuật, yêu cầu chức năng, phi chức năng và **báo cáo tiến độ hoàn thành thực tế** cho hệ thống Web Game cờ tương tác kết hợp nền tảng Blog tự động hóa nội dung tại `kybien.blogspot.com`.

#### 1.2. Mục tiêu hệ thống
* **Tối ưu hóa 100% SEO trên Blogger**: Không dùng iframe nhúng toàn trang; toàn bộ giao diện, DOM ngữ nghĩa và bài viết text nằm trực tiếp trên Blogger.
* **Tách biệt Trang Chủ & Trang Thư viện Bài viết**: Phân tách giao diện Trang chủ (`pageType == index` không nhãn) với Thư viện Bình Văn Sa Trường (`pageType == index` có `searchLabel`).
* **Hỗ trợ 4 Thể loại Cờ**: Cờ Bí Pháp Kiếm Hiệp (`kb`), Cờ Tướng Truyền Thống (`n`), Cờ Úp Truyền Thống (`t`), Cờ Úp Gián Điệp (`g`).
* **Tách biệt Frontend/Backend**: Render Web Service đảm nhiệm REST API, Socket.io WebSocket real-time, xác thực JWT, cơ sở dữ liệu PostgreSQL và tích hợp Gemini AI Engine.
* **Tự động hóa xuất bản Ký sự Sa trường (AI Content Pipeline)**: Tự động lọc ván cờ đặc sắc ($\ge 50$ nước), giả lập bàn cờ 10x9 để biên dịch log nước đi sang ngôn ngữ tự nhiên (Human-Readable PGN), gọi Gemini AI phân tích sa trường và xuất bản tự động qua Blogger API v3.
* **Chống Race Condition trên Blogger**: Hệ thống lắng nghe và tự động chờ các khối HTML Gadgets trên Blogger (`waitForElem`) trước khi render widget Hồ sơ, Top ELO và Phòng chờ trực tiếp.

#### 1.3. Ngăn xếp công nghệ (Technology Stack)
* **Frontend / Host CMS**: Blogger (`kybien.blogspot.com`), Vanilla JS, CSS3, Semantic HTML5, HTML5 Canvas.
* **Agentic Dev Workspace**: Google Antigravity (IDE, Agents, Git Integration).
* **VCS & CI/CD**: GitHub Repository (`duyanhk1000-dot/kybien`).
* **Backend Runtime**: Node.js, Express.js, Socket.io, TypeScript (`tsc`).
* **Database**: Render Managed PostgreSQL (Prisma ORM, lưu trữ User, Elo, Exp, Match Logs).
* **AI Engine**: Google Gemini API (`gemini-2.5-flash` / `@google/generative-ai`).
* **CMS Automation**: Google Blogger API v3 (Google APIs client).
* **CDNs**: jsDelivr (`v=2.8.0`), Socket.io CDN (`4.8.1`).

---

### 2. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)
```
      [Người dùng / Khách truy cập]
                    │
                    ▼ (HTTPS)
      ┌─────────────────────────────────┐
      │  Blogger (kybien.blogspot.com)  │
      │  - Giao diện bàn cờ Canvas      │
      │  - Bài viết phân tích chuẩn SEO  │
      │  - Script kybien-client.js v2.8 │
      └───────┬─────────────────▲───────┘
              │                 │ (Tự động đăng bài qua Blogger API v3)
 (REST / WSS) │                 │
              ▼                 │
      ┌─────────────────────────┴───────┐
      │       Render Web Service        │
      │  - Auth (JWT) & Exp/Level       │
      │  - Matchmaking & Socket Hub     │
      │  - Human-Readable PGN Compiler  │
      │  - Pipeline AI Analysis         │
      └───┬──────────────┬──────────────┘
          │              │
          ▼              ▼
   [Render Postgres]   [Gemini API: gemini-2.5-flash]
```

---

### 3. ĐẶC TẢ YÊU CẦU CHỨC NĂNG VÀ TRẠNG THÁI THỰC THI

#### 3.1. Phân hệ Người dùng & Cấp bậc (User, Exp & Level)
* **FR-01: Đăng ký / Đăng nhập (Hoàn thành 100%)**:
  * Đăng ký tài khoản (Username, Email, Hash Password với bcrypt) và Đăng nhập nhận JWT Token.
  * Tự động khởi tạo tài khoản Khách ngầm (`KyThu_XXXXX`) nếu chưa đăng nhập để tích lũy ELO/Exp.
  * Lưu token an toàn tại `localStorage.kybien_jwt_token`.
* **FR-02: Header Profile Widget & Profile Card (Hoàn thành 100%)**:
  * Đọc JWT từ `localStorage`; tự động hiển thị Avatar, Username, Cấp bậc (Lv), Thanh tiến trình Exp (%) và Điểm Elo.
  * Danh xưng người chơi được chuẩn hóa: `[Chiến Tướng.<username>]` đối với tài khoản đăng nhập, `[Hành Giả.Vô Danh]` / `[Lữ Nhân.Vô Danh]` đối với khách, và `[Địa Ngục Vương]` đối với máy.
* **FR-03: Cơ chế tính điểm Exp/Elo (Hoàn thành 100%)**:
  * **Thắng**: $+50$ Exp, $+15$ Elo.
  * **Thua**: $+10$ Exp, $-12$ Elo.
  * **Hòa**: $+25$ Exp, $\pm 1$ Elo.
  * Công thức thăng cấp: $\text{Exp cần lên cấp} = 100 \times (\text{Level})^{1.5}$.

#### 3.2. Phân hệ Phòng đấu & Ghép trận (Lobby & Matchmaking)
* **FR-04: Ghép phòng nhanh (Quick Match) & Phòng Riêng (Hoàn thành 100%)**:
  * Tạo phòng chơi công khai / riêng tư kèm mã phòng (ví dụ `KB-8899`).
  * Gửi request vào hàng đợi trên server Render qua Socket.io.
  * Độc quyền 1 phòng chờ duy nhất cho mỗi người chơi (`cancelAllWaitingRoomsOfUser`).
  * Hỗ trợ thời gian gia hạn 20 giây (grace period) giữ phòng khi ngắt kết nối tạm thời.
  * Tự động chuyển hướng sang sảnh đấu (`/p/arena.html`) khi ghép thành công (`match_found`).
* **FR-05: Đấu cờ thời gian thực & 4 Thể loại cờ (Hoàn thành 100%)**:
  * Canvas 2D/3D vẽ bàn cờ native trên Blogspot.
  * Hỗ trợ 4 Thể loại: Cờ Bí Pháp (`kb`), Cờ Truyền Thống (`n`), Cờ Úp (`t`), Cờ Gián Điệp (`g`).
  * Đồng bộ nước đi hai chiều qua WebSocket, xác thực tính hợp lệ của nước đi (Rule Engine) trên cả Client và Server.

#### 3.3. Phân hệ Tự động Đánh thức (Silent Wake-up) & Chống Race Condition
* **FR-06: Khởi động ngầm Render (Hoàn thành 100%)**:
  * Ngay khi nạp trang, kích hoạt script gửi ngầm `GET /ping` đến Render với chế độ `no-cors` để loại bỏ độ trễ cold boot.
* **FR-07: Chống Race Condition Blogger Gadgets (Hoàn thành 100%)**:
  * Bổ sung cơ chế `waitForElem` tự động lắng nghe và thử lại (lên đến 20 lần x 250ms) cho các khối HTML Gadgets trên Blogger (`initHeaderProfileWidget`, `initUserProfileSection`, `initTopEloLeaderboard`, `initLiveRoomsWidget`).
  * Khóa chống gọi trùng `KybienViewer._inited` để loại bỏ việc khởi tạo lại viewer 6 lần.

#### 3.4. Phân hệ Pipeline Phân tích AI & Tự động Đăng bài
* **FR-08: Tự động Đăng bài ván cờ đặc sắc (Hoàn thành 100%)**:
  * Khi ván cờ kết thúc có số nước đi $\ge 50$, hệ thống tự động kích hoạt tiến trình biên soạn bài viết mà không cần nút bấm thủ công.
  * Cập nhật trạng thái động trong modal Game Over: `📜 TRẬN HAY ĐỦ X NƯỚC!` ➔ `⏳ Đang tự động biên soạn & xuất bản...` ➔ `🎉 Đã tự động xuất bản bài viết Trận Hay thành công lên Blogger!`.
* **FR-09: Biên dịch PGN Ngôn Ngữ Tự Nhiên (Human-Readable PGN) (Hoàn thành 100%)**:
  * Giả lập bàn cờ 10x9 trong backend (`aiService.ts`), dịch tọa độ thô thành văn bản chi tiết:
    * `Nước 12 (🔴 Đỏ - [Chiến Tướng.duy]): [Xe Đỏ] từ (9,0) tiến đến (9,1) ăn [Mã Đen]!`
    * `✨ [KÍCH HOẠT BÍ PHÁP] (🔴 Đỏ - [Chiến Tướng.duy]): Thi triển Thiểm Điện Trảm...`
    * `🕵️ [LẬT QUÂN ÚP] (⚫ Đen - [Địa Ngục Vương]): Lật ngửa quân Úp tại (2,1) -> Lộ diện đại tướng [Pháo Đen]!`
    * `☠️ [KÍCH ĐỘC BÙNG PHÁP]: [Xe Đen] dính độc Tuyệt Mệnh Cổ phát tác, lập tức đồng thọ tử bị loại khỏi bàn cờ!`
* **FR-10: Xử lý Độc Tuyệt Mệnh Cổ trên Replay (Hoàn thành 100%)**:
  * Đẩy sự kiện `POISON_KILL:r,c` vào mảng `rec`. Trình xem ván cờ (`kybien-client.js`) tự động xóa quân ăn Mã độc khỏi bàn cờ Canvas khi xem lại.
* **FR-11: Phân tích chuyên môn & Sáng tạo Tiêu đề tự động (Gemini 2.5 Flash) (Hoàn thành 100%)**:
  * Tạo cụm tiêu đề phụ thần thái 3-6 từ (`matchTitlePhrase`), trích xuất nước cờ bước ngoặt (`keyMoves`), phân tích chiến thuật (`tacticalAnalysis`) và bài văn sa trường kiếm hiệp (`saTruongCommentary`).
* **FR-12: Xuất bản tự động qua Blogger API v3 (Hoàn thành 100%)**:
  * Gửi payload HTML nhúng `data-moves` và `data-variant` trực tiếp vào bài viết trên Blogger với nhãn (Labels) chuẩn hóa: *✨ Cờ Bí Pháp*, *🏯 Cờ Truyền Thống*, *🎴 Cờ Úp Truyền Thống*, *🕵️ Cờ Úp Gián Điệp*.

---

### 4. ĐẶC TẢ GIAO DIỆN BLOGGER & TEMPLATE XML (UI/UX)
#### 4.1. Cấu trúc Template XML (`blogger-theme.xml`)
* **Trang chủ (`/`)**:
  * Hero Banner giới thiệu 4 thể loại cờ kèm nút bấm chơi ngay.
  * Bố cục 3 khối động: Hồ Sơ Kỳ Thủ (`kybien-user-profile-section`), Bảng Xếp Hạng Top ELO (`kybien-top-elo-section`), Phòng Đấu Trực Tiếp (`kybien-live-rooms-section`).
* **Trang Thư Viện Bình Văn Sa Trường (`/search/label/...`)**:
  * Bộ lọc phân loại ván cờ, thẻ ván cờ giàu thông tin (ảnh bàn cờ, hai kỳ thủ, Elo, kết quả, số nước).
* **Trang Sảnh Đấu (`/p/arena.html`)**:
  * Sảnh đấu cờ tương tác đầy đủ tính năng: Đấu máy AI Bot (5 cấp độ), Đấu 2 người local, Đấu Online Socket.io, Khay Bí Pháp 16 chiêu, Khay quân ăn Cờ Úp, Nhật ký nước đi.
* **Trang Bài Viết Ký Sự (`/yyyy/mm/slug.html`)**:
  * Khung bàn cờ xem lại tương tác Canvas (`kybien-board-viewer`) kèm các nút `[Về đầu]`, `[◀ Lùi]`, `[Tiến ▶]`, `[Về cuối]`.
  * Nội dung bài luận sa trường kiếm hiệp sinh bởi Gemini AI.

---

### 5. MÔ HÌNH DỮ LIỆU CỐT LÕI (DATABASE SCHEMA - POSTGRESQL)
```sql
-- Bảng Người dùng (users)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    elo INT DEFAULT 1200,
    exp BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    matches_played INT DEFAULT 0,
    matches_won INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Lịch sử Ván đấu (matches)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_white_id INT REFERENCES users(id),
    player_black_id INT REFERENCES users(id),
    pgn_moves TEXT NOT NULL,
    result VARCHAR(10) NOT NULL, -- 'WHITE_WIN', 'BLACK_WIN', 'DRAW'
    is_featured BOOLEAN DEFAULT FALSE,
    blogger_post_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 6. BÁO CÁO TIẾN ĐỘ THỰC HIỆN VÀ TRẠNG THÁI HIỆN TẠI (PROJECT PROGRESS)

| Hạng mục / Chức năng | Trạng thái | Ghi chú kỹ thuật |
|---|---|---|
| **Backend REST API & Auth (JWT)** | ✅ **HOÀN THÀNH 100%** | Express, TypeScript, Prisma, PostgreSQL on Render |
| **Real-time Matchmaking & Socket.io** | ✅ **HOÀN THÀNH 100%** | Socket.io v4.8.1, quản lý phòng chờ, reconnect grace period 20s |
| **Bàn cờ Sảnh đấu (`/p/arena.html`)** | ✅ **HOÀN THÀNH 100%** | Canvas 2D/3D, 4 Thể loại cờ, 16 Bí Pháp, AI Pikafish engine |
| **Gemini AI Engine & Human PGN** | ✅ **HOÀN THÀNH 100%** | Model `gemini-2.5-flash`, bộ biên dịch PGN 10x9 tiếng Việt |
| **Tự động Xuất bản Blogger API v3** | ✅ **HOÀN THÀNH 100%** | Tự động đăng bài trận hay $\ge 50$ nước, gắn label theo thể loại cờ |
| **Blogger Theme XML (`v2.8.0`)** | ✅ **HOÀN THÀNH 100%** | Phân tách trang chủ/thư viện, chống trùng title/meta SEO |
| **Chống Race Condition & Optimization** | ✅ **HOÀN THÀNH 100%** | Cơ chế `waitForElem`, khóa `_inited` viewer, dọn dẹp duplicate Socket.io |
| **Trang xem nhanh (`index.html`)** | ✅ **HOÀN THÀNH 100%** | Standalone HTML5 preview đầy đủ giao diện Trang chủ & Thư viện |

---

*Tài liệu đặc tả SRS này đã được đồng bộ chính xác với toàn bộ mã nguồn trên GitHub repository `duyanhk1000-dot/kybien`.*
