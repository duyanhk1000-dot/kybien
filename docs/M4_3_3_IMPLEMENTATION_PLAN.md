# TIÊN LỘ: VẠN GIỚI TRANH PHONG — KẾ HOẠCH TRIỂN KHAI M4.3.3 MULTIPLAYER CO-OP

> **Tài liệu:** Kế hoạch khảo sát và kiến trúc kỹ thuật M4.3.3  
> **Repository:** `D:\Lap trinh game\ky_bien\`  
> **Tác giả:** Senior Backend Engineer & Security Reviewer  
> **Trạng thái:** Giai đoạn 0 — Khảo sát & Thiết kế hoàn chỉnh (Chưa sửa mã nguồn)  
> **Ngày lập:** 25/10/2026  

---

## 1. TỔNG QUAN VÀ KHẢO SÁT KIẾN TRÚC HIỆN CÓ

Hệ thống backend hiện tại được xây dựng trên nền tảng **TypeScript + Node.js (Express) + Prisma ORM + PostgreSQL/Supabase + Socket.IO**. Toàn bộ mã nguồn Tiên Lộ tuân thủ nghiêm ngặt mô hình kiến trúc phân lớp: `Route -> Middleware (Auth) -> Controller -> Service -> Prisma / DB Transaction`.

### 1.1. Các module có sẵn và khả năng tái sử dụng

| Module / Thành phần | Đường dẫn thực tế | Khả năng tái sử dụng cho M4.3.3 |
| :--- | :--- | :--- |
| **Xác thực JWT** | `backend/src/middlewares/authMiddleware.ts`<br>`backend/src/utils/jwt.ts` | Tái sử dụng 100% middleware `authenticateToken` và `verifyToken`. Lấy an toàn `req.user.userId`. |
| **Chỉ số & Căn Cốt Nhân Vật** | `backend/src/services/xianxia/xianxiaCharacterService.ts` | Tái sử dụng `calculateEffectiveStats(char)` để tính toàn diện Attack, Defense, Speed, Crit, Dodge, Max Qi, Max Health của từng thành viên trong tổ đội. Tái sử dụng `applyExpGain(char, exp)` để xử lý thăng cấp và chuyển đổi EXP. |
| **Chiến Lực Đạo Hạnh** | `backend/src/services/xianxia/xianxiaLeaderboardService.ts` | Tái sử dụng `calcCombatPower(char)` để hiển thị chiến lực từng thành viên trong tổ đội. |
| **Công thức & Vòng lặp Chiến Đấu** | `backend/src/services/xianxia/xianxiaCombatService.ts`<br>`backend/src/services/xianxia/xianxiaPvpService.ts` | Tái sử dụng cấu trúc vòng lặp chiến đấu theo Thân pháp (Speed initiative), đòn đánh thường, Thần thông (Skill tiêu hao Qi), bạo kích, né tránh, và tính toán sát thương `variance`. Mở rộng từ 1v1 sang Co-op (1-4 Người chơi vs Đợt Yêu thú / Boss). |
| **Danh mục Quái vật & Boss** | `backend/src/services/xianxia/xianxiaBestiaryService.ts`<br>`backend/src/data/xianxia/monsters.json` | Tái sử dụng dữ liệu quái vật thực tế: `monster_thao_moc_tinh` (Wave 1), `monster_u_minh_lang` + `monster_thiet_giap_tru` (Wave 2), và Boss thế giới `boss_u_minh_lang_vuong` (Wave 3). |
| **Túi đồ & Kinh tế** | `prisma.xianxiaInventoryItem`<br>`prisma.xianxiaCharacter` | Tái sử dụng bảng vật phẩm, tiền tệ Bạc (`silver`), Tu Vi (`cultivation`), Thể Lực (`fatigue`). |
| **Giao dịch & Khóa hàng DB** | Prisma Transactions & Row-level Locking | Tái sử dụng mô hình `SELECT ... FOR UPDATE` với ID sắp xếp tăng dần đã được kiểm chứng an toàn tuyệt đối ở M4.2 PvP và M4.3.2 Tông Môn. |
| **Hạ tầng Realtime** | `backend/src/server.ts`<br>`backend/src/socket/xianxiaChatSocket.ts` | Tái sử dụng máy chủ HTTP và Socket.IO server hiện có. Mở rộng namespace hoặc event handler cho Party & Dungeon Co-op. |

---

## 2. THIẾT KẾ SCHEMA PRISMA (CSDL MỚI)

Để đảm bảo tính toàn vẹn dữ liệu, các invariant nghiệp vụ được bảo vệ ngay tại tầng CSDL thông qua các ràng buộc khóa ngoại, `UNIQUE` index và kiểu cột chính xác:

### 2.1. Các Model bổ sung trong `backend/prisma/schema.prisma`

```prisma
// ==========================================
// M4.3.3: TỔ ĐỘI & PHÓ BẢN MULTIPLAYER CO-OP
// ==========================================

model XianxiaParty {
  id           Int      @id @default(autoincrement())
  leader_id    Int                           // ID nhân vật Đội Trưởng
  name         String   @db.VarChar(50)       // Tên Tổ Đội
  status       String   @default("FORMING") @db.VarChar(20) // 'FORMING' | 'IN_DUNGEON' | 'DISBANDED'
  max_members  Int      @default(4)          // Tối đa 4 người
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  leader       XianxiaCharacter       @relation("PartyLeader", fields: [leader_id], references: [id], onDelete: Restrict)
  members      XianxiaPartyMember[]
  invites      XianxiaPartyInvite[]
  dungeon_runs XianxiaDungeonRun[]

  @@index([leader_id])
  @@index([status])
  @@map("xianxia_parties")
}

model XianxiaPartyMember {
  id           Int      @id @default(autoincrement())
  party_id     Int
  character_id Int      @unique               // BẢO ĐẢM BẬC CƠ SỞ DỮ LIỆU: 1 Nhân vật chỉ tham gia tối đa 1 tổ đội
  role         String   @default("MEMBER") @db.VarChar(20) // 'LEADER' | 'MEMBER'
  is_ready     Boolean  @default(false)       // Trạng thái sẵn sàng tham chiến
  joined_at    DateTime @default(now())

  party        XianxiaParty           @relation(fields: [party_id], references: [id], onDelete: Cascade)
  character    XianxiaCharacter       @relation(fields: [character_id], references: [id], onDelete: Cascade)

  @@index([party_id, role])
  @@map("xianxia_party_members")
}

model XianxiaPartyInvite {
  id           Int      @id @default(autoincrement())
  party_id     Int
  inviter_id   Int                            // ID nhân vật gửi lời mời (Đội trưởng)
  invitee_id   Int                            // ID nhân vật nhận lời mời
  status       String   @default("PENDING") @db.VarChar(20) // 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
  expires_at   DateTime                       // Thời hạn phản hồi (2 phút)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt

  party        XianxiaParty           @relation(fields: [party_id], references: [id], onDelete: Cascade)
  inviter      XianxiaCharacter       @relation("SentPartyInvites", fields: [inviter_id], references: [id], onDelete: Cascade)
  invitee      XianxiaCharacter       @relation("ReceivedPartyInvites", fields: [invitee_id], references: [id], onDelete: Cascade)

  @@unique([party_id, invitee_id, status]) // Chặn gửi trùng lời mời PENDING tới cùng một người
  @@index([invitee_id, status])
  @@index([party_id, status])
  @@map("xianxia_party_invites")
}

model XianxiaDungeonRun {
  id                  String   @id @default(uuid()) @db.Uuid
  dungeon_id          String   @db.VarChar(60)       // 'dungeon_u_minh_co_dong'
  party_id            Int
  leader_character_id Int
  status              String   @default("IN_PROGRESS") @db.VarChar(20) // 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED'
  current_wave        Int      @default(1)
  total_waves         Int      @default(3)
  turns_count         Int      @default(0)
  combat_state        String?  @db.Text             // Snapshot JSON: HP quái vật, debuffs hiện tại
  combat_log          String?  @db.Text             // Nhật ký diễn biến chiến đấu (JSON Array)
  idempotency_key     String?  @unique @db.VarChar(100) // Scoped key: 'dungeon:start:p{partyId}:{rawKey}'
  started_at          DateTime @default(now())
  expires_at          DateTime                      // Giới hạn thời gian (15 phút)
  completed_at        DateTime?

  party               XianxiaParty                 @relation(fields: [party_id], references: [id], onDelete: Cascade)
  members             XianxiaDungeonMember[]
  reward_claims       XianxiaDungeonRewardClaim[]

  @@index([party_id, status])
  @@index([status, expires_at])
  @@map("xianxia_dungeon_runs")
}

model XianxiaDungeonMember {
  id             Int      @id @default(autoincrement())
  dungeon_run_id String   @db.Uuid
  character_id   Int
  initial_hp     Int
  current_hp     Int
  max_hp         Int
  damage_dealt   Int      @default(0)
  damage_taken   Int      @default(0)
  is_alive       Boolean  @default(true)
  is_connected   Boolean  @default(true)
  last_seen_at   DateTime @default(now())

  dungeon_run    XianxiaDungeonRun @relation(fields: [dungeon_run_id], references: [id], onDelete: Cascade)
  character      XianxiaCharacter  @relation(fields: [character_id], references: [id], onDelete: Cascade)

  @@unique([dungeon_run_id, character_id])
  @@index([dungeon_run_id])
  @@map("xianxia_dungeon_members")
}

model XianxiaDungeonRewardClaim {
  id                 String   @id @default(uuid()) @db.Uuid
  dungeon_run_id     String   @db.Uuid
  character_id       Int
  idempotency_key    String   @unique @db.VarChar(100) // 'dungeon:reward:r{runId}:c{charId}'
  exp_reward         Int      @default(0)
  cultivation_reward Int      @default(0)
  silver_reward      Int      @default(0)
  items_reward       String?  @db.Text                // JSON DroppedItem[]
  claimed_at         DateTime @default(now())

  dungeon_run        XianxiaDungeonRun @relation(fields: [dungeon_run_id], references: [id], onDelete: Cascade)
  character          XianxiaCharacter  @relation(fields: [character_id], references: [id], onDelete: Cascade)

  @@unique([dungeon_run_id, character_id]) // BẢO ĐẢM TUYỆT ĐỐI: Mỗi nhân vật chỉ nhận thưởng duy nhất 1 lần / run
  @@map("xianxia_dungeon_reward_claims")
}
```

### 2.2. Quan hệ bổ sung trong `XianxiaCharacter`
- `party_led XianxiaParty[] @relation("PartyLeader")`
- `party_membership XianxiaPartyMember?`
- `sent_party_invites XianxiaPartyInvite[] @relation("SentPartyInvites")`
- `received_party_invites XianxiaPartyInvite[] @relation("ReceivedPartyInvites")`
- `dungeon_memberships XianxiaDungeonMember[]`
- `dungeon_reward_claims XianxiaDungeonRewardClaim[]`

---

## 3. THIẾT KẾ API VÀ SỰ KIỆN REALTIME SOCKET.IO

### 3.1. REST API Endpoints (`/api/xianxia/...`)

Tất cả các endpoint đều yêu cầu xác thực `authenticateToken` JWT Header `Authorization: Bearer <token>`.

#### Phân hệ Tổ Đội (`/api/xianxia/party`):
1. `POST /api/xianxia/party` — Khởi tạo tổ đội mới (Người tạo tự động là Đội trưởng).
2. `GET /api/xianxia/party/me` — Lấy thông tin chi tiết tổ đội hiện tại và danh sách thành viên.
3. `POST /api/xianxia/party/invite` — Mời người chơi khác (Body: `{ inviteeCharacterId }`).
4. `GET /api/xianxia/party/invites` — Lấy danh sách lời mời đang chờ (`PENDING`) của bản thân.
5. `POST /api/xianxia/party/invites/:inviteId/respond` — Chấp nhận hoặc từ chối lời mời (Body: `{ action: 'ACCEPT' | 'REJECT' }`).
6. `POST /api/xianxia/party/ready` — Chuyển trạng thái sẵn sàng (Body: `{ isReady: boolean }`).
7. `POST /api/xianxia/party/kick` — Đội trưởng trục xuất thành viên (Body: `{ targetCharacterId }`).
8. `POST /api/xianxia/party/leave` — Rời tổ đội (Tự động chuyển Đội trưởng hoặc giải tán nếu hết người).
9. `POST /api/xianxia/party/disband` — Đội trưởng giải tán tổ đội.

#### Phân hệ Phó Bản PvE (`/api/xianxia/dungeons`):
1. `GET /api/xianxia/dungeons` — Lấy danh sách cấu hình phó bản khả dụng (Điều kiện cảnh giới, thể lực, đợt quái, phần thưởng dự kiến).
2. `POST /api/xianxia/dungeons/:dungeonId/enter` — Đội trưởng khởi chạy phó bản cho toàn đội (Body: `{ idempotencyKey }`).
3. `GET /api/xianxia/dungeons/run/:runId` — Lấy trạng thái phiên phó bản đang chạy (Wave, quái vật, HP các thành viên).
4. `POST /api/xianxia/dungeons/run/:runId/combat-step` — Thực hiện hiệp đấu / lượt công kích tiếp theo (Server-authoritative loop).
5. `POST /api/xianxia/dungeons/run/:runId/claim-reward` — Nhận thưởng sau khi vượt phó bản thành công (Idempotency key).
6. `POST /api/xianxia/dungeons/run/:runId/reconnect` — Đồng bộ và kết nối lại phiên khi mất mạng.

---

### 3.2. Thiết kế Sự Kiện Realtime Socket.IO

Sử dụng namespace `/xianxia-chat` (hoặc mở rộng module `/xianxia-coop`). Tận dụng Room isolation:
- `xianxia:user:${characterId}`: Kênh riêng của từng nhân vật để nhận lời mời tức thì (`party:invite_received`).
- `xianxia:party:${partyId}`: Kênh phòng của tổ đội (Đồng bộ thành viên, sẵn sàng, giải tán).
- `xianxia:dungeon:${runId}`: Kênh phòng của phó bản (Đồng bộ HP, nhật ký hiệp đấu, chuyển đợt quái, kết quả thắng/thua).

#### Danh sách sự kiện hai chiều:
| Sự kiện Socket | Hướng | Mô tả |
| :--- | :---: | :--- |
| `party:invite` | Client $\rightarrow$ Server | Gửi lời mời tới `inviteeCharacterId` |
| `party:invite_received` | Server $\rightarrow$ Client | Báo hiệu có lời mời tổ đội mới tới người nhận |
| `party:invite_response` | Client $\rightarrow$ Server | Phản hồi ACCEPT hoặc REJECT |
| `party:state` | Server $\rightarrow$ Room | Phát sóng danh sách thành viên và trạng thái sẵn sàng |
| `party:member_joined` | Server $\rightarrow$ Room | Có thành viên mới gia nhập |
| `party:member_left` | Server $\rightarrow$ Room | Thành viên rời đội hoặc bị trục xuất |
| `party:disbanded` | Server $\rightarrow$ Room | Tổ đội đã giải tán |
| `dungeon:started` | Server $\rightarrow$ Room | Đội trưởng kích hoạt phó bản, client tự động mở giao diện chiến đấu |
| `dungeon:state` | Server $\rightarrow$ Room | Cập nhật wave hiện tại, HP quái vật và HP các thành viên |
| `dungeon:combat_log` | Server $\rightarrow$ Room | Phát sóng diễn biến hiệp đấu (Ai đánh, sát thương bao nhiêu, bạo kích, né đòn) |
| `dungeon:completed` | Server $\rightarrow$ Room | Phó bản hoàn thành, Boss bị trảm, mở quyền nhận thưởng |
| `dungeon:failed` | Server $\rightarrow$ Room | Toàn đội tử trận hoặc hết thời gian |
| `dungeon:reconnect` | Client $\rightarrow$ Server | Khôi phục trạng thái chuẩn khi kết nối lại |

> **Lưu ý Kiến trúc Multi-instance:**  
> Hệ thống hiện tại vận hành trên **Single Instance Node.js**, không sử dụng Redis Pub/Sub adapter. Mọi phòng Socket.IO và sự kiện đồng bộ được quản lý trong bộ nhớ của tiến trình đơn. Trạng thái gốc (Ground Truth) được lưu trực tiếp trong PostgreSQL/Supabase DB để đảm bảo độ tin cậy khi người chơi reconnect hoặc server khởi động lại.

---

## 4. CHI TIẾT NGHIỆP VỤ PHÓ BẢN MVP: U MINH CỔ ĐỘNG

- **Mã Phó Bản:** `dungeon_u_minh_co_dong`
- **Tên:** U Minh Cổ Động (Yêu Sào Rừng Trúc)
- **Điều kiện vào cửa:**
  - Cảnh giới tối thiểu: `LUYEN_KHI_1` (Luyện Khí Tầng 1).
  - Thể lực khấu trừ: 15 Thể Lực cho mỗi thành viên khi bắt đầu vào cửa.
  - Số lượng thành viên: 1 đến 4 người.
  - Yêu cầu: 100% thành viên trong đội phải ở trạng thái Sẵn Sàng (`is_ready: true`).
- **Thời hạn phiên:** 15 phút (Timeout sau 900 giây).
- **Cấu trúc 3 Đợt Quái (Waves):**
  - **Đợt 1 (Tiền Tiêu):** 2x Thảo Mộc Tinh (`monster_thao_moc_tinh`, Max HP: 120, Công: 22, Thủ: 10).
  - **Đợt 2 (Hộ Vệ):** 1x U Minh Lang (`monster_u_minh_lang`, Max HP: 240, Công: 38, Thủ: 18) + 1x Thổ Lang (`monster_tho_lang`, Max HP: 80, Công: 15, Thủ: 5).
  - **Đợt 3 (Trùm Cuối):** 1x U Minh Lang Vương (`boss_u_minh_lang_vuong`, Max HP: 950, Công: 75, Thủ: 45, Tốc độ: 22, Kỹ năng: Lang Vương Cuồng Hống, Ám Ảnh Liệt Trảo).
- **Quy tắc tính toán chiến đấu tổ đội phía Server:**
  - Vòng lặp hiệp đấu sắp xếp thứ tự hành động dựa trên `Speed` (Thân pháp) của tất cả người chơi còn sống và quái vật còn sống.
  - Người chơi hành động: Tự động trảm kích hoặc xuất Thần thông khi đủ Chân khí (Qi) vào quái vật mục tiêu.
  - Quái vật hành động: Lựa chọn ngẫu nhiên một thành viên còn sống để tấn công (hoặc thành viên có sát thương cao nhất).
  - Trạng thái thành viên: Khi HP rơi về 0, thành viên rơi vào trạng thái `is_alive: false`. Nếu toàn bộ thành viên tử trận $\rightarrow$ Kết quả `FAILED`. Nếu trảm sạch quái vật ở Đợt 3 $\rightarrow$ Kết quả `COMPLETED`.
- **Quy tắc phần thưởng chuẩn (Server-Authoritative):**
  - EXP: 300 EXP cho mỗi thành viên tham gia.
  - Tu Vi: 120 Điểm (156 nếu sở hữu Thiên Linh Căn).
  - Bạc: Ngẫu nhiên 80 - 150 Bạc.
  - Rơi đồ: 1x Yêu Đan Nhất Giai (U Minh) (100%), 2-5x Linh Thạch Vụn (80%), 40% cơ hội Bản Vẽ Thanh Phong Kiếm.
  - Cấp thưởng thông qua bảng `XianxiaDungeonRewardClaim` có ràng buộc `@unique([dungeon_run_id, character_id])` để ngăn chặn tuyệt đối việc nhận thưởng trùng.

---

## 5. CÁC RỦI RO CẠNH TRANH DỮ LIỆU & GIẢI PHÁP PHÒNG VỆ

### 5.1. Rủi ro vượt quá 4 thành viên khi có nhiều lời mời chấp nhận đồng thời
- **Tình huống:** Đội trưởng mời 4 người khi đội đã có 2 người. 3 người cùng bấm Chấp Nhận (`ACCEPT`) tại cùng một mili-giây.
- **Giải pháp:**
  - Khóa hàng bi quan trên bảng `xianxia_parties`:
    ```sql
    SELECT id, max_members FROM xianxia_parties WHERE id = $1 FOR UPDATE;
    ```
  - Đếm số lượng thành viên thực tế hiện tại trong transaction. Nếu `count >= max_members`, quăng lỗi `PARTY_FULL` và từ chối lời mời.
  - Ràng buộc `character_id @unique` trong bảng `xianxia_party_members` đảm bảo một nhân vật không thể bị gán vào hai đội khác nhau.

### 5.2. Rủi ro Spam tạo phó bản hoặc nhiều request Enter Dungeon đồng thời
- **Tình huống:** Đội trưởng bấm nhiều lần hoặc gửi song song request `enter`.
- **Giải pháp:**
  - Kiểm tra trạng thái `party.status === 'FORMING'`.
  - Khóa hàng `xianxia_parties WHERE id = $1 FOR UPDATE`. Chuyển ngay trạng thái sang `IN_DUNGEON`. Request đến sau sẽ bị từ chối với lỗi `PARTY_ALREADY_IN_DUNGEON`.
  - Scoped Idempotency Key: `dungeon:start:p{partyId}:{rawKey}` đảm bảo nếu retry cùng request sẽ trả về run ID đã tạo.

### 5.3. Rủi ro gian lận kết quả và nhận thưởng kép (Duplicate Claim Exploitation)
- **Tình huống:** Client tự gửi gói tin báo "Ta đã thắng" hoặc gửi 10 request nhận thưởng đồng thời để nhân bản Linh Thạch.
- **Giải pháp:**
  - Client không có quyền gửi kết quả chiến đấu! Kết quả thắng/thua do máy chủ tính toán và lưu trực tiếp vào CSDL (`dungeon_runs.status = 'COMPLETED'`).
  - Endpoint nhận thưởng chỉ mở khi `status === 'COMPLETED'`.
  - Transaction nhận thưởng thực hiện khóa và kiểm tra bảng `XianxiaDungeonRewardClaim`. Khóa duy nhất `@@unique([dungeon_run_id, character_id])` là bức tường vật lý chặn đứng 100% việc nhận thưởng lần 2.

### 5.4. Tránh Deadlock khi khóa nhiều nhân vật trong Tổ Đội
- **Tình huống:** Khi vào phó bản, hệ thống cần khấu trừ thể lực của 4 thành viên. Nếu khóa ngẫu nhiên, hai transaction đồng thời có thể gây Deadlock.
- **Giải pháp:**
  - Sắp xếp danh sách `character_id` theo thứ tự tăng dần:
    ```sql
    SELECT id, fatigue FROM xianxia_characters WHERE id IN ($1, $2, $3, $4) ORDER BY id FOR UPDATE;
    ```
  - Triệt tiêu hoàn toàn khả năng xảy ra chu trình chờ khóa (Deadlock-Free).

---

## 6. LỘ TRÌNH TRIỂN KHAI 5 GIAI ĐOẠN (M4.3.3A — M4.3.3E)

```
[Giai đoạn 0: Khảo sát & Kế hoạch] (HOÀN TẤT)
       │
       ▼
[M4.3.3A: Party Backend] ──► Schema, Migration, CRUD Tổ Đội, Mời, Giới hạn 4 người, Pessimistic Lock, Unit Tests
       │
       ▼
[M4.3.3B: Dungeon Backend] ──► Cấu hình Phó bản, Instance, Authoritative Combat Loop, Cấp thưởng Idempotent, Tests
       │
       ▼
[M4.3.3C: Realtime Socket] ──► Socket.IO Rooms, Đồng bộ Tổ đội & Phó bản, Reconnect, Kiểm tra quyền Room
       │
       ▼
[M4.3.3D: Frontend UI] ────► Giao diện Tổ đội, Danh sách thành viên, Phòng chờ, Sàn đấu Phó bản, HP Bar, Combat Logs
       │
       ▼
[M4.3.3E: Nghiệm Thu] ─────► Chạy toàn bộ Test Suites, Concurrency Audit, Browser Checklist, Báo cáo Nghiệm thu
```

### Chi tiết từng giai đoạn:

### M4.3.3A — Party Backend
- Cập nhật `schema.prisma` và chạy Prisma migration an toàn.
- Xây dựng `XianxiaPartyService`, `xianxiaPartyController.ts`, `xianxiaPartyRoutes.ts`.
- Triển khai logic: Tạo đội, mời bằng ID nhân vật, chấp nhận, từ chối, rời đội, giải tán, chuyển đội trưởng.
- Khóa bi quan chống race condition khi vượt quá 4 thành viên.
- Viết bộ kiểm thử chuyên biệt `backend/src/tests/xianxiaM4Party.test.ts`.

### M4.3.3B — Dungeon Backend
- Xây dựng `XianxiaDungeonService`, `xianxiaDungeonController.ts`, `xianxiaDungeonRoutes.ts`.
- Định nghĩa dữ liệu cấu hình `dungeon_u_minh_co_dong`.
- Tạo phiên phó bản, kiểm tra điều kiện toàn đội, trừ 15 thể lực.
- Xây dựng Engine tính toán chiến đấu tổ đội nhiều thành viên phía server.
- Xử lý hoàn thành phó bản, thất bại, hết hạn phiên, và cấp thưởng an toàn.
- Viết bộ kiểm thử chuyên biệt `backend/src/tests/xianxiaM4Dungeon.test.ts`.

### M4.3.3C — Realtime Socket.IO
- Xây dựng `backend/src/socket/xianxiaCoopSocket.ts` và gắn vào `server.ts`.
- Xác thực JWT ở cấp socket handshake, kiểm tra quyền gia nhập room.
- Phát sóng các sự kiện tổ đội và diễn biến từng hiệp đấu phó bản theo thời gian thực.
- Xử lý ngắt kết nối (`disconnect`) và phục hồi trạng thái khi kết nối lại (`reconnect`).

### M4.3.3D — Frontend Integration
- Cập nhật `tien-lo.html` và `tienlo-engine.js`.
- Bổ sung UI Dock Tổ Đội: Tạo đội, danh sách thành viên, nút Sẵn Sàng, popup mời đạo hữu.
- Bổ sung UI Phó Bản: Danh sách phó bản, yêu cầu tu vi, nút Vào Cửa.
- Bổ sung UI Đấu Trường Phó Bản: Hiển thị đợt quái, thanh máu HP từng thành viên, nhật ký chiến đấu thời gian thực, bảng tổng kết phần thưởng.
- Xử lý mượt mà trạng thái mất mạng và kết nối lại. Bảo đảm không ảnh hưởng đến các panel cũ.

### M4.3.3E — Nghiệm Thu & Đóng Milestone
- Chạy `npm run build` để kiểm tra tính sạch sẽ 100% của TypeScript.
- Thực thi tất cả các test suite của dự án (Kỳ Biến, PvP, Chat, Tông Môn, Tổ Đội, Phó Bản).
- Kiểm tra tính toàn vẹn CSDL (Database baseline).
- Lập checklist kiểm thử giao diện thủ công 8 kịch bản.
- Lập báo cáo nghiệm thu chính thức `docs/M4_3_3_FINAL_ACCEPTANCE_REPORT.md`.

---

## 7. TIÊU CHÍ NGHIỆM THU TỔNG THỂ

1. **Tính đúng đắn của Tổ đội:**
   - Một nhân vật tại một thời điểm chỉ thuộc tối đa 1 tổ đội.
   - Số lượng thành viên không bao giờ vượt quá 4 người, kể cả khi có nhiều yêu cầu chấp nhận đồng thời.
   - Chỉ Đội trưởng mới có quyền mời thành viên, kích thành viên và kích hoạt phó bản.
2. **Tính thẩm quyền của Phó bản (Server-Authoritative):**
   - 100% quyết định chiến đấu, sát thương, thứ tự hiệp đấu và kết quả thắng/thua do máy chủ quyết định.
   - Client không thể can thiệp hoặc tự gửi kết quả.
   - Phiên kết thúc hoặc hết hạn không thể tiếp tục gây sát thương hoặc nhận thưởng.
3. **An toàn Phần thưởng & Idempotency:**
   - Mỗi thành viên chỉ nhận thưởng tối đa 1 lần cho một lượt phó bản.
   - Thao tác gửi lại (retry) trả về kết quả cũ mà không cộng thêm tài nguyên.
4. **Không hồi quy (Zero Regressions):**
   - Tất cả 32 test suite hiện có đều tiếp tục PASS 100%.
   - Hệ thống cờ Kỳ Biến, Tông Môn và Chat hoạt động ổn định bình thường.
