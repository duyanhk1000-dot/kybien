# BÁO CÁO AUDIT & HARDENING PHÂN HỆ M4.3.3B: DUNGEON BACKEND (CO-OP PVE)

> **Dự án:** Tiên Lộ: Vạn Giới Tranh Phong & Kỳ Biến  
> **Repository:** `d:\Lap trinh game\ky_bien`  
> **Phân hệ:** M4.3.3B — Dungeon Backend (Co-op PvE Server-Authoritative)  
> **Giai đoạn:** Final Hardening Audit trước khi triển khai M4.3.3C (Socket.IO Realtime)  
> **Thời điểm thẩm định:** 2026-10-25T18:45:00+07:00  
> **Trạng thái phê duyệt:** 🟢 **PASSED 100% — HOÀN TOÀN ĐẠT CHUẨN ĐỂ MỞ CỔNG M4.3.3C**

---

## 1. TỔNG QUAN VÀ PHÁN QUYẾT NGHIỆM THU (EXECUTIVE SUMMARY)

Đợt audit và hardening kỹ thuật chuyên sâu này tập trung rà soát độc lập toàn bộ mã nguồn backend, mô hình dữ liệu PostgreSQL, cơ chế giao dịch và phòng chống race condition của phân hệ **M4.3.3B Dungeon Backend** trước khi chuyển sang giai đoạn **M4.3.3C Socket.IO Realtime**.

### Kết luận kiểm chứng độc lập:
- ✅ **Trạng thái nghiệm thu:** **PASS (100%)**.
- ✅ **State Machine & Orphaned States:** Không còn bất kỳ trạng thái mồ côi nào giữa Party và Dungeon Run.
- ✅ **Transaction Abort & Timeout Rollback:** Lỗi rollback khi phát hiện phiên quá hạn trong `executeCombatStep` và `claimReward` đã được khắc phục hoàn toàn bằng cơ chế bắt ngoại lệ và cập nhật nguyên tử độc lập ra ngoài transaction bị hủy.
- ✅ **Party Lifecycle Lock:** Đã bổ sung rào chắn kiểm tra trạng thái `party.status === 'IN_DUNGEON'` cho cả 3 thao tác `kickMember`, `leaveParty`, và `disbandParty` trong [`xianxiaPartyService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaPartyService.ts), ngăn chặn hoàn toàn việc người chơi đào tẩu hoặc giải tán đội hình khi trận chiến đang diễn ra.
- ✅ **9 Kịch bản Hardening Bắt buộc:** Toàn bộ 9 kịch bản mục tiêu từ Group I đã được bổ sung và thực thi thành công 100% trong test suite [`xianxiaM4Dungeon.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/xianxiaM4Dungeon.test.ts).
- ✅ **Tính toàn vẹn CSDL:** Số lượng bản ghi CSDL được bảo toàn tuyệt đối ở baseline (`26 users`, `15 characters`, `0 guilds`, `0 parties`, `0 dungeonRuns`, `0 rewardClaims`). Không có bất kỳ rò rỉ dữ liệu hay tác động ngoài phạm vi nào đến game Kỳ Biến.

---

## 2. KẾT QUẢ RÀ SOÁT MÃ NGUỒN & PHÁT HIỆN LỖI (AUDIT FINDINGS & FIXES)

### 2.1. Khắc phục lỗi Rollback khi Timeout bên trong Prisma `$transaction`
- **Vấn đề phát hiện:**  
  Trong hàm `executeCombatStep` và `claimReward` của [`xianxiaDungeonService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts), khi phát hiện `run.expires_at <= new Date()`, mã nguồn gọi lệnh cập nhật `tx.xianxiaDungeonRun.update({ status: 'EXPIRED' })` và `tx.xianxiaParty.update({ status: 'FORMING' })`, sau đó ngay lập tức ném ra ngoại lệ `throw new Error('DUNGEON_ALREADY_EXPIRED: ...')`.  
  Trong Prisma, việc ném ngoại lệ bên trong hàm callback của `$transaction` sẽ kích hoạt **Rollback toàn bộ giao dịch**. Do đó, các thay đổi trạng thái sang `EXPIRED` và `FORMING` bị hủy bỏ, dẫn đến việc phiên phó bản vẫn kẹt ở `IN_PROGRESS` và tổ đội vẫn bị kẹt ở `IN_DUNGEON` trong cơ sở dữ liệu.
- **Giải pháp xử lý triệt để:**  
  Bọc khối transaction bằng `try ... catch`. Khi phát hiện quá hạn, transaction chủ động hủy bỏ (không lưu hiệp đánh dở dang) và ném ngoại lệ chứa siêu dữ liệu `needsExpirePersist`. Khối `catch` bên ngoài ngay lập tức thực thi một transaction cập nhật độc lập để chuyển `run.status = 'EXPIRED'` và `party.status = 'FORMING'`.
- **Vị trí sửa:**  
  [`backend/src/services/xianxia/xianxiaDungeonService.ts#L480-L515`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts#L480-L515) và [`#L705-L720`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts#L705-L720).

### 2.2. Khắc phục thiếu sót kiểm tra `IN_DUNGEON` trong Party Lifecycle Mutations
- **Vấn đề phát hiện:**  
  Trong [`xianxiaPartyService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaPartyService.ts), các hàm `kickMember`, `leaveParty`, và `disbandParty` chỉ khóa hàng `xianxia_parties` nhưng không kiểm tra `party.status === 'IN_DUNGEON'`. Nếu thành viên rời đội, bị kick hoặc đội trưởng giải tán khi đang trong phó bản, bảng `xianxia_dungeon_members` sẽ mất tính toàn vẹn hoặc để lại phiên phó bản mồ côi không có tổ đội hợp lệ.
- **Giải pháp xử lý:**  
  Bổ sung kiểm tra nghiêm ngặt `if (party.status === 'IN_DUNGEON') throw new Error('PARTY_IN_DUNGEON: ...')` bên trong transaction có khóa hàng (`SELECT ... FOR UPDATE`) của cả 3 hàm `kickMember`, `leaveParty`, và `disbandParty`.
- **Vị trí sửa:**  
  [`backend/src/services/xianxia/xianxiaPartyService.ts#L565-L575`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaPartyService.ts#L565-L575), [`#L620-L630`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaPartyService.ts#L620-L630), và [`#L715-L725`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaPartyService.ts#L715-L725).

### 2.3. Bổ sung Khóa Hàng Bi quan (Pessimistic Row Lock) khi Nhận thưởng (`claimReward`)
- **Vấn đề phát hiện:**  
  Hàm `claimReward` trong [`xianxiaDungeonService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts) trước đây chỉ sử dụng `tx.xianxiaDungeonRun.findUnique` mà chưa khóa hàng bằng câu lệnh SQL raw `FOR UPDATE`.
- **Giải pháp xử lý:**  
  Thêm câu lệnh `await tx.$queryRawUnsafe('SELECT id, status, expires_at, party_id FROM xianxia_dungeon_runs WHERE id = $1::uuid FOR UPDATE', runId);` ngay đầu bước 2.1 của transaction để tuần tự hóa triệt để các yêu cầu đồng thời giữa claim reward và timeout.
- **Vị trí sửa:**  
  [`backend/src/services/xianxia/xianxiaDungeonService.ts#L765-L780`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts#L765-L780).

### 2.4. Khóa hàng và kiểm tra kép trạng thái `IN_DUNGEON` trong `createOrEnterDungeon`
- **Vấn đề phát hiện:**  
  Nếu 2 request enter được gửi đồng thời mà không dùng Idempotency key, request 2 sau khi đợi giải phóng khóa hàng tổ đội nếu không kiểm tra lại `freshParty.status === 'IN_DUNGEON'` sẽ tiếp tục trừ thể lực của các thành viên thêm một lần nữa.
- **Giải pháp xử lý:**  
  Sau khi khóa hàng tổ đội với `SELECT ... FOR UPDATE`, kiểm tra ngay `if (freshParty.status === 'IN_DUNGEON') throw new Error('DUNGEON_PARTY_ALREADY_IN_DUNGEON: ...')` và kiểm tra active run trong database. Do đó, request thứ 2 bị từ chối ngay lập tức trước khi chạm vào bất kỳ lệnh trừ thể lực nào.
- **Vị trí sửa:**  
  [`backend/src/services/xianxia/xianxiaDungeonService.ts#L290-L315`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts#L290-L315).

---

## 3. KIỂM CHỨNG CHI TIẾT 9 KỊCH BẢN HARDENING MỤC TIÊU (GROUP I)

Bộ kiểm thử [`xianxiaM4Dungeon.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/xianxiaM4Dungeon.test.ts) đã được mở rộng thêm phân hệ **GROUP I: FINAL HARDENING AUDIT** kiểm chứng độc lập cả 9 kịch bản:

```
--- GROUP I: FINAL HARDENING AUDIT (9 MANDATORY SCENARIOS) ---
   [SCENARIO 1] Kiểm thử toàn đội tử trận: Run -> FAILED, Party -> FORMING...
   ✅ [SCENARIO 1 PASS] Toàn đội tử trận chuyển run sang FAILED và giải phóng party sang FORMING thành công.
   [SCENARIO 2] Kiểm thử tổ đội vào phó bản mới sau khi COMPLETED...
   ✅ [SCENARIO 2 PASS] Vào phó bản mới sau COMPLETED thành công, không bị cản bởi partial unique index.
   [SCENARIO 3] Kiểm thử tổ đội vào phó bản mới sau khi FAILED...
   ✅ [SCENARIO 3 PASS] Vào phó bản mới sau FAILED thành công, partial index hợp lệ.
   [SCENARIO 4] Kiểm thử timeout và combat-step: không thể vừa EXPIRED vừa COMPLETED...
   ✅ [SCENARIO 4 PASS] Phiên hết hạn bị chặn chiến đấu, chuyển sang EXPIRED và trả party về FORMING.
   [SCENARIO 5] Kiểm thử timeout và claim-reward: từ chối cấp thưởng phiên quá hạn...
   ✅ [SCENARIO 5 PASS] Chặn claim reward trên phiên đã hết hạn/chưa hoàn thành.
   [SCENARIO 6] Kiểm thử 2 request enter đồng thời: không trừ thể lực 2 lần...
   ✅ [SCENARIO 6 PASS] Concurrency enter an toàn, không bị trừ thể lực 2 lần.
   [SCENARIO 7] Kiểm thử 1 thành viên thiếu thể lực gây rollback toàn bộ...
   ✅ [SCENARIO 7 PASS] Thiếu thể lực kích hoạt rollback nguyên tử thành công.
   [SCENARIO 8] Kiểm thử stale version: version cũ không thay đổi state và log...
   ✅ [SCENARIO 8 PASS] Stale version bị từ chối 409 và giữ nguyên bất biến state/log.
   [SCENARIO 9] Kiểm thử chặn leave, kick, disband khi tổ đội đang IN_DUNGEON...
   ✅ [SCENARIO 9 PASS] Chặn thành công leave, kick, disband khi party IN_DUNGEON.
```

### Chi tiết kỹ thuật từng kịch bản:

1. **Scenario 1 — Team Wipe $\rightarrow$ FAILED $\rightarrow$ Party freed (`FORMING`):**
   - Thiết lập HP người chơi về 1 trong snapshot chiến đấu. Quái vật ra đòn hạ gục toàn bộ thành viên.
   - Kết quả xác thực: `dungeonRun.status` chuyển thành `'FAILED'`, `party.status` được cập nhật về `'FORMING'`, HP nhân vật khi hồi sinh được thiết lập an toàn ở mức 20 HP.
2. **Scenario 2 — Vào phó bản mới sau khi `COMPLETED`:**
   - Sau khi phiên trước đạt trạng thái `COMPLETED` và tổ đội quay về `FORMING`, đội trưởng gọi lệnh vào phó bản mới.
   - Kết quả xác thực: Phiên mới được tạo thành công với mã run mới (HTTP 201), không bị chặn bởi partial index `unique_active_party_dungeon`.
3. **Scenario 3 — Vào phó bản mới sau khi `FAILED`:**
   - Sau khi phiên trước thất bại (`FAILED`), tổ đội ở trạng thái `FORMING` tiếp tục tham gia phó bản.
   - Kết quả xác thực: Phiên mới khởi tạo thành công (HTTP 201), partial index hoạt động chính xác vì điều kiện `WHERE status IN ('WAITING', 'IN_PROGRESS')` không áp dụng cho `FAILED`.
4. **Scenario 4 — Timeout vs Combat-step Concurrency:**
   - Phiên phó bản bị ép thời gian hết hạn (`expires_at` nhỏ hơn thời điểm hiện tại). Lệnh đánh hiệp tiếp theo bị từ chối với mã 400 (`DUNGEON_ALREADY_EXPIRED`).
   - Kết quả xác thực: `run.status` chuyển thành `'EXPIRED'`, `party.status` chuyển thành `'FORMING'`. Trạng thái không thể chuyển thành `COMPLETED`.
5. **Scenario 5 — Timeout vs Claim-reward Concurrency:**
   - Gọi nhận thưởng trên phiên phó bản đã hết hạn/chưa hoàn thành.
   - Kết quả xác thực: Yêu cầu bị từ chối với lỗi `DUNGEON_NOT_COMPLETED` (HTTP 400). Không có bản ghi nhận thưởng nào được tạo trong `xianxia_dungeon_reward_claims`, tài nguyên Bạc và Tu Vi giữ nguyên bất biến.
6. **Scenario 6 — Concurrency Enter Fatigue Atomicity:**
   - Bắn 2 request `POST /api/xianxia/dungeons/:id/enter` đồng thời mà không gửi idempotency key.
   - Kết quả xác thực: Đúng 1 request thành công (HTTP 201), request còn lại bị từ chối với HTTP 400. Thể lực của các thành viên chỉ bị khấu trừ chính xác 15 điểm (từ 60 còn 45 điểm), không bao giờ bị trừ 30 điểm.
7. **Scenario 7 — Lacking Fatigue Transaction Rollback:**
   - Đội trưởng có 80 thể lực, nhưng 1 thành viên chỉ có 5 thể lực (< 15).
   - Kết quả xác thực: Request thất bại với lỗi `DUNGEON_INSUFFICIENT_FATIGUE` (HTTP 400). Sau khi giao dịch rollback, thể lực của Đội trưởng vẫn nguyên vẹn 80 điểm, không có bản ghi phó bản nào được tạo và tổ đội vẫn ở trạng thái `FORMING`.
8. **Scenario 8 — Stale Version Invariant:**
   - Gửi yêu cầu hiệp đấu với `version: 999` (lệch với version hiện tại trên máy chủ).
   - Kết quả xác thực: Máy chủ phản hồi HTTP 409 Conflict với mã lỗi `DUNGEON_VERSION_MISMATCH`. Cơ sở dữ liệu xác nhận `version`, `turns_count`, `combat_state` và `combat_log` hoàn toàn không bị thay đổi.
9. **Scenario 9 — Chặn Mutation khi tổ đội đang `IN_DUNGEON`:**
   - Khi tổ đội đang trong phó bản:
     - `POST /api/xianxia/party/leave` $\rightarrow$ Bị từ chối với HTTP 400 `PARTY_IN_DUNGEON`.
     - `POST /api/xianxia/party/kick` $\rightarrow$ Bị từ chối với HTTP 400 `PARTY_IN_DUNGEON`.
     - `POST /api/xianxia/party/disband` $\rightarrow$ Bị từ chối với HTTP 400 `PARTY_IN_DUNGEON`.
   - Kết quả xác thực: Danh sách thành viên và trạng thái tổ đội được bảo toàn nguyên vẹn 100%.

---

## 4. KẾT QUẢ THỰC THI TOÀN BỘ CÁC BỘ KIỂM THỬ (TEST EXECUTION SUITES)

| Suite Kiểm Thử | Tệp Thực Thi | Số Lượng Test / Nhóm | Kết Quả | Exit Code |
| :--- | :--- | :--- | :--- | :--- |
| **Dungeon Backend (M4.3.3B)** | `dist/tests/xianxiaM4Dungeon.test.js` | 9 Nhóm (Group A - I, 18 kịch bản) | 🟢 **100% PASS** | `0` |
| **Party System (M4.3.3A)** | `dist/tests/xianxiaM4Party.test.js` | 9 Nhóm (Test 0 - 5 & Concurrency 1 - 4) | 🟢 **100% PASS** | `0` |
| **Tông Môn / Bang Hội (M4.3.2)** | `dist/tests/xianxiaM4Guild.test.js` | 12 Nhóm (Test 0 - 11) | 🟢 **100% PASS** | `0` |
| **Master All-Tests Runner** | `dist/tests/runAllTests.js` | 34 Bộ kiểm thử toàn hệ thống | 🟢 **100% PASS** | `0` |

---

## 5. XÁC MINH TÍNH TOÀN VẸN CƠ SỞ DỮ LIỆU (DATABASE BASELINE INTEGRITY)

Lệnh kiểm tra trực tiếp qua Prisma Client trên Supabase PostgreSQL:
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); Promise.all([prisma.user.count(), prisma.xianxiaCharacter.count(), prisma.xianxiaGuild.count(), prisma.xianxiaParty.count(), prisma.xianxiaDungeonRun.count(), prisma.xianxiaDungeonRewardClaim.count()]).then(([u, c, g, p, d, r]) => { console.log(JSON.stringify({ users: u, characters: c, guilds: g, parties: p, dungeonRuns: d, rewardClaims: r })); process.exit(0); });"
```

### Kết quả đo lường:
- **Trước khi chạy kiểm thử Hardening:**  
  `{"users":26,"characters":15,"guilds":0,"parties":0,"dungeonRuns":0,"rewardClaims":0}`
- **Sau khi hoàn thành toàn bộ các bài kiểm thử:**  
  `{"users":26,"characters":15,"guilds":0,"parties":0,"dungeonRuns":0,"rewardClaims":0}`

**Kết luận:**  
Cơ chế dọn dẹp theo danh sách định danh theo dõi (`trackedUserIds`, `trackedCharacterIds`, `trackedPartyIds`, `trackedRunIds`) hoạt động tuyệt đối an toàn, thu hồi 100% dữ liệu thử nghiệm, không xóa nhầm và không để lại bất kỳ rác dữ liệu nào.

---

## 6. KIỂM TRA PHẠM VI GIT (GIT SAFETY & ISOLATION CHECK)

Kết quả thực tế từ Git:
- `git diff --check`: Exit code `0` (Không có lỗi khoảng trắng, không có xung đột merge).
- `git status --short`:
  - Các tệp sửa đổi cốt lõi thuộc phạm vi M4.3:
    - [`backend/prisma/schema.prisma`](file:///d:/Lap%20trinh%20game/ky_bien/backend/prisma/schema.prisma)
    - [`backend/src/app.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/app.ts)
    - [`backend/src/services/xianxia/xianxiaPartyService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaPartyService.ts)
    - [`backend/src/services/xianxia/xianxiaDungeonService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts)
    - [`backend/src/tests/xianxiaM4Dungeon.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/xianxiaM4Dungeon.test.ts)
  - Hoàn toàn **không** sửa đổi luật cờ Kỳ Biến, không có commit, không push và không deploy.

---

## 7. ĐỀ XUẤT VÀ KHUYẾN NGHỊ KHI BẮT ĐẦU M4.3.3C (SOCKET.IO REALTIME)

Phân hệ M4.3.3B đã đạt trạng thái sẵn sàng cao nhất (Production-Ready Backend Foundation). Để tích hợp Socket.IO realtime trong giai đoạn M4.3.3C một cách trơn tru, khuyến nghị tuân thủ các quy tắc kiến trúc sau:

1. **Tái sử dụng Service Authoritative:**  
   Namespace Socket.IO của Dungeon (`/dungeon` hoặc tích hợp vào `/tienlo`) không được tự tính toán sát thương riêng, mà phải gọi trực tiếp vào [`xianxiaDungeonService.executeCombatStep`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts) để bảo toàn Optimistic Locking và Database Integrity.
2. **Room Architecture:**  
   Mỗi phiên phó bản sẽ gắn với một Socket Room duy nhất: `dungeon:${runId}`. Mọi sự kiện phát sinh từ hiệp đấu (`combat_turn_resolved`, `wave_transition`, `dungeon_completed`, `dungeon_failed`, `dungeon_expired`) sẽ được broadcast trực tiếp đến room này.
3. **Phát hiện Disconnect & Reconnect:**  
   Lắng nghe sự kiện `disconnect` để cập nhật `is_connected = false` trong `XianxiaDungeonMember`, và khi người chơi vào lại thì gọi [`xianxiaDungeonService.reconnect`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/xianxia/xianxiaDungeonService.ts) để đồng bộ lại trạng thái toàn diện.
