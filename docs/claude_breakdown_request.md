Bạn là Tech Lead & Checker Claude Code trong quy trình pair-programming với Antigravity.
Hãy đọc kỹ bản Kế Hoạch Tổng Hợp Giai Đoạn 1 dưới đây và thực hiện:
1. Đánh giá tính khả thi và độ chặt chẽ của kế hoạch.
2. Phân chia kế hoạch thành các bước nhỏ tuần tự (M1.1, M1.2, M1.3...) chi tiết, rõ ràng, không nhảy cóc.
3. Với mỗi bước, nêu rõ:
   - Tên bước & Mục tiêu cụ thể.
   - Các file cần chỉnh sửa hoặc tạo mới.
   - Tiêu chí nghiệm thu (Acceptance Criteria) độc lập để bạn kiểm tra sau khi Antigravity code xong.
4. Chỉ định bước đầu tiên (M1.1) để Antigravity bắt tay vào thực hiện ngay.

---

# KẾ HOẠCH TỔNG HỢP GIAI ĐOẠN 1: TINH GIẢN & TỐI ƯU HÓA HỆ THỐNG NHIỆM VỤ (PHASE 1 QUEST SYSTEM STREAMLINE & POLISH)

**Dự án:** Tiên Lộ (Wuxia / Xianxia RPG độc lập)
**Tác giả:** Antigravity (Architect & Maker)
**Gửi tới:** Claude Code (Tech Lead & Checker)
**Mục tiêu:** Tinh giản hệ thống nhiệm vụ phụ thành 6 tuyến nhiệm vụ tinh hoa giàu cốt truyện, cấu trúc lại giao diện UI Tab Nhiệm Vụ với các danh mục phân loại rõ ràng (Chính Tuyến, Phụ Tuyến/Duyên Phận, Tiêu Cục Tứ Hải), tối ưu thanh tiến trình và trải nghiệm người dùng theo phong cách kiếm hiệp cổ điển.

---

## 1. PHẠM VI & NGUYÊN TẮC (SCOPE & PRINCIPLES)
- **Độc lập hoàn toàn:** Trò chơi là game Tiên Hiệp / Kiếm Hiệp độc lập (Tiên Lộ), không phụ thuộc hay gắn kết với minigame Kỳ Biến.
- **Bảo toàn dữ liệu:** Không reset cơ sở dữ liệu, không xóa bảng, không làm đứt gãy tiến trình của người chơi hiện tại.
- **Tiêu chuẩn chất lượng:**
  * Backend TypeScript (`xianxiaQuestService.ts` & `quests.json`) hoạt động ổn định, không lỗi biên dịch, không lỗi logic mục tiêu (`KILL_MONSTER`, `TALK_NPC`, `DELIVER_MESSAGE`, `ANSWER_QUIZ`, `MAKE_CHOICE`).
  * Frontend (`tienlo-engine.js` & `tien-lo.html`) có UI Wuxia sắc nét, font chữ kiếm hiệp cổ điển, sub-tab phân loại mượt mà, thanh tiến độ trực quan, responsive trên mobile/desktop.

---

## 2. NỘI DUNG KẾ HOẠCH CHI TIẾT

### Hạng mục A: Tinh Giản Dữ Liệu Nhiệm Vụ (`quests.json`)
1. **Chính Tuyến (Giữ nguyên 3 Chương Khởi Đầu & Chuẩn Hóa):**
   - `main_01_khoi_dau_tien_duyen`: Trảm Sài Lang (Phàm Nhân -> Luyện Khí 1).
   - `main_02_bong_ma_u_minh`: Bóng Ma U Minh (Luyện Khí 1 -> Luyện Khí 2).
   - `main_03_tram_diet_lang_vuong`: Tuyệt Đỉnh Hắc Phong (Luyện Khí 2 -> Luyện Khí 3).
2. **Phụ Tuyến Tinh Hoa (Rút gọn từ 10 xuống 6 nhiệm vụ đặc sắc, giàu cốt truyện):**
   - `side_01_tram_yeu_thanh_ha`: [Trảm Yêu] Họa Sài Lang Cửa Thôn (Săn 3 Thổ Lang quấy nhiễu dân làng).
   - `side_02_dam_dao_quy_luat`: [Đàm Đạo] Cảnh Giới & Quy Luật Tiên Thiên (Nói chuyện với Trưởng Thôn khai mở nhận thức).
   - `side_03_khao_nghiem_duoc_ly`: [Khảo Nghiệm] Vấn Đạo Dược Lý & Đan Đạo (Trả lời câu hỏi trắc nghiệm của Trần Dược Sư về Trúc Cơ Đan).
   - `side_04_dua_tin_khan`: [Đưa Tin] Mật Thư Cảnh Báo Rừng Trúc (Giao phong thư khẩn cho Mạc Vô Nhai trước khi yêu khí bùng phát).
   - `side_05_truy_vet_tan_tu`: [Truy Vết] Tán Tu Mất Tích Tại Miếu Hoang (Theo dấu vết cứu thiếu niên tán tu bị bao vây).
   - `side_06_phan_quyet_dao_tam`: [Đạo Tâm] Phán Quyết Kẻ Trộm Khoáng Thạch (Lựa chọn tha bổng hoặc giao cho trưởng thôn xử lý -> ảnh hưởng trực tiếp điểm Thiện/Ác Karma và Tâm Ma).
3. **Loại bỏ 4 nhiệm vụ phụ cày cuốc vô hồn:**
   - Xóa bỏ `side_03_giao_dan_duoc`, `side_04_hai_linh_thao`, `side_05_san_nanh_soi`, `side_06_nghe_ngong_tin_tuc`.

---

### Hạng mục B: Tối Ưu Logic Backend (`xianxiaQuestService.ts`)
1. Đảm bảo hỗ trợ lọc nhiệm vụ theo danh mục (`MAIN_STORY`, `SIDE_QUEST`, `AGENCY`).
2. Trả về đầy đủ thông tin: Danh mục, Cảnh giới yêu cầu, Tiến độ từng mục tiêu (`current` / `required`), Trạng thái (`AVAILABLE`, `IN_PROGRESS`, `READY_TO_TURN_IN`, `COMPLETED`, `LOCKED`).
3. Đảm bảo hàm `recordMonsterKill`, `interactObjective`, `submitQuiz`, `submitChoice`, `turnInQuest` hoạt động mượt mà với 6 nhiệm vụ phụ mới.

---

### Hạng mục C: Thiết Kế & Nâng Cấp Giao Diện Tab Nhiệm Vụ (`frontend/tienlo-engine.js` & CSS)
1. **Hệ Thống Phân Loại Danh Mục (Sub-tabs Filter Bar):**
   - Thêm thanh chuyển tab con ngay trong Tab Nhiệm Vụ:
     * `[📜 Tất Cả]`
     * `[⚔️ Chính Tuyến]` (Gắn với tu vi & cốt truyện)
     * `[🌿 Thỉnh Cầu / Duyên Phận]` (6 nhiệm vụ phụ tinh tuyển)
     * `[🛡️ Tiêu Cục Tứ Hải]` (Ủy thác vận chuyển, săn lùng tuần hoàn)
2. **Nâng Cấp Thẻ Nhiệm Vụ (Wuxia Quest Card):**
   - Header thẻ: Tiêu đề kèm Huy hiệu Phân Loại (Badge mực đỏ cho Chính Tuyến, ngọc bích cho Phụ Tuyến, vàng kim cho Tiêu Cục).
   - Trạng thái rõ ràng: `CÓ THỂ TIẾP NHẬN` (Nút viền vàng), `ĐANG TIẾN HÀNH` (Nút phát sáng lam), `CÔNG ĐỨC VIÊN MÃN - BÀN GIAO` (Nút hào quang lục), `CHƯA MỞ KHÓA` (Khóa mờ kèm điều kiện cảnh giới đỏ).
   - Thanh tiến trình mục tiêu (Objective Progress Bar): Hiển thị tỉ lệ % kèm chỉ số `[1/3 Con]`, `[Đã thu thập 10/10]`.
   - Phần thưởng hiển thị bằng icon sắc nét (Tu vi, Bạc, EXP, Đan dược/Vật phẩm quý).
3. **Tích hợp sâu với Smart Guide Header:**
   - Khi bấm theo dõi nhiệm vụ bất kỳ, thanh Header cập nhật tức thì tên nhiệm vụ, mục tiêu kế tiếp và nút điều hướng nhanh.
