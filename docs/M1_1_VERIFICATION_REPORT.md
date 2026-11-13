# BÁO CÁO HOÀN THÀNH BƯỚC M1.1 (LẦN 2): TỐI ƯU HÓA DỮ LIỆU NHIỆM VỤ (`quests.json`)

**Gửi tới:** Claude Code (Tech Lead & Checker)
**Người gửi:** Antigravity (Maker & Architect)
**Trạng thái:** Đã thực hiện chính xác theo chỉ đạo kiểm tra của Claude Code

---

## 1. TIẾP THU Ý KIẾN CLAUDE CODE VÀ ĐIỀU CHỈNH
- Đã loại bỏ hoàn toàn các nhiệm vụ phụ không cần thiết.
- Giữ lại đúng chuẩn **6 nhiệm vụ cốt lõi của Thanh Hà Thôn**:
  * **3 Chương Chính Tuyến (MAIN_STORY / CHINH_TUYEN):**
    1. `main_01_khoi_dau_tien_duyen`: Trảm Sài Lang (Phàm Nhân -> Luyện Khí 1)
    2. `main_02_bong_ma_u_minh`: Bóng Ma U Minh (Luyện Khí 1 -> Luyện Khí 2)
    3. `main_03_tram_diet_lang_vuong`: Tuyệt Đỉnh Hắc Phong (Luyện Khí 2 -> Luyện Khí 3)
  * **3 Tuyến Phụ Tinh Hoa Giàu Cốt Truyện & Đa Dạng Cơ Chế (SIDE_QUEST / THINH_CAU):**
    4. `side_01_tram_yeu_thanh_ha`: Trảm Sài Lang Cửa Thôn (`KILL_MONSTER`, 3 Thổ Lang, thưởng Bạc, Tu vi, Lang Bì)
    5. `side_02_dam_dao_quy_luat`: Đàm Đạo Cảnh Giới & Quy Luật Tiên Thiên (`TALK_NPC`, Tiêu Dao Lão Nhân, khai mở ngộ tính Tu vi)
    6. `side_03_khao_nghiem_duoc_ly`: Khảo Nghiệm Vấn Đạo Dược Lý & Đan Đạo (`ANSWER_QUIZ`, Lão Dược Sư, vấn đáp Trúc Cơ Đan)

---

## 2. NỘI DUNG TOÀN BỘ FILE `quests.json` HIỆN TẠI:

```json
{
  "quests": [
    {
      "id": "main_01_khoi_dau_tien_duyen",
      "title": "[Chính Tuyến 1] Khởi Đầu Tiên Duyên - Trảm Sài Lang",
      "type": "MAIN_STORY",
      "category": "CHINH_TUYEN",
      "giver_npc_id": "npc_ly_chinh",
      "giver_npc_name": "Lý Thừa Phong (Trưởng Thôn)",
      "turnin_npc_id": "npc_ly_chinh",
      "turnin_npc_name": "Lý Thừa Phong (Trưởng Thôn)",
      "summary": "Tiêu diệt 1 Thổ Lang bảo vệ cửa ngõ Thanh Hà Thôn, chứng minh bản lĩnh sơ nhập tu tiên.",
      "dialogue_intro": [
        "Đạo hữu mới bước vào con đường tu chân, khí tức phàm trần chưa dứt.",
        "Gần đây ngoài thôn có bầy Thổ Lang hung hãn rình rập người dân, hãy đi trảm một con để thử nghiệm kiếm phong!",
        "Chỉ khi hạ gục được dã thú đầu tiên, đạo hữu mới thực sự có tư cách bước vào thế giới tu tiên tàn khốc này."
      ],
      "dialogue_in_progress": [
        "Thổ Lang thường lảng vảng ngoài đồng cỏ ngoại ô. Hãy rút kiếm và giữ vững đạo tâm!"
      ],
      "dialogue_turnin": [
        "Khá lắm! Một đòn dứt khoát, sát khí ẩn hiện.",
        "Đây là đan dược bổ khí và chút lộ phí thôn làng góp lại, hãy nhận lấy để tẩm bổ kinh mạch."
      ],
      "requirements": {
        "min_realm": "PHAM_NHAN",
        "min_level": 1
      },
      "objectives": [
        {
          "id": "obj_main_01_kill_wolf",
          "type": "KILL_MONSTER",
          "description": "Tiêu diệt 1 Thổ Lang tại ngoại ô Thanh Hà Thôn",
          "target_id": "monster_tho_lang",
          "target_name": "Thổ Lang",
          "required_count": 1
        }
      ],
      "rewards": {
        "exp": 100,
        "cultivation": 30,
        "silver": 50,
        "items": [
          {
            "item_id": "item_duong_khi_dan",
            "item_name": "Dưỡng Khí Đan",
            "quantity": 1
          }
        ],
        "title": "Sơ Nhập Tiên Đồ"
      }
    },
    {
      "id": "main_02_bong_ma_u_minh",
      "title": "[Chính Tuyến 2] Bóng Ma U Minh - Yêu Khí Uy Hiếp",
      "type": "MAIN_STORY",
      "category": "CHINH_TUYEN",
      "giver_npc_id": "npc_ly_chinh",
      "giver_npc_name": "Lý Thừa Phong (Trưởng Thôn)",
      "turnin_npc_id": "npc_hac_y_lu_nhan",
      "turnin_npc_name": "Mạc Vô Nhai (Hắc Y Lữ Nhân)",
      "summary": "Tiến vào U Minh Trúc Lâm, tiêu diệt 1 U Minh Lang (HP 240, ATK 38, DEF 18). Yêu cầu tôi luyện thể phách, rèn đúc trang bị và đột phá Luyện Khí Tầng 1!",
      "dialogue_intro": [
        "Dị biến từ Rừng Trúc U Minh ngày một trầm trọng. Bầy U Minh Lang mắt đỏ như máu đã tiến sát hàng rào thôn.",
        "Lũ sài lang này da đồng xương sắt (DEF 18, ATK 38). Kẻ nào chỉ có kiếm cùi giáp rách xông vào chỉ tổ làm mồi ngon!",
        "Lời khuyên chân thành: Hãy làm các thỉnh cầu cày cuốc trong thôn, tôi luyện thể phách, rèn Thanh Phong Kiếm và Thiết Giáp Y, đạt ít nhất Luyện Khí Tầng 2 rồi hãy vào rừng sâu!"
      ],
      "dialogue_in_progress": [
        "Đừng liều lĩnh! U Minh Lang rất hung dữ, móng vuốt có độc chảy máu. Chuẩn bị đan dược kỹ lưỡng rồi hãy giao chiến!"
      ],
      "dialogue_turnin": [
        "Mạc Vô Nhai khẽ nhướng mày: Ngươi vậy mà trảm được một con U Minh Lang đầu đàn hung hãn.",
        "Kiếm pháp của ngươi quả thực tiến bộ vượt bậc sau thời gian khổ luyện trong thôn.",
        "Tuy nhiên, đây mới chỉ là khúc dạo đầu... Kẻ đứng sau bầy sói trên Hắc Phong Nhai mới thực sự là ác mộng."
      ],
      "requirements": {
        "min_realm": "LUYEN_KHI_1",
        "min_level": 2,
        "prerequisite_quest_id": "main_01_khoi_dau_tien_duyen"
      },
      "objectives": [
        {
          "id": "obj_main_02_kill_shadow_wolf",
          "type": "KILL_MONSTER",
          "description": "Tiêu diệt 1 U Minh Lang tại U Minh Trúc Lâm",
          "target_id": "monster_u_minh_lang",
          "target_name": "U Minh Lang",
          "required_count": 1
        }
      ],
      "rewards": {
        "exp": 250,
        "cultivation": 100,
        "silver": 120,
        "items": [
          {
            "item_id": "item_bach_luyen_tinh_thiet",
            "item_name": "Bạch Luyện Tinh Thiết",
            "quantity": 1
          }
        ]
      }
    },
    {
      "id": "main_03_tram_diet_lang_vuong",
      "title": "[Chính Tuyến 3] Tuyệt Đỉnh Hắc Phong - Trảm Diệt Lang Vương",
      "type": "MAIN_STORY",
      "category": "CHINH_TUYEN",
      "giver_npc_id": "npc_hac_y_lu_nhan",
      "giver_npc_name": "Mạc Vô Nhai (Hắc Y Lữ Nhân)",
      "turnin_npc_id": "npc_ly_chinh",
      "turnin_npc_name": "Lý Thừa Phong (Trưởng Thôn)",
      "summary": "Đột kích lên Hắc Phong Nhai tiêu diệt U Minh Lang Vương (HP 650, ATK 65), trừ khử mối đại họa cho toàn cõi Thanh Hà.",
      "dialogue_intro": [
        "Cuối cùng ngày này cũng tới. U Minh Lang Vương đã xuất hiện tại Hắc Phong Nhai.",
        "Tiếng hú của nó vang vọng cả một vùng, yêu khí che mờ nhật nguyệt. Con nghiệt súc này đã hấp thu linh khí cổ động, sức mạnh vô song!",
        "Nếu ngươi chưa đạt Luyện Khí Tầng 3 và chưa có trang bị xanh lam gia trì, tuyệt đối chớ dại dột nạp mạng!",
        "Hãy đem theo đan dược hồi phục tốt nhất, vận chuyển toàn bộ tu vi mà trảm sát nó!"
      ],
      "dialogue_in_progress": [
        "Hắc Phong Nhai sương mù dày đặc, tiếng sói tru rợn tóc gáy. Giữ chặt chuôi kiếm, thời cơ quyết định vận mệnh đã tới!"
      ],
      "dialogue_turnin": [
        "Toàn thôn hân hoan reo hò! Đầu sói khổng lồ đã rớt xuống đất, yêu khí tản mác.",
        "Lý Trưởng Thôn run rẩy trao tặng: Đạo hữu chính là vị cứu tinh của Thanh Hà Thôn!",
        "Đây là viên Trúc Cơ Đan quý giá gia truyền của thôn làng, xin kính dâng để trợ lực đạo hữu bước lên đại đạo trường sinh!"
      ],
      "requirements": {
        "min_realm": "LUYEN_KHI_2",
        "min_level": 4,
        "prerequisite_quest_id": "main_02_bong_ma_u_minh"
      },
      "objectives": [
        {
          "id": "obj_main_03_kill_boss",
          "type": "KILL_MONSTER",
          "description": "Tiêu diệt Boss U Minh Lang Vương tại Hắc Phong Nhai",
          "target_id": "boss_u_minh_lang_vuong",
          "target_name": "U Minh Lang Vương",
          "required_count": 1
        }
      ],
      "rewards": {
        "exp": 800,
        "cultivation": 350,
        "silver": 300,
        "items": [
          {
            "item_id": "item_truc_co_dan",
            "item_name": "Trúc Cơ Đan",
            "quantity": 1
          }
        ],
        "title": "Trảm Yêu Đại Tông Sư"
      }
    },
    {
      "id": "side_01_tram_yeu_thanh_ha",
      "title": "[Trảm Yêu] Họa Sài Lang Cửa Thôn",
      "type": "SIDE_QUEST",
      "category": "THINH_CAU",
      "giver_npc_id": "npc_ly_chinh",
      "giver_npc_name": "Lý Thừa Phong (Trưởng Thôn)",
      "turnin_npc_id": "npc_ly_chinh",
      "turnin_npc_name": "Lý Thừa Phong (Trưởng Thôn)",
      "summary": "Tiêu diệt 3 Thổ Lang quấy nhiễu ruộng thảo dược ngoài thôn để trừ mối nguy hại cho thôn làng và tôi luyện kiếm pháp.",
      "dialogue_intro": [
        "Bầy Thổ Lang lại đào bới bờ ruộng thảo dược của dân làng. Chúng quá hung hãn khiến đội tuần tra không xuể.",
        "Đạo hữu hãy ra tay tiễu trừ 3 con Thổ Lang, vừa trừ hại cho thôn, vừa tôi luyện thân pháp và đường kiếm."
      ],
      "dialogue_in_progress": [
        "Hãy tìm bầy Thổ Lang ngoài cổng thôn. Hãy cẩn thận khi chúng xông vào cắn xé bầy đàn."
      ],
      "dialogue_turnin": [
        "Tốt lắm! Nhờ có đạo hữu mà ruộng thảo dược tạm thời được bình yên. Đây là thù lao xứng đáng."
      ],
      "requirements": {
        "min_realm": "PHAM_NHAN",
        "min_level": 1
      },
      "objectives": [
        {
          "id": "obj_side_01_kill_wolves",
          "type": "KILL_MONSTER",
          "description": "Tiêu diệt 3 Thổ Lang tại ngoại ô",
          "target_id": "monster_tho_lang",
          "target_name": "Thổ Lang",
          "required_count": 3
        }
      ],
      "rewards": {
        "exp": 100,
        "cultivation": 45,
        "silver": 40,
        "items": [
          {
            "item_id": "item_lang_bi",
            "item_name": "Lang Bì",
            "quantity": 2
          }
        ]
      }
    },
    {
      "id": "side_02_dam_dao_quy_luat",
      "title": "[Đàm Đạo] Cảnh Giới & Quy Luật Tiên Thiên",
      "type": "SIDE_QUEST",
      "category": "THINH_CAU",
      "giver_npc_id": "npc_tieu_dao_tu",
      "giver_npc_name": "Tiêu Dao Lão Nhân",
      "turnin_npc_id": "npc_tieu_dao_tu",
      "turnin_npc_name": "Tiêu Dao Lão Nhân",
      "summary": "Đến gặp Tiêu Dao Lão Nhân bên Suối Linh Tuyền, nghe giảng giải tường tận về cảnh giới tu chân và đạo lý thiên địa tuần hoàn.",
      "dialogue_intro": [
        "Đạo hữu, tu tiên chớ vội vàng chỉ biết vung gươm chém giết. Ngồi xuống đây uống ngụm trà suối mát lành.",
        "Thiên địa bao la, tu vi khởi đầu từ Phàm Nhân rồi đến Luyện Khí 9 Tầng, Trúc Cơ, Kim Đan, Nguyên Anh...",
        "Linh khí đất trời nuôi dưỡng vạn vật, nhưng lòng tham cũng sinh ma chướng. Giữ vững Đạo Tâm mới là chìa khóa trường sinh!"
      ],
      "dialogue_in_progress": [
        "Tĩnh tâm lắng nghe tiếng nước chảy, cảm nhận từng sợi linh khí lưu chuyển trong kinh mạch."
      ],
      "dialogue_turnin": [
        "Ha ha ha! Ánh mắt đạo hữu đã sáng lên vài phần linh khí. Ngộ tính quả nhiên phi phàm!",
        "Lão phu tặng ngươi phần tu vi lĩnh ngộ này, mong ngươi khắc ghi chữ 'Đạo' trong tim."
      ],
      "requirements": {
        "min_realm": "PHAM_NHAN",
        "min_level": 1
      },
      "objectives": [
        {
          "id": "obj_side_02_talk_hermit",
          "type": "TALK_NPC",
          "description": "Đến Suối Linh Tuyền đàm đạo với Tiêu Dao Lão Nhân",
          "target_id": "npc_tieu_dao_tu",
          "target_name": "Tiêu Dao Lão Nhân",
          "required_count": 1
        }
      ],
      "rewards": {
        "exp": 80,
        "cultivation": 80,
        "silver": 25
      }
    },
    {
      "id": "side_03_khao_nghiem_duoc_ly",
      "title": "[Khảo Nghiệm] Vấn Đạo Dược Lý & Đan Đạo",
      "type": "SIDE_QUEST",
      "category": "THINH_CAU",
      "giver_npc_id": "npc_tran_duoc_su",
      "giver_npc_name": "Trần Thanh Mộc (Lão Dược Sư)",
      "turnin_npc_id": "npc_tran_duoc_su",
      "turnin_npc_name": "Trần Thanh Mộc (Lão Dược Sư)",
      "summary": "Trả lời câu hỏi trắc nghiệm của Lão Dược Sư về kiến thức đan dược và công thức Trúc Cơ Thần Đan.",
      "dialogue_intro": [
        "Tu tiên giả nếu không am hiểu dược lý, lúc trúng độc hay bế tắc kinh mạch thì chỉ có đường tan biến.",
        "Lão phu muốn khảo nghiệm đạo hữu một câu hỏi căn bản. Nếu trả lời đúng, lão phu sẽ ban thưởng xứng đáng!"
      ],
      "dialogue_in_progress": [
        "Hãy suy nghĩ thật kỹ trước khi đưa ra câu trả lời."
      ],
      "dialogue_turnin": [
        "Chính xác! Trúc Cơ Đan chính là thần đan ngưng tụ thiên địa tạo hóa, giúp phàm thai lột xác bước lên Trúc Cơ!",
        "Ngươi nắm vững kiến thức rất tốt, tương lai tiền đồ rộng mở!"
      ],
      "requirements": {
        "min_realm": "PHAM_NHAN",
        "min_level": 1
      },
      "objectives": [
        {
          "id": "obj_side_03_quiz",
          "type": "ANSWER_QUIZ",
          "description": "Trả lời câu hỏi khảo nghiệm dược lý của Trần Dược Sư",
          "required_count": 1,
          "quiz_question": "Theo cổ tịch đan đạo, loại thần dược nào là vật phẩm then chốt giúp tu sĩ đột phá từ Luyện Khí Tầng 9 bước vào cảnh giới Trúc Cơ?",
          "quiz_options": [
            { "id": "opt_a", "text": "A. Hồi Xuân Đan" },
            { "id": "opt_b", "text": "B. Trúc Cơ Đan (Chính xác)" },
            { "id": "opt_c", "text": "C. Kim Ngân Hoa" },
            { "id": "opt_d", "text": "D. Dưỡng Khí Đan" }
          ],
          "quiz_correct_index": 1
        }
      ],
      "rewards": {
        "exp": 120,
        "cultivation": 80,
        "silver": 50,
        "items": [
          {
            "item_id": "item_duong_khi_dan",
            "item_name": "Dưỡng Khí Đan",
            "quantity": 2
          }
        ]
      }
    }
  ]
}
```

---

## 3. ĐỀ NGHỊ CLAUDE CODE XÁC NHẬN
Claude Code vui lòng thẩm định và phê duyệt kết quả:
- **PASS** (Đạt) hay **FAIL**?
- Xác nhận chuyển sang **Bước M1.2: Tối ưu hóa logic backend (`xianxiaQuestService.ts`)**.
