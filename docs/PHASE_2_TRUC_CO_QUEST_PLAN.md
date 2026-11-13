# KẾ HOẠCH TỔNG HỢP GIAI ĐOẠN 2: XÂY DỰNG CHUỖI NHIỆM VỤ ĐẾN TRÚC CƠ ĐỈNH PHONG (PHASE 2: QUEST PROGRESSION TO FOUNDATION ESTABLISHMENT PEAK)

**Dự án:** Tiên Lộ (Game nhập vai Tiên Hiệp / Kiếm Hiệp độc lập)
**Tác giả:** Antigravity (Architect & Maker)
**Gửi tới:** Claude Code (Tech Lead & Checker)
**Mục tiêu:** Xây dựng hoàn chỉnh chuỗi nhiệm vụ chính tuyến & phụ tuyến dẫn dắt người chơi từ Luyện Khí Tầng 1 đến cảnh giới **Trúc Cơ Đỉnh Phong** (Foundation Establishment Peak), mở rộng hệ thống Cảnh Giới, Bản Đồ, Dữ liệu Quái vật / Boss, Đan Dược và Pháp Bảo tương ứng.

---

## 1. NGUYÊN TẮC CỐT LÕI (CORE PRINCIPLES)
1. **Độc lập tuyệt đối:** Game Tiên Lộ là game RPG Tiên Hiệp thuần túy, 100% không liên quan đến cờ tướng hay Kỳ Biến.
2. **Tiến trình tu chân mạch lạc (Sense of Progression):**
   - Mỗi chương chính tuyến gắn liền với một bước ngoặt tu vi, yêu cầu người chơi tích lũy tu vi, rèn đúc trang bị, luyện chế đan dược thích hợp để vượt ải và trảm Boss.
3. **Bảo toàn dữ liệu & Không lỗi hồi quy (Regression-free):**
   - Giữ nguyên tiến trình của người chơi hiện tại, tương thích hoàn toàn với hệ thống nhiệm vụ đã tinh giản ở Giai đoạn 1.

---

## 2. MỞ RỘNG KIẾN TRÚC CẢNH GIỚI & BẢN ĐỒ

### A. Bổ sung Cảnh Giới Trúc Cơ vào Type System (`types/xianxia.ts` & `xianxiaWorldService.ts`):
- `TRUC_CO_SO_KY` (Trúc Cơ Sơ Kỳ) - Cấp 10-14
- `TRUC_CO_TRUNG_KY` (Trúc Cơ Trung Kỳ) - Cấp 15-19
- `TRUC_CO_HAU_KY` (Trúc Cơ Hậu Kỳ) - Cấp 20-24
- `TRUC_CO_DINH_PHONG` (Trúc Cơ Đỉnh Phong / Viên Mãn) - Cấp 25+

### B. Mở rộng Phân Khu Thế Giới (`worldData.json`):
1. **Thanh Hà Thôn (`zone_thanh_ha_thon`)**: Phàm Nhân -> Luyện Khí 1 [Đã có]
2. **U Minh Trúc Lâm (`zone_u_minh_truc_lam`)**: Luyện Khí 1 -> Luyện Khí 3 [Đã có]
3. **Hắc Phong Nhai (`zone_hac_phong_nhai`)**: Luyện Khí 3 -> Luyện Khí 5 [Đã có]
4. **Vân Mộng Đầm Lầy (`zone_van_mong_dam`)**: Mở mới (Yêu cầu Luyện Khí Tầng 5)
   - Địa điểm: `place_duoc_vuong_coc` (Dược Vương Cốc), `place_u_minh_dam` (Đầm U Minh)
5. **Cổ Vực Tiên Ma / Thiên Kiếm Sơn (`zone_thien_kiem_son`)**: Mở mới (Yêu cầu Trúc Cơ Sơ Kỳ)
   - Địa điểm: `place_kiem_tong_dien` (Kiếm Tông Đại Điện), `place_co_ma_dong` (Cổ Ma Động Phủ)

---

## 3. THIẾT KẾ MẠCH NHIỆM VỤ CHÍNH TUYẾN ĐẾN TRÚC CƠ ĐỈNH PHONG

- **[Chính Tuyến 1] Khởi Đầu Tiên Duyên - Trảm Sài Lang** (Phàm Nhân -> Luyện Khí 1) [Đã có]
- **[Chính Tuyến 2] Bóng Ma U Minh - Yêu Khí Uy Hiếp** (Luyện Khí 1 -> Luyện Khí 2) [Đã có]
- **[Chính Tuyến 3] Tuyệt Đỉnh Hắc Phong - Trảm Diệt Lang Vương** (Luyện Khí 2 -> Luyện Khí 3) [Đã có]
- **[Chính Tuyến 4] Thâm Nhập Vân Mộng - Đoạt Đan Hóa Khí**
  - *Cảnh giới yêu cầu:* Luyện Khí Tầng 4.
  - *Mục tiêu:* Thu thập Ngàn Năm Huyết Linh Chi tại Đầm Vân Mộng, hạ sát Huyết Ngạc (Cá sấu đầm lầy HP 1,200).
  - *Phần thưởng:* Tụ Khí Linh Đan, Pháp khí Lam Sơ Giai, mở khóa Luyện Khí Tầng 6.
- **[Chính Tuyến 5] Nghịch Thiên Cải Mệnh - Trúc Cơ Xung Quan**
  - *Cảnh giới yêu cầu:* Luyện Khí Tầng 7 -> Đỉnh Phong.
  - *Mục tiêu:* Luyện chế/Thu thập Trúc Cơ Thần Đan, vào Cổ Tu Động đả tọa độ kiếp, đánh bại Tâm Ma Hóa Thân (HP 2,500).
  - *Phần thưởng:* Đột phá **Trúc Cơ Sơ Kỳ**, nhận Danh hiệu `Trúc Cơ Tiên Tôn`, mở khóa Pháp bảo Ngự Kiếm.
- **[Chính Tuyến 6] Tiên Môn Tuyển Đệ Tử - Trúc Cơ Trung Kỳ**
  - *Cảnh giới yêu cầu:* Trúc Cơ Sơ Kỳ.
  - *Mục tiêu:* Vượt qua Khảo Hạch Kiếm Tông tại Thiên Kiếm Sơn, trảm sát Kiếm Khôi Cổ Đại (HP 5,000).
  - *Phần thưởng:* Đột phá **Trúc Cơ Trung Kỳ**, Kiếm Khí Thuần Dương / Ma Diễm Bí Kíp.
- **[Chính Tuyến 7] Thần Lăng Phong Ấn - Trấn Áp Ma Thi Vương**
  - *Cảnh giới yêu cầu:* Trúc Cơ Trung Kỳ.
  - *Mục tiêu:* Tiến nhập tầng sâu Cổ Ma Động Phủ, tiêu diệt Boss Ma Thi Cửu U (HP 9,000, ATK 180).
  - *Phần thưởng:* Đột phá **Trúc Cơ Hậu Kỳ**, nhận Bản Mệnh Kiếm Thai cực phẩm.
- **[Chính Tuyến 8] Càn Khôn Đạo Vận - Trúc Cơ Đỉnh Phong**
  - *Cảnh giới yêu cầu:* Trúc Cơ Hậu Kỳ.
  - *Mục tiêu:* Hấp thu Cửu U Địa Hỏa, ngưng tụ Ngũ Hành Đạo Cơ Viên Mãn, vượt qua Cửu Trọng Lôi Kiếp.
  - *Phần thưởng:* Đạt tới **Trúc Cơ Đỉnh Phong**, Danh hiệu `Đạo Cơ Vô Khuyết`, sẵn sàng Kết Đan Hóa Thần!

---

## 4. BỔ SUNG QUÁI VẬT, VẬT PHẨM & ĐAN DƯỢC
- **Quái vật mới (`bestiary.json`):**
  - `monster_huyet_ngac` (Huyết Ngạc Đầm Lầy - Luyện Khí Trung Kỳ)
  - `monster_kiem_khoi` (Kiếm Khôi Cổ - Trúc Cơ Sơ Kỳ)
  - `boss_tam_ma` (Tâm Ma Huyễn Cảnh - Boss Độ Kiếp Trúc Cơ)
  - `boss_ma_thi_vuong` (Thiên Cổ Ma Thi Vương - Trúc Cơ Hậu Kỳ)
- **Vật phẩm & Đan Dược mới (`items.json`):**
  - `item_ngan_nam_huyet_chi` (Nguyên liệu Trúc Cơ)
  - `item_cuc_pham_truc_co_dan` (Đan dược xung quan tỷ lệ 100%)
  - `item_ban_menh_kiem_thai` (Pháp bảo Trúc Cơ)
  - `item_dao_co_ngoc_gian` (Bí tịch tâm pháp đỉnh phong)

---

## 5. ĐỀ NGHỊ CLAUDE CODE PHÂN CHIA CÁC BƯỚC NHỎ (M2.1, M2.2, M2.3...)
Claude vui lòng:
1. Thẩm định tính chặt chẽ của bản kế hoạch chuỗi nhiệm vụ Trúc Cơ Đỉnh Phong.
2. Chia nhỏ thành các bước thực thi tuần tự (M2.1, M2.2, M2.3...) kèm tiêu chí nghiệm thu (Acceptance Criteria) độc lập.
3. Chỉ định bước đầu tiên (M2.1) để Antigravity bắt tay vào code ngay.
