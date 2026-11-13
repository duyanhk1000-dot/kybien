# TÀI LIỆU THIẾT KẾ & ĐẶC TẢ HỆ THỐNG GAME: WUXIA LOGS REVERSE-ENGINEERING
## BLUEPRINT CHO PHÂN HỆ "GIANG HỒ KỲ HIỆP" - DỰ ÁN KỲ BIẾN (KYBIEN.BLOGSPOT.COM)

> **Mục tiêu**: Bóc tách 100% cơ chế trò chơi (Gameplay Mechanics), hệ thống dữ liệu (Data Schemas), chiến đấu (Turn-based Combat), thám hiểm (Exploration), kỹ nghệ sinh hoạt (Life Skills) và cấu trúc phân hệ để làm nền tảng phát triển một game nhập vai kiếm hiệp text-based / hybrid tích hợp hoàn hảo vào hệ sinh thái Kỳ Biến.

---

### 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

#### 1.1. Mô hình Client - Server
* **Frontend**: Single Page Application (SPA), phong cách giao diện tối giản (Minimalist dark/sepia Wuxia theme).
  * Render các khối thông tin trạng thái hiệp khách (Health, Fatigue, Focus, Silver, Karma, Location).
  * Log hành trình thời gian thực (Interactive Story Logs).
  * Modal tương tác: Hành trang (Inventory), Bí kíp (Techniques), Tiêu cục/Sạp chợ (Places/Vending).
* **Backend API & Data Flow**:
  * `/account`: Xác thực JWT, quản lý phiên đăng nhập (`remember_token`).
  * `/characters`: Khởi tạo nhân vật, phân bổ điểm tiềm năng, danh hiệu (`unlocked_titles`).
  * `/characters/{id}/exploration`: Cỗ máy sự kiện phân nhánh ngẫu nhiên theo vùng (Zone-based Event Machine).
  * `/characters/{id}/battles`: Đấu trường theo lượt (Turn-based Combat Engine).
  * `/characters/{id}/train`: Hệ thống treo máy tu luyện thân thể / nội lực ngầm (Idle Training).
  * `/characters/{id}/places`: Tương tác địa điểm dịch vụ (Tiêu cục, Nhà kho, Chợ trời, Luyện đan/Rèn đúc).

---

### 2. HỆ THỐNG THUỘC TÍNH NHÂN VẬT (CHARACTER ATTRIBUTES & STATS)

#### 2.1. Ngũ Đại Căn Bản (Primary Attributes)
Mỗi điểm tiềm năng (Unspent Points) nhận được khi thăng cấp có thể cộng vào 5 chỉ số cốt lõi:

| Chỉ số | Tên tiếng Anh | Tác dụng trong Gameplay & Chiến đấu |
| :--- | :--- | :--- |
| **Sức mạnh** | `Strength` | Tăng sát thương ngoại công cơ bản, tăng giới hạn mang vác hành trang (`inventory_slots_breakdown.strengthBonus`). |
| **Thân pháp** | `Agility` | Tăng tốc độ xuất chiêu (`Initiative`), tăng tỷ lệ né đòn (`Dodge`) và khả năng đào tẩu khi gặp nguy cấp. |
| **Thể chất** | `Endurance` | Tăng Sinh lực tối đa (`Max Health`), tăng Thể lực tối đa (`Max Fatigue`), tăng sức chịu đòn và giới hạn mang vác. |
| **Nội lực** | `Internal Force` | Tăng uy lực chiêu thức võ công, tiêu hao thi triển tuyệt chiêu, tăng giới hạn Tinh thần (`Focus`). |
| **Ý chí** | `Willpower` | Kháng hiệu ứng khống chế (Choáng, Điểm huyệt, Câm lặng), giảm suy giảm sát thương, hồi phục tinh thần. |

#### 2.2. Các Chỉ Số Sinh Tồn & Hành Trình (Secondary & Survival Stats)
* **Khí huyết (Health - HP)**: 
  * Cạn về 0 trong thám hiểm/chiến đấu sẽ dẫn đến trọng thương, rơi rớt ngân lượng hoặc bị đẩy về làng hồi sức.
  * Hồi phục qua: Thảo dược (Greenleaf Herb), đan dược, ngủ trọ, nướng thức ăn.
* **Mệt mỏi / Thể lực (Fatigue)**:
  * Mỗi hành động Thám hiểm (Roam/Wander), Rèn luyện (Train), Di chuyển (Travel) đều tiêu tốn điểm Fatigue (ví dụ: Roam tốn 3-5 Fatigue).
  * Khi Fatigue chạm ngưỡng tối đa (ví dụ 210/210), nhân vật bị kiệt sức, không thể thám hiểm tiếp mà phải nghỉ ngơi (`rest/check`) hoặc ăn uống.
* **Tinh thần (Focus / Chiêu thức)**:
  * Điểm tài nguyên đặc biệt dùng để kích hoạt các tuyệt chiêu võ học cao cấp hoặc giải các câu đố kỳ ngộ.
* **Nghiệp lực (Karma)**:
  * Thang đo Thiện/Ác trong giang hồ (-100 đến +100).
  * Quyết định thái độ của NPC, mở khóa các môn phái Chính đạo (Thiếu Lâm, Võ Đang) hay Tà đạo (Minh Giáo, Huyết Đao Môn), và loại sự kiện ngẫu nhiên gặp phải.
* **Cảm tri (Perception)** & **May mắn (Luck)**:
  * Tăng tỷ lệ phát hiện cơ quan, rương báu bí mật, dược thảo hiếm và né tránh mai phục.

---

### 3. CƠ CHẾ THÁM HIỂM GIANG HỒ (EXPLORATION & EVENT ENGINE)

#### 3.1. Phân cấp Bản đồ (World Hierarchy)
* **Vùng (Zones)**:
  * *starting_village* (Làng Minh - Ming Village): Khu vực tân thủ thanh bình, nhiều thương nhân và tiêu cục.
  * *starting_forest* (Rừng U Tịch - Serene Forest): Rừng rậm ven làng, nơi thu thập thảo dược, săn bắt và đối mặt thú dữ/sơn tặc.
  * Các phân khu giang hồ cấp cao: Trung Nguyên Thành, Hắc Phong Lĩnh, Vạn Hoa Cốc...
* **Địa điểm đặc biệt trong Vùng (Places)**:
  * **Tiêu cục (Escort Agency - Four Winds Agency)**: Nơi nhận nhiệm vụ áp tiêu, nâng cấp danh vọng bang phái, đổi vật tư.
  * **Chợ trời (Peddler's Market)**: Sạp buôn bán, trao đổi vật phẩm nhặt được giữa người chơi và NPC.
  * **Kho hàng chung (Storehouse)**: Két an toàn lưu trữ đồ đạc, có thể rút đồ tại bất kỳ chi nhánh kho nào trong giang hồ.

#### 3.2. Cỗ máy Sự kiện Ngẫu nhiên (Choice-Driven Event Loop)
Mỗi lần người chơi nhấn **Roam** (Đi dạo) hoặc **Wander** (Phiêu bạt):
```
[Gửi request /characters/{id}/exploration]
         │
         ▼
[Server tính toán Random Event theo Zone & Karma]
         │
         ├──> A. Sự kiện Văn bản (Narrative/Dialogue) ──> Đưa ra 2-4 Lựa chọn (Choices)
         │       Ví dụ: Gặp nhạc sư mù, gặp thư sinh bị cướp, phát hiện hang động hoang.
         │       Mỗi lựa chọn gắn liền: Chi phí (Cost Bạc/Máu/Khí), Kiểm tra chỉ số (Stat Check), Phần thưởng (Karma/EXP/Item).
         │
         ├──> B. Chạm trán Quái / Kẻ địch ──> Chuyển hướng sang /battle
         │
         └──> C. Kỳ ngộ Vật phẩm (Loot/Gathering) ──> Nhặt thảo dược, khoáng thạch, bí kíp tàn quyển.
```

---

### 4. CƠ CHẾ CHIẾN ĐẤU THEO LƯỢT (TACTICAL TURN-BASED COMBAT)

#### 4.1. Quy tắc Vòng đấu (Rounds & Turns)
1. **Khởi điểm**: Đầu mỗi hiệp đấu, hệ thống so sánh `Initiative` (Thân pháp + Trang bị + Ngẫu nhiên) để sắp xếp thứ tự ra chiêu.
2. **Hành động trong lượt**:
   * Mỗi hiệp nhân vật có điểm **AP (Action Points)** và **Thể lực (Stamina)**.
   * **Chiêu thức cơ bản**:
     * `skill_basic_strike`: Đòn đánh thường, tiêu hao ít Stamina, tích lũy điểm tuyệt chiêu.
     * `skill_defensive_stance`: Thế thủ, giảm 40-60% sát thương nhận vào ở lượt kế, tăng khả năng phản đòn (Counter).
     * `skill_use_potion`: Uống thuốc trị thương hoặc đan dược giải độc từ túi đồ.
     * `skill_basic_flee`: Bỏ chạy (tỷ lệ thành công dựa trên chênh lệch Thân pháp `Agility`).
   * **Tuyệt kỹ môn phái (Finisher Moves)**: Tiêu tốn nhiều Focus/Nội lực nhưng gây sát thương chí mạng hoặc khống chế địch thủ.

#### 4.2. Khống chế & Kháng hiệu ứng (Crowd Control & Willpower)
* Hiệu ứng: Choáng (`Stun`), Điểm huyệt cấm chiêu (`Silence`), Chảy máu (`Bleed`), Trúng độc (`Poison`).
* Chỉ số `Willpower` cung cấp kháng tự nhiên và cơ chế **Diminishing Returns** (hiệu ứng lặp lại sẽ giảm thời gian tác dụng, tránh việc bị quái khống chế vô hạn).

---

### 5. CƠ CHẾ TREO MÁY TU LUYỆN & NGHỀ SINH HOẠT (TRAIN & LIFE SKILLS)

#### 5.1. Hệ thống Tu Luyện Tự Động (Auto-Train / Grind)
* Nhân vật có thể bật chế độ rèn luyện cơ thể:
  * Luyện Thể (tăng EXP Thể chất).
  * Luyện Cốt (tăng EXP Sức mạnh).
  * Luyện Khí (ngồi thiền tích lũy Nội lực).
* Cứ sau mỗi chu kỳ (ví dụ 60 giây), hệ thống cấp một lượng EXP chỉ số (`statExp`) vào bể tích lũy, giúp người chơi thăng cấp chỉ số mà không cần phải spam click liên tục.

#### 5.2. Chế tác & Nấu nướng (Crafting & Alchemy)
* **Bào chế đan dược**: Thu gom dược liệu như *Greenleaf Herb* kết hợp với lò luyện đan tại thôn/thành để chế thành Kim Sang Dược (hồi máu), Hồi Khí Đan.
* **Rèn đúc & Tẩy luyện (Forge & Tempering)**: Dùng khoáng thạch ghép phôi vũ khí, tôi luyện gia tăng phẩm cấp (Trắng ➔ Lục ➔ Lam ➔ Tử ➔ Hoàng Kim).
* **Nấu nướng sinh tồn**: Nhặt củi khô, nướng thịt/cá hoang dã để chế biến lương khô hồi phục Fatigue trên đường thám hiểm.

---

### 6. ĐỀ XUẤT TÍCH HỢP VÀO DỰ ÁN KỲ BIẾN (KYBIEN.BLOGSPOT.COM)

Kỳ Biến đang có sẵn nền tảng Cờ Tướng, Cờ Bí Pháp Kiếm Hiệp, hệ thống ELO, EXP, User và AI Ký sự sa trường. Chúng ta có thể mở rộng phân hệ **"Kỳ Biến: Giang Hồ Sa Trường" (Wuxia Chess RPG)** theo hướng:

```
                      ┌────────────────────────────────────────┐
                      │    KỲ BIẾN: GIANG HỒ SA TRƯỜNG         │
                      └──────────────────┬─────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   [Phân hệ Nhập vai Thám hiểm]                    [Phân hệ Giao chiến Đặc trưng]
   - Tạo nhân vật Hiệp khách (Hệ ngũ hành/chỉ số)  - Đấu quái thường: Turn-based RPG
   - Thám hiểm bản đồ dạng chữ (Text Wuxia)       - Đấu Boss / Tỷ võ giang hồ:
   - Làm nhiệm vụ Tiêu cục, săn kỳ ngộ               + Lựa chọn A: Đấu võ (Turn-based)
   - Thu thập Bí kíp Cờ & Bí kíp Võ công             + Lựa chọn B: Đấu Cờ Thế Kiếm Hiệp!
```

* **Điểm đột phá độc nhất vô nhị**: Khi nhân vật đi thám hiểm gặp các Kỳ ngộ Cao nhân (như Độc Cô Cầu Bại, Trương Tam Phong), thay vì chỉ đánh quái thông thường, người chơi có thể **phá giải các ván Cờ Thế Kiếm Hiệp (Puzzle Chess)** để nhận Bí kíp thượng thừa, danh hiệu cao quý và ngân lượng!
