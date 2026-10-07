# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
## DỰ ÁN: NỀN TẢNG KỲ BIỂN (KYBIEN.BLOGSPOT.COM HYBRID CHESS PLATFORM)

### 1. GIỚI THIỆU TỔNG QUAN (INTRODUCTION)
#### 1.1. Mục đích
Tài liệu quy định kiến trúc kỹ thuật, yêu cầu chức năng và phi chức năng cho hệ thống Web Game cờ tương tác kết hợp nền tảng Blog tự động hóa nội dung tại kybien.blogspot.com.

#### 1.2. Mục tiêu hệ thống
* **Tối ưu hóa 100% SEO trên Blogger**: Không dùng iframe nhúng toàn trang; toàn bộ giao diện, DOM ngữ nghĩa và bài viết text nằm trực tiếp trên Blogger.
* **Tách biệt Frontend/Backend**: Render chỉ đảm nhiệm API tính toán, xác thực, quản lý ván cờ, cơ sở dữ liệu và tích hợp AI.
* **Tự động hóa nội dung (Content Automation Pipeline)**: Tự động lọc ván cờ đặc sắc, gọi Gemini AI phân tích chuyên môn và sáng tác bài văn sa trường, sau đó xuất bản tự động qua Blogger API v3.
* **Sử dụng Google Antigravity** làm nền tảng agentic coding để triển khai mã nguồn end-to-end.

#### 1.3. Ngăn xếp công nghệ (Technology Stack)
* **Frontend / Host CMS**: Blogger (kybien.blogspot.com), Vanilla JS, CSS3, Semantic HTML5, Canvas/SVG.
* **Agentic Dev Workspace**: Google Antigravity (IDE, Agents, Git Integration).
* **VCS & CI/CD**: GitHub Repository.
* **Backend Runtime**: Node.js (Express, Socket.io, TypeScript).
* **Database**: Render Managed PostgreSQL (Lưu trữ User, Elo, Exp, Match Logs).
* **AI Engine**: Google Gemini API (gemini-2.5-flash).
* **CMS Automation**: Google Blogger API v3.
* **Uptime Monitoring**: UptimeRobot (HTTP ping mỗi 5 phút).

---

### 2. KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)
```
      [Người dùng / Khách truy cập]
                    │
                    ▼ (HTTPS)
      ┌─────────────────────────────────┐
      │  Blogger (kybien.blogspot.com)  │
      │  - Giao diện bàn cờ Native      │
      │  - Bài viết phân tích chuẩn SEO  │
      │  - Local JS quản lý bàn cờ      │
      └───────┬─────────────────▲───────┘
              │                 │ (Tự động đăng bài qua Blogger API)
 (REST / WSS) │                 │
              ▼                 │
      ┌─────────────────────────┴───────┐
      │       Render Web Service        │
      │  - Auth (JWT) & Exp/Level       │
      │  - Matchmaking & Socket Hub     │
      │  - Pipeline AI Analysis         │
      └───┬──────────────┬──────────────┘
          │              │
          ▼              ▼
   [Render Postgres]   [Gemini API: gemini-2.5-flash]
```

---

### 3. ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

#### 3.1. Phân hệ Người dùng & Cấp bậc (User, Exp & Level)
* **FR-01: Đăng ký / Đăng nhập**:
  * Hỗ trợ đăng ký tài khoản (Username, Email, Hash Password) và Đăng nhập nhận JWT Token.
  * Lưu token an toàn tại `localStorage` trên trình duyệt Blogspot.
* **FR-02: Header Profile Widget (Blogspot)**:
  * Đọc JWT từ `localStorage`; nếu hợp lệ, hiển thị Avatar, Tên, Cấp bậc (Lv), Điểm kinh nghiệm (Exp) dạng thanh tiến trình (progress bar), và Điểm Elo.
* **FR-03: Cơ chế tính điểm Exp/Elo**:
  * Tính toán sau mỗi ván đấu:
    * **Thắng**: $+50$ Exp, $+15$ Elo.
    * **Thua**: $+10$ Exp, $-12$ Elo.
    * **Hòa**: $+25$ Exp, $+1$ hoặc $-1$ Elo tùy tương quan đối thủ.
  * Công thức thăng cấp: $\text{Exp cần lên cấp} = 100 \times (\text{Level})^{1.5}$.

#### 3.2. Phân hệ Phòng đấu & Ghép trận (Lobby & Matchmaking)
* **FR-04: Ghép phòng nhanh (Quick Match)**:
  * Gửi request vào hàng đợi trên server Render qua WebSocket.
  * Server tìm đối thủ có Rank/Elo xấp xỉ ($\pm 100$ điểm Elo hoặc $\pm 2$ Level) trong thời gian quy định; nếu không có, mở rộng biên độ tìm kiếm.
* **FR-05: Đấu cờ thời gian thực**:
  * Bàn cờ SVG/Canvas vẽ trên Blogspot nhận input nước đi.
  * Đồng bộ nước đi hai chiều qua WebSocket với độ trễ tối thiểu.
  * Xác thực tính hợp lệ của nước đi (Rule Engine) trên cả Client và Server.

#### 3.3. Phân hệ Tự động Đánh thức (Silent Wake-up)
* **FR-06: Khởi động ngầm Render**:
  * Ngay khi `DOMContentLoaded` trên Blogspot, kích hoạt script gửi ngầm lệnh `GET /ping` đến Render với chế độ `no-cors` để loại bỏ độ trễ cold boot trước khi người dùng thực hiện các thao tác cần máy chủ.

#### 3.4. Phân hệ Pipeline Phân tích AI & Tự động Đăng bài
* **FR-07: Bộ lọc ván đấu đặc sắc**:
  * Chỉ kích hoạt khi ván đấu thỏa mãn:
    * Tổng số nước đi $\ge 30$ hiệp.
    * Có ít nhất 1 lần lật ngược thế cờ (Score swing) hoặc có nước cờ đột biến.
    * Kết thúc bằng Chiếu bí (Checkmate) hoặc cờ tàn giằng co.
* **FR-08: Phân tích chuyên môn (Gemini 2.5 Flash)**:
  * Trích xuất các nước cờ then chốt (Key Moves), phân tích lý do điều quân, mưu đồ chiến thuật, sai lầm (Blunder) và biến thể thay thế khả dĩ.
* **FR-09: Sáng tác Bình văn Sa trường**:
  * Yêu cầu AI viết bài luận văn học ở cuối ván: Tường thuật lại ván cờ với phong cách sa trường, binh pháp, hào hùng như một trận đánh giữa hai đạo quân.
* **FR-10: Lắp ráp HTML & Tự động xuất bản**:
  * Ghép cấu trúc JSON nước đi vào template Bàn cờ Viewer (HTML/CSS/JS nhúng có các nút: `[Về đầu]`, `[◀ Lùi]`, `[Tiến ▶]`, `[Về cuối]`).
  * Gửi payload qua Blogger API v3 để tạo bài viết mới tự động với nhãn (Labels): *Phân Tích Cờ*, *Đại Chiến Kỳ Biển*.

---

### 4. ĐẶC TẢ GIAO DIỆN BLOGGER (UI/UX SPECIFICATION)
#### 4.1. Kiến trúc trang trên Blogger
* **Trang chủ (`/`)**: Tạp chí tin tức, bài viết phân tích cờ chuẩn SEO, bảng xếp hạng Top Elo, CTA nút bấm vào sàn đấu.
* **Trang Sảnh Đấu (`/p/arena.html`)**: Sử dụng trang tĩnh (Static Page) của Blogger, tải script kết nối Socket.io, hiển thị nút Ghép phòng, Tạo phòng và Bàn cờ chiến đấu.
* **Trang Chi tiết Bài viết (`/yyyy/mm/slug.html`)**:
  * Khung trên: Bàn cờ tương tác (Interactive Viewer) với bộ điều khiển `[<]` `[>]`.
  * Khung giữa: Lời bình nước đi tương ứng theo bước nhảy của bàn cờ.
  * Khung dưới: Bài viết ký sự chiến trận chuẩn Semantic HTML (`<article>`, `<h2>`, `<p>`).

---

### 5. MÔ HÌNH DỮ LIỆU CỐT LÕI (DATABASE SCHEMA - POSTGRESQL)
```sql
-- Bảng Người dùng
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

-- Bảng Lịch sử Ván đấu
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

### 6. PHÂN CÔNG TÁC VỤ CHO GOOGLE ANTIGRAVITY AGENT
* **Pha 1 (Backend Core & Database)**:
  * Dựng cấu trúc project Node.js Express với TypeScript & Socket.io.
  * Viết các router Auth (JWT), Database migration với PostgreSQL trên Render (Prisma / SQL).
  * Thiết lập module WebSocket phục vụ Matchmaking và di chuyển quân cờ.
  * Thêm endpoint `/ping` phục vụ Silent Wake-up & UptimeRobot.
* **Pha 2 (AI Engine & Blogger Automation)**:
  * Tích hợp Gemini API (`@google/genai`) sử dụng model `gemini-2.5-flash`.
  * Cấu hình Prompt chuyên sâu cho Kỳ đạo và Bình thuật sa trường.
  * Viết service kết nối Blogger API v3 để tự động build HTML template và POST bài.
* **Pha 3 (Frontend Scripts & Template Blogger)**:
  * Tạo mã nguồn JavaScript client: `kybien-client.js` để nhúng vào Blogspot.
  * Tạo component Bàn cờ tương tác (Viewer) có cơ chế lắng nghe nút Tiến/Lùi và đồng bộ text phân tích.
  * Thêm cơ chế Ping ngầm đánh thức server Render (Silent Wake-up).
