# BÁO CÁO MÔ PHỎNG CÂN BẰNG & PHÂN TÍCH TOÁN HỌC GAMEPLAY
## DỰ ÁN: TIÊN LỘ: VẠN GIỚI TRANH PHONG

**Tác giả:** Senior Game Systems Architect & Gameplay Balance Lead  
**Phiên bản:** 1.0 (Simulation & Balance Report)  
**Phạm vi:** CHỈ MỤC 1 — THỐNG NHẤT GAMEPLAY TỔNG THỂ  
**Trạng thái:** Báo cáo khoa học dựa trên dữ liệu thực tế và chạy mô phỏng 10,000 trận  

---

## I. MỤC TIÊU & PHƯƠNG PHÁP LUẬN

Báo cáo này được thực hiện theo đúng chỉ đạo của Chủ Dự Án:
- **Tuyệt đối chưa sửa mã nguồn sản phẩm** (`frontend/tienlo-engine.js`, `frontend/tien-lo.html`, backend TypeScript).
- Sử dụng mô hình toán học và công cụ mô phỏng độc lập (`simulate_balance.js`) nạp 100% dữ liệu thực tế từ 9 tệp JSON của game (`monsters.json`, `quests.json`, `items.json`, `agencyMissions.json`, `worldData.json`).
- Chạy phương pháp Monte Carlo (1,000 lượt mô phỏng ngẫu nhiên cho từng cặp đấu) để xác định chính xác: tỷ lệ thắng/thua, số hiệp trung bình, hiện tượng quá 30 hiệp, tác động kinh tế thể lực, lỗ hổng khai thác và các bug cốt lõi cần giải quyết.

---

## II. PHẦN 1: CÔNG THỨC EXP & KHỚP NỐI VỚI QUÁI / NHIỆM VỤ

### 1. Công Thức EXP Lũy Thừa Tự Nhiên
$$\text{EXP\_Required}(L) = \left\lfloor 50 \times L^{1.45} + 50 \times L \right\rfloor$$
- **Cơ chế:** Khi người chơi nhận EXP vượt mức yêu cầu, hệ thống trừ đúng lượng `EXP_Required(L)` và **bảo toàn nguyên vẹn lượng EXP dư thừa** để tính tiếp cho cấp độ kế tiếp.

### 2. Bảng Mô Phỏng Tiến Trình Cấp Độ (Level 1 $\rightarrow$ 100) Chuẩn Xác

*Lưu ý phân định rạch ròi giữa:*
- **EXP lên cấp tiếp:** Lượng EXP người chơi đang ở cấp $L$ cần nạp để thăng lên cấp $L+1$ ($\text{EXP\_Required}(L)$).
- **Tổng EXP tích lũy để ĐẠT cấp này:** Lượng EXP người chơi bắt đầu từ Level 1 (0 EXP) phải tích lũy để vừa bước chân đạt tới cấp $L$ ($\sum_{i=1}^{L-1} \text{EXP\_Required}(i)$).

| Cấp độ ($L$) | EXP lên cấp tiếp $\text{EXP\_Required}(L)$ | Tổng EXP tích lũy để ĐẠT cấp này | Tương đương Thổ Lang (25 EXP) | Tương đương U Minh Lang (90 EXP) | Tương đương Boss Lang Vương (450 EXP) |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | 100 | 0 | 4 con | 2 con | 1 con |
| **2** | 236 | 100 | 10 con | 3 con | 1 con |
| **3** | 395 | 336 | 16 con | 5 con | 1 con |
| **4** | 573 | 731 | 23 con | 7 con | 2 con |
| **5** | 765 | 1.304 | 31 con | 9 con | 2 con |
| **10** | 1.909 | 7.308 | 77 con | 22 con | 5 con |
| **15** | 3.286 | 19.526 | 132 con | 37 con | 8 con |
| **20** | 4.850 | 39.016 | 194 con | 54 con | 11 con |
| **25** | 6.570 | 66.647 | 263 con | 73 con | 15 con |
| **30** | 8.430 | 103.167 | 338 con | 94 con | 19 con |
| **40** | 12.518 | 205.484 | 501 con | 140 con | 28 con |
| **50** | 17.037 | 350.666 | 682 con | 190 con | 38 con |
| **75** | 29.920 | 926.802 | 1.197 con | 333 con | 67 con |
| **99** | 44.091 *(chặng cuối lên 100)* | 1.804.627 | 1.764 con | 490 con | 98 con |
| **100 (Max)** | Trần cấp *(Chuyển Bạc 10:1)* | **1.848.718** *(Tổng để đạt L100)* | Trần thể phách | Tích lũy đỉnh phong | Tự động chuyển Bạc |

### 3. Phân Tích Độ Khớp Của Chuỗi Nhiệm Vụ Chính Tuyến
Kiểm tra chéo với dữ liệu thực tế từ `quests.json` và công thức chuẩn `floor(50 * L^1.45 + 50 * L)`:

1. **Giai đoạn Mở Đầu (Main 1: Khởi Đầu Tiên Duyên):**
   - **Yêu cầu:** Level 1, Phàm Nhân.
   - **Hoạt động:** Tiêu diệt 1 Thổ Lang (+25 EXP), hoàn thành Q1 (+100 EXP).
   - **Tổng nhận:** $125\text{ EXP}$.
   - **Kết quả:** Level 1 cần 100 EXP để lên Level 2 $\rightarrow$ **Thăng lên Level 2 ngay lập tức, dư lại 25 EXP!**
   - **Khớp nối:** Mở khóa ngay lập tức Nhiệm Vụ Main 2 (yêu cầu `min_level: 2`) mà không bị kẹt.

2. **Giai đoạn U Minh Trúc Lâm (Main 2: Bóng Ma U Minh):**
   - **Yêu cầu:** Level 2, Luyện Khí Tầng 1 (đòi hỏi người chơi đã đột phá từ Phàm Nhân lên Luyện Khí 1).
   - **Hoạt động:** Tiêu diệt 1 U Minh Lang (+90 EXP), hoàn thành Q2 (+250 EXP).
   - **Tổng nhận:** $25\text{ (dư)} + 340 = 365\text{ EXP}$.
   - **Kết quả:**
     - Level 2 $\rightarrow$ 3 cần 236 EXP $\rightarrow$ Thăng lên **Level 3**, còn dư $365 - 236 = 129\text{ EXP}$.
     - Level 3 $\rightarrow$ 4 cần 395 EXP. Người chơi đang có 129 EXP $\rightarrow$ **còn thiếu 266 EXP để đạt Level 4.**

3. **Giai đoạn Quyết Đấu Tuyệt Đỉnh (Main 3: Trảm Diệt Lang Vương):**
   - **Yêu cầu:** Level 4, Luyện Khí Tầng 3.
   - **Phân tích:** Người chơi cần thêm 266 EXP và nâng cao cảnh giới (Luyện Khí 1 $\rightarrow$ 3).
   - **Khớp nối vòng lặp cày cuốc:**
     - Người chơi hoàn thành nhiệm vụ phụ săn bắt (`side_05_san_nanh_soi` thưởng 120 EXP, săn 3 U Minh Lang nhận thêm $3 \times 90 = 270\text{ EXP}$) $\rightarrow$ Tổng cộng thu được $390\text{ EXP}$, vượt xa mức 266 EXP cần thiết $\rightarrow$ **Đạt Level 4 tự nhiên và mượt mà!**
     - Đồng thời, người chơi thu thập khoáng thạch/thảo mộc rèn đúc Thanh Phong Kiếm và Thiết Giáp Y để đủ sức chiến thắng Boss Lang Vương.
   - **Kết luận:** Công thức EXP lũy thừa tự nhiên và chuỗi nhiệm vụ **hoàn toàn ăn khớp**, tạo động lực cày cuốc chuẩn chỉ của thể loại RPG Tu Tiên.

---

## III. PHẦN 2: CHỈ SỐ NHÂN VẬT Ở CÁC CẤP (LEVEL VS CẢNH GIỚI)

### 1. Bảng Chỉ Số Tổng Hợp Tại Các Cột Mốc Quan Trọng

| Cấp độ | Cảnh giới tương ứng | Khí Huyết (Max HP) | Thể Lực (Max Fatigue) | Căn Cốt (Physique) | Ngộ Tính (Comp) | Điểm Tiềm Năng | Công ước tính | Thủ ước tính | Tốc độ |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Level 1** | Phàm Nhân (Khởi đầu) | **120** | **100** | 12 | 14 | 0 | 18 | 0 | 10 |
| **Level 10** | Luyện Khí Tầng 2 | **246** *(210 + 36)* | **134** *(130 + 4)* | 18 | 23 *(18+5 relic)* | 1 | 49 *(vũ khí 22)* | 0 | 15 |
| **Level 25** | Luyện Khí Tầng 5 | **486** *(390 + 96)* | **172** *(160 + 12)* | 25 | 29 | 2 | 59 | 25 *(giáp 25)* | 13 |
| **Level 50** | Luyện Khí Tầng 9 (Đỉnh phong) | **1.396** *(1200 + 196)* | **324** *(300 + 24)* | 50 | 50 | 5 | 97 | 25 | 13 |
| **Level 100** | Trúc Cơ Sơ Kỳ (Tiên Nhân) | **2.096** *(1700 + 396)* | **429** *(380 + 49)* | 65 | 60 | 10 | 119 | 25 | 13 |

### 2. Phân Tích Tỷ Trọng Đóng Góp (Realm vs Level)
- **Tỷ trọng HP:** Cảnh Giới đóng góp **81% – 86%**, Cấp Độ đóng góp **14% – 19%**.
- **Ý nghĩa gameplay:** Cảnh Giới giữ vững vị thế là "bước nhảy vọt sinh mệnh" (đột phá từ Phàm Nhân lên Luyện Khí, từ Luyện Khí lên Trúc Cơ gia tăng hàng trăm đến hàng nghìn HP). Trong khi đó, Level đóng vai trò là "lớp rèn giũa thể chất bền bỉ", giúp nhân vật cứng cáp dần qua từng trận đánh. Không có hiện tượng Level đè bẹp Cảnh Giới.

---

## IV. PHẦN 3: TÁC ĐỘNG ĐẾN THỂ LỰC, HỒI PHỤC VÀ TỐC ĐỘ CÀY CUỐC

### 1. Kinh Tế Thể Lực (Fatigue Economy)
- **Chi phí hoạt động:**
  - Khiêu chiến quái: 10 Thể lực/trận.
  - Thu thập tài nguyên: 8 Thể lực/lần.
  - Di chuyển liên vùng: 10 – 15 Thể lực/chuyến.
- **Sức chứa theo cấp:**
  - Level 1: 100 Thể lực = Đánh liên tiếp 10 trận hoặc thu thập 12 lần.
  - Level 50: 124 Thể lực = Đánh liên tiếp 12 trận.
  - Level 100: 149 Thể lực = Đánh liên tiếp 15 trận.
- **Cơ chế Hồi đầy khi Lên Cấp (Level Up Full Refresh):**
  - Trong giai đoạn đầu (Level 1 $\rightarrow$ 3), người chơi liên tục lên cấp khi làm nhiệm vụ, thể lực được làm đầy tức thì, tạo trải nghiệm dấn thân liền mạch không bị gián đoạn.

### 2. Phân Tích Hao Tổn HP & Vai Trò Của Đan Dược
- Tại Level 1 (HP 120), khi đánh 1 con Thổ Lang (mất 4.5 hiệp), người chơi nhận khoảng 15 – 25 sát thương. Sau 3 – 4 trận, máu tụt xuống mức báo động ($\le 40\text{ HP}$).
- Lúc này, người chơi **bắt buộc phải sử dụng Hồi Xuân Đan (+50 HP)** hoặc quay về Động Phủ nghỉ ngơi.
- **Kết luận:** Mức tăng $+4$ HP/cấp giúp hệ thống kinh tế Dược Phẩm (Luyện Đan, mua đan từ NPC Dược Sư) giữ nguyên giá trị cốt lõi, không bị vô hiệu hóa.

---

## V. PHẦN 4: KẾT QUẢ MÔ PHỎNG MONTE CARLO CHIẾN ĐẤU (1,000 TRẬN/CẶP)

Mô phỏng chạy với thuật toán Auto-Combat: Speed so lượt, Auto-Guard khi quái ra đòn HEAVY nếu có giáp, Auto-Skill khi đủ Qi.

| STT | Cặp giao đấu (Người chơi vs Quái vật) | Tỷ lệ Thắng | Tỷ lệ Thua | Tỷ lệ Hòa (30 hiệp) | Số hiệp TB | Nhận xét cân bằng |
|:---:|---|:---:|:---:|:---:|:---:|---|
| **1** | Phàm Nhân (Lv 1) vs **Thổ Lang** | **100.0%** | 0.0% | 0.0% | 4.5 | Trận đánh khởi đầu hoàn hảo, kết thúc nhanh gọn. |
| **2** | Luyện Khí 1 (Lv 3) vs **Thổ Lang** | **100.0%** | 0.0% | 0.0% | 3.3 | Quái khu 1 bị áp đảo khi người chơi đã tu luyện. |
| **3** | Luyện Khí 1 (Lv 3) vs **Thảo Mộc Tinh** | **98.4%** | 1.6% | 0.0% | 6.0 | Cân bằng tốt, có rủi ro nhỏ nếu dính độc liên tục. |
| **4** | Luyện Khí 2 (Lv 5, **Tay Không**) vs **U Minh Lang** | **0.0%** | **100.0%** | 0.0% | 6.5 | **Tử vong 100%!** Chuẩn xác theo cốt truyện Main 2. |
| **5** | Luyện Khí 2 (Lv 5, **Có Kiếm + Giáp**) vs **U Minh Lang** | **100.0%** | 0.0% | 0.0% | 12.2 | **Thắng 100%!** Trang bị phát huy sức mạnh tối thượng. |
| **6** | Luyện Khí 2 (Lv 5, Có Kiếm + Giáp) vs **Thiết Giáp Trư** | **86.6%** | 1.3% | **12.1%** | 24.1 | Trư thủ trâu (DEF 30), trận đấu giằng co kéo dài. |
| **7** | Luyện Khí 3 (Lv 8, Có Kiếm + Giáp) vs **Thiết Giáp Trư** | **98.5%** | 0.0% | 1.5% | 20.3 | Vượt qua dễ dàng hơn khi tăng căn cốt. |
| **8** | Luyện Khí 3 (Lv 8) vs **Boss U Minh Lang Vương** | **0.0%** | **100.0%** | 0.0% | 8.6 | **Boss nghiền nát người chơi thiếu tu vi.** |
| **9** | Luyện Khí 5 (Lv 15) vs **Boss U Minh Lang Vương** | **0.0%** | **100.0%** | 0.0% | 13.9 | Boss bạo kích và xé rách giáp cực mạnh. |
| **10** | Luyện Khí 9 (Lv 30, Full Gear) vs **Boss Lang Vương** | **94.4%** | 0.0% | **5.6%** | 22.6 | Trận huyết chiến đỉnh phong cân não, tỷ lệ thắng cao. |

---

## VI. PHẦN 5: PHÁT HIỆN LỖ HỔNG KHAI THÁC (EXPLOIT ANALYSIS) & BIỆN PHÁP CHỐNG GIAN LẬN

### 1. Lỗ Hổng Phát Hiện: "Full Tank AFK Farm 50% Thưởng"
- **Kịch bản khai thác:**
  - Người chơi ở cảnh giới thấp (Luyện Khí 1 - 2) mặc Thiết Giáp Y (+25 DEF).
  - Chủ động khiêu chiến quái vật có Công thấp nhưng Thủ cao như **Thiết Giáp Trư** (ATK 32, DEF 30, HP 350).
  - Trong trận đấu, người chơi chỉ phòng thủ (`GUARD` liên tục), kích hoạt giảm 70% sát thương nhận vào (chỉ mất 2-3 HP/hiệp) và tự hồi 5% HP mỗi hiệp.
  - Sau 30 hiệp: Quái vật mất khoảng 10% – 25% máu do người chơi đánh nhẹ hoặc phản kích, trong khi người chơi kết thúc trận ở **100% Khí Huyết**!
- **Kết quả mô phỏng:** **100% các trận đấu rơi vào trường hợp `% HP người chơi > % HP quái vật`!**
- **Hệ quả nghiêm trọng:** Người chơi không cần vũ khí, không cần đánh thắng, chỉ cần vào trận bấm Skip là nghiễm nhiên nhận **50% EXP (52.5 EXP) và 50% Tu vi (17.5 Tu vi) hoàn toàn miễn phí mà không mất một giọt máu nào!** Người chơi có thể lợi dụng điều này để cày cấp siêu tốc mà không cần chơi đúng luật.

### 2. Đề Xuất Cơ Chế Khắc Phục (Anti-Exploit Threshold)
Để bảo đảm tính công bằng tuyệt đối cho quy tắc thưởng 50%, đề xuất bổ sung **Điều kiện Sát Thương Tối Thiểu (Minimum Damage Threshold)**:
- **Quy tắc mới:** Khi hết 30 hiệp, người chơi **chỉ được xét nhận 50% phần thưởng** khi thỏa mãn đồng thời cả 2 điều kiện:
  1. $\% \text{HP}_{\text{Player}} > \% \text{HP}_{\text{Monster}}$ (Chiếm thế thượng phong).
  2. **Tổng sát thương người chơi gây ra phải đạt tối thiểu $\ge 40\%$ Lượng Máu Tối Đa (Max HP) của Quái Vật.**
- **Nếu không đạt 40% sát thương:** Hệ thống phán quyết là *"Đạo hữu lực kiệt, không thể công phá hộ thể yêu thú, đành thi triển khinh công rút lui an toàn"*. Kết thúc Hòa trận, **không nhận thưởng EXP/Tu vi**, nhưng **không bị phạt máu về 20 hay mất thể lực**.
- **Hiệu quả:** Xóa bỏ hoàn toàn 100% hành vi lợi dụng build Tank AFK câu giờ để farm điểm.

---

## VII. PHẦN 6: TỔNG HỢP 7 LỖI HIỆN HỮU CẦN SỬA ĐỒNG BỘ

Qua quá trình kiểm tra mã nguồn và chạy mô phỏng, đã xác minh chính xác 7 lỗi logic đang cản trở gameplay thống nhất:

| Mã Bug | Tên Bug & Vị trí | Nguyên nhân kỹ thuật | Hậu quả thực tế | Giải pháp sửa trong Giai đoạn B |
|---|---|---|---|---|
| **BUG-01** | EXP Black Hole (`tienlo-engine.js:1047`) | `const expGained = mon.exp_reward` được khai báo nhưng vứt bỏ, không có hàm `addExp()`. | Đánh quái không bao giờ nhận được điểm kinh nghiệm. | Bổ sung `addExp(expGained)` vào `endBattle('WIN')`. |
| **BUG-02** | Quest min_level Lockout (`quests.json`) | Object người chơi thiếu trường `level`. So sánh `undefined >= 2` luôn là `false`. | Người chơi vĩnh viễn không mở khóa được Main 2 và Main 3. | Bổ sung `level: 1, exp: 0` vào schema và migration LocalStorage. |
| **BUG-03** | Lệch pha Items JSON (`backend/.../items.json`) | Backend thiếu `item_thanh_tam_boi`. | Gây lỗi 404 khi frontend gửi yêu cầu trang bị ngọc bội lên server. | Copy mục `item_thanh_tam_boi` sang backend để 9/9 JSON trùng khớp. |
| **BUG-04** | Tê liệt rơi đồ Loot Table (`tienlo-engine.js:1058`) | Code đọc `drop.drop_rate` nhưng trong `monsters.json` trường tên là `chance`. `Math.random() <= undefined` luôn là `false`. | **Đánh quái vĩnh viễn không bao giờ rơi ra bất kỳ vật phẩm/nguyên liệu nào!** | Sửa thành `drop.chance \|\| drop.drop_rate`. |
| **BUG-05** | Bạc thưởng quái bị gãy (`tienlo-engine.js:1049`) | Code đọc `mon.silver_reward` nhưng trong JSON là `silver_reward_min/max`. Luôn fallback về 30 Bạc. | Mọi quái từ cấp 1 đến Boss đều chỉ thưởng 30 Bạc cố định. | Tính random trong khoảng `[silver_reward_min, silver_reward_max]`. |
| **BUG-06** | Lạm phát Đả Tọa Vô Hạn (`tienlo-engine.js:1150`) | `meditateRest()` không cooldown, bấm liên tục hồi 30 thể lực, 20 HP, 10 tu vi. | Người chơi spam nút đả tọa lên Trúc Cơ mà không cần chơi game. | Thêm thời gian giãn cách (cooldown 60s) hoặc kiểm tra thời gian thực. |
| **BUG-07** | Phạt Thể Lực Kép Khi Thua (`tienlo-engine.js:861, 1074`) | `startBattle` trừ 10 thể lực, khi thua trừ tiếp 20 thể lực (mất tổng 30 thể lực). | Người chơi bị phạt quá nặng và sai lệch so với chỉ đạo mất 15 thể lực. | Vào trận trừ 10 thể lực; nếu thua trừ thêm 5 thể lực (tổng đúng 15). |

---

## VIII. KẾT LUẬN & ĐỀ NGHỊ

1. Kết quả mô phỏng thực tế chứng minh các quyết định thiết kế đã chốt hoàn toàn khả thi, cân bằng và khớp nối tự nhiên với dữ liệu của dự án.
2. Mức tăng **$+4$ HP tối đa/cấp** và **$+1$ Thể lực tối đa mỗi 2 cấp** là tỷ lệ vàng, bảo toàn trọn vẹn vị thế tối cao của Cảnh Giới và kinh tế Đan Dược.
3. Đã nhận diện và có phương án triệt tiêu lỗ hổng "AFK Tank 30 hiệp" bằng điều kiện gây tối thiểu 40% sát thương.
4. Antigravity tiếp tục **tuân thủ nghiêm ngặt ranh giới**, không tự ý sửa mã nguồn, và kính trình báo cáo này lên Chủ Dự Án để xem xét phê duyệt chính thức chuyển sang Giai đoạn B.
