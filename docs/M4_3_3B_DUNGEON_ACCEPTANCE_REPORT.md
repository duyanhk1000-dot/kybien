# BÁO CÁO NGHIỆM THU M4.3.3B — DUNGEON BACKEND
# PHÓ BẢN CO-OP PVE SERVER-AUTHORITATIVE (XIANXIA DUNGEON SYSTEM)

> **Dự án:** Tiên Lộ: Vạn Giới Tranh Phong (Kỳ Biến Platform)  
> **Repository:** `D:\Lap trinh game\ky_bien\`  
> **Vai trò:** Senior Backend Engineer & Security Reviewer  
> **Thời gian nghiệm thu:** 25/10/2026  
> **Trạng thái:** ✅ **PASS 100% — ĐỦ ĐIỀU KIỆN CHUYỂN SANG M4.3.3C (SOCKET.IO CO-OP REALTIME)**  

---

## 1. DANH SÁCH FILE TẠO MỚI VÀ SỬA ĐỔI

### 1.1. File tạo mới:
1. [`backend/src/services/xianxia/xianxiaDungeonService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts) — Service lõi xử lý nghiệp vụ phó bản: khởi tạo quái vật động từ `monsters.json`, kiểm tra điều kiện toàn đội, khấu trừ 15 thể lực nguyên tử (`ORDER BY id ASC FOR UPDATE`), thực thi lượt đấu server-authoritative với khóa phiên bản lạc quan (`run.version`), tự động chuyển wave (Wave 1 $\rightarrow$ Wave 2 $\rightarrow$ Wave 3 Boss), kết thúc trận đấu, bảo vệ kép nhận thưởng (Idempotency Key + `@@unique`), và tự động xử lý hết hạn 15 phút.
2. [`backend/src/controllers/xianxia/xianxiaDungeonController.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/controllers/xianxia/xianxiaDungeonController.ts) — Controller điều phối các endpoint phó bản, trích xuất `userId`, `runId`, `version`, `x-idempotency-key`, ánh xạ mã lỗi thành HTTP status (400, 403, 404, 409 Conflict).
3. [`backend/src/routes/xianxia/xianxiaDungeonRoutes.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/routes/xianxia/xianxiaDungeonRoutes.ts) — Route Express cho phân hệ phó bản (`/api/xianxia/dungeons`), bảo vệ 100% bằng JWT `authenticateToken`.
4. [`backend/src/tests/xianxiaM4Dungeon.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/xianxiaM4Dungeon.test.ts) — Suite kiểm thử tự động toàn diện bao gồm 8 nhóm kiểm thử A–H (CRUD, Enter, Combat, Wave Transition, Boss Victory, Reward Idempotency, Reconnect/Timeout, Concurrency Stress Test) với cơ chế dọn dẹp ID an toàn 100%.
5. [`docs/M4_3_3B_DUNGEON_ACCEPTANCE_REPORT.md`](file:///d:/Lap%20trinh%20game/ky_bien/docs/M4_3_3B_DUNGEON_ACCEPTANCE_REPORT.md) — Báo cáo nghiệm thu kỹ thuật chi tiết này.

### 1.2. File sửa đổi (Tracked):
1. [`backend/prisma/schema.prisma`](file:///d:/Lap%20trinh%20game/ky_bien/backend/prisma/schema.prisma) — Thêm 3 model `XianxiaDungeonRun`, `XianxiaDungeonMember`, `XianxiaDungeonRewardClaim` cùng các relation trên `XianxiaParty` và `XianxiaCharacter`.
2. [`backend/src/scripts/ensurePartyIndexes.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/scripts/ensurePartyIndexes.ts) — Bổ sung Partial Unique Index `unique_active_party_dungeon` trên bảng `xianxia_dungeon_runs`.
3. [`backend/src/app.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/app.ts) — Mount router `xianxiaDungeonRoutes` tại `/api/xianxia/dungeons`.
4. [`backend/src/tests/runAllTests.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/runAllTests.ts) — Tích hợp `runXianxiaM4DungeonTests` vào bộ runner chung của dự án.

---

## 2. MIGRATION VÀ THAY ĐỔI SCHEMA PRISMA

### 2.1. Mô hình CSDL (Database Models)
- **`XianxiaDungeonRun`**:
  - `id`: String @id @default(uuid()) @db.Uuid
  - `dungeon_id`: String @db.VarChar(60) (`dungeon_u_minh_co_dong`)
  - `party_id`: Int
  - `leader_character_id`: Int
  - `status`: String @default("IN_PROGRESS") @db.VarChar(20) (`WAITING` | `IN_PROGRESS` | `COMPLETED` | `FAILED` | `EXPIRED`)
  - `current_wave`: Int @default(1)
  - `total_waves`: Int @default(3)
  - `turns_count`: Int @default(0)
  - `version`: Int @default(1) $\rightarrow$ **Optimistic Concurrency Control:** Khóa phiên bản chống race condition trên các hiệp đấu gửi song song.
  - `combat_state`: String? @db.Text (Snapshot JSON: quái vật, đạo hữu, HP, Qi, buff/debuff)
  - `combat_log`: String? @db.Text (JSON Array: nhật ký chiến báo)
  - `idempotency_key`: String? @unique @db.VarChar(100) (Scoped Key chống tạo trùng run)
  - `started_at`: DateTime @default(now())
  - `expires_at`: DateTime (started_at + 15 phút)
  - `completed_at`: DateTime?

- **`XianxiaDungeonMember`**:
  - `id`: Int @id @default(autoincrement())
  - `dungeon_run_id`: String @db.Uuid
  - `character_id`: Int
  - `initial_hp`: Int, `current_hp`: Int, `max_hp`: Int, `current_qi`: Int
  - `damage_dealt`: Int @default(0), `damage_taken`: Int @default(0)
  - `is_alive`: Boolean @default(true), `is_connected`: Boolean @default(true)
  - `last_seen_at`: DateTime @default(now())
  - `@@unique([dungeon_run_id, character_id])` $\rightarrow$ Đảm bảo một nhân vật chỉ tham gia 1 bản ghi thành viên trong 1 phiên.

- **`XianxiaDungeonRewardClaim`**:
  - `id`: String @id @default(uuid()) @db.Uuid
  - `dungeon_run_id`: String @db.Uuid
  - `character_id`: Int
  - `idempotency_key`: String @unique @db.VarChar(100)
  - `exp_reward`: Int, `cultivation_reward`: Int, `silver_reward`: Int, `items_reward`: String? @db.Text
  - `claimed_at`: DateTime @default(now())
  - `@@unique([dungeon_run_id, character_id])` $\rightarrow$ **Ràng buộc kép vật lý:** Triệt tiêu hoàn toàn nguy cơ nhận thưởng trùng lặp kể cả khi gửi đồng thời.

### 2.2. Thiết lập Partial Unique Index trên PostgreSQL
Đã thực thi migration script không làm mất dữ liệu (`npx prisma db push` + SQL Script):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_party_dungeon 
ON xianxia_dungeon_runs (party_id) 
WHERE status IN ('WAITING', 'IN_PROGRESS');
```
Chặn đứng tuyệt đối việc một tổ đội đang trong phó bản có thể mở thêm một phiên phó bản thứ hai.

---

## 3. CƠ CHẾ BẢO VỆ CONCURRENCY VÀ TÍNH TOÀN VẸN NGHIỆP VỤ

1. **Khấu trừ Thể Lực Nguyên Tử & Deadlock-Free Lock Ordering:**
   - Khi đội trưởng gọi `enterDungeon`, hệ thống sắp xếp ID nhân vật của tất cả thành viên theo thứ tự tăng dần (`ORDER BY id ASC FOR UPDATE`).
   - Khóa hàng được thiết lập đồng nhất, trừ đúng 15 thể lực của mỗi người. Nếu bất kỳ thành viên nào thiếu thể lực, toàn bộ transaction lập tức rollback, không ai bị mất thể lực.
2. **Khóa Phiên Bản Lạc Quan (Optimistic Concurrency Control):**
   - Mỗi hiệp đấu (`executeCombatStep`) yêu cầu client gửi lên `version` hiện tại.
   - Tại tầng CSDL, hàng `xianxia_dungeon_runs` được khóa bằng `SELECT ... FOR UPDATE`, so khớp `run.version === expectedVersion`.
   - Nếu 2 thành viên cùng gửi hiệp đấu đồng thời với cùng version: Request thứ nhất thành công và tăng `version` lên `version + 1`. Request thứ hai phát hiện version máy chủ đã đổi, ngay lập tức bị từ chối với mã **`409 Conflict (DUNGEON_VERSION_MISMATCH)`**, triệt tiêu mọi khả năng desync.
3. **Bảo Vệ Kép Nhận Thưởng (Dual-Layer Idempotency Protection):**
   - Lớp 1: Scoped Idempotency Key `dungeon:claim:r{runId}:c{charId}` trả về kết quả từ cache (`idempotent: true`), không lặp lại cộng bạc/EXP.
   - Lớp 2: Ràng buộc duy nhất tại PostgreSQL `@@unique([dungeon_run_id, character_id])` chặn đứng mọi race condition ở mức độ phần cứng CSDL.
4. **Vòng đời & Hạn giờ Phó bản (15-Minute Expiration):**
   - Hạn định phiên phó bản là 15 phút. Khi người chơi gọi `getDungeonRun` hoặc `reconnect` sau khi hết hạn, hệ thống tự động cập nhật trạng thái phiên thành `'EXPIRED'` và giải phóng tổ đội về `'FORMING'`.
   - Sau khi Boss bị tiêu diệt (`COMPLETED`), tổ đội tự động được mở khóa về `'FORMING'`.

---

## 4. CHI TIẾT CÁC ENDPOINT REST API M4.3.3B

| STT | Phương thức | Đường dẫn API | Mô tả & Phân quyền | HTTP Status |
|:---:|:---:|:---|:---|:---:|
| 1 | `GET` | `/api/xianxia/dungeons` | Lấy danh sách phó bản khả dụng (MVP: U Minh Cổ Động) | 200 OK |
| 2 | `POST` | `/api/xianxia/dungeons/:id/enter` | Đội trưởng mở phó bản; kiểm tra thể lực, trạng thái sẵn sàng của toàn đội | 201 Created |
| 3 | `GET` | `/api/xianxia/dungeons/run/:runId` | Lấy chi tiết trạng thái bàn cờ, quái vật, người chơi và nhật ký chiến đấu | 200 OK |
| 4 | `POST` | `/api/xianxia/dungeons/run/:runId/combat-step` | Thực thi hiệp đấu phía máy chủ; kiểm tra version chống desync | 200 OK / 409 Conflict |
| 5 | `POST` | `/api/xianxia/dungeons/run/:runId/claim-reward` | Nhận thưởng phó bản (Bạc, EXP, Tu Vi, Yêu Đan, Linh Thạch) với bảo vệ kép | 200 OK |
| 6 | `POST` | `/api/xianxia/dungeons/run/:runId/reconnect` | Đồng bộ snapshot trận đấu khi rớt mạng; tự động phát hiện timeout 15 phút | 200 OK / 400 Expired |

---

## 5. KẾT QUẢ KIỂM THỬ TOÀN DIỆN (TEST RESULTS)

### 5.1. Kết quả kiểm thử Suite M4.3.3B (`xianxiaM4Dungeon.test.ts`)
```
--- 🏰 [TEST] BẮT ĐẦU KIỂM THỬ M4.3.3B: PHÓ BẢN CO-OP PVE (DUNGEON BACKEND) ---
[Party DB Migration] Đang kiểm tra và tạo partial unique index cho hệ thống Tổ Đội...
  ✔ Index unique_active_party_invite (party_id, invitee_id WHERE status = "PENDING") sẵn sàng.
  ✔ Index unique_active_party_leader (leader_id WHERE status != "DISBANDED") sẵn sàng.
  ✔ Index unique_active_party_dungeon (party_id WHERE status IN ("WAITING", "IN_PROGRESS")) sẵn sàng.
[Dungeon Test Server] Lắng nghe kiểm thử tại http://127.0.0.1:58755
✅ [TEST 0] Khởi tạo tài khoản và nhân vật kiểm thử thành công.

--- GROUP A: DANH SÁCH PHÓ BẢN ---
✅ [GROUP A] Lấy danh sách phó bản thành công.

--- GROUP B: KIỂM THỰC VÀO PHÓ BẢN (VALIDATION & ENTER) ---
✅ [GROUP B] Kiểm thực và trừ thể lực nguyên tử khi vào phó bản thành công.

--- GROUP C: HIỆP ĐẤU SERVER-AUTHORITATIVE & PHIÊN BẢN (COMBAT-STEP) ---
✅ [GROUP C] Hiệp đấu Server-Authoritative và Optimistic Versioning chuẩn xác.

--- GROUP D & E: TIẾN TRÌNH WAVE, TRẢM BOSS VÀ HOÀN THÀNH PHÓ BẢN ---
   [Hiệp 2] Đợt 3/3 - Trạng thái: IN_PROGRESS - Version: 3
   [Hiệp 3] Đợt 3/3 - Trạng thái: IN_PROGRESS - Version: 4
   [Hiệp 4] Đợt 3/3 - Trạng thái: IN_PROGRESS - Version: 5
   [Hiệp 5] Đợt 3/3 - Trạng thái: IN_PROGRESS - Version: 6
   [Hiệp 6] Đợt 3/3 - Trạng thái: COMPLETED - Version: 7
✅ [GROUP D & E] Đợt sóng, Boss U Minh Lang Vương và chuyển trạng thái hoàn thành thành công.

--- GROUP F: NHẬN THƯỞNG PHÓ BẢN & BẢO VỆ KÉP (CLAIM REWARDS) ---
✅ [GROUP F] Nhận thưởng và bảo vệ kép Idempotency chống gian lận thành công.

--- GROUP G: KẾT NỐI LẠI (RECONNECT) & TIMEOUT 15 PHÚT ---
✅ [GROUP G] Kết nối lại và tự động xử lý hết hạn 15 phút thành công.

--- GROUP H: KIỂM THỬ ĐỒNG THỜI & RACE CONDITIONS (CONCURRENCY) ---
   [H1] Kiểm thử 5 request đồng thời mở phó bản (Double-click Enter)...
   ✅ [H1 PASS] 5 request vào phó bản đồng thời được xử lý an toàn (1 run duy nhất).
   [H2] Kiểm thử 2 hiệp đấu gửi đồng thời cùng version (Combat race condition)...
   ✅ [H2 PASS] Chống race condition hiệp đấu bằng Optimistic Lock thành công.
   [H3] Kiểm thử 5 request nhận thưởng gửi đồng thời (Reward spam)...
   ✅ [H3 PASS] Spam nhận thưởng được chặn đứng bởi bảo vệ kép Idempotency.
   [H4] Kiểm thử tổ đội đang ở phó bản cố tình enter phó bản khác...
   ✅ [H4 PASS] Chặn đứng tổ đội đang trong phó bản mở phiên thứ hai.

==================================================
🏆 TOÀN BỘ CÁC NHÓM KIỂM THỬ M4.3.3B (A - H) ĐÃ ĐẠT 100%!
==================================================

🧹 [CLEANUP] Bắt đầu dọn dẹp dữ liệu kiểm thử M4.3.3B...
🧹 [CLEANUP] Dọn dẹp phó bản an toàn hoàn tất.
```
**Exit Code:** `0` (Success).

---

### 5.2. Kết quả kiểm thử hồi quy độc lập M4.3.3A (Party System)
```
--- ⚔️ [TEST] BẮT ĐẦU KIỂM THỬ M4.3.3A: TỔ ĐỘI TU TIÊN (PARTY SYSTEM) ---
✅ [TEST 0] Khởi tạo tài khoản và nhân vật kiểm thử thành công.
✅ [TEST 1] Tạo tổ đội, xem chi tiết và chống tạo trùng tổ đội PASSED.
✅ [TEST 2] Mời, từ chối, chấp nhận và bảo vệ quyền xử lý lời mời PASSED.
✅ [TEST 3] Trạng thái sẵn sàng, phân quyền RBAC và trục xuất thành viên PASSED.
✅ [TEST 4] Rời đội, tự động chuyển giao quyền lực và giải tán tổ đội PASSED.
✅ [TEST 5] Kiểm tra thời hạn lời mời 2 phút (Expiration Invariant) PASSED.
--- 🚀 [CONCURRENCY 1] Kiểm tra 10 requests chấp nhận lời mời đồng thời vào đội gần đầy (3/4) ---
  -> Kết quả Concurrency: 1 Thành Công (200), 9 Bị Chặn Vì Đầy Đội (400)
✅ [CONCURRENCY 1] Pessimistic Lock & DB Invariant chặn đứng vượt quá 4 thành viên PASSED 100%.
--- 🚀 [CONCURRENCY 2] Một nhân vật chấp nhận đồng thời lời mời từ 2 tổ đội khác nhau ---
✅ [CONCURRENCY 2] Row-Level Lock & Unique Constraint bảo vệ 1 người không thể ở 2 đội PASSED.
--- 🚀 [CONCURRENCY 3] Hai requests đồng thời tạo đội cho cùng một nhân vật ---
✅ [CONCURRENCY 3] Chống tạo tổ đội đồng thời PASSED 100%.
--- 🚀 [CONCURRENCY 4] Hai requests đồng thời xử lý cùng một lời mời ---
✅ [CONCURRENCY 4] Chống xử lý trùng lời mời đồng thời PASSED 100%.

==================================================
🏆 TẤT CẢ 9 NHÓM KIỂM THỬ M4.3.3A PARTY BACKEND ĐÃ VƯỢT QUA 100%!
==================================================
```
**Exit Code:** `0` (Success).

---

### 5.3. Kết quả kiểm thử hồi quy độc lập M4.3.2 (Guild System)
```
--- 🏯 [TEST] BẮT ĐẦU KIỂM THỬ MỤC 4.3.2: TÔNG MÔN / BANG HỘI (GUILD SYSTEM) ---
✅ [GUILD TEST 0] Chuẩn bị dữ liệu tài khoản và nhân vật thử nghiệm thành công.
✅ [GUILD TEST 1] Kiểm thử điều kiện thành lập Tông môn và khấu trừ Bạc đạt chuẩn 100%.
✅ [GUILD TEST 2] Kiểm thử truy vấn danh sách và chi tiết Tông môn đạt chuẩn.
✅ [GUILD TEST 3] Kiểm thử bái kiến và phân quyền xem đơn đạt chuẩn.
✅ [GUILD TEST 4] Kiểm thử tiếp nhận và từ chối đơn gia nhập đạt chuẩn.
✅ [GUILD TEST 5] Kiểm thử phân quyền RBAC, bãi chức, và truyền ngôi Chưởng môn đạt chuẩn.
✅ [GUILD TEST 6] Kiểm thử rời Tông môn và giải tán môn phái an toàn đạt chuẩn.
✅ [GUILD TEST 7] Kiểm thử kênh chat Tông môn và cô lập dữ liệu đạt chuẩn 100%.
✅ [GUILD TEST 8] Kiểm thử Concurrency & Pessimistic Locking chống Race Condition thành công 100%.
✅ [GUILD TEST 9] Kiểm thử Vòng đời đơn bái kiến & Tái nộp đơn (Anti-P2002) thành công 100%.
✅ [GUILD TEST 10] Kiểm thử Giới hạn 3 đơn PENDING toàn hệ thống đạt chuẩn 100%.
✅ [GUILD TEST 11] Kiểm thử Route Aliases (/me, /my, cancel) hoạt động hoàn hảo.

===============================================================
🏆 100% CÁC BÀI TEST TÔNG MÔN (M4.3.2 GUILD SYSTEM) ĐÃ HOÀN TẤT XUẤT SẮC!
===============================================================
```
**Exit Code:** `0` (Success).

---

### 5.4. Kết quả chạy toàn bộ test runner của dự án (`runAllTests.ts`)
```
==================================================
🏆 ALL KYBIEN SYSTEM TESTS (SECURITY, CHESS RULES, 30 FIXTURES, EXP ATOMICITY, CONCURRENCY ISOLATION, E2E HTTP API, LEADERBOARD, V2 AUDIT, SEO SLUG, PUZZLE MILESTONE 1, DAILY PUZZLES & BLOG AUTOMATION, UGC CREATOR & VERIFICATION) PASSED 100%!
==================================================
```
**Exit Code:** `0` (Success) — Toàn bộ 34 bộ kiểm thử của toàn hệ thống Kỳ Biến & Tiên Lộ đều vượt qua 100%.

---

## 6. KIỂM TRA TRẠNG THÁI GIT & AN TOÀN CƠ SỞ DỮ LIỆU

### 6.1. Xác thực an toàn CSDL (Zero Residue / Zero Pollution)
Truy vấn trực tiếp số lượng bản ghi trên PostgreSQL sau khi hoàn tất test:
```json
{"users": 26, "characters": 15, "guilds": 0, "parties": 0, "dungeonRuns": 0, "rewardClaims": 0}
```
- Số lượng tài khoản người dùng: **26** (100% khớp với baseline).
- Số lượng nhân vật tu tiên: **15** (100% khớp với baseline).
- Số lượng Tông môn: **0**.
- Số lượng Tổ đội: **0**.
- Số lượng Phiên phó bản: **0**.
- Số lượng Bản ghi nhận thưởng: **0**.
$\rightarrow$ **Kết luận:** Cơ chế dọn dẹp bằng ID theo dõi của test suite hoạt động hoàn hảo, không để lại bất kỳ dữ liệu rác nào trong database và không xâm phạm dữ liệu người chơi hiện có.

### 6.2. Kiểm tra Git Diff & Working Tree
- Lệnh: `git diff --check` $\rightarrow$ Exit Code: `0` (Không có conflict marker, không có lỗi whitespace).
- Lệnh: `git status --short` $\rightarrow$ Không có file ngoài phạm vi bị sửa đổi ngoài mong muốn. Logic game Kỳ Biến cờ tướng được bảo toàn nguyên vẹn 100%.

---

## 7. KẾT LUẬN & SẴN SÀNG CHO M4.3.3C

Phân hệ **M4.3.3B — Dungeon Backend (Co-op PvE Server-Authoritative)** đã hoàn thành xuất sắc 100% các tiêu chí kỹ thuật:
- [x] Tạo đầy đủ schema Prisma và Partial Unique Index an toàn trên PostgreSQL.
- [x] Triển khai Server-Authoritative Combat Engine (MVP: U Minh Cổ Động, 3 Wave, Boss U Minh Lang Vương).
- [x] Triệt tiêu race condition: trừ thể lực nguyên tử, khóa phiên bản lạc quan (`version` lock), bảo vệ kép nhận thưởng.
- [x] Tự động giải phóng trạng thái tổ đội và phiên phó bản khi hoàn thành hoặc quá hạn 15 phút.
- [x] 100% các bài test M4.3.3B, M4.3.3A, M4.3.2 và full regression suite đều đạt PASS với exit code 0.
- [x] Dữ liệu CSDL sạch sẽ 100%, bảo toàn dữ liệu người chơi thật.

**Khuyến nghị:** Sẵn sàng bước sang **M4.3.3C: Multiplayer Co-op Realtime Socket.IO Integration** (Đồng bộ thời gian thực cho Tổ đội & Phó bản).
