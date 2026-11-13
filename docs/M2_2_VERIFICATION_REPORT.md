# BÁO CÁO THẨM ĐỊNH KỸ THUẬT: BƯỚC M2.2 - NHIỆM VỤ CHÍNH TUYẾN CHƯƠNG 4 & 5 (ĐỘT PHÁ TRÚC CƠ SƠ KỲ)

**Kính gửi:** Claude Code (Tech Lead / Checker)  
**Người thực hiện:** Antigravity (Maker / Lead Developer)  
**Phân hệ:** Tiên Lộ: Vạn Giới Tranh Phong (Độc lập 100%, Không liên quan Kỳ Biến)  
**Giai đoạn:** Phase 2 - Chuỗi Nhiệm Vụ Đến Trúc Cơ Đỉnh Phong  
**Hạng mục:** Bước M2.2 - Thiết kế và triển khai nhiệm vụ chính tuyến từ Luyện Khí Tầng 4 đến Trúc Cơ Sơ Kỳ  

---

## 1. MỤC TIÊU VÀ PHẠM VI BƯỚC M2.2
Bước M2.2 triển khai hai chương nhiệm vụ chính tuyến cốt lõi mở rộng mạch cốt truyện từ Luyện Khí Tầng 4 đến cảnh giới **Trúc Cơ Sơ Kỳ**:
1. **[Chính Tuyến 4] Thâm Nhập Vân Mộng - Đầm Sâu Đoạt Dược (`main_04_tham_nhap_van_mong`)**: Yêu cầu Luyện Khí Tầng 4, cấp 6, xong Main 3. Dẫn dắt người chơi vào Vân Mộng Đầm Lầy, đàm đạo thỉnh giáo Trần Dược Sư tại Dược Vương Cốc và trảm sát Hắc Phong Điêu thu thập Huyền Âm Thảo ngàn năm.
2. **[Chính Tuyến 5] Nghịch Thiên Cải Mệnh - Trúc Cơ Xung Quan (`main_05_truc_co_xung_quan`)**: Yêu cầu Luyện Khí Tầng 7, cấp 9, xong Main 4. Dẫn dắt người chơi gặp Tiêu Dao Lão Nhân bên Suối Linh Tuyền đả thông kinh mạch, sau đó mang Trúc Cơ Đan vào Cổ Tu Động Phủ trảm ma trừ khử chấp niệm, chính thức ngưng tụ Đạo Cơ bước vào Trúc Cơ Sơ Kỳ.

---

## 2. CHI TIẾT CÁC THAY ĐỔI ĐÃ TRIỂN KHAI

### 2.1. Cấu hình Dữ liệu Nhiệm Vụ (`quests.json`)
- **Tập tin:** `backend/src/data/xianxia/quests.json` (đồng bộ 1:1 sang `backend/dist/data/xianxia/quests.json` và `frontend/data/xianxia/quests.json`).
- **Nội dung nhiệm vụ mới:**
  ```json
  {
    "id": "main_04_tham_nhap_van_mong",
    "title": "[Chính Tuyến 4] Thâm Nhập Vân Mộng - Đầm Sâu Đoạt Dược",
    "type": "MAIN_STORY",
    "category": "CHINH_TUYEN",
    "giver_npc_id": "npc_hac_y_lu_nhan",
    "turnin_npc_id": "npc_tran_duoc_su",
    "requirements": {
      "min_realm": "LUYEN_KHI_4",
      "min_level": 6,
      "prerequisite_quest_id": "main_03_tram_diet_lang_vuong"
    },
    "objectives": [
      {
        "id": "obj_main_04_talk_alchemist",
        "type": "TALK_NPC",
        "description": "Đến Dược Vương Cốc đàm đạo với Trần Dược Sư về bí pháp Trúc Cơ",
        "target_id": "npc_tran_duoc_su",
        "target_name": "Trần Thanh Mộc (Lão Dược Sư)",
        "required_count": 1
      },
      {
        "id": "obj_main_04_kill_swamp_monster",
        "type": "KILL_MONSTER",
        "description": "Tiêu diệt 1 Hắc Phong Điêu tại ranh giới đầm lầy",
        "target_id": "monster_hac_phong_dieu",
        "target_name": "Hắc Phong Điêu",
        "required_count": 1
      }
    ],
    "rewards": {
      "exp": 1200,
      "cultivation": 600,
      "silver": 250,
      "items": [{ "item_id": "item_huyen_am_thao", "item_name": "Huyền Âm Thảo", "quantity": 2 }],
      "title": "Vân Mộng Hành Giả"
    }
  },
  {
    "id": "main_05_truc_co_xung_quan",
    "title": "[Chính Tuyến 5] Nghịch Thiên Cải Mệnh - Trúc Cơ Xung Quan",
    "type": "MAIN_STORY",
    "category": "CHINH_TUYEN",
    "giver_npc_id": "npc_tran_duoc_su",
    "turnin_npc_id": "npc_tieu_dao_tu",
    "requirements": {
      "min_realm": "LUYEN_KHI_7",
      "min_level": 9,
      "prerequisite_quest_id": "main_04_tham_nhap_van_mong"
    },
    "objectives": [
      {
        "id": "obj_main_05_breakthrough_prep",
        "type": "TALK_NPC",
        "description": "Đến gặp Tiêu Dao Lão Nhân bên Suối Linh Tuyền đàm đạo phá cảnh",
        "target_id": "npc_tieu_dao_tu",
        "target_name": "Tiêu Dao Lão Nhân",
        "required_count": 1
      },
      {
        "id": "obj_main_05_boss_challenge",
        "type": "KILL_MONSTER",
        "description": "Vào Cổ Tu Tọa Hóa Động trảm sát U Minh Lang Vương tôi luyện sát khí",
        "target_id": "boss_u_minh_lang_vuong",
        "target_name": "U Minh Lang Vương",
        "required_count": 1
      }
    ],
    "rewards": {
      "exp": 2500,
      "cultivation": 1500,
      "silver": 500,
      "items": [
        { "item_id": "item_truc_co_dan", "item_name": "Trúc Cơ Đan", "quantity": 1 },
        { "item_id": "item_thanh_tam_boi", "item_name": "Thanh Tâm Ngọc Bội", "quantity": 1 }
      ],
      "title": "Trúc Cơ Chân Nhân"
    }
  }
  ```

---

## 3. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG & VERIFICATION
1. **TypeScript Build (`npm run build`):**
   - Lệnh: `tsc`
   - Kết quả: **Exit code 0 (Thành công 100%).**
2. **Kiểm thử Đơn vị Hệ Thống Nhiệm Vụ (`xianxiaQuest.test.ts`):**
   - Kết quả: **PASS 100% (9/9 mục kiểm thử):**
     - ✅ [1/9] Tải thành công chính xác 8 nhiệm vụ từ `quests.json`.
     - ✅ [2/9] Phân bổ chính xác 5 nhiệm vụ Chính Tuyến và 3 nhiệm vụ Thỉnh Cầu tinh tuyển.
     - ✅ [3/9] Phương thức `getQuestsByCategory` hoạt động hoàn hảo cho `ALL` (8), `MAIN_STORY` (5), `SIDE_QUEST` (3).
     - ✅ [4/9] Xác minh độ khó quái Chính Tuyến.
     - ✅ [5/9] Hệ thống khóa cấp độ và nhiệm vụ tiền đề: Main 1 AVAILABLE, Main 2, 3, 4, 5 LOCKED.
     - ✅ [6/9] Hoàn thành Chính Tuyến 1, nhận danh hiệu và mở khóa Chính Tuyến 2.
     - ✅ [7/9] Các nhiệm vụ phụ tinh tuyển (Trảm Yêu, Đàm Đạo, Khảo Nghiệm Dược Lý) hoạt động chính xác.
     - ✅ [8/9] Hoàn thành Chính Tuyến 2 & 3 hạ gục Boss Lang Vương.
     - ✅ [9/9] Hoàn thành Chính Tuyến 4 (Vân Mộng Đầm Lầy) và Chính Tuyến 5 (Trúc Cơ Xung Quan) -> Đột phá Trúc Cơ Chân Nhân thành công!
3. **Kiểm tra Hồi Quy Thế Giới (`xianxiaWorld.test.ts`):**
   - Kết quả: **PASS 100% (8/8 mục kiểm thử).**
4. **Kiểm tra Live Server (Port 3000):**
   - `GET /api/xianxia/quests/player?category=ALL`:
     - Trả về đúng 8 nhiệm vụ.
     - Main 1: AVAILABLE; Main 2, 3, 4, 5: LOCKED chuẩn theo cấp độ và điều kiện tiên quyết.
5. **Độc lập Tuyệt đối (Zero Kỳ Biến):**
   - Không chứa bất kỳ liên kết, chuỗi ký tự hay logic nào liên quan đến Kỳ Biến hay cờ tướng.

---

## 4. YÊU CẦU ĐÁNH GIÁ (TECH LEAD REVIEW)
Kính mời Claude Code đánh giá và thẩm định báo cáo Bước M2.2:
- Tính hợp lý của mạch cốt truyện và điều kiện gating từ Luyện Khí Tầng 4 đến Trúc Cơ Sơ Kỳ.
- Cho kết luận **PASS** hoặc **FAIL**.
- Nếu PASS, phê duyệt chuyển sang **Bước M2.3: Thiết kế và triển khai nhiệm vụ chính tuyến từ Trúc Cơ Sơ Kỳ đến Trúc Cơ Hậu Kỳ (Chương 6 & 7)**.
