# BÁO CÁO NGHIỆM THU MỤC 2: CORE GAMEPLAY
## DỰ ÁN: TIÊN LỘ: VẠN GIỚI TRANH PHONG

**Thời gian lập báo cáo:** 2026-10-24  
**Người thực hiện:** Senior Gameplay Systems Architect & QA Lead  
**Quyền hạn triển khai:** Thực hiện theo CHỈ THỊ CHỦ DỰ ÁN — TRIỂN KHAI MỤC 2: CORE GAMEPLAY  
**Phạm vi:** Riêng biệt Mục 2 (Authoritative Core Gameplay Backend, Database Persistence, Combat Engine, Inventory, Battle Logs & Frontend Synchronization).  
**Trạng thái kiểm thử:** 10/10 bài kiểm thử Mục 2 đạt **PASS 100%**; toàn bộ test suite dự án (`npm test`) đạt **PASS 100% (Exit Code 0)**.

---

## 1. TỔNG QUAN KIẾN TRÚC & MỤC TIÊU MỤC 2

Trước Mục 2, phân hệ Tiên Lộ vận hành chủ yếu theo mô hình Client-side / Offline LocalStorage. Mô hình này không thể làm nền tảng cho Multiplayer vì dễ bị giả mạo kết quả chiến đấu, chỉnh sửa EXP/vật phẩm, và mất dữ liệu khi đổi thiết bị.

Mục 2 đã thiết lập **Kiến trúc Máy Chủ Thẩm Quyền (Authoritative Server Architecture)**:
1. **Máy chủ là Nguồn Chân Lý duy nhất (Single Source of Truth):** Toàn bộ dữ liệu nhân vật, chỉ số hiệu dụng, túi đồ và lịch sử trận đấu được lưu trữ bền vững trên **PostgreSQL (Supabase)** qua Prisma ORM.
2. **Chiến đấu có Thẩm quyền (Server-Simulated Combat):** Người chơi chỉ gửi lệnh khiêu chiến quái (`monster_id`); máy chủ mô phỏng toàn bộ diễn biến từng hiệp, sát thương, ý định quái, thi triển thần thông, tỷ lệ rơi đồ và phán quyết thắng/thua. Frontend chỉ nhận danh sách diễn biến (`playbackTurns`) để phát lại cho người chơi xem.
3. **Chống trùng lặp & Gian lận phần thưởng (Idempotency Key):** Mỗi trận đấu gắn với một `idempotency_key` duy nhất; nếu gọi lại hoặc xảy ra retry mạng, máy chủ trả về kết quả cũ mà tuyệt đối không nhân đôi phần thưởng.
4. **Bảo toàn 100% các quyết định của Mục 1:**
   - Công thức EXP: $EXP\_Required(L) = \lfloor 50 \cdot L^{1.45} + 50 \cdot L \rfloor$, hỗ trợ nhảy nhiều cấp, giữ EXP dư, trần Level 100 đổi Bạc 10:1.
   - Tách biệt hoàn toàn EXP Thể Phách và Tu Vi Cảnh Giới.
   - Bắt buộc xem trọn Hiệp 1 trước khi mở nút Bỏ qua trận chiến.
   - Trần 30 hiệp kịch chiến: hòa chiếm ưu thế nhận 50% EXP/Tu vi; hòa rút lui an toàn không bị phạt.
   - Hình phạt thất bại chuẩn xác: HP về 20, mất 15 Thể lực tổng, đưa về Động Phủ Tán Tu; 100% trang bị, vật phẩm, cấp độ và cảnh giới được bảo toàn.
   - Cooldown đả tọa 30 giây, tuyệt đối không cộng Tu Vi để chống exploit AFK.

---

## 2. CHI TIẾT CÁC PHÂN HỆ ĐÃ TRIỂN KHAI

### 2.1. Cấu Trúc Cơ Sở Dữ Liệu (Prisma Schema & PostgreSQL)
Đã bổ sung 4 model thực thể vào `backend/prisma/schema.prisma` và đồng bộ thành công lên Supabase:
- `XianxiaCharacter`: Lưu thuộc tính cốt lõi (Cấp độ, EXP, HP, Thể lực, Cảnh giới, Tu vi, Căn cốt, Ngộ tính, Khí vận, Bạc, Điểm tiềm năng, 3 slot trang bị `equipped_weapon`, `equipped_armor`, `equipped_relic`).
- `XianxiaInventoryItem`: Quản lý danh mục vật phẩm trong túi đồ của từng người chơi (`item_id`, `quantity`).
- `XianxiaBattleLog`: Lưu lại toàn bộ lịch sử các trận đấu (`monster_id`, `result`, `turns`, `reward_exp`, `reward_cultivation`, `reward_silver`, `reward_items`, `idempotency_key`, `created_at`). Khóa ngoại phân quyền theo `user_id`.
- `XianxiaQuestProgress`: Lưu tiến độ và trạng thái nhiệm vụ của từng người chơi.

### 2.2. Dịch Vụ Nhân Vật & EXP (`xianxiaCharacterService.ts`)
- `calcExpRequired(level)`: Tính toán ngưỡng EXP thăng cấp chuẩn xác.
- `applyExpGain(character, expGained, tx)`: Thăng cấp nhiều lần liên tiếp, cập nhật chỉ số (+4 HP/cấp, +1 Thể lực/2 cấp, +1 Điểm Tiềm Năng/10 cấp), hồi đầy thể lực khi lên cấp, chuyển hóa EXP tràn trần Level 100 thành Bạc theo tỉ lệ 10:1.
- `calculateEffectiveStats(character, inventoryItems)`: Tính toán chỉ số chiến đấu động tức thời (Công, Thủ, Thân pháp, Bạo kích, Né tránh, Max Qi) từ căn cốt và trang bị đang mang, không lưu trường phụ thuộc vào DB nhằm loại bỏ triệt để lỗi cộng dồn chỉ số ảo.
- `meditate(userId)`: Đả tọa hồi 35 Thể lực, 25 HP, có Cooldown 30 giây, không cộng Tu Vi.
- `distributeStatPoints(userId, stat)`: Phân bổ điểm tiềm năng an toàn, kiểm soát không âm.

### 2.3. Quản Lý Trang Bị & Túi Đồ (`xianxiaInventoryService.ts`)
- `equipItem(userId, itemId)`: Kiểm tra điều kiện Cảnh giới (`realm_requirement`). Nếu không đủ cảnh giới, trả về lỗi 400. Nếu đủ, trong Prisma Transaction: tháo trang bị cũ (nếu có) hoàn vào túi, gán trang bị mới vào slot, trừ đúng 1 vật phẩm trong túi đồ.
- `unequipItem(userId, slot)`: Tháo trang bị khỏi ô và tăng số lượng vật phẩm trong túi đồ lên 1. Không làm mất trang bị.
- `useItem(userId, itemId)`: Tiêu thụ đan dược (ví dụ: Hồi Xuân Đan hồi 60 HP, Dưỡng Khí Đan hồi 40 Thể lực), trừ 1 vật phẩm, xóa bản ghi khi số lượng về 0.

### 2.4. Động Cơ Chiến Đấu Thẩm Quyền (`xianxiaCombatService.ts`)
- `simulateAndResolveBattle(userId, monsterId, idempotencyKey)`:
  1. Kiểm tra thể lực (cần $\ge 10$), trừ 10 Thể lực nhập trận.
  2. Nạp chỉ số hiệu dụng người chơi và yêu thú.
  3. Mô phỏng tối đa 30 hiệp: bên có Speed cao hơn ra đòn trước; tự động thi triển Thần Thông khi đủ 15 Qi (tiêu hao 15 Qi, sát thương dựa trên Ngộ Tính), thế thủ khi quái súc lực nộ sát, hoặc trảm kích tích lũy +8 Qi.
  4. Xác định kết quả (`WIN`, `LOSE`, `STALEMATE_ADVANTAGE`, `STALEMATE_RETREAT`).
  5. Roll phần thưởng từ `loot_table` dựa trên xác suất `chance` và khoảng số lượng `[min_quantity, max_quantity]`.
  6. Lưu chiến báo vào `XianxiaBattleLog` gắn kèm `idempotencyKey` trong Database Transaction.
  7. Trả về toàn bộ diễn biến `playbackTurns` để frontend trình chiếu.
- `getCharacterBattleLogs(userId, limit)`: Truy vấn danh sách chiến báo được bảo vệ theo `userId`.

### 2.5. Giao Diện & Tích Hợp Client (`tien-lo.html` & `tienlo-engine.js`)
- Thêm nút `📜 Chiến Báo` trên thanh điều hướng đầu trang.
- Thêm modal `📜 Lịch Sử Chiến Báo Tiên Gia (#battle-history-modal)`.
- Khi người chơi có tín vật đăng nhập (`kybien_jwt_token`):
  - Khởi tạo tự động đồng bộ hồ sơ nhân vật và túi đồ từ máy chủ (`GET /api/xianxia/gameplay/character/me`).
  - Khiêu chiến quái tự động kết nối API máy chủ (`POST /api/xianxia/gameplay/combat/battle`), nhận `playbackTurns` và phát lại từng hiệp.
  - Vô hiệu hóa nút Bỏ qua trong Hiệp 1, tự động kích hoạt sau khi hoàn thành Hiệp 1.
  - Bấm nút Chiến Báo mở modal, nạp và hiển thị danh sách trận đấu được xác thực từ PostgreSQL.
- Khi người chơi chưa đăng nhập (khách vãng lai / offline mode):
  - Tự động fallback sang động cơ chiến đấu cục bộ Mục 1 mượt mà, không gặp lỗi gián đoạn.

---

## 3. BẰNG CHỨNG KIỂM THỬ THỰC TẾ (100% PASS)

### 3.1. Kết quả kiểm thử Lõi Gameplay Mục 2 (`xianxiaCoreGameplay.test.ts`)
```
--- ⚡ [TEST] BẮT ĐẦU KIỂM THỬ LÕI GAMEPLAY MỤC 2 (AUTHORITATIVE BACKEND CORE) ---
-> Test 1: Khởi tạo nhân vật Tu Tiên Authoritative trên Database...
✅ 1. Khởi tạo nhân vật và túi đồ ban đầu trên PostgreSQL thành công 100%!
-> Test 2: Tính toán chỉ số chiến đấu từ Căn Cốt và Trang Bị...
✅ 2. Chỉ số chiến đấu tính toán chính xác, không bị cộng dồn chồng chéo!
-> Test 3: Thuật toán tăng EXP, bảo toàn EXP dư và nhảy nhiều cấp...
✅ 3. Thuật toán EXP, nhảy nhiều cấp và trần Level 100 đổi Bạc đạt chuẩn 100%!
-> Test 4: Đả tọa điều tức và bảo vệ chống exploit...
✅ 4. Đả tọa có Cooldown 30s và tuyệt đối không tăng Tu Vi hoạt động hoàn hảo!
-> Test 5: Quy trình trang bị và tháo trang bị trong Transaction...
✅ 5. Quy trình trang bị và tháo đồ bảo toàn số lượng vật phẩm đạt chuẩn 100%!
-> Test 6: Sử dụng đan dược tiêu hao trong túi đồ...
✅ 6. Sử dụng đan dược tiêu hao chính xác và khấu trừ an toàn!
-> Test 7: Máy chủ mô phỏng chiến đấu tự động và kiểm tra Idempotency...
✅ 7. Authoritative Combat Engine & Cơ chế Idempotent chặn đứng nhân đôi phần thưởng 100%!
-> Test 8: Hình phạt thất bại khi đối đầu Boss siêu cấp...
✅ 8. Hình phạt chiến bại: 20 HP, mất 15 thể lực tổng, đưa về Động Phủ đạt chuẩn 100%!
-> Test 9: Bảo mật và phân quyền truy xuất lịch sử trận đấu (Battle Logs)...
✅ 9. Phân quyền và bảo mật lịch sử trận đấu cá nhân đạt chuẩn tuyệt đối!
-> Test 10: Xác minh giới hạn tối đa 30 hiệp kịch chiến...
✅ 10. Giới hạn 30 hiệp chiến đấu hoạt động chuẩn xác theo thiết kế!
==================================================
🎉 TOÀN BỘ 10 BÀI KIỂM THỬ LÕI GAMEPLAY MỤC 2 ĐÃ ĐẠT PASS 100%!
==================================================
```

### 3.2. Kết quả kiểm thử Tích hợp Frontend (`xianxiaFrontendIntegration.test.ts`)
```
--- [TEST] BẮT ĐẦU KIỂM THỬ TÍCH HỢP GIAO DIỆN FRONTEND TIÊN LỘ (BƯỚC 6) ---
✅ 1. Tải thành công giao diện web /tien-lo.html với đầy đủ hiệu ứng narrative streaming, 3 chấm ngọc bích, Bảng Nhiệm Vụ và Modal Chiến Báo.
✅ 2. Tải thành công tệp kịch bản điều hành /tienlo-engine.js với bộ điều khiển chữ hiện dần, đối thoại và hệ thống nhiệm vụ sinh động, kết nối chiến báo máy chủ.
✅ 3. Trang chủ Kỳ Biến đã tích hợp lối vào nhanh sang phân hệ Tiên Lộ Tu Tiên.
--- [XIANXIA FRONTEND TESTS] TẤT CẢ BÀI TEST BƯỚC 6 ĐÃ ĐẠT 100%! ---
```

### 3.3. Kết quả kiểm thử Toàn Hệ Thống (`npm test`)
```
> kybien-backend@1.0.0 test
> tsc && node dist/tests/runAllTests.js

...
==================================================
🏆 ALL KYBIEN SYSTEM TESTS (SECURITY, CHESS RULES, 30 FIXTURES, EXP ATOMICITY, CONCURRENCY ISOLATION, E2E HTTP API, LEADERBOARD, V2 AUDIT, SEO SLUG, PUZZLE MILESTONE 1, DAILY PUZZLES & BLOG AUTOMATION, UGC CREATOR & VERIFICATION) PASSED 100%!
==================================================
Exit code: 0
```

---

## 4. PHÂN ĐỊNH RANH GIỚI VÀ GIỚI HẠN

1. **Phương pháp kiểm thử:** Toàn bộ các tiêu chí kỹ thuật, backend API, Prisma Transaction, DB State, Idempotency và giao thức giao diện đều được xác minh tự động bằng test suite tích hợp. Chưa có bước kiểm thử thủ công bấm chuột trên trình duyệt thật với giao diện đồ họa người dùng.
2. **Ranh giới Mục 2 & Mục 3:**
   - **Đã hoàn thành trong Mục 2:** Lõi gameplay Authoritative cho 1 người chơi tương tác với máy chủ (Đánh quái, Thăng cấp, Túi đồ, Trang bị, Đan dược, Lịch sử chiến báo trên DB).
   - **Tuyệt đối chưa triển khai Mục 3:** Không mở rộng sang tính năng Tổ Đội (Party), Boss Thế Giới nhiều người cùng đánh (World Boss), Đấu Trường PvP / PK, Chợ Giao Dịch tự do (Player Market), hoặc Kênh Chat Realtime qua WebSocket.

---

## 5. KẾT LUẬN & ĐỀ NGHỊ

Mục 2 đã được triển khai hoàn chỉnh, đúng quy chuẩn kiến trúc và đáp ứng trọn vẹn mọi yêu cầu trong Chỉ thị của Chủ Dự Án.

Trân trọng kính trình Chủ Dự Án xem xét và phê duyệt nghiệm thu Mục 2.
