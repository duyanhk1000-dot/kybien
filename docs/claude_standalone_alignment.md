# THỐNG NHẤT ĐỊNH HƯỚNG PHÁT TRIỂN: TIÊN LỘ LÀ GAME NHẬP VAI TIÊN HIỆP ĐỘC LẬP 100%

**Gửi tới:** Claude Code (Tech Lead & Checker)
**Người gửi:** Antigravity (Maker & Architect)
**Chủ đề:** Làm rõ ranh giới kiến trúc và định hướng phân hệ Tiên Lộ

---

## 1. YÊU CẦU LÀM RÕ TỪ PRODUCT OWNER (NGƯỜI DÙNG)
- **Tiên Lộ (Vạn Giới Tranh Phong)** là một **phân hệ game RPG Tiên Hiệp / Kiếm Hiệp chạy hoàn toàn độc lập**, KHÔNG liên quan, KHÔNG ràng buộc và KHÔNG tích hợp bất kỳ cơ chế nào của game cờ tướng / Kỳ Biến.
- Đã rà soát và gỡ bỏ triệt để toàn bộ các tàn dư liên kết hoặc câu chữ dẫn xuất ("Sảnh Kỳ Biến", "Trang Chủ Cờ Tướng", "Đăng nhập Kỳ Biến") trong toàn bộ giao diện và mã nguồn frontend ([tien-lo.html](file:///d:/Lap%20trinh%20game/ky_bien/frontend/tien-lo.html), [tienlo-engine.js](file:///d:/Lap%20trinh%20game/ky_bien/frontend/tienlo-engine.js), [tienlo-coop.js](file:///d:/Lap%20trinh%20game/ky_bien/frontend/tienlo-coop.js)).

---

## 2. ĐỊNH HƯỚNG CÁC GIAI ĐOẠN TIẾP THEO (THUẦN TIÊN HIỆP / KIẾM HIỆP)
- **Giai đoạn 2: Kỳ Ngộ Giang Hồ & Cơ Duyên Tiên Phủ (Pure Wuxia / Xianxia Fate System)**
  * **Cơ chế Kỳ Ngộ ngẫu nhiên:** Khi du hành qua các địa danh (U Minh Trúc Lâm, Suối Linh Tuyền, Hắc Phong Nhai) có tỷ lệ kích hoạt cơ duyên:
    - Rơi xuống đáy vực phát hiện Cổ Động Tiên Nhân.
    - Cứu giúp thương nhân giang hồ nhận Tàn Quyển Bí Thuật.
    - Chợ đen Quỷ Thị xuất hiện ngẫu nhiên với linh đan dị thảo giá trị cao.
    - Lựa chọn gặp Ma Đầu dụ dỗ (tăng tu vi tức thì nhưng tăng Tâm Ma / giảm Karma).
  * **Hệ thống Đạo Tâm & Phân Nhánh Nhân Quả (Chính Đạo vs Ma Đạo):**
    - Điểm Karma dương mở khóa kiếm khí thuần dương, danh hiệu chính phái.
    - Điểm Karma âm / Tâm Ma mở khóa ma công thôn phệ, hút máu, bạo kích.
- **Giai đoạn 3: Môn Phái & Tông Môn Tranh Đạt (Sect Factions & Co-op Raids)**
  * Nhiệm vụ cống hiến Tông Môn, rèn đúc Thần Binh, khiêu chiến Boss Ma Long.

Claude Code hãy xác nhận đã hiểu rõ định hướng độc lập này để đảm bảo toàn bộ thiết kế, bước chia nhỏ và tiêu chí nghiệm thu từ nay về sau hoàn toàn tập trung vào trải nghiệm Tiên Hiệp thuần túy!
