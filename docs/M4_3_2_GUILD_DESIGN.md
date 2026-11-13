# THIẾT KẾ HỆ THỐNG M4.3.2: BANG HỘI / TÔNG MÔN (XIANXIA SECT SYSTEM)
## Dự án: Tiên Lộ: Vạn Giới Tranh Phong & Kỳ Biến

**Tác giả:** Senior Backend & Game Systems Architect  
**Ngày lập:** 24/10/2026  
**Trạng thái:** Giai đoạn 1 — Đề xuất thiết kế & Chờ phê duyệt  

---

## 1. TỔNG QUAN VÀ MỤC TIÊU PHÂN HỆ

Hệ thống **Tông Môn (Bang Hội Tu Tiên)** là tính năng xã hội cốt lõi trong Mục 4.3 của game Tiên Lộ, tạo tiền đề liên kết cộng đồng người chơi, hỗ trợ multiplayer thực sự dựa trên nền tảng PostgreSQL / Prisma / Express hiện có.

### Nguyên tắc bất khả xâm phạm:
1. **Cô lập hoàn toàn:** Không làm ảnh hưởng đến hệ thống Cờ Tướng Kỳ Biến, cơ sở dữ liệu người chơi, tiến trình tu luyện (M1, M2, M3), Bảng Xếp Hạng (M4.1), Đấu Trường PvP (M4.2) và Hệ thống Chat (M4.3.1).
2. **Không phá hủy dữ liệu (Zero Data Loss):** Toàn bộ schema mới là phần mở rộng (additive only), không thay đổi kiểu hay xóa các cột hiện hữu của các bảng khác.
3. **Server-Authoritative tuyệt đối:** Quyền hạn, chức vụ, trạng thái thành viên và ID Tông môn hoàn toàn do máy chủ truy vấn từ Database; tuyệt đối không tin cậy bất kỳ tham số định danh nào do client gửi lên.
4. **An toàn Concurrency & Ràng buộc tính nhất quán:** Ngăn chặn triệt để tình trạng một nhân vật gia nhập hai Tông môn, hai người cùng làm Chưởng môn, hoặc Tông môn bị giải tán dở dang do các request gửi đồng thời.

---

## 2. KHẢO SÁT HIỆN TRẠNG & TÍCH HỢP KIẾN TRÚC

1. **Liên kết Người dùng - Nhân vật:**
   - Mỗi tài khoản [`User`](file:///d:/Lap%20trinh%20game/ky_bien/backend/prisma/schema.prisma#L14) liên kết 1-1 với [`XianxiaCharacter`](file:///d:/Lap%20trinh%20game/ky_bien/backend/prisma/schema.prisma#L196) thông qua trường `user_id @unique`.
   - Các API xác thực bằng JWT Bearer Token qua [`authenticateToken`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/middlewares/authMiddleware.ts), từ đó trích xuất `req.user.userId` an toàn.
2. **Quy tắc phân định Tông Môn:**
   - Một nhân vật tại một thời điểm **chỉ được phép thuộc về duy nhất một Tông môn**.
   - Một Tông môn tại một thời điểm **chỉ có duy nhất một Chưởng môn**.
3. **Kế thừa hạ tầng Chat Realtime (M4.3.1):**
   - Phân hệ Chat Socket.IO tại namespace `/xianxia-chat` đã có sẵn cơ chế phân luồng Room.
   - Bổ sung Room `xianxia:guild:{guildId}` cho phép thành viên trong cùng Tông môn truyền âm nội bộ bảo mật, cô lập 100% với các Tông môn khác.

---

## 3. MÔ HÌNH DỮ LIỆU PRISMA ĐỀ XUẤT

Hệ thống bổ sung 3 models mới và cập nhật model Chat:

```prisma
// ==========================================
// M4.3.2: BANG HỘI / TÔNG MÔN TU TIÊN
// ==========================================

model XianxiaGuild {
  id           Int      @id @default(autoincrement())
  name         String   @unique @db.VarChar(50)  // Tên Tông môn duy nhất trên toàn cõi
  description  String?  @db.VarChar(255)         // Tôn chỉ / Giới thiệu Tông môn
  notice       String?  @db.VarChar(500)         // Lời răn / Bảng cáo thị nội bộ
  leader_id    Int      @unique                  // ID nhân vật Chưởng môn (duy nhất)
  level        Int      @default(1)              // Cấp độ Tông môn
  reputation   Int      @default(0)              // Danh vọng Tông môn
  member_count Int      @default(1)              // Số lượng thành viên hiện tại
  max_members  Int      @default(20)             // Giới hạn số lượng thành viên tối đa
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  leader       XianxiaCharacter         @relation("GuildLeader", fields: [leader_id], references: [id], onDelete: Restrict)
  members      XianxiaGuildMember[]
  applications XianxiaGuildApplication[]

  @@index([reputation])
  @@index([created_at])
  @@map("xianxia_guilds")
}

model XianxiaGuildMember {
  id           Int      @id @default(autoincrement())
  guild_id     Int
  character_id Int      @unique                  // ĐẢM BẢO 1 NHÂN VẬT CHỈ THUỘC 1 TÔNG MÔN TRÊN CẢ HỆ THỐNG
  role         String   @default("MEMBER") @db.VarChar(20) // 'LEADER' (Chưởng Môn) | 'ELDER' (Trưởng Lão) | 'MEMBER' (Đệ Tử)
  joined_at    DateTime @default(now())
  updated_at   DateTime @updatedAt

  guild        XianxiaGuild     @relation(fields: [guild_id], references: [id], onDelete: Cascade)
  character    XianxiaCharacter @relation(fields: [character_id], references: [id], onDelete: Cascade)

  @@index([guild_id, role])
  @@map("xianxia_guild_members")
}

model XianxiaGuildApplication {
  id           Int      @id @default(autoincrement())
  guild_id     Int
  character_id Int
  status       String   @default("PENDING") @db.VarChar(20) // 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
  message      String?  @db.VarChar(200)                    // Lời bái kiến gia nhập
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  guild        XianxiaGuild     @relation(fields: [guild_id], references: [id], onDelete: Cascade)
  character    XianxiaCharacter @relation(fields: [character_id], references: [id], onDelete: Cascade)

  @@unique([guild_id, character_id, status]) // Chặn nộp nhiều đơn PENDING cùng lúc vào 1 Tông môn
  @@index([guild_id, status])
  @@index([character_id, status])
  @@map("xianxia_guild_applications")
}
```

Và cập nhật model [`XianxiaChatMessage`](file:///d:/Lap%20trinh%20game/ky_bien/backend/prisma/schema.prisma#L318) thêm cột `guild_id Int?`:
```prisma
model XianxiaChatMessage {
  // ...
  channel             String   @db.VarChar(20) // 'WORLD' | 'ZONE' | 'GUILD'
  zone_id             String?  @db.VarChar(60)
  guild_id            Int?                      // NULL nếu là WORLD/ZONE, có giá trị nếu là GUILD
  // ...
  @@index([channel, guild_id, created_at])
}
```

---

## 4. MA TRẬN VAI TRÒ & PHÂN QUYỀN (RBAC MATRIX)

Hệ thống thiết lập 3 cấp bậc rõ ràng:
1. **Chưởng Môn (`LEADER`):** Người sáng lập hoặc kế vị đứng đầu Tông môn.
2. **Trưởng Lão (`ELDER`):** Cán bộ cốt cán hỗ trợ điều hành.
3. **Đệ Tử (`MEMBER`):** Thành viên chính thức của Tông môn.

| Hành động nghiệp vụ | Chưởng Môn (`LEADER`) | Trưởng Lão (`ELDER`) | Đệ Tử (`MEMBER`) | Quy tắc kiểm soát máy chủ |
| :--- | :---: | :---: | :---: | :--- |
| **Xem danh sách & Chi tiết Tông môn** | ✅ | ✅ | ✅ | Công khai cho toàn bộ người chơi tu tiên. |
| **Xem bảng cáo thị / Tin tức nội bộ** | ✅ | ✅ | ✅ | Chỉ thành viên cùng Tông môn mới xem được `notice`. |
| **Sửa lời răn / Cáo thị nội bộ** | ✅ | ✅ | ❌ | Bị từ chối `403 Forbidden` nếu không phải Leader/Elder. |
| **Xem danh sách đơn xin gia nhập** | ✅ | ✅ | ❌ | Chỉ Leader và Elder có thẩm quyền xem đơn `PENDING`. |
| **Duyệt / Từ chối đơn gia nhập** | ✅ | ✅ | ❌ | Trưởng lão không thể tự duyệt đơn của người khác nếu Tông môn đã đầy người. Không thể tự duyệt đơn chính mình. |
| **Thăng chức Đệ Tử lên Trưởng Lão** | ✅ | ❌ | ❌ | Chỉ Chưởng môn có quyền bổ nhiệm Trưởng lão. |
| **Bãi chức Trưởng Lão xuống Đệ Tử** | ✅ | ❌ | ❌ | Chỉ Chưởng môn có quyền bãi chức. |
| **Trục xuất thành viên khỏi Tông môn** | ✅ | ❌ | ❌ | Chỉ Chưởng môn có quyền trục xuất Đệ tử/Trưởng lão. |
| **Chuyển chức Chưởng Môn (Truyền ngôi)** | ✅ | ❌ | ❌ | Chỉ Chưởng môn hiện tại mới có quyền chỉ định người kế vị. |
| **Rời Tông Môn** | ⚠️ Có điều kiện | ✅ | ✅ | Chưởng môn **không được tự ý rời** nếu Tông môn còn thành viên khác. Phải truyền ngôi trước. |
| **Giải tán Tông Môn** | ✅ | ❌ | ❌ | Chỉ Chưởng môn mới có quyền giải tán. |
| **Chat Kênh Tông Môn** | ✅ | ✅ | ✅ | Bắt buộc phải là thành viên trong Tông môn. |

---

## 5. THIẾT KẾ REST API TÔNG MÔN

Tất cả các route được gắn dưới tiền tố `/api/xianxia/guilds`.

### 5.1. Nhóm Route Công Khai / Tìm Kiếm (Public / Read-only)
- `GET /api/xianxia/guilds`: Lấy danh sách Tông môn (hỗ trợ tìm kiếm theo tên `?search=...`, phân trang `?page=1&limit=10`, sắp xếp theo `reputation` hoặc `member_count`).
- `GET /api/xianxia/guilds/me`: Lấy thông tin Tông môn và chức vụ hiện tại của nhân vật đang đăng nhập (kèm danh sách thành viên nếu đã gia nhập).
- `GET /api/xianxia/guilds/:guildId`: Xem chi tiết công khai một Tông môn (Tên, Chưởng môn, Cấp, Số lượng thành viên, Giới thiệu).
- `GET /api/xianxia/guilds/:guildId/members`: Lấy danh sách thành viên của một Tông môn (Tên, Cảnh giới, Cấp độ, Chức vụ, Ngày gia nhập).

### 5.2. Nhóm Route Thao Tác Gia Nhập / Đơn Xin (Applications)
- `POST /api/xianxia/guilds`: Tạo Tông môn mới (Yêu cầu: Chưa có Tông môn, Tên hợp lệ 3-30 ký tự, Chi phí 500 Bạc).
- `POST /api/xianxia/guilds/:guildId/apply`: Gửi đơn xin gia nhập Tông môn (Kèm lời nhắn tối đa 200 ký tự).
- `DELETE /api/xianxia/guilds/:guildId/apply`: Hủy đơn xin gia nhập đang chờ duyệt.
- `GET /api/xianxia/guilds/:guildId/applications`: Lấy danh sách đơn đang chờ duyệt (Yêu cầu quyền Chưởng môn hoặc Trưởng lão).
- `POST /api/xianxia/guilds/:guildId/applications/:appId/accept`: Chấp thuận đơn gia nhập (Yêu cầu quyền Chưởng môn hoặc Trưởng lão).
- `POST /api/xianxia/guilds/:guildId/applications/:appId/reject`: Từ chối đơn gia nhập (Yêu cầu quyền Chưởng môn hoặc Trưởng lão).

### 5.3. Nhóm Route Quản Trị Thành Viên & Điều Hành (Management)
- `POST /api/xianxia/guilds/:guildId/leave`: Tự nguyện rời khỏi Tông môn.
- `POST /api/xianxia/guilds/:guildId/kick`: Trục xuất thành viên (Yêu cầu quyền Chưởng môn).
- `POST /api/xianxia/guilds/:guildId/promote`: Thăng chức thành viên lên Trưởng lão (Yêu cầu quyền Chưởng môn).
- `POST /api/xianxia/guilds/:guildId/demote`: Bãi chức Trưởng lão xuống Đệ tử (Yêu cầu quyền Chưởng môn).
- `POST /api/xianxia/guilds/:guildId/transfer-leadership`: Chuyển giao chức Chưởng môn cho thành viên khác (Yêu cầu quyền Chưởng môn).
- `PUT /api/xianxia/guilds/:guildId/notice`: Cập nhật bảng cáo thị nội bộ (Yêu cầu quyền Chưởng môn hoặc Trưởng lão).
- `DELETE /api/xianxia/guilds/:guildId`: Giải tán Tông môn (Yêu cầu quyền Chưởng môn).

---

## 6. QUY TẮC GIAO DỊCH & CHỐNG RACE CONDITION (CONCURRENCY CONTROL)

Để đảm bảo tuyệt đối không phát sinh lỗi đồng thời trong môi trường nhiều người chơi:

1. **Ràng buộc cứng ở tầng PostgreSQL (Unique Constraints):**
   - `XianxiaGuildMember.character_id @unique`: Đảm bảo 1 nhân vật không bao giờ tồn tại trong 2 Tông môn dù có gửi bao nhiêu request đồng thời.
   - `XianxiaGuild.name @unique`: Đảm bảo không bao giờ tạo trùng tên Tông môn.
   - `XianxiaGuild.leader_id @unique`: Đảm bảo 1 nhân vật không thể cùng lúc làm Chưởng môn của 2 Tông môn khác nhau.
2. **Khóa Hàng Bi Quan (Pessimistic Locking `FOR UPDATE`):**
   - **Khi duyệt đơn gia nhập:** Khóa hàng `XianxiaGuild` để kiểm tra chính xác trần số lượng thành viên (`member_count < max_members`), đồng thời khóa hàng `XianxiaCharacter` của ứng viên để kiểm tra trạng thái tự do.
   - **Khi chuyển chức Chưởng môn:** Khóa hàng Tông môn và cả hai nhân vật (Chưởng môn cũ và Chưởng môn mới) theo thứ tự ID tăng dần (`ORDER BY id FOR UPDATE`) để triệt tiêu hoàn toàn nguy cơ Deadlock.
   - **Khi giải tán Tông môn:** Khóa Tông môn `FOR UPDATE` trước khi thực hiện xóa cascade các bản ghi liên quan.
3. **Tính nguyên tử trong Prisma `$transaction`:**
   - Tất cả các thao tác cập nhật nhiều bảng (Tạo guild + trừ bạc + tạo member; Duyệt đơn + tăng member_count + hủy các đơn khác) đều được đóng gói trong một transaction với timeout thích hợp (`maxWait: 10000, timeout: 20000`).

---

## 7. CÁC QUYẾT ĐỊNH NGHIỆP VỤ CẦN CHỦ DỰ ÁN XÁC NHẬN

Trước khi viết mã nguồn và chạy migration database, kính đề nghị Chủ dự án xác nhận các điểm nghiệp vụ sau:

1. **Điều kiện & Chi phí tạo Tông Môn:**
   - *Đề xuất:* Nhân vật đạt cảnh giới tối thiểu **Luyện Khí Tầng 3** và tiêu hao **500 Bạc**.  
   - *Lý do:* Tránh tình trạng tài khoản clone vừa tạo đã spam lập hàng loạt Tông môn rác làm rác cơ sở dữ liệu.
2. **Số lượng thành viên tối đa (Max Members):**
   - *Đề xuất:* Cấp độ 1 cho phép tối đa **20 thành viên**.
3. **Quy định khi Chưởng môn rời Tông môn:**
   - *Đề xuất:* Nếu Tông môn còn từ 2 thành viên trở lên, Chưởng môn **bắt buộc phải chuyển giao chức Chưởng môn** cho một thành viên khác trước khi rời đi. Nếu Chưởng môn là thành viên duy nhất còn lại, thao tác rời Tông môn sẽ kích hoạt quy trình **giải tán Tông môn an toàn**.
4. **Số lượng đơn xin gia nhập tối đa của 1 người chơi:**
   - *Đề xuất:* Mỗi người chơi được phép gửi tối đa **3 đơn xin gia nhập** đang ở trạng thái `PENDING` cùng lúc. Khi được một Tông môn bất kỳ chấp thuận, hệ thống tự động hủy các đơn còn lại.
5. **Kênh Chat Tông Môn:**
   - *Đề xuất:* Tích hợp kênh `GUILD` vào widget Truyền Âm Các hiện có (thêm Tab thứ 3 bên cạnh Thế Giới và Khu Vực khi nhân vật đã có Tông môn).

---

## 8. ĐÁNH GIÁ XUNG ĐỘT SCHEMA & NGUY CƠ HỒI QUY

- **Schema Prisma:** Thêm 3 models hoàn toàn mới (`XianxiaGuild`, `XianxiaGuildMember`, `XianxiaGuildApplication`) và thêm quan hệ 1-nhiều trên `XianxiaCharacter`. Không sửa đổi, không đổi tên, không xóa bất kỳ trường hiện hữu nào.
- **Tính an toàn của cơ sở dữ liệu:** Thao tác `npx prisma db push` là an toàn 100% (Non-destructive schema addition), không yêu cầu drop hay reset bảng cũ.
- **Kiểm thử hồi quy:** Sau khi triển khai, toàn bộ 20 test Chat M4.3.1, 25 test PvP M4.2, 15 test Leaderboard M4.1 và test suite Kỳ Biến sẽ được chạy lại để bảo đảm zero-regression.
