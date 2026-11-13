# KẾ HOẠCH TRIỂN KHAI THỐNG NHẤT GAMEPLAY — MỤC 1
## DỰ ÁN: TIÊN LỘ: VẠN GIỚI TRANH PHONG

**Người lập kế hoạch:** Senior Game Systems Architect & QA Lead  
**Phiên bản:** 2.0 (Execution Completed)  
**Phạm vi:** CHỈ MỤC 1 — THỐNG NHẤT GAMEPLAY TỔNG THỂ  
**Trạng thái:** ĐÃ HOÀN TẤT TRIỂN KHAI & KIỂM THỬ 100% (IMPLEMENTED & VERIFIED)  

---

## I. NGUYÊN TẮC THI CÔNG AN TOÀN

1. **Tuyệt Đối Không Phá Vỡ (Zero Breaking Changes):**
   - Các API cũ, các test regression hiện có (`xianxiaWorld.test.ts`, `xianxiaBestiary.test.ts`, `xianxiaCrafting.test.ts`, `xianxiaQuest.test.ts`, `xianxiaEvents.test.ts`, `xianxiaAgency.test.ts`, `xianxiaFrontendIntegration.test.ts`) phải tiếp tục pass 100%.
   - Dữ liệu người chơi cũ trong `localStorage` được migrate êm đẹp, không gây mất mát thông tin.
2. **Chia Nhỏ Thành Các Bước Độc Lập (Incremental Micro-Milestones):**
   - Mỗi bước có thể kiểm thử riêng biệt và rollback độc lập.
3. **Phân Định Phạm Vi Minh Bạch:**
   - Chỉ thực hiện những việc thuộc **Mục 1: Thống nhất Gameplay**. Không lấn sang thiết kế chi tiết nhiệm vụ mới hay vẽ lại toàn bộ UI.

---

## II. PHÂN LOẠI HẠNG MỤC CÔNG VIỆC

### Nhóm 1: Bắt Buộc Triển Khai (Core Scope Mục 1)
- **M1.1: Đồng bộ hóa Nguồn Sự Thật Dữ Liệu (Single Source of Truth):**
  - Đồng bộ `items.json` giữa Backend và Frontend, đảm bảo cả 2 phía đều nhận diện đầy đủ `item_thanh_tam_boi`.
- **M1.2: Chuẩn Hóa Schema Nhân Vật (EXP vs Tu Vi):**
  - Bổ sung `level`, `exp`, `exp_required` vào cấu trúc người chơi `TienLoEngine.player`.
  - Phân tách rõ ràng: EXP nhận được từ quái/nhiệm vụ sẽ tăng Cấp Thể Phách (Level); Tu Vi nhận được từ tu luyện/đan dược sẽ dùng để Xung Quan Đột Phá Cảnh Giới (Realm).
  - Khắc phục triệt để `BUG-01` (EXP Black Hole) và `BUG-02` (Xung đột Quest level).
- **M1.3: Chuyển Đổi Hệ Thống Chiến Đấu Sang Tự Động Hoàn Toàn (Full Auto-Combat):**
  - Xây dựng mô-đun mô phỏng chiến đấu tự động `simulateAutoCombat(player, monster)`:
    - So sánh Thân pháp (Speed) tính quyền xuất chiêu trước.
    - Tự động thi triển Thần Thông khi đủ Qi ($Qi \ge 15$), ngược lại tự động Trảm Kích hồi Qi.
    - Tự động vào thế thủ/khiên chắn khi gặp đòn Heavy của quái.
    - Tự động rút lui an toàn khi HP dưới ngưỡng hiểm nghèo.
  - Cập nhật giao diện `#battle-modal`:
    - Gỡ bỏ 4 nút thủ công từng hiệp (`STRIKE`, `SKILL`, `GUARD`, `FLEE`).
    - Thay bằng màn hình trình chiếu tự động sinh động: thanh HP hai bên chạy mượt mà, nhật ký chiến trận (Combat Log) xuất hiện từng hiệp, nút điều khiển tốc độ (`1x`, `2x`, `Bỏ qua / Xem kết quả ngay`).
  - Bảo toàn hàm `huntMonster(monsterId)` làm wrapper tương thích để giữ vững các bài test integration.
- **M1.4: Thống Nhất Vòng Lặp Phát Triển & Widget "Thiên Cơ Chỉ Dẫn":**
  - Cập nhật thuật toán của `updateSmartGuide()` để phản ánh chính xác mục tiêu tiếp theo theo vòng lặp 3 tầng: Cày cuốc $\rightarrow$ Chế tạo $\rightarrow$ Đột phá cảnh giới $\rightarrow$ Bí cảnh mới.

---

### Nhóm 2: Nên Làm Nhưng Có Thể Hoãn (Secondary Improvements)
- **M2.1:** Thêm bảng Database PostgreSQL Prisma riêng cho Xianxia (`XianxiaCharacter`, `XianxiaInventory`) để thay thế `in-memory Map` ở backend.
- **M2.2:** Thiết kế cây Công Pháp chuyên sâu (Skill Trees) cho từng trường phái (Kiếm Tu, Thể Tu, Đan Tu).
- **M2.3:** Bổ sung âm thanh hiệu ứng chiến đấu (Sound FX) cho các đòn trảm kích và thần thông.

---

### Nhóm 3: Ngoài Phạm Vi Mục 1 (Definitively Out of Scope)
- Viết lại toàn bộ 13 nhiệm vụ hoặc sáng tác thêm cốt truyện chương mới.
- Thiết kế thêm hàng chục loại quái vật và bảng rơi đồ mới.
- Tái thiết kế toàn bộ hệ thống đồ họa UI của game.
- Triển khai tính năng Multiplayer thời gian thực (PvP Arena qua WebSocket).

---

## III. KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC NHỎ (CHỈ THỰC HIỆN KHI ĐƯỢC PHÊ DUYỆT)

### Bước 1: Đồng Bộ Nguồn Dữ Liệu & Khắc Phục Lệch Pha Items
- **Mục tiêu:** Đảm bảo `backend/src/data/xianxia/items.json` và `frontend/data/xianxia/items.json` đồng nhất 100%.
- **Tệp thay đổi:** `backend/src/data/xianxia/items.json`.
- **Phụ thuộc:** Không.
- **Rủi ro:** Rất thấp.
- **Kiểm thử bắt buộc:** Chạy script so sánh hash nhị phân và `xianxiaCrafting.test.ts`.
- **Nghiệm thu:** 9/9 file JSON giữa frontend và backend giống nhau tuyệt đối.
- **Rollback:** `git checkout backend/src/data/xianxia/items.json`.

---

### Bước 2: Tách Bạch Ranh Giới EXP (Cấp Độ) vs Tu Vi (Cảnh Giới)
- **Mục tiêu:** Đưa EXP và Level vào hoạt động thực tế trong cả Frontend Client và Backend Services.
- **Tệp thay đổi:**
  - `frontend/tienlo-engine.js`:
    - Cập nhật `getDefaultPlayer()`: bổ sung `level: 1`, `exp: 0`, `exp_required: 100`.
    - Thêm hàm `addExp(amount)`: Khi đủ EXP $\rightarrow$ tăng `level`, tăng `max_health (+4)`, tăng `max_fatigue (+1 mỗi 2 cấp)`, mỗi 10 cấp thưởng 1 Điểm Tiềm Năng, hồi đầy thể lực.
    - Cập nhật `endBattle()`: gọi `this.addExp(expGained)` thay vì vứt bỏ biến này.
    - Cập nhật giao diện `renderPlayerStats()`: hiển thị Level bên cạnh Cảnh giới.
  - `backend/src/types/xianxia.ts` & `xianxiaQuestService.ts`: Đảm bảo `playerContext.level` nhận giá trị hợp lệ từ client.
- **Chiến lược tương thích:** Trong `loadPlayerState()`, nếu dữ liệu lưu cũ thiếu `level` $\rightarrow$ tự động gán mặc định `level = 1, exp = 0`.
- **Kiểm thử bắt buộc:**
  - Chạy `npm test` toàn bộ suite kiểm thử backend.
  - Test kiểm tra việc thăng cấp level khi nhận đủ EXP từ quái.
- **Nghiệm thu:** Người chơi đánh quái nhận EXP và lên cấp level rõ ràng; Tu vi vẫn dùng riêng cho đột phá cảnh giới.
- **Rollback:** Khôi phục `frontend/tienlo-engine.js` từ backup.

---

### Bước 3: Triển Khai Chiến Đấu Tự Động Hoàn Toàn (Full Auto-Combat Engine)
- **Mục tiêu:** Chuyển đổi toàn bộ trận đấu sang chế độ tự động, người chơi không phải bấm nút từng hiệp.
- **Tệp thay đổi:**
  - `frontend/tienlo-engine.js`:
    - Xây dựng phương thức mô phỏng tự động `simulateAutoCombat(player, monster)`:
      - Tính toán sẵn kịch bản hiệp đấu (rounds array).
      - Mỗi hiệp ghi lại: hành động người chơi (Strike/Skill/Guard), hành động quái, sát thương, máu còn lại, Qi còn lại.
      - Giới hạn 30 hiệp: Quá 30 hiệp so sánh % máu; bên người chơi cao hơn nhận 50% thưởng an ủi, quái cao hơn tự động rút lui an toàn.
      - Xử lý thất bại trận đấu: Trở về Động Phủ Tán Tu với 20 HP, mất 15 Thể lực; bảo toàn nguyên vẹn trang bị, vật phẩm túi đồ và cảnh giới.
    - Cập nhật `startBattle(monsterId)`:
      - Khởi chạy trận đánh tự động.
      - Sử dụng `setInterval` để phát lại (playback) từng hiệp với tốc độ tùy chọn (1x = 800ms/hiệp, 2x = 400ms/hiệp).
      - **Quy tắc Bỏ qua (Skip):** Nút `[⏭ Xem Kết Quả Ngay]` ở trạng thái Vô hiệu hóa (Disabled) trong suốt Hiệp 1. Ngay khi Hiệp 1 hoàn tất, nút mới sáng lên (Enabled) để người chơi có thể bỏ qua phần diễn biến còn lại và xem ngay bảng tổng kết.
    - Loại bỏ mã lắng nghe click của 4 nút thủ công cũ trong `#battle-modal`.
    - Giữ lại các hàm alias: `huntMonster(id)`, `playerBattleAction(act)` để tương thích với test.
  - `frontend/tien-lo.html`:
    - Cập nhật markup `#battle-modal`: Thay khu vực 4 nút bấm bằng bảng điều khiển tốc độ trận đấu (`▶ 1x`, `⏩ 2x`, `⏭ Kết Quả Nhanh` - mở sau Hiệp 1) và thanh trạng thái tự động.
- **Rủi ro:** Người chơi có thể cảm thấy mất quyền can thiệp nếu combat diễn ra quá nhanh mà không có visual rõ ràng.
- **Giảm thiểu:** Cung cấp combat log nhảy số sinh động, thanh máu co giãn mượt mà, và cho phép tùy chỉnh tốc độ xem hoặc bỏ qua tùy ý (sau Hiệp 1).
- **Kiểm thử bắt buộc:**
  - Chạy `xianxiaBestiary.test.ts` và `xianxiaFrontendIntegration.test.ts`.
  - Kiểm thử đánh bại quái, kiểm thử người chơi ngất xỉu trở về Động phủ với 20 HP, -15 Thể lực.
- **Nghiệm thu:** Trận đấu diễn ra hoàn toàn tự động từ lúc bấm "Khiêu Chiến" đến khi hiện bảng chiến lợi phẩm.
- **Rollback:** Khôi phục từ `tienlo-engine.js.bak` và `tien-lo.html`.

---

### Bước 4: Thống Nhất Vòng Lặp Gameplay & Tinh Chỉnh Chỉ Dẫn Thiên Cơ
- **Mục tiêu:** Tạo mối liên kết hữu cơ giữa Thám hiểm $\rightarrow$ Thu thập $\rightarrow$ Luyện chế $\rightarrow$ Đột phá.
- **Tệp thay đổi:** `frontend/tienlo-engine.js`.
- **Nội dung:**
  - Cập nhật hàm `updateSmartGuide()`:
    - Khi người chơi kẹt ở quái mạnh $\rightarrow$ gợi ý luyện chế đan dược hoặc rèn vũ khí phù hợp.
    - Khi người chơi đạt đỉnh phong tu vi $\rightarrow$ chỉ dẫn chuẩn bị Trúc Cơ Đan trước khi xung quan.
- **Kiểm thử bắt buộc:** Kiểm tra hiển thị widget trên các phân khu và trạng thái người chơi khác nhau.
- **Nghiệm thu:** Widget hiển thị lời khuyên chính xác, bấm nút "Hành Động ➔" điều hướng tức thì đến đúng tính năng cần làm.

---

## IV. BẢNG MA TRẬN RỦI RO & PHƯƠNG ÁN DỰ PHÒNG

| Rủi ro tiềm ẩn | Mức độ | Ảnh hưởng | Phương án xử lý & Dự phòng |
|---|:---:|---|---|
| **Lỗi hồi quy bài test cũ (Regression Failure)** | Trung bình | Các bài test backend assert chuỗi hoặc hàm cũ bị fail. | Giữ nguyên 100% các hàm wrapper (`huntMonster`, `renderQuestBoard`, `turnInQuest`) và bảo toàn các attribute DOM `data-tab="quests"`. |
| **Mất dữ liệu LocalStorage của người chơi cũ** | Thấp | Người chơi bị reset về nhân vật ban đầu. | Cơ chế Migration tự động: `Object.assign(getDefaultPlayer(), parsed)` tự điền các trường mới (`level`, `exp`) mà không ghi đè dữ liệu cũ. |
| **Trận đánh auto bị treo vòng lặp vô hạn** | Thấp | Hai bên phòng thủ liên tục không ai chết. | Giới hạn cứng tối đa 30 hiệp. Nếu sau 30 hiệp chưa phân thắng bại $\rightarrow$ xử hòa và tự động rút lui an toàn. |
