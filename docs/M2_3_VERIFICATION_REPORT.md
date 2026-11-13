# BÁO CÁO THẨM ĐỊNH KỸ THUẬT: BƯỚC M2.3 - NHIỆM VỤ CHÍNH TUYẾN CHƯƠNG 6 & 7 (TRÚC CƠ TRUNG KỲ ĐẾN HẬU KỲ)

**Kính gửi:** Claude Code (Tech Lead / Checker)  
**Người thực hiện:** Antigravity (Maker / Lead Developer)  
**Phân hệ:** Tiên Lộ: Vạn Giới Tranh Phong (Độc lập 100%, Không liên quan Kỳ Biến)  
**Giai đoạn:** Phase 2 - Chuỗi Nhiệm Vụ Đến Trúc Cơ Đỉnh Phong  
**Hạng mục:** Bước M2.3 - Thiết kế và triển khai nhiệm vụ chính tuyến từ Trúc Cơ Sơ Kỳ đến Trúc Cơ Hậu Kỳ  

---

## 1. MỤC TIÊU VÀ PHẠM VI BƯỚC M2.3
Bước M2.3 tiếp nối tiến trình phát triển nhân vật sau khi đã ngưng tụ Đạo Cơ thành công ở Bước M2.2, đưa người chơi tiến nhập vào phân khu môn phái Thiên Kiếm Sơn (`zone_thien_kiem_son`), chinh phục 2 chương chính tuyến tiếp theo:
1. **[Chính Tuyến 6] Kiếm Khí Xung Tiêu - Thiên Kiếm Khảo Hạch (`main_06_tien_mon_khao_hach`)**:
   - Điều kiện: Cảnh giới `TRUC_CO_SO_KY`, cấp 12, tiền đề `main_05_truc_co_xung_quan`.
   - Cốt truyện: Sau khi thành công Trúc Cơ, người chơi phi thăng đến Thiên Kiếm Sơn. Mạc Vô Nhai lộ diện thân phận thực sự là Chấp Pháp Sứ của Thiên Kiếm Tông, trực tiếp khảo hạch kiếm ý, yêu cầu người chơi trảm sát 2 Hắc Phong Điêu hung hãn trên đỉnh kiếm núi để tôi luyện Kiếm Ý Thuần Dương, gia nhập hàng ngũ Chân Truyền Đệ Tử và đột phá **Trúc Cơ Trung Kỳ**.
2. **[Chính Tuyến 7] Thần Lăng Phong Ấn - Trấn Áp Cổ Ma (`main_07_tran_ap_co_ma`)**:
   - Điều kiện: Cảnh giới `TRUC_CO_TRUNG_KY`, level 16, tiền đề `main_06_tien_mon_khao_hach`.
   - Cốt truyện: Ma khí tại Cổ Ma Động Phủ (`place_co_ma_dong`) dưới lòng Kiếm Sơn bùng phát dữ dội uy hiếp môn phái. Người chơi thỉnh giáo Tiêu Dao Lão Nhân bí thuật "Càn Khôn Phong Ma Ấn", sau đó tiến nhập sào huyệt sâu nhất trảm sát đại yêu trấn giữ, gia cố phong ấn, viên dung đạo cơ và đột phá **Trúc Cơ Hậu Kỳ** với danh hiệu `Trấn Ma Kiếm Quân`.

---

## 2. CHI TIẾT CÁC THAY ĐỔI ĐÃ TRIỂN KHAI

### 2.1. Cấu hình Dữ liệu Nhiệm Vụ (`quests.json`)
- **Tập tin:** `backend/src/data/xianxia/quests.json` (được đồng bộ 1:1 sang `backend/dist/data/xianxia/quests.json` và `frontend/data/xianxia/quests.json`).
- **Nội dung nhiệm vụ mới:**
  ```json
  {
    "id": "main_06_tien_mon_khao_hach",
    "title": "[Chính Tuyến 6] Kiếm Khí Xung Tiêu - Thiên Kiếm Khảo Hạch",
    "type": "MAIN_STORY",
    "category": "CHINH_TUYEN",
    "giver_npc_id": "npc_hac_y_lu_nhan",
    "turnin_npc_id": "npc_hac_y_lu_nhan",
    "requirements": {
      "min_realm": "TRUC_CO_SO_KY",
      "min_level": 12,
      "prerequisite_quest_id": "main_05_truc_co_xung_quan"
    },
    "objectives": [
      {
        "id": "obj_main_06_talk_sword_elder",
        "type": "TALK_NPC",
        "description": "Gặp Mạc Vô Nhai tại Thiên Kiếm Sơn tiếp nhận khảo nghiệm kiếm đạo",
        "target_id": "npc_hac_y_lu_nhan",
        "target_name": "Mạc Vô Nhai (Thiên Kiếm Chấp Pháp)",
        "required_count": 1
      },
      {
        "id": "obj_main_06_kill_beasts",
        "type": "KILL_MONSTER",
        "description": "Tiêu diệt 2 Hắc Phong Điêu chứng minh kiếm ý",
        "target_id": "monster_hac_phong_dieu",
        "target_name": "Hắc Phong Điêu",
        "required_count": 2
      }
    ],
    "rewards": {
      "exp": 4500,
      "cultivation": 3000,
      "silver": 800,
      "items": [
        { "item_id": "item_bach_luyen_tinh_thiet", "item_name": "Bạch Luyện Tinh Thiết", "quantity": 3 },
        { "item_id": "item_truc_co_dan", "item_name": "Trúc Cơ Đan", "quantity": 1 }
      ],
      "title": "Thiên Kiếm Đệ Tử"
    }
  },
  {
    "id": "main_07_tran_ap_co_ma",
    "title": "[Chính Tuyến 7] Thần Lăng Phong Ấn - Trấn Áp Cổ Ma",
    "type": "MAIN_STORY",
    "category": "CHINH_TUYEN",
    "giver_npc_id": "npc_hac_y_lu_nhan",
    "turnin_npc_id": "npc_tieu_dao_tu",
    "requirements": {
      "min_realm": "TRUC_CO_TRUNG_KY",
      "min_level": 16,
      "prerequisite_quest_id": "main_06_tien_mon_khao_hach"
    },
    "objectives": [
      {
        "id": "obj_main_07_consult_seal",
        "type": "TALK_NPC",
        "description": "Thỉnh giáo Tiêu Dao Lão Nhân về bí quyết phong ma đại trận",
        "target_id": "npc_tieu_dao_tu",
        "target_name": "Tiêu Dao Lão Nhân",
        "required_count": 1
      },
      {
        "id": "obj_main_07_kill_demon_boss",
        "type": "KILL_MONSTER",
        "description": "Vào Cổ Ma Động trảm sát Boss Lang Vương trấn áp ma nhãn",
        "target_id": "boss_u_minh_lang_vuong",
        "target_name": "U Minh Lang Vương",
        "required_count": 1
      }
    ],
    "rewards": {
      "exp": 8000,
      "cultivation": 6000,
      "silver": 1500,
      "items": [
        { "item_id": "item_truc_co_dan", "item_name": "Trúc Cơ Đan", "quantity": 2 },
        { "item_id": "item_thanh_tam_boi", "item_name": "Thanh Tâm Ngọc Bội", "quantity": 1 }
      ],
      "title": "Trấn Ma Kiếm Quân"
    }
  }
  ```

---

## 3. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & VERIFICATION
1. **TypeScript Build (`npm run build`):**
   - Lệnh: `tsc`
   - Kết quả: **Exit code 0 (Thành công 100%).**
2. **Kiểm thử Đơn vị Hệ Thống Nhiệm Vụ (`xianxiaQuest.test.ts`):**
   - Kết quả: **PASS 100% (10/10 mục kiểm thử):**
     - ✅ [1/10] Tải thành công chính xác 10 nhiệm vụ từ `quests.json`.
     - ✅ [2/10] Phân bổ chính xác 7 nhiệm vụ Chính Tuyến và 3 nhiệm vụ Thỉnh Cầu tinh tuyển.
     - ✅ [3/10] Phương thức `getQuestsByCategory` hoạt động chuẩn cho `ALL` (10), `MAIN_STORY` (7), `SIDE_QUEST` (3).
     - ✅ [4/10] Xác minh độ khó quái Chính Tuyến.
     - ✅ [5/10] Hệ thống khóa cấp độ và tiền đề: Main 1 AVAILABLE, Main 2 -> 7 LOCKED.
     - ✅ [6/10] Hoàn thành Chính Tuyến 1 -> Mở khóa Chính Tuyến 2.
     - ✅ [7/10] Các nhiệm vụ phụ tinh tuyển (Trảm Yêu, Đàm Đạo, Khảo Nghiệm Dược Lý) hoạt động chính xác.
     - ✅ [8/10] Hoàn thành Chính Tuyến 2 & 3 hạ gục Boss Lang Vương.
     - ✅ [9/10] Hoàn thành Chính Tuyến 4 & 5 -> Đột phá Trúc Cơ Sơ Kỳ.
     - ✅ [10/10] Hoàn thành Chính Tuyến 6 & 7 -> Khảo nghiệm kiếm tông, trấn áp Cổ Ma, bước vào Trúc Cơ Hậu Kỳ!
3. **Kiểm tra Hồi Quy Thế Giới (`xianxiaWorld.test.ts`):**
   - Kết quả: **PASS 100% (8/8 mục kiểm thử).**
4. **Kiểm tra Live Server (Port 3000):**
   - `GET /api/xianxia/quests/player?category=ALL`:
     - Trả về đúng 10 nhiệm vụ.
     - Phân tầng điều kiện chính xác: Main 1 AVAILABLE, Main 2 -> 7 LOCKED.
5. **Độc lập Tuyệt đối (Zero Kỳ Biến):**
   - Không chứa bất kỳ liên kết, chuỗi ký tự hay logic nào liên quan đến Kỳ Biến hay cờ tướng.

---

## 4. YÊU CẦU ĐÁNH GIÁ (TECH LEAD REVIEW)
Kính mời Claude Code đánh giá và thẩm định báo cáo Bước M2.3:
- Đạt chuẩn logic cốt truyện, phân cấp cảnh giới Trúc Cơ Sơ Kỳ -> Trung Kỳ -> Hậu Kỳ?
- Cho kết luận **PASS** hoặc **FAIL**.
- Nếu PASS, phê duyệt chuyển sang **Bước M2.4: Thiết kế và triển khai nhiệm vụ chính tuyến đến Trúc Cơ Đỉnh Phong (Chương 8: Càn Khôn Đạo Vận)**.
