# BÁO CÁO THẨM ĐỊNH KỸ THUẬT: BƯỚC M2.4 - NHIỆM VỤ CHÍNH TUYẾN CHƯƠNG 8 (TRÚC CƠ ĐỈNH PHONG - ĐẠO CƠ VÔ KHUYẾT)

**Kính gửi:** Claude Code (Tech Lead / Checker)  
**Người thực hiện:** Antigravity (Maker / Lead Developer)  
**Phân hệ:** Tiên Lộ: Vạn Giới Tranh Phong (Độc lập 100%, Không liên quan Kỳ Biến)  
**Giai đoạn:** Phase 2 - Chuỗi Nhiệm Vụ Đến Trúc Cơ Đỉnh Phong  
**Hạng mục:** Bước M2.4 - Thiết kế và triển khai nhiệm vụ chính tuyến đến Trúc Cơ Đỉnh Phong  

---

## 1. MỤC TIÊU VÀ PHẠM VI BƯỚC M2.4
Bước M2.4 hoàn thiện mảnh ghép chính tuyến tối hậu trong Phase 2:
- **[Chính Tuyến 8] Càn Khôn Đạo Vận - Trúc Cơ Đỉnh Phong (`main_08_truc_co_dinh_phong`)**:
  - **Điều kiện mở khóa:** Cảnh giới `TRUC_CO_HAU_KY`, level 20, hoàn thành `main_07_tran_ap_co_ma`.
  - **Mục tiêu và Cốt truyện:** Người chơi đạt Trúc Cơ Hậu Kỳ, vận chuyển Càn Khôn Đạo Vận thâm nhập tầng sâu Cổ Ma Động Phủ. Hấp thu linh khí địa mạch, tiếp nhận Càn Khôn Khẩu Quyết từ Tiêu Dao Lão Nhân (`obj_main_08_talk_enlighten`), trảm sát tà thú trấn giữ ma trận trong Cổ Ma Động (`obj_main_08_kill_final_boss`), vượt qua Cửu Trọng Lôi Kiếp để chính thức ngưng tụ **Ngũ Hành Đạo Cơ Viên Mãn**, bước lên cảnh giới **Trúc Cơ Đỉnh Phong**.
  - **Phần thưởng:** 15,000 EXP, 12,000 Tu Vi, 3,000 Ngân Lượng, 3 Trúc Cơ Đan (`item_truc_co_dan`), 1 Thanh Tâm Ngọc Bội (`item_thanh_tam_boi`), Danh hiệu tối thượng: `Đạo Cơ Vô Khuyết`!

---

## 2. CHI TIẾT CÁC THAY ĐỔI ĐÃ TRIỂN KHAI

### 2.1. Cấu hình Dữ liệu Nhiệm Vụ (`quests.json`)
- **Tập tin:** `backend/src/data/xianxia/quests.json` (được đồng bộ 1:1 sang `backend/dist/data/xianxia/quests.json` và `frontend/data/xianxia/quests.json`).
- **Nội dung nhiệm vụ mới:**
  ```json
  {
    "id": "main_08_truc_co_dinh_phong",
    "title": "[Chính Tuyến 8] Càn Khôn Đạo Vận - Trúc Cơ Đỉnh Phong",
    "type": "MAIN_STORY",
    "category": "CHINH_TUYEN",
    "giver_npc_id": "npc_hac_y_lu_nhan",
    "giver_npc_name": "Mạc Vô Nhai (Thiên Kiếm Chấp Pháp)",
    "turnin_npc_id": "npc_tieu_dao_tu",
    "turnin_npc_name": "Tiêu Dao Lão Nhân",
    "summary": "Đạt Trúc Cơ Hậu Kỳ, vận chuyển Càn Khôn Đạo Vận thâm nhập tầng sâu Cổ Ma Động Phủ. Hấp thu linh khí địa mạch, trảm sát tà thú trấn giữ ma trận, vượt qua Cửu Trọng Lôi Kiếp để chính thức ngưng tụ Ngũ Hành Đạo Cơ Viên Mãn, bước lên Trúc Cơ Đỉnh Phong!",
    "dialogue_intro": [
      "Vạn cổ tu tiên, người bước vào Trúc Cơ nhiều vô số kể, nhưng kẻ ngưng tụ được 'Đạo Cơ Vô Khuyết' chạm tới Trúc Cơ Đỉnh Phong thì phượng mao lân giác!",
      "Chân khí trong kinh mạch của ngươi đã sánh đặc như lưu ly. Thời cơ đột phá Trúc Cơ Đại Viên Mãn ngàn năm có một đã tới!",
      "Hãy đến gặp Tiêu Dao Lão Nhân để tiếp nhận Càn Khôn Khẩu Quyết, sau đó tiến thẳng vào trung tâm ma quật nghênh đón Cửu Trọng Lôi Kiếp!"
    ],
    "dialogue_in_progress": [
      "Lôi vân ngập trời, tử điện cuồn cuộn giáng xuống đan điền! Tĩnh tâm ngưng tụ, tôi luyện Đạo Cơ không chút tỳ vết!"
    ],
    "dialogue_turnin": [
      "Thiên địa cộng minh, vạn đạo thần quang chiếu rọi đỉnh Kiếm Sơn!",
      "Tiêu Dao Lão Nhân và Mạc Vô Nhai đồng thanh bái phục: Đạo Cơ Vô Khuyết! Ngươi đã đạt tới cảnh giới tối cao của Trúc Cơ – Trúc Cơ Đỉnh Phong!",
      "Kim Đan đại đạo đã mở ra trước mắt ngươi. Từ nay danh chấn bát hoang, thiên hạ không ai không biết đến danh hào Trúc Cơ Đỉnh Phong Chân Tu!"
    ],
    "requirements": {
      "min_realm": "TRUC_CO_HAU_KY",
      "min_level": 20,
      "prerequisite_quest_id": "main_07_tran_ap_co_ma"
    },
    "objectives": [
      {
        "id": "obj_main_08_talk_enlighten",
        "type": "TALK_NPC",
        "description": "Đến Suối Linh Tuyền tiếp nhận Càn Khôn Khẩu Quyết từ Tiêu Dao Lão Nhân",
        "target_id": "npc_tieu_dao_tu",
        "target_name": "Tiêu Dao Lão Nhân",
        "required_count": 1
      },
      {
        "id": "obj_main_08_kill_final_boss",
        "type": "KILL_MONSTER",
        "description": "Trảm sát U Minh Lang Vương trong trận lôi kiếp để viên mãn đạo cơ",
        "target_id": "boss_u_minh_lang_vuong",
        "target_name": "U Minh Lang Vương",
        "required_count": 1
      }
    ],
    "rewards": {
      "exp": 15000,
      "cultivation": 12000,
      "silver": 3000,
      "items": [
        { "item_id": "item_truc_co_dan", "item_name": "Trúc Cơ Đan", "quantity": 3 },
        { "item_id": "item_thanh_tam_boi", "item_name": "Thanh Tâm Ngọc Bội", "quantity": 1 }
      ],
      "title": "Đạo Cơ Vô Khuyết"
    }
  }
  ```

---

## 3. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & VERIFICATION
1. **TypeScript Build (`npm run build`):**
   - Lệnh: `tsc`
   - Kết quả: **Exit code 0 (Thành công 100%).**
2. **Kiểm thử Toàn diện Hệ Thống Nhiệm Vụ (`xianxiaQuest.test.ts`):**
   - Kết quả: **PASS 100% (11/11 mục kiểm thử):**
     - ✅ [1/11] Tải thành công chính xác 11 nhiệm vụ từ `quests.json`.
     - ✅ [2/11] Phân bổ chính xác 8 nhiệm vụ Chính Tuyến và 3 nhiệm vụ Thỉnh Cầu tinh tuyển.
     - ✅ [3/11] Phương thức `getQuestsByCategory` hoạt động chuẩn cho `ALL` (11), `MAIN_STORY` (8), `SIDE_QUEST` (3).
     - ✅ [4/11] Xác minh độ khó quái Chính Tuyến.
     - ✅ [5/11] Hệ thống khóa cấp độ và tiền đề: Main 1 AVAILABLE, Main 2 -> 8 LOCKED.
     - ✅ [6/11] Hoàn thành Chính Tuyến 1 -> Mở khóa Chính Tuyến 2.
     - ✅ [7/11] Các nhiệm vụ phụ tinh tuyển (Trảm Yêu, Đàm Đạo, Khảo Nghiệm Dược Lý) hoạt động chính xác.
     - ✅ [8/11] Hoàn thành Chính Tuyến 2 & 3 hạ gục Boss Lang Vương.
     - ✅ [9/11] Hoàn thành Chính Tuyến 4 & 5 -> Đột phá Trúc Cơ Sơ Kỳ.
     - ✅ [10/11] Hoàn thành Chính Tuyến 6 & 7 -> Khảo nghiệm kiếm tông, trấn áp Cổ Ma, bước vào Trúc Cơ Hậu Kỳ.
     - ✅ [11/11] Hoàn thành Chính Tuyến 8 -> ĐẠT TỚI TRÚC CƠ ĐỈNH PHONG (ĐẠO CƠ VÔ KHUYẾT)!
3. **Kiểm tra Hồi Quy Thế Giới (`xianxiaWorld.test.ts`):**
   - Kết quả: **PASS 100% (8/8 mục kiểm thử).**
4. **Kiểm tra Live Server (Port 3000):**
   - `GET /api/xianxia/quests/player?category=ALL`:
     - Trả về đúng 11 nhiệm vụ.
     - Toàn bộ chuỗi gating: Main 1 AVAILABLE, Main 2 -> 8 LOCKED chuẩn xác.
5. **Độc lập Tuyệt đối (Zero Kỳ Biến):**
   - Hoàn toàn độc lập, không liên quan đến Kỳ Biến hay cờ tướng.

---

## 4. YÊU CẦU ĐÁNH GIÁ (TECH LEAD REVIEW)
Kính mời Claude Code đánh giá và thẩm định báo cáo Bước M2.4:
- Đạt chuẩn toàn diện chuỗi nhiệm vụ chính tuyến lên đến Trúc Cơ Đỉnh Phong?
- Cho kết luận **PASS** hoặc **FAIL**.
- Nếu PASS, phê duyệt chuyển sang **Bước M2.5: Thiết kế và triển khai hệ thống đan dược, pháp bảo và quái vật mở rộng (bestiary.json, items.json)**.
