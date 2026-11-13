# TÀI LIỆU THIẾT KẾ KỸ THUẬT — MỤC 4.2
## PHÂN HỆ: ĐẤU TRƯỜNG THIÊN KIÊU (ASYNCHRONOUS PVP SYSTEM)
### Dự án: Tiên Lộ: Vạn Giới Tranh Phong (Kỳ Biến Platform)

**Tác giả:** Senior Game Backend Engineer  
**Phiên bản:** 1.0 (Design & Architecture Specification)  
**Phạm vi:** M4.2 — Đấu Trường PvP Bất Đồng Bộ  
**Trạng thái:** SẴN SÀNG TRIỂN KHAI (APPROVED FOR IMPLEMENTATION)  

---

## 1. TỔNG QUAN KIẾN TRÚC MỤC 4.2

Phân hệ **Đấu Trường Thiên Kiêu (M4.2)** là tính năng PvP bất đồng bộ (Asynchronous PvP Arena) cho phép người chơi lựa chọn đối thủ từ danh sách các Tu Tiên Giả khác, khiêu chiến lôi đài và giành lấy **Điểm Danh Vọng (Reputation)** để thăng tiến trên Đấu Trường Thiên Bảng.

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT (FRONTEND)                                |
|  - Danh sách đối thủ gợi ý (Opponents List)                                       |
|  - Nút Thách Đấu Lôi Đài (Challenge Action) kèm Idempotency Key                    |
|  - Trình chiếu diễn biến trận đấu tự động (Auto Combat Playback Round 1 -> 30)    |
|  - Bảng tổng kết kết quả, biến động Danh Vọng & Lịch sử Đấu Trường               |
+------------------------------------------+----------------------------------------+
                                           | HTTP REST API (JWT Authenticated)
                                           v
+-----------------------------------------------------------------------------------+
|                            BACKEND SERVER & ENGINE M4.2                           |
|  1. Xác thực quyền sở hữu nhân vật (User Ownership Validation)                    |
|  2. Kiểm tra Idempotency Key chống tấn công lặp / Concurrency Race Condition     |
|  3. Khóa hàng bi quan (Row-level Lock FOR UPDATE trên XianxiaCharacter)           |
|  4. Tạo bản sao trạng thái chiến đấu bất biến (Immutable Defender Snapshot)       |
|  5. Khởi chạy Server-side PvP Combat Simulation (Authoritative 30 Rounds)         |
|  6. Tính toán biến động Điểm Danh Vọng & Thưởng Bạc trong Database Transaction     |
|  7. Lưu trữ lịch sử trận đấu (XianxiaPvpMatch) & Nhật ký diễn biến               |
+------------------------------------------+----------------------------------------+
                                           | Prisma ORM (Connection Pool)
                                           v
+-----------------------------------------------------------------------------------+
|                               POSTGRESQL DATABASE                                 |
|  - xianxia_characters: Cột mới reputation, pvp_wins, pvp_losses, pvp_draws        |
|  - xianxia_pvp_matches: Lưu kết quả, defender_snapshot, idempotency_key UNIQUE    |
+-----------------------------------------------------------------------------------+
```

---

## 2. QUY TẮC SNAPSHOT ĐỐI THỦ (DEFENDER SNAPSHOT SPECIFICATION)

1. **Tính Bất Biến (Immutability):**
   - Khi trận đấu được tạo, máy chủ chụp nhanh toàn bộ trạng thái chiến đấu của đối thủ tại thời điểm đó và lưu vào trường `defender_snapshot` dưới dạng JSON chuỗi.
   - Nếu sau thời điểm đó, đối thủ có tăng cấp, tháo lắp trang bị, hoặc đột phá cảnh giới, trận đấu đã tạo vẫn sử dụng chính xác dữ liệu từ Snapshot đã chốt.
2. **Cấu trúc dữ liệu Snapshot (Zero Leakage):**
   - Chỉ lưu các chỉ số phục vụ trực tiếp cho mô phỏng chiến đấu:
     ```typescript
     export interface DefenderSnapshot {
       characterId: number;
       name: string;
       realm: string;
       realmTitle: string;
       level: number;
       combatPower: number;
       maxHealth: number;
       attack: number;
       defense: number;
       speed: number;
       critRate: number;
       dodgeRate: number;
       maxQi: number;
       equippedWeapon: string | null;
       equippedArmor: string | null;
       equippedRelic: string | null;
       snapshotTime: string;      // ISO String
       rulesVersion: string;      // "v1.0"
     }
     ```
   - **Tuyệt đối không lưu dữ liệu nhạy cảm:** Không có `email`, `password_hash`, `user_id`, hay JWT token trong snapshot.

---

## 3. ENGINE MÔ PHỎNG CHIẾN ĐẤU PVP PHÍA MÁY CHỦ (SERVER-SIDE PVP ENGINE)

1. **Tính Thẩm Quyền (Server Authoritative):**
   - Máy chủ chịu trách nhiệm 100% trong việc tính toán lượt đi, sát thương, bạo kích, né tránh và kết quả cuối cùng.
   - Client tuyệt đối không được gửi kết quả thắng/thua hay lượng sát thương lên để server phê duyệt.
2. **Quy tắc Thể Trạng Lôi Đài:**
   - Trong lôi đài tỉ thí luận đạo, cả Người Thách Đấu (Attacker) và Đối Thủ (Defender Snapshot) đều bắt đầu trận với $100\%$ Khí Huyết Lôi Đài (`max_health`) và $25$ Chân Khí khởi đầu.
   - Phí tham chiến: Khấu trừ $10$ Thể Lực (`fatigue`) của Người Thách Đấu. Đối thủ thụ động không bị trừ thể lực.
   - **Bảo toàn thể trạng dã ngoại:** Sau trận đấu PvP, người thua không bị phạt đưa về Động phủ với 20 HP như khi đánh quái dã ngoại PvE. Khí huyết thực tế ngoài thế giới không bị ảnh hưởng.
3. **Quy tắc 30 Hiệp Đấu Đồng Nhất PvE:**
   - Từng hiệp: Bên có Thân Pháp (`speed`) cao hơn được quyền xuất chiêu trước. Nếu bằng nhau, Người Thách Đấu xuất chiêu trước.
   - Cơ chế Chân Khí:
     - Khi Chân Khí $\ge 15$: Tự động thi triển Thần Thông Tiên Thuật (gây sát thương uy lực lớn dựa trên Công và giảm trừ Thủ đối phương), tiêu hao 15 Chân Khí.
     - Khi Chân Khí $< 15$: Tự động Trảm Kích cơ bản và hồi phục $+8$ Chân Khí (tối đa `max_qi`).
   - Kiểm tra Né Đòn (`dodge_rate`) và Bạo Kích (`crit_rate` x1.5 sát thương).
   - Biến thiên sát thương: Dao động tự nhiên $\pm 10\%$ (`0.9 + Math.random() * 0.2`).
4. **Phán Quyết Kết Quả Sau 30 Hiệp:**
   - Nếu một bên hết máu trước hiệp 30:
     - Defender hết máu $\rightarrow$ `ATTACKER_WIN`.
     - Attacker hết máu $\rightarrow$ `DEFENDER_WIN`.
   - Nếu cả 2 bên còn máu sau 30 hiệp:
     - So sánh tỷ lệ $\% \text{HP}_{\text{Attacker}}$ vs $\% \text{HP}_{\text{Defender}}$:
       - $\% \text{HP}_{\text{Attacker}} > \% \text{HP}_{\text{Defender}}$ $\rightarrow$ `DRAW_ADVANTAGE` (Người thách đấu chiếm thế thượng phong).
       - $\% \text{HP}_{\text{Attacker}} \le \% \text{HP}_{\text{Defender}}$ $\rightarrow$ `DRAW_TIMEOUT` (Đối thủ phòng thủ vững chắc).

---

## 4. QUY TẮC ĐIỂM DANH VỌNG & PHẦN THƯỞNG (REPUTATION & REWARDS)

### 4.1. Quy tắc thay đổi Điểm Danh Vọng
- **Điểm khởi điểm:** Mọi nhân vật sở hữu mặc định $100$ Điểm Danh Vọng. Sàn tối thiểu là $0$ (không có điểm âm).
- **Khi Thắng trận (`ATTACKER_WIN`):**
  - Công thức tính Danh Vọng thưởng:
    $$\Delta R = \max(10, \min(35, 20 + \lfloor (R_{\text{def}} - R_{\text{att}}) / 20 \rfloor))$$
    - Đánh thắng đối thủ có Danh Vọng cao hơn: Nhận từ $+21$ đến $+35$ Danh Vọng.
    - Đánh thắng đối thủ có Danh Vọng thấp hơn: Nhận từ $+10$ đến $+19$ Danh Vọng.
  - Thưởng ngân lượng: Thưởng $+50$ Bạc từ Ngân Quỹ Đấu Trường (không trừ tiền của đối thủ).
- **Khi Thua trận (`DEFENDER_WIN`):**
  - Giảm nhẹ $-10$ Điểm Danh Vọng (nếu $R_{\text{att}} > 100$; nếu $\le 100$ thì không giảm để khuyến khích tân thủ).
  - Không mất Bạc, không mất EXP, không mất Tu Vi, không mất trang bị/vật phẩm.
- **Khi Hòa trận chiếm ưu thế (`DRAW_ADVANTAGE`):**
  - Cộng $+5$ Điểm Danh Vọng khích lệ và $+20$ Bạc.
- **Khi Hòa trận thế thủ (`DRAW_TIMEOUT`):**
  - Biến động Danh Vọng: $0$.

### 4.2. Cơ chế Chống Khai Thác & Cày Điểm (Anti-Farming & Exploit Prevention)
1. **Chặn tự đấu với chính mình:** Nghiêm cấm `attacker_id === defender_id`.
2. **Giới hạn số lần đấu với cùng một đối thủ (Anti-Win-Trading):**
   - Trong vòng 24 giờ, Người chơi chỉ được nhận Điểm Danh Vọng và Bạc tối đa **3 lần** đối với cùng một đối thủ (`defender_id`).
   - Từ trận thứ 4 trở đi với cùng đối thủ đó trong ngày: Trận đấu vẫn cho phép diễn ra để luyện tập, nhưng `reputation_change = 0` và `silver_reward = 0`.
3. **Chi phí Thể Lực:** Tiêu hao 10 Thể Lực mỗi trận chặn đứng bot spam request vô hạn.

---

## 5. THIẾT KẾ CƠ SỞ DỮ LIỆU & GIAO DỊCH (DATABASE & TRANSACTIONS)

### 5.1. Cập nhật Model Prisma

```prisma
model XianxiaCharacter {
  // ... các trường hiện hữu ...
  reputation           Int       @default(100)
  pvp_wins             Int       @default(0)
  pvp_losses           Int       @default(0)
  pvp_draws            Int       @default(0)

  // Quan hệ PvP
  pvp_matches_as_attacker XianxiaPvpMatch[] @relation("AttackerMatches")
  pvp_matches_as_defender XianxiaPvpMatch[] @relation("DefenderMatches")

  @@map("xianxia_characters")
}

model XianxiaPvpMatch {
  id                        String   @id @default(uuid()) @db.Uuid
  idempotency_key           String?  @unique @db.VarChar(100)
  attacker_id               Int
  defender_id               Int
  defender_snapshot         String   @db.Text
  result                    String   @db.VarChar(30) // 'ATTACKER_WIN', 'DEFENDER_WIN', 'DRAW_ADVANTAGE', 'DRAW_TIMEOUT'
  turns_count               Int
  reputation_change         Int      @default(0)
  attacker_reputation_after Int      @default(100)
  silver_reward             Int      @default(0)
  combat_log                String   @db.Text // JSON string array
  playback_turns            String   @db.Text // JSON string array
  created_at                DateTime @default(now())

  attacker XianxiaCharacter @relation("AttackerMatches", fields: [attacker_id], references: [id], onDelete: Cascade)
  defender XianxiaCharacter @relation("DefenderMatches", fields: [defender_id], references: [id], onDelete: Cascade)

  @@index([attacker_id, created_at])
  @@index([defender_id, created_at])
  @@map("xianxia_pvp_matches")
}
```

### 5.2. Luồng Giao Dịch & Khóa Hàng Bi Quan (Row-level Locking)
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Kiểm tra khóa Idempotency Key
  if (idempotencyKey) {
    const existing = await tx.xianxiaPvpMatch.findUnique({ where: { idempotency_key: idempotencyKey } });
    if (existing) return formatMatchResult(existing);
  }

  // 2. Khóa hàng bi quan trên attacker để chống Race Condition đồng thời
  await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE', userId);

  // 3. Đọc dữ liệu attacker & defender
  const attacker = await tx.xianxiaCharacter.findUnique({ where: { user_id: userId } });
  const defender = await tx.xianxiaCharacter.findUnique({ where: { id: defenderId } });

  // 4. Validate nghiệp vụ (fatigue >= 10, attacker.id !== defender.id)
  // 5. Kiểm tra giới hạn 3 trận/ngày với cùng defender_id
  // 6. Tạo Snapshot bất biến của defender
  // 7. Chạy mô phỏng 30 hiệp
  // 8. Cập nhật attacker (fatigue, reputation, silver, pvp_stats)
  // 9. Ghi bản ghi XianxiaPvpMatch
});
```

---

## 6. THIẾT KẾ DANH SÁCH ENDPOINTS API (RESTFUL CONTRACTS)

Tất cả các endpoint đều nằm dưới tiền tố `/api/xianxia/gameplay/pvp` và yêu cầu middleware `authenticateToken`.

| Phương thức | Đường dẫn Endpoint | Mô tả chức năng | Quyền truy cập |
|---|---|---|---|
| `GET` | `/api/xianxia/gameplay/pvp/opponents` | Lấy danh sách 5-10 đối thủ phù hợp trên lôi đài | Authenticated |
| `POST` | `/api/xianxia/gameplay/pvp/challenge` | Khiêu chiến đối thủ, nhận kết quả và playback turns | Authenticated |
| `GET` | `/api/xianxia/gameplay/pvp/history` | Lấy danh sách 15 trận đấu PvP gần nhất của người chơi | Authenticated |
| `GET` | `/api/xianxia/gameplay/pvp/match/:id` | Xem chi tiết diễn biến 1 trận đấu cụ thể | Authenticated |
| `GET` | `/api/xianxia/gameplay/pvp/leaderboard` | Bảng xếp hạng Danh Vọng Đạo Hạnh lôi đài | Authenticated / Public |

---

## 7. KẾ HOẠCH TÍCH HỢP GIAO DIỆN CLIENT (FRONTEND INTEGRATION)

1. **Giao diện Modal Đấu Trường `#pvp-modal` trong `frontend/tien-lo.html`:**
   - Header: Danh Vọng của bản thân, Tỷ lệ Thắng/Thua, Thể Lực.
   - Tabs: `[Danh Sách Đối Thủ]` | `[Lịch Sử Đấu Trường]` | `[Bảng Xếp Hạng Danh Vọng]`.
   - Danh sách đối thủ: Thẻ đối thủ hiển thị Tên, Cảnh giới, Cấp độ, Điểm Danh Vọng, Chiến Lực ước tính, Nút `[⚔️ Khiêu Chiến]` (Kèm chỉ số tiêu hao 10 Thể Lực).
2. **Trình điều khiển trong `frontend/tienlo-engine.js`:**
   - Các hàm: `openPvpModal()`, `fetchPvpOpponents()`, `challengePvpOpponent(defenderId)`, `renderPvpPlayback(playbackTurns, resultData)`, `fetchPvpHistory()`.
   - Sử dụng lại modal diễn biến trận đấu tự động, hiển thị rõ ràng thông báo tăng/giảm Danh Vọng và Bạc thưởng.
   - Tương thích chế độ Offline: Khi mất kết nối API, thông báo thân thiện và vô hiệu hóa nút thách đấu an toàn.
