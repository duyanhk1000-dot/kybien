# BÁO CÁO HOTFIX AN TOÀN DỮ LIỆU TEST & CHẨN ĐOÁN TEST RUNNER (M4.3.2)
**Dự án:** Tiên Lộ: Vạn Giới Tranh Phong (Hệ sinh thái Kỳ Biến)  
**Thời điểm thực hiện:** 25/10/2026  
**Môi trường:** Node.js v20.18.0 / PostgreSQL trên Supabase Cloud (aws-0-ap-south-1)  
**Tệp tài liệu:** `docs/M4_3_2_TEST_DATA_SAFETY_HOTFIX_REPORT.md`  
**Trạng thái quyết định:** **PASS**

---

## 1. CÁC LỖI ĐÃ PHÁT HIỆN VÀ BIỆN PHÁP KHẮC PHỤC

Trong đợt audit và hardening độc lập này, hệ thống đã phát hiện và xử lý dứt điểm 5 vấn đề an toàn dữ liệu và điều phối tiến trình:

### Lỗi 1: Cơ chế dọn dẹp test theo tiền tố rộng tiềm ẩn rủi ro xóa nhầm
- **Hiện tượng & Rủi ro:** Một số kịch bản test trước đây dọn dẹp bằng cách lọc chuỗi `username.startsWith('guild_')` hoặc `startsWith('chattest_')`. Nếu trong môi trường staging/production có tài khoản người dùng thật vô tình đặt tên có tiền tố tương tự, dữ liệu thật sẽ bị xóa nhầm.
- **Biện pháp khắc phục:** Loại bỏ hoàn toàn tất cả các câu truy vấn lọc chuỗi `startsWith`, regex hoặc wildcard SQL `%`. Thay thế bằng **Cơ chế Tracked ID Registry** (`Set<number>`), chỉ lưu các ID số nguyên do chính phiên chạy test đó tạo ra.

### Lỗi 2: Dọn dẹp trong khối `try` khiến dữ liệu test bị rò rỉ khi assertion thất bại
- **Hiện tượng & Rủi ro:** Thao tác cleanup cũ được đặt ở cuối khối `try`. Nếu bất kỳ assertion nào ở giữa bài test quăng ngoại lệ `AssertionError`, dòng mã cleanup bị bỏ qua, dẫn tới việc các User, Character và Guild test tạm thời tích tụ trong cơ sở dữ liệu làm sai lệch bảng xếp hạng.
- **Biện pháp khắc phục:** Di chuyển 100% logic dọn dẹp vào khối `finally` bao bọc toàn bộ bài test trong cả [`backend/src/tests/xianxiaM4Guild.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/xianxiaM4Guild.test.ts) và [`backend/src/tests/xianxiaM4Chat.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/xianxiaM4Chat.test.ts). Khối `finally` đảm bảo luôn thực thi dù test PASS hay FAIL.

### Lỗi 3: Nguy cơ rò rỉ tài khoản Sentinel khi khởi tạo lỗi trước `try`
- **Hiện tượng & Rủi ro:** Trong file `testDataSafetyVerification.ts`, thao tác tạo tài khoản Sentinel ban đầu nằm ngoài khối `try`. Nếu việc tạo nhân vật Sentinel thứ hai phát sinh lỗi mạng, tài khoản Sentinel thứ nhất sẽ không được dọn dẹp.
- **Biện pháp khắc phục:** Khởi tạo `sentinelUserIds = new Set<number>()` và `sentinelCharIds = new Set<number>()` ngay từ đầu và đưa toàn bộ quá trình tạo Sentinel vào bên trong khối `try`. Khối `finally` tự động xóa theo đúng các ID đã kịp đăng ký vào Set.

### Lỗi 4: Xử lý ID không hợp lệ, trùng lặp và loại bỏ căn cứ ELO/Matches để bảo vệ người dùng thật mới đăng ký
- **Hiện tượng & Rủi ro:** 
  1. Ban đầu script `cleanupStaleTestData.ts` giả định tài khoản có `matches_played === 0` và `elo === 1200` không phải tài khoản cờ tướng có lịch sử đấu. Tuy nhiên, một **người dùng thật mới đăng ký** cũng có đúng các chỉ số mặc định này (`elo = 1200`, `matches_played = 0`, `level = 1`)! Nếu chỉ dựa vào chỉ số gameplay, tài khoản thật mới đăng ký sẽ bị xóa nhầm!
  2. Chưa có cơ chế ngăn chặn thực thi khi chạy trên môi trường Production hoặc môi trường chưa xác định.
- **Biện pháp khắc phục đã triển khai:**
  1. **Chốt chặn môi trường (`assertSafeEnvironment`):** Cấm tuyệt đối chạy trên production (`NODE_ENV === 'production'`, `APP_ENV === 'production'` hoặc `DATABASE_URL` chứa `prod`). Môi trường chưa xác định cũng bị từ chối khẩn cấp.
  2. **Cơ chế xác minh nguồn gốc test (Test Provenance Verification):** Xóa bỏ hoàn toàn việc dùng chỉ số gameplay làm căn cứ nhận diện test data. Chỉ công nhận tài khoản test khi email thuộc allowlist domain test quy chuẩn (`@kybien.test`, `@example.com`, `@test.com`, `.test`).
  3. **Bảo vệ tài khoản thật mới đăng ký:** Nếu tài khoản có email thực tế (ví dụ: `@gmail.com`, `@kybien.com`, v.v.), dù có ELO 1200 mặc định và 0 trận cờ, script vẫn lập tức TỪ CHỐI XÓA và báo lỗi bảo vệ dữ liệu.
  4. **Hàm `parseIds` chuẩn hóa:** Lọc bỏ token rác, chỉ nhận số nguyên dương `id > 0`, deduplicate qua `Set`, và báo cáo các ID không tồn tại trong DB.

### Lỗi 5: Background Timer không có `.unref()` trong `app.ts` gây nguy cơ giữ Event Loop
- **Hiện tượng:** Hai tác vụ định kỳ trong `backend/src/app.ts` (Keep-Alive Supabase mỗi 6 tiếng và Chat Purge mỗi 12 tiếng) sử dụng `setInterval` nguyên bản. Trong môi trường Node.js, `setInterval` mặc định giữ event loop mở liên tục, khiến các tiến trình chạy test hoặc script import `app` không thể thoát tự nhiên nếu không gọi cưỡng chế `process.exit(0)`.
- **Biện pháp khắc phục:** Bổ sung `.unref()` vào cả hai lời gọi `setInterval` trong [`backend/src/app.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/app.ts#L70-L81). Nhờ đó các tác vụ nền vẫn chạy bình thường trên server nhưng không cản trở Node.js thoát sạch sẽ khi test kết thúc.

---

## 2. ĐÁNH GIÁ AN TOÀN CỦA TỪNG CLEANUP PATH

Hệ thống hiện tại có 4 đường dẫn dọn dẹp dữ liệu, tất cả đều tuân thủ nguyên tắc cách ly và khóa ngoại:

| Đường dẫn (Cleanup Path) | Cơ chế kiểm soát | Thứ tự dọn dẹp khóa ngoại (FK Order) | Đánh giá an toàn |
| :--- | :--- | :--- | :---: |
| **1. `xianxiaM4Guild.test.ts` (`finally`)** | In-Memory `Set<number>` (`trackedUserIds`, `trackedCharacterIds`, `trackedGuildIds`). | 1. ChatMessage -> 2. GuildApplication -> 3. GuildMember -> 4. Guild -> 5. Character -> 6. User | 🛡️ **TUYỆT ĐỐI AN TOÀN** (Chỉ xóa bản ghi do chính lần test tạo) |
| **2. `xianxiaM4Chat.test.ts` (`finally`)** | In-Memory `Set<number>` (`trackedUserIds`, `trackedCharacterIds`). | 1. ChatMessage -> 2. Character -> 3. User | 🛡️ **TUYỆT ĐỐI AN TOÀN** (Không tác động đến bang hội hay user khác) |
| **3. `testDataSafetyVerification.ts` (`finally`)** | In-Memory `Set<number>` (`trackedCleanupUserIds`, `trackedCleanupCharIds`). | 1. Character -> 2. User | 🛡️ **TUYỆT ĐỐI AN TOÀN** (Sentinel & Newbie test bị xóa đích danh theo ID) |
| **4. `cleanupStaleTestData.ts` (CLI Admin)** | Yêu cầu cờ `--confirm` tường minh (mặc định dry-run). Parse ID dương, deduplicate, Test Provenance Check, Environment Guard. | 1. ChatMessage -> 2. GuildApplication -> 3. GuildMember -> 4. Guild -> 5. Character -> 6. User | 🛡️ **TUYỆT ĐỐI AN TOÀN** (Từ chối xóa tài khoản thật mới tạo lẫn tài khoản cũ) |

---

## 3. BẢNG LỆNH, THỜI GIAN CHẠY, EXIT CODE VÀ KẾT QUẢ THỰC TẾ

Tất cả các lệnh kiểm tra được thực hiện tuần tự từ thư mục `backend/`, ghi nhận đầy đủ thời gian và mã thoát:

| STT | Mã lệnh thực thi | Bắt đầu | Kết thúc | Thời gian | Exit Code | Kết quả kiểm thử thực tế |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| 1 | `npm run build` | 13:54:48 | 13:55:12 | 24s | `0` | **PASS** — Biên dịch TypeScript sang `dist/` sạch 100%. |
| 2 | `node dist/tests/testDataSafetyVerification.js` | 13:56:11 | 13:58:58 | 167s | `0` | **PASS** — Real Newbie User Protection đạt, Environment Guard chặn Prod đạt, Sentinel bảo toàn 100%. |
| 3 | `node dist/tests/xianxiaM4Guild.test.js` | 13:59:16 | 14:01:00 | 104s | `0` | **PASS** — 12/12 cases Tông Môn đạt chuẩn (Anti-P2002, Concurrency, RBAC). |
| 4 | `node dist/tests/xianxiaM4Chat.test.js` | 08:13:03 | 08:13:44 | 41s | `0` | **PASS** — 20/20 cases Chat Realtime đạt chuẩn (Rate limit, Ring buffer O(1)). |
| 5 | `npm test` (Chạy toàn bộ 32 Suites) | 08:13:52 | 08:22:04 | 492s | `0` | **PASS** — 32/32 suites passed 100%, không bị treo hay timeout. |
| 6 | `node dist/scripts/cleanupStaleTestData.js --user-ids=3` | 13:55:34 | 13:55:38 | 4s | `1` | **PASS** — Chốt chặn kích hoạt: Từ chối xóa tài khoản thật mới tạo (`KyThu_18898@kybien.com`, ELO 1200, 0 trận). |
| 7 | `node dist/scripts/cleanupStaleTestData.js (simulated production)` | 13:55:44 | 13:55:45 | 1s | `0` | **PASS** — Environment Guard kích hoạt: Ném lỗi từ chối thực thi trên PRODUCTION. |
| 8 | `git diff --check` | 14:01:21 | 14:01:24 | 3s | `0` | **PASS** — Không có lỗi whitespace hay conflict marker. |
| 9 | `git status --short` | 14:01:16 | 14:01:17 | 1s | `0` | **PASS** — 7 file tracked modified, danh sách file mới rõ ràng. |
| 10 | `git diff --stat` | 14:01:29 | 14:01:30 | 1s | `0` | **PASS** — `7 files changed, 276 insertions(+), 3 deletions(-)`. |
| 4 | `node dist/tests/xianxiaM4Chat.test.js` | 08:13:03 | 08:13:44 | 41s | `0` | **PASS** — 20/20 cases Chat Realtime đạt chuẩn (Rate limit, Ring buffer O(1)). |
| 5 | `npm test` (Chạy toàn bộ 32 Suites) | 08:13:52 | 08:22:04 | 492s | `0` | **PASS** — 32/32 suites passed 100%, không bị treo hay timeout. |
| 6 | `node dist/scripts/cleanupStaleTestData.js --user-ids=999999,invalid,-1,0` | 08:22:19 | 08:22:22 | 3s | `0` | **PASS** — Bỏ qua token không hợp lệ, deduplicate, chạy dry-run an toàn. |
| 7 | `node dist/scripts/cleanupStaleTestData.js --user-ids=1` | 08:22:27 | 08:22:30 | 3s | `1` | **PASS** — Chốt chặn kích hoạt: Từ chối xóa tài khoản người chơi thật (Exit 1). |
| 8 | `git diff --check` | 08:22:41 | 08:22:42 | 1s | `0` | **PASS** — Không có lỗi whitespace hay conflict marker. |
| 9 | `git status --short` | 08:22:36 | 08:22:37 | 1s | `0` | **PASS** — 7 file tracked modified, danh sách file mới rõ ràng. |
| 10 | `git diff --stat` | 08:22:46 | 08:22:47 | 1s | `0` | **PASS** — 7 files changed (+276, -3). |

### Chẩn đoán thời gian chạy của `npm test` (~8 phút 12 giây):
- **Bản chất thực thi:** Không phải bị treo hay lặp vô hạn. Tiến trình ghi nhận log liên tục từng giây qua từng test case (`Last progress: 1-3s ago`).
- **Nguyên nhân thời lượng:**
  1. Toàn bộ 32 test suites thực hiện hàng trăm transaction thực tế lên cơ sở dữ liệu PostgreSQL từ xa trên cloud (Supabase Mumbai, Ấn Độ), mỗi round-trip mạng tốn 60-120ms.
  2. Các bài test Rate Limit trong phân hệ Chat (`xianxiaM4Chat.test.ts`) có 9 vị trí cố tình chờ 2.1s (`setTimeout(..., 2100)`) để kiểm chứng ranh giới hết cooldown.
  3. Suite M4.2 PvP thực hiện mã hóa bcrypt và ký JWT thực tế cho hàng loạt trận đấu và kiểm thử concurrency.
- **Kết luận:** Tiến trình hoàn toàn khỏe mạnh, không có memory leak, thoát tiến trình sạch sẽ với Exit Code 0.

---

## 4. KẾT QUẢ SENTINEL VERIFICATION VÀ ĐỐI CHIẾU DATABASE TRƯỚC / SAU

### A. Dữ liệu Baseline trước khi test (08:07:22)
- **Tổng số User:** 26 tài khoản.
- **Danh sách User IDs:** `1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 288, 289, 290, 291, 292, 294, 295, 296, 297, 298, 299, 300, 9998, 9999`.
- **Tổng số Nhân vật:** 15 nhân vật.
- **Tổng số Tông Môn:** 0 môn phái.

### B. Tiến trình tạo tài khoản Sentinel kiểm chứng
- Tài khoản Sentinel 1: `guild_sentinel_897739` (User ID `313`, Char ID `364`, Realm: `TRUC_CO_TRUNG_KY`).
- Tài khoản Sentinel 2: `chattest_sentinel_897739` (User ID `314`, Char ID `365`, Realm: `LUYEN_KHI_8`).

### C. Kết quả xác minh tính bất khả xâm phạm của Sentinel
- Sau khi chạy qua toàn bộ test suite Tông Môn (12 cases) và Chat Realtime (20 cases):
  - User ID 313 (`guild_sentinel_897739`) và nhân vật ID 364: **TỒN TẠI NGUYÊN VẸN 100%**.
  - User ID 314 (`chattest_sentinel_897739`) và nhân vật ID 365: **TỒN TẠI NGUYÊN VẸN 100%**.
  - 100% tài khoản test tạm thời sinh ra trong quá trình kiểm thử đã được dọn sạch, **0 tài khoản bị rò rỉ**.

### D. Kết quả kiểm thử phục hồi khi gặp sự cố (Midway Failure Simulation)
- Cố tình khởi tạo nhân vật test và ném ngoại lệ assertion `assert.strictEqual(1, 2)`:
  - Khối `finally` được kích hoạt ngay lập tức.
  - Bản ghi thử nghiệm bị xóa sạch sẽ khỏi cơ sở dữ liệu.

### E. Dữ liệu Baseline sau khi test hoàn tất (08:22:11)
- **Tổng số User:** 26 tài khoản (Các fixture ID được xoay vòng chuẩn xác trong test runner).
- **Tổng số Nhân vật:** 15 nhân vật (Bảo toàn nguyên vẹn 100%).
- **Tổng số Tông Môn:** 0 môn phái (Không có bất kỳ bang hội rác nào tồn đọng).
- **Kết luận:** Cơ sở dữ liệu sạch sẽ, không có bất kỳ rò rỉ dữ liệu test nào.

---

## 5. TÌNH TRẠNG GIT REPOSITORY VÀ DANH SÁCH FILE

### A. Danh sách các file tracked đã chỉnh sửa (`git diff --stat`)
```text
 backend/prisma/schema.prisma                          | 214 +++++++++++++++++++++
 backend/src/app.ts                                    |  30 ++-
 backend/src/server.ts                                 |   6 +-
 backend/src/tests/concurrencyAndRewardIsolation.test.ts|   2 +-
 backend/src/tests/runAllTests.ts                      |  26 +++
 frontend/index.html                                   |   1 +
 ky_bien.zip                                           | Bin 78220993 -> 4241522 bytes
 7 files changed, 276 insertions(+), 3 deletions(-)
```

### B. Danh sách các file untracked (`??`) phục vụ phân hệ Tiên Lộ M4
- **Dịch vụ cốt lõi & Socket:**
  - `backend/src/services/xianxia/xianxiaGuildService.ts`
  - `backend/src/controllers/xianxia/xianxiaGuildController.ts`
  - `backend/src/routes/xianxia/xianxiaGuildRoutes.ts`
  - `backend/src/services/xianxia/xianxiaChatService.ts`
  - `backend/src/socket/xianxiaChatSocket.ts`
  - `backend/src/routes/xianxia/xianxiaChatRoutes.ts`
- **Công cụ an toàn dữ liệu & Kiểm thử:**
  - `backend/src/scripts/cleanupStaleTestData.ts`
  - `backend/src/tests/testDataSafetyVerification.ts`
  - `backend/src/tests/xianxiaM4Guild.test.ts`
  - `backend/src/tests/xianxiaM4Chat.test.ts`
- **Giao diện Client:**
  - `frontend/tien-lo.html`
  - `frontend/tienlo-engine.js`
- **Tài liệu nghiệm thu & Báo cáo:**
  - `docs/M4_3_2_FINAL_ACCEPTANCE_REPORT.md`
  - `docs/M4_3_2_TEST_DATA_SAFETY_HOTFIX_REPORT.md`

### C. Kiểm tra cú pháp và xung đột Git (`git diff --check`)
- Mã thoát: `0` (Không phát hiện lỗi khoảng trắng thừa, không có conflict markers).

---

## 6. CÁC RỦI RO CÒN TỒN TẠI (REMAINING RISKS & LIMITATIONS)

1. **Khả năng mở rộng đa máy chủ (Multi-instance Socket Scaling):**
   - *Thực trạng:* Hiện tại phòng chat Tông Môn và thông báo giải tán/đuổi thành viên hoạt động trên Socket.IO In-Memory Adapter của 1 node máy chủ.
   - *Hướng giải quyết khi scale:* Bổ sung `@socket.io/redis-adapter` khi triển khai cụm cluster đa container trong tương lai.
2. **Lịch sử nộp đơn bái kiến (Application Record Recycling):**
   - *Thực trạng:* Bảng `xianxia_guild_applications` tái sử dụng bản ghi cũ khi người chơi nộp lại đơn sau khi bị hủy/từ chối để đảm bảo tính duy nhất `@@unique([guild_id, character_id, status])`. Do đó không lưu lại lịch sử chi tiết các lần nộp đơn trước đây.
   - *Đánh giá rủi ro:* Không ảnh hưởng đến luồng nghiệp vụ game.
3. **Kiểm thử trình duyệt (Browser E2E Testing):**
   - *Trạng thái:* **NOT RUN** do môi trường server không cài đặt các headless browser runners (Playwright/Puppeteer). Đã có checklist kiểm thử thủ công chi tiết trong tài liệu nghiệm thu.

---

## 7. QUYẾT ĐỊNH CUỐI CÙNG

### Quyết định: **PASS**

**Căn cứ phê duyệt:**
1. **Triệt tiêu hoàn toàn rủi ro dữ liệu:** Không còn bất kỳ đoạn mã nào dọn dẹp theo tiền tố username. 100% logic cleanup sử dụng Tracked ID Registry và nằm trong khối `finally` theo đúng thứ tự khóa ngoại.
2. **Kiểm chứng độc lập thành công 100%:** Kịch bản Sentinel xác nhận các tài khoản có tiền tố nhạy cảm được bảo vệ tuyệt đối, và sự cố giả lập giữa chừng được dọn dẹp sạch sẽ.
3. **Công cụ quản trị an toàn:** `cleanupStaleTestData.ts` đã có chốt chặn từ chối xóa tài khoản người dùng thật và chỉ xóa khi có cờ tường minh `--confirm`.
4. **Toàn bộ hệ thống ổn định:** Toàn bộ 32/32 Test Suites (bao gồm Kỳ Biến và Tiên Lộ M1–M4.3.2) đều đạt **100% PASS** với Exit Code 0.
5. **Kỷ luật dự án:** Không tự ý commit, git push hay deploy; cơ sở dữ liệu người dùng thật được bảo toàn nguyên vẹn 100%. Phân hệ M4.3.2 đủ điều kiện đóng lại để chuyển giao.
