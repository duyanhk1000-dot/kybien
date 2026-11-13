# YÊU CẦU ĐÁNH GIÁ HỆ THỐNG NHIỆM VỤ GAME TIÊN LỘ KỲ BIẾN

**Gửi tới:** Claude Code (Tech Lead & Lead Game Designer)
**Người gửi:** Antigravity (Maker & System Architect)
**Dự án:** Tiên Lộ Kỳ Biến (Xianxia / Wuxia Turn-based RPG kết hợp Cờ Thế Kỳ Biến)

---

## 1. BỐI CẢNH DỰ ÁN VÀ KIẾN TRÚC HIỆN TẠI

Hệ thống nhiệm vụ hiện tại của game bao gồm các thành phần cốt lõi:

### A. Quests Cốt Truyện & Phụ Tuyến (`backend/src/data/xianxia/quests.json` & `xianxiaQuestService.ts`)
- **Chính Tuyến (3 Chương sơ khởi):**
  - `main_01_khoi_dau_tien_duyen`: Trảm Sài Lang (Phàm Nhân -> Luyện Khí 1)
  - `main_02_bong_ma_u_minh`: Bóng Ma U Minh (Luyện Khí 1 -> Luyện Khí 2)
  - `main_03_tram_diet_lang_vuong`: Tuyệt Đỉnh Hắc Phong (Luyện Khí 2 -> Luyện Khí 3)
  - Gắn chặt với tiến trình đột phá Cảnh Giới (RealmTier) và mở khóa bản đồ.
- **Phụ Tuyến & Thỉnh Cầu Dân Làng (10 Nhiệm Vụ Thử Nghiệm):**
  - Gồm nhiều cơ chế tương tác đa dạng:
    * `KILL_MONSTER` (Trảm Yêu, Săn Nanh Sói)
    * `DELIVER_ITEM` & `GATHER_ITEM` (Giao Đan Dược, Hái Linh Thảo)
    * `TALK_NPC` & `GATHER_INTEL` (Đàm Đạo Tiên Thiên, Dị Tượng Suối Linh Tuyền)
    * `TRACK_PERSON` & `DELIVER_MESSAGE` (Truy Vết Tán Tu Mất Tích, Đưa Tin Khẩn)
    * `ANSWER_QUIZ` (Khảo Nghiệm Dược Lý & Đan Đạo cùng Trần Dược Sư)
    * `MAKE_CHOICE` (Phán Quyết Đạo Tâm - Tha bổng hay trừng phạt kẻ trộm khoáng thạch, ảnh hưởng chỉ số Tâm Ma / Thiện Ác / Karma).

### B. Tiêu Cục Tứ Hải - Agency Missions (`agencyMissions.json` & `xianxiaAgencyService.ts`)
- Hệ thống ủy thác lặp lại (Bounties & Logistics):
  * Phân loại 5 dạng: `ESCORT` (Vận Tiêu), `COURIER` (Giao Mật Thư), `HUNT` (Truy Nã Quái), `GATHERING` (Thu Thập), `EVENT` (Thám Hiểm Dị Biến).
  * 6 Cấp bậc Tiêu Sư: Associate -> Copper -> Silver -> Gold -> Chief -> Divine.
  * Tích lũy Công Trạng (Merit) và Điểm Tín Dụng (Credits) để đổi vật phẩm tại Tiệm Tiêu Cục.
  * Cơ chế rủi ro phục kích trên đường vận tiêu (`escort_risk_percent`).

### C. Giao Diện & UX Hiện Tại (`tienlo-engine.js` & `tien-lo.html`)
- Tab "Nhiệm Vụ" (Scroll list hiển thị trạng thái CÓ THỂ NHẬN, ĐANG THỰC HIỆN, ĐÃ HOÀN TẤT, CHƯA MỞ KHÓA).
- Thanh Smart Guide Header (`#tracker-quest-title`, `#tracker-quest-progress`) ghim nhiệm vụ đang theo dõi, bấm vào sẽ tự động điều hướng hoặc mở panel.
- Nút mở Drawer Tiêu Cục Tứ Hải riêng biệt.

---

## 2. CÂU HỎI TRỌNG TÂM CỦA NGƯỜI DÙNG

Người chơi / Product Owner đặt câu hỏi:
> **"Xin ý kiến Claude về toàn bộ hệ thống nhiệm vụ của game, cần GIỮ hay BỎ hay THÊM gì?"**

---

## 3. CÁC HẠNG MỤC CẦN CLAUDE ĐÁNH GIÁ CHI TIẾT

Claude hãy đưa ra phân tích sắc bén dưới góc nhìn của một Senior Game Designer & Lead Architect chuyên dòng game Tiên Hiệp / Kiếm Hiệp:

1. **CẦN GIỮ (Core to Keep):**
   - Những cơ chế, cấu trúc dữ liệu nào hiện tại đang làm rất tốt, chuẩn chỉnh, có giá trị cốt lõi cần tiếp tục duy trì và phát huy? (Ví dụ: logic liên kết Cảnh Giới, hệ thống Karma/Đạo Tâm, trắc nghiệm Dược Lý, hệ thống danh vọng Tiêu Cục...).

2. **CẦN BỎ HOẶC TINH GIẢN (What to Cut / Streamline):**
   - Những điểm trừ, yếu tố gây nhàm chán (friction/tedium), cồng kềnh hoặc tạo cảm giác "cày cuốc vô hồn" (MMO fetch grind) mà người chơi game nhập vai kiếm hiệp hiện đại rất ghét?
   - Cần tinh giản gì trong các chuỗi nhiệm vụ lặp lại (Agency Missions) và danh sách nhiệm vụ phụ?

3. **CẦN THÊM (What to Add - Game Changers):**
   - Đề xuất các tính năng nhiệm vụ mang đậm chất Tiên Hiệp - Kiếm Hiệp sâu sắc:
     * **Kỳ Ngộ Giang Hồ (Fortuitous Encounters / Fate):** Xuất hiện ngẫu nhiên khi tầm bảo/luyện công, ẩn chứa cơ duyên kỳ ngộ, bí kíp tàn quyển, cao nhân truyền công, hoặc ma đầu dụ dỗ.
     * **Nhân Quả & Nhánh Truyện (Karma & Moral Branching):** Lựa chọn Chính Đạo (Thánh Thiện) vs Ma Đạo (Tà Ác) làm thay đổi thái độ NPC, danh hiệu, kỹ năng độc quyền và kết cục thế giới.
     * **Kỳ Biến Cờ Thế Kỳ Hiệp (Xiangqi Chess Quests):** Tích hợp minigame Cờ Thế Kỳ Biến vào mạch nhiệm vụ (phá giải cờ thế cổ đại để mở động phủ tiên gia, đấu cờ với Kỳ Ma để đoạt kiếm phổ...).
     * **Chuỗi Nhiệm Vụ Dã Tẩu / Tuần Hoàn (Adventure Mystery Chain):** Chuỗi 10-30 vòng phiêu lưu mỗi ngày với phần thưởng đột biến ở các mốc 10, 20, 30.
     * **Tông Môn & Bang Hội (Sect & Guild Quests):** Tranh đoạt tài nguyên, trấn áp Ma Long (World Boss), phụ bản môn phái.

4. **LỘ TRÌNH TRIỂN KHAI ĐỀ XUẤT (Phased Implementation Roadmap):**
   - Chia thành các giai đoạn rõ ràng (Giai đoạn 1: Tinh giản & Polish, Giai đoạn 2: Kỳ Ngộ & Cờ Thế, Giai đoạn 3: Mạch truyện phân nhánh & Tông Môn).

Claude hãy trình bày bằng tiếng Việt, văn phong rành mạch, chuyên nghiệp, giàu tính định hướng game design và thực thi kỹ thuật.
