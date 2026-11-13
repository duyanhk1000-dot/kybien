# THIẾT KẾ KIẾN TRÚC M4.3.1 — CHAT THẾ GIỚI & CHAT KHU VỰC
## Dự án: Tiên Lộ: Vạn Giới Tranh Phong & Kỳ Biến

**Tác giả:** Senior Backend Engineer & System Architect  
**Ngày lập:** 24/10/2026  
**Trạng thái:** Sẵn sàng triển khai thực tế  

---

## 1. KHẢO SÁT HIỆN TRẠNG KIẾN TRÚC

Qua khảo sát toàn diện mã nguồn repository `D:\Lap trinh game\ky_bien\`:

1. **HTTP Framework:**  
   Backend sử dụng **Express.js v4.21.1** bọc trong Node.js `http.createServer(app)` tại [`backend/src/server.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/server.ts).
2. **Thư viện Realtime (WebSocket):**  
   Dự án đã có sẵn thư viện **`socket.io` v4.8.1** trong [`backend/package.json`](file:///d:/Lap%20trinh%20game/ky_bien/backend/package.json). Hiện tại `server.ts` đã khởi tạo `const io = new Server(server, { cors: ... })` và phục vụ bàn cờ Kỳ Biến thông qua [`backend/src/socket/gameSocket.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/socket/gameSocket.ts).
3. **Cơ chế xác thực JWT:**  
   Hệ thống sử dụng `jsonwebtoken` với chữ ký `config.jwtSecret`. Hàm [`verifyToken(token)`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/utils/jwt.ts) giải mã payload `{ userId, username, email }`. Phía frontend lưu token tại `localStorage.getItem('kybien_jwt_token')`.
4. **Phân vùng địa lý & Bản đồ nhân vật:**  
   Bảng cơ sở dữ liệu `xianxia_characters` lưu giữ trường [`current_zone`](file:///d:/Lap%20trinh%20game/ky_bien/backend/prisma/schema.prisma#L218) (kiểu `VarChar(60)`, mặc định `"zone_thanh_ha_thon"`). Dữ liệu phân khu được quản lý bởi [`xianxiaWorldService`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaWorldService.ts).
5. **Khả năng duy trì kết nối lâu dài (Transport Fallback):**  
   Socket.IO hỗ trợ tự động đàm phán nâng cấp từ HTTP Long-Polling lên WebSocket thuần túy (`transports: ['websocket', 'polling']`). Nếu gặp hạ tầng proxy/firewall chặn kết nối WebSocket cố định, hệ thống tự động fallback về polling mà không làm gián đoạn trải nghiệm của người chơi.

---

## 2. QUYẾT ĐỊNH KIẾN TRÚC & PHẠM VI CÔ LẬP

### 2.1. Tách biệt Namespace `/xianxia-chat`
Để **tuyệt đối không làm ảnh hưởng** đến phân hệ bàn cờ Kỳ Biến (`gameSocket.ts` lắng nghe ở root namespace `/`), hệ thống chat Tiên Lộ được triển khai trên một Socket.IO Namespace chuyên biệt:
```text
io.of('/xianxia-chat')
```
- Tất cả logic bắt tay, xác thực nhân vật, kiểm soát quyền hạn, và xử lý room của Tiên Lộ diễn ra hoàn toàn độc lập bên trong namespace này.
- Phía frontend Tiên Lộ (`tien-lo.html`) chỉ kết nối tới `/xianxia-chat`, mang theo JWT token.

### 2.2. Mô hình Kênh và Quản lý Room
Hệ thống hỗ trợ 2 kênh chat cốt lõi cho mốc MVP M4.3.1:
1. **Kênh Thế Giới (`WORLD`):**
   - Socket Room: `xianxia:channel:world`
   - Tất cả người chơi tu tiên hợp lệ sau khi xác thực danh tính sẽ tự động tham gia (join) vào room này.
   - Tin nhắn phát sóng tới toàn bộ tu sĩ đang trực tuyến trên mọi cõi.
2. **Kênh Khu Vực (`ZONE`):**
   - Socket Room: `xianxia:zone:{zoneId}` (ví dụ: `xianxia:zone:zone_thanh_ha_thon`, `xianxia:zone:zone_van_tinh_hai`).
   - Server truy vấn vị trí thực tế `current_zone` của nhân vật từ cơ sở dữ liệu PostgreSQL.
   - Khi người chơi gửi tin vào kênh Khu vực, máy chủ **cưỡng chế phát tin vào đúng `character.current_zone` của người gửi**.
   - Client **không được phép chỉ định `zoneId` khác**. Người chơi chỉ nhận được tin nhắn của những đạo hữu đang cùng ở trong phân khu bản đồ đó.

---

## 3. MÔ HÌNH DỮ LIỆU & CHÍNH SÁCH LƯU TRỮ

### 3.1. Schema Cơ Sở Dữ Liệu (`schema.prisma`)
Thêm bảng `xianxia_chat_messages` để lưu trữ lịch sử tin nhắn:
```prisma
model XianxiaChatMessage {
  id                  Int      @id @default(autoincrement())
  channel             String   @db.VarChar(20) // 'WORLD' | 'ZONE'
  zone_id             String?  @db.VarChar(60) // NULL nếu là WORLD, có giá trị nếu là ZONE
  sender_user_id      Int
  sender_character_id Int
  sender_name         String   @db.VarChar(50)
  sender_realm        String   @db.VarChar(50)
  content             String   @db.VarChar(500)
  created_at          DateTime @default(now())

  @@index([channel, zone_id, created_at])
  @@index([created_at])
  @@map("xianxia_chat_messages")
}
```

### 3.2. Kiến Trúc Bộ Đệm Kép (In-Memory Ring Buffer + DB Persistence)
1. **In-Memory Ring Buffer (Tốc độ 0ms):**
   - Mỗi kênh/phân khu duy trì một danh sách vòng tối đa 50 tin nhắn mới nhất trong RAM máy chủ.
   - Khi tin nhắn mới đến, server broadcast tức thì tới room và đẩy vào ring buffer.
   - Khi client mới kết nối hoặc đổi khu vực, server trích xuất ngay 30 tin nhắn mới nhất từ buffer để trả về trong vòng 1ms.
2. **Ghi DB Bất Đồng Bộ (Durability):**
   - Tin nhắn được ghi vào PostgreSQL trong background task mà không chặn vòng lặp sự kiện của Socket.IO.
3. **Chính Sách Dọn Rác (Retention & Auto-Purge Policy):**
   - Để bảo vệ cơ sở dữ liệu Supabase khỏi phình to, hệ thống định kỳ (mỗi 12 tiếng) dọn dẹp các tin nhắn cũ hơn **7 ngày**, hoặc giữ tối đa **2,000 bản ghi** mới nhất.

---

## 4. MA TRẬN BẢO MẬT & CHỐNG SPAM (DEFENSE IN DEPTH)

| Tiêu chuẩn an ninh | Cơ chế phòng ngừa | Hành vi máy chủ |
| :--- | :--- | :--- |
| **Xác thực danh tính** | Handshake Auth qua JWT Bearer token | Từ chối kết nối nếu thiếu token hoặc token hết hạn/sai chữ ký. |
| **Chống giả mạo nhân vật** | Lấy thông tin từ DB (`user_id -> xianxia_characters`) | Tên người gửi, danh xưng cảnh giới, và khu vực hoàn toàn do server cấp phát. |
| **Chống gửi chéo khu vực** | Gán cứng `character.current_zone` từ DB vào tin nhắn | Client cố gửi `zoneId` lạ sẽ bị phớt lờ, chỉ phát vào khu vực nhân vật đang đứng. |
| **Giới hạn độ dài** | Kiểm tra độ dài nội dung sau khi `trim()` | Tối thiểu 1 ký tự, tối đa **200 ký tự**. Trả về lỗi `CHAT_MESSAGE_TOO_LONG`. |
| **Chống Spam Tần Suất (Rate Limit)** | Cooldown theo `userId` | Tối đa **1 tin nhắn mỗi 2 giây** cho mỗi tài khoản. Trả về lỗi `CHAT_RATE_LIMITED`. |
| **Chống Lặp Tin Tự Động** | Kiểm tra hash/nội dung tin gần nhất | Chặn gửi tin có nội dung trùng lặp 100% với tin vừa gửi trong vòng **30 giây**. Trả về lỗi `CHAT_DUPLICATE_MESSAGE`. |
| **Chống XSS (Cross-Site Scripting)** | Chuẩn hóa Server & Render an toàn Client | Server loại bỏ ký tự điều khiển/HTML độc hại. Frontend render qua `element.textContent`, tuyệt đối không dùng `innerHTML` trên nội dung người dùng. |
| **Bảo mật dữ liệu nhạy cảm** | Lọc dữ liệu broadcast | Payload phát sóng chỉ chứa: `{ id, channel, zoneId, senderName, senderRealm, content, createdAt }`. Tuyệt đối không để lộ `email`, `password_hash`, `token`. |

---

## 5. THIẾT KẾ TRẢI NGHIỆM GIAO DIỆN (UI/UX)

1. **Khối Truyền Âm Các (Floating Collapsible Wuxia Chat Dock):**
   - Nằm ở góc dưới cùng màn hình trong [`frontend/tien-lo.html`](file:///d:/Lap%20trinh%20game/ky_bien/frontend/tien-lo.html), tông màu than mực cổ phong (Ink-Wash Charcoal) viền ánh vàng hoàng kim (Antique Gold) và ngọc bích (Jade).
   - Thanh tiêu đề hiển thị: `💬 Truyền Âm Các` kèm chỉ báo trạng thái (🟢 Đã kết nối / 🟡 Đang kết nối / 🔴 Mất kết nối) và nút thu gọn/bung mở.
2. **Hệ thống Tab Kênh:**
   - Tab `Thế Giới`: Hiển thị tin nhắn toàn cõi tiên đồ.
   - Tab `Khu Vực`: Hiển thị tin nhắn trong phân khu hiện tại của người chơi (kèm tên phân khu động, ví dụ: *Thanh Hà Thôn*).
3. **Cơ chế Smart Scroll:**
   - Khi người dùng đang ở cuối danh sách: Tin mới đến tự động cuộn xuống dưới cùng.
   - Khi người dùng đang cuộn lên trên xem lại tin cũ: **Không ép cuộn**, xuất hiện nút nhỏ hoặc nhãn `"Có tin mới ↓"`.
4. **Hỗ trợ Thiết Bị:**
   - Desktop: Bảng chat mở rộng góc dưới, không che khuất bảng điều khiển tu luyện.
   - Mobile: Co giãn linh hoạt, có thể thu gọn thành một nút bấm truyền âm nổi.

---

## 6. KẾ HOẠCH TRIỂN KHAI & BỘ KIỂM THỬ

1. **Bước 1:** Cập nhật [`schema.prisma`](file:///d:/Lap%20trinh%20game/ky_bien/backend/prisma/schema.prisma) thêm `XianxiaChatMessage`, chạy `npx prisma db push`.
2. **Bước 2:** Xây dựng [`xianxiaChatService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaChatService.ts) xử lý lưu trữ, ring buffer, rate limit, dọn dữ liệu.
3. **Bước 3:** Xây dựng Socket handler [`xianxiaChatSocket.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/socket/xianxiaChatSocket.ts) gắn vào `server.ts` trên namespace `/xianxia-chat`.
4. **Bước 4:** Tích hợp giao diện Chat Widget và module kết nối socket trong [`tien-lo.html`](file:///d:/Lap%20trinh%20game/ky_bien/frontend/tien-lo.html) và [`tienlo-engine.js`](file:///d:/Lap%20trinh%20game/ky_bien/frontend/tienlo-engine.js).
5. **Bước 5:** Viết bộ test chuyên sâu [`xianxiaM4Chat.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/xianxiaM4Chat.test.ts) bao phủ toàn bộ 10 yêu cầu kiểm thử và tích hợp vào test runner chung.
