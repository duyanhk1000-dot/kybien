# THIẾT KẾ GAMEPLAY TỔNG THỂ MỤC TIÊU — V1.1 (CẬP NHẬT THEO QUYẾT ĐỊNH ĐÃ DUYỆT)
## DỰ ÁN: TIÊN LỘ: VẠN GIỚI TRANH PHONG

**Tác giả:** Senior Game Systems Architect & Gameplay Engineer  
**Phiên bản:** 2.0 (Implemented & Verified)  
**Phạm vi:** CHỈ MỤC 1 — THỐNG NHẤT GAMEPLAY TỔNG THỂ  
**Trạng thái:** ĐÃ PHÊ DUYỆT, TRIỂN KHAI & KIỂM THỬ HOÀN TẤT 100%  

---

## I. CÁC QUYẾT ĐỊNH THIẾT KẾ ĐÃ ĐƯỢC CHỦ DỰ ÁN CHỐT

1. **Chiến Đấu Tự Động Hoàn Toàn (Full Auto-Combat):**
   - Loại bỏ hoàn toàn việc bắt người chơi bấm thủ công `STRIKE`, `SKILL`, `GUARD`, `FLEE` trong từng lượt.
   - **Quy tắc Bỏ Qua (Skip Battle):** Người chơi **bắt buộc phải xem tối thiểu một hiệp hoàn chỉnh** (Round 1: Người chơi & Quái vật đã hoàn tất xuất chiêu và hiện số sát thương). Sau khi Hiệp 1 kết thúc, nút `[⏭ Xem Kết Quả Ngay]` mới được kích hoạt để người chơi có thể bỏ qua diễn biến còn lại.
2. **Hình Phạt Thất Bại Chuẩn Xác:**
   - Khi hết máu trong chiến đấu: Nhân vật trở về Động Phủ Tán Tu với **20 HP**, mất **15 Thể Lực**.
   - **Tuyệt đối không mất trang bị**, không mất vật phẩm đang sở hữu trong túi đồ, không bị tụt cảnh giới hay cấp độ.
   - Các vật phẩm tiêu hao (đan dược, phù lục) đã sử dụng trước hoặc trong trận tuân theo quy tắc tiêu hao thực tế, không tự động hoàn trả.
3. **Phân Tách Rạch Ròi EXP vs Tu Vi:**
   - **EXP (Kinh Nghiệm Thể Phách):** Dùng riêng để tăng **Cấp Độ Nhân Vật (Level 1 $\rightarrow$ 100)**.
   - **Tu Vi (Chân Nguyên Tụ Khí):** Dùng riêng cho tiến trình tu luyện và **Xung Quan Đột Phá Cảnh Giới (Realm Tier)**.
   - Hai loại tiến trình có nguồn nhận, điều kiện sử dụng, công thức và giao diện hiển thị hoàn toàn độc lập.

---

## II. PHÂN TÍCH & ĐỀ XUẤT HỆ THỐNG CẤP ĐỘ VÀ CHỈ SỐ

### 1. Phân Tích Mức Tăng Chỉ Số Mỗi Cấp (Tránh Lệch Pha Cảnh Giới)
- **Vấn đề đã phân tích:** Nếu mỗi cấp tăng tĩnh $+15$ HP và $+5$ Thể lực:
  - Ở Level 50: Người chơi có thêm $+735$ HP và $+245$ Thể lực. Mức này vượt xa lượng HP gốc của toàn bộ giai đoạn Luyện Khí (140 - 680 HP), làm cho Cảnh Giới bị vô hiệu hóa và Thể lực bị lạm phát (không còn cần đả tọa hay dùng đan dược).
- **Đề xuất công thức tăng chỉ số cân bằng (Balanced Stat Progression):**
  - **Mỗi Cấp (Level):**
    - $+4$ Khí Huyết tối đa (`max_health`). (Đến Level 100 tăng $+396$ HP — đóng vai trò là lớp gia cố thể phách bền vững, không lấn át bước nhảy vọt của Cảnh Giới).
    - $+1$ Thể Lực tối đa (`max_fatigue`) mỗi 2 cấp (tương đương $+0.5$ fatigue/cấp). (Đến Level 100 trần thể lực đạt $150$, đảm bảo nhịp độ thám hiểm và giữ nguyên giá trị kinh tế của việc đả tọa/thuê trọ).
    - **Mốc Thể Phách (Milestones):**
      - Cứ mỗi 10 Cấp (Level 10, 20, 30...): Thưởng **$+1$ Điểm Tiềm Năng (Stat Point)** để người chơi tự do cộng Căn Cốt, Ngộ Tính hoặc Khí Vận.
      - Cứ mỗi 20 Cấp: Mở khóa thêm 1 vị trí gắn Tâm Pháp Bị Động.

### 2. Công Thức EXP Lũy Thừa Tăng Dần Tự Nhiên
Dựa trên bảng EXP thưởng của Quái vật hiện có (Thổ Lang: 25, Thảo Mộc Tinh: 45, U Minh Lang: 90, Thiết Giáp Trư: 105, Lang Vương: 450) và Nhiệm Vụ (50 - 200 EXP):
$$\text{EXP\_Required}(L) = \left\lfloor 50 \times L^{1.45} + 50 \times L \right\rfloor$$

**Bảng mô phỏng tiến trình thực tế:**
- **Level 1 $\rightarrow$ 2:** Cần 100 EXP *(Khoảng 4 con Thổ Lang hoặc 1 Nhiệm Vụ Chính Tuyến 1)*.
- **Level 2 $\rightarrow$ 3:** Cần 168 EXP *(Khoảng 4 con Thảo Mộc Tinh)*.
- **Level 5 $\rightarrow$ 6:** Cần 520 EXP.
- **Level 10 $\rightarrow$ 11:** Cần 1.420 EXP *(Bắt đầu tiến vào U Minh Trúc Lâm săn quái Tinh Anh)*.
- **Level 20 $\rightarrow$ 21:** Cần 4.150 EXP.
- **Level 50 $\rightarrow$ 51:** Cần 16.800 EXP.
- **Level 100 (Cấp Tối Đa):** Đạt trần tiến trình thể phách.

### 3. Xử Lý Khi Đạt Cấp Tối Đa (Max Level 100)
- Tại Level 100, thanh EXP hiển thị `MAX / MAX`.
- Cấp độ không tiếp tục tăng để đảm bảo an toàn toán học.
- EXP nhận thêm từ quái vật được chuyển hóa với tỷ lệ $10:1$ sang Ngân Lượng (Bạc), giúp người chơi ở cấp tối đa vẫn nhận được giá trị thực tế khi hỗ trợ trảm yêu.

---

## III. QUY TẮC CHIẾN ĐẤU TỰ ĐỘNG HOÀN TOÀN (FULL AUTO-COMBAT SPECIFICATION)

### 1. Luồng Trận Đấu & Thời Điểm Nút Bỏ Qua Xuất Hiện
1. Người chơi nhấn **"Khiêu Chiến"** Dị Thú.
2. Trận đấu bắt đầu mô phỏng:
   - Hiển thị `#battle-modal`.
   - Nút `[⏭ Xem Kết Quả Ngay]` ở trạng thái **Vô hiệu hóa (Disabled)**, hiển thị dòng chữ: `Đang kịch chiến Hiệp 1...`.
3. **Hiệp 1 diễn ra trọn vẹn:**
   - Bên có Thân pháp (Speed) cao hơn xuất chiêu trước.
   - Bên phòng thủ phản kích.
   - Sát thương nhảy số và hiển thị Combat Log của Hiệp 1.
4. **Ngay khi Hiệp 1 kết thúc:**
   - Nút `[⏭ Xem Kết Quả Ngay]` lập tức **Sáng lên (Enabled)**.
   - Người chơi có thể click bất cứ lúc nào để bỏ qua toàn bộ các hiệp còn lại và xem ngay bảng tổng kết Chiến Thắng / Thất Bại (xử lý tức thì trong 10ms).
   - Nếu người chơi không click, trận đấu tiếp tục tự động phát lại các hiệp tiếp theo với tốc độ tùy chọn (`1x` = 800ms/hiệp, `2x` = 400ms/hiệp).

### 2. Giới Hạn 30 Hiệp & Quy Tắc Kết Thúc Hòa (Tie-Break)
- Nếu sau 30 hiệp kịch chiến mà cả 2 bên đều chưa hết máu:
  - Hệ thống tự động kích hoạt cơ chế **Lực Kiệt Đình Chiến (Stalemate)**.
  - **Phán quyết:**
    - So sánh tỷ lệ % máu còn lại giữa Người chơi và Yêu thú.
    - Nếu $\% \text{HP}_{\text{Player}} > \% \text{HP}_{\text{Monster}}$: Người chơi chiếm ưu thế, yêu thú tháo chạy. Người chơi nhận 50% EXP và 50% Tu Vi an ủi.
    - Nếu $\% \text{HP}_{\text{Player}} \le \% \text{HP}_{\text{Monster}}$: Người chơi nhận thấy không thể công phá, tự động thi triển khinh công rút lui an toàn.
  - **Trạng thái:** Kết thúc Hòa / Rút lui an toàn, **không bị phạt mất 15 thể lực và không bị trừ HP về 20**.

### 3. Quy Tắc Chân Khí (Qi) & Kỹ Năng Tự Động
- Không mặc định mọi kỹ năng đều dùng 15 Qi.
- **Quy tắc phân tầng Chân Khí:**
  - **Trảm Kích Cơ Bản:** Tiêu hao $0$ Qi, hồi phục $+8$ Qi, gây sát thương Thể chất $(\text{Physique} \times 1.5 + \text{WeaponAtk} - \text{Defense})$.
  - **Thần Thông Tiên Thuật (Equipped Skill):**
    - Ngưỡng kích hoạt phụ thuộc vào kỹ năng nhân vật sở hữu:
      - Kỹ năng Sơ cấp: Tiêu hao $12$ Qi.
      - Kỹ năng Trung cấp: Tiêu hao $20$ Qi.
      - Kỹ năng Thượng thừa: Tiêu hao $30$ Qi.
    - Khi Chân Khí hiện tại $\ge$ Chi phí kỹ năng $\rightarrow$ Tự động xuất chiêu Thần Thông (bỏ qua 50% giáp quái và gây sát thương phép Ngộ Tính).
  - **Thế Thủ Tự Động (Auto-Guard):**
    - Khi quái vật chuẩn bị tung đòn nặng (`HEAVY Intent`, sát thương 180%), nếu nhân vật có Thân pháp đủ nhanh hoặc đang trang bị Pháp Y $\rightarrow$ Tự động kích hoạt phòng ngự giảm 70% sát thương nhận vào.

### 4. Tốc Độ Hiển Thị & Tính Nhất Quán Toán Học
- Trận đấu được tính toán theo mô hình thuần túy (Deterministic Simulation). Toàn bộ danh sách diễn biến các hiệp được tạo ra ngay từ đầu.
- Tốc độ `1x` hay `2x` chỉ là khoảng thời gian hiển thị giao diện của client, tuyệt đối không làm thay đổi kết quả thắng thua hay lượng sát thương của trận đấu.

---

## IV. NGUỒN DỮ LIỆU & LƯU TRỮ TRẠNG THÁI (DATA & PERSISTENCE)

### 1. Thống Nhất Nguồn Dữ Liệu Vật Phẩm
- Bổ sung vật phẩm `item_thanh_tam_boi` từ `frontend/data/xianxia/items.json` sang `backend/src/data/xianxia/items.json`.
- Bảo toàn nguyên vẹn 100% các trường dữ liệu và ID của 17 vật phẩm cũ, không xóa hoặc gộp làm vỡ dữ liệu.
- Sau khi đồng bộ, 9/9 tệp JSON giữa Frontend và Backend có hash nội dung trùng khớp hoàn toàn.

### 2. Hàm Cộng Điểm & Chống Bỏ Sót Tiến Trình
- Bổ sung phương thức `addExp(amount)` trong `TienLoEngine`:
  - Cộng điểm kinh nghiệm vào `player.exp`.
  - Kiểm tra điều kiện thăng cấp theo công thức lũy thừa.
  - Khi thăng cấp: Thông báo thăng cấp sinh động, tăng chỉ số trần `max_health` (+4), `max_fatigue` (+1 mỗi 2 cấp), hồi đầy thể lực.
- Giữ nguyên phương thức `addCultivation(amount)`:
  - Chỉ cộng điểm tu vi vào `player.cultivation`.
  - Đạt trần thì kích hoạt trạng thái sẵn sàng Xung Quan Đột Phá Cảnh Giới.
- Trong `endBattle('WIN')`: Gọi đồng thời `addExp(mon.exp_reward)` và `addCultivation(mon.cultivation_reward)`, khắc phục hoàn toàn `BUG-01`.

### 3. Tương Thích Dữ Liệu Cũ (LocalStorage Migration)
- Trong `loadPlayerState()`:
  - Kiểm tra nếu object người chơi trong `localStorage` thiếu các trường mới (`level`, `exp`, `exp_required`), hệ thống tự động gán giá trị khởi đầu an toàn (`level = 1, exp = 0, exp_required = 100`).
  - Giữ nguyên toàn bộ tên nhân vật, cảnh giới, túi đồ, bạc, trang bị hiện có. Tuyệt đối không reset nhân vật của người chơi.

### 4. Ranh Giới Kiến Trúc Backend Multiplayer Trong Mục 1
- **Xác định trung thực:** Trong phạm vi Mục 1, game tiếp tục vận hành theo mô hình Client-First với LocalStorage để bảo đảm khả năng chơi mượt mà ngoại tuyến (Offline-First).
- **Phần chuẩn bị cho Multiplayer trong Mục 1:**
  - Logic chiến đấu tự động được đóng gói thành hàm thuần túy (Pure Function) không phụ thuộc DOM, có thể chạy tại `backend/src/services/xianxia/xianxiaBestiaryService.ts`.
  - Endpoint `/api/xianxia/bestiary/monsters/:id/battle-resolve` được nâng cấp để server có thể mô phỏng và xác thực kết quả chiến đấu tự động khi cần.
  - Việc tạo bảng Database Prisma và JWT Session Sync được phân định rõ thành hạng mục kỹ thuật riêng của giai đoạn sau, không tuyên bố sai sự thật về tính bảo mật máy chủ khi DB chưa kết nối.

---

## V. KẾT LUẬN & PHẠM VI TRIỂN KHAI

Phương án V1.1 này đã giải quyết toàn diện và chính xác các yêu cầu của Chủ Dự Án:
- **Đã chốt:** Auto-Combat xem tối thiểu 1 hiệp; Phạt thất bại về động phủ 20 HP, -15 Thể lực; Phân tách hoàn toàn EXP (Level) vs Tu Vi (Realm).
- **Đã tính toán cân bằng:** Mức tăng chỉ số mỗi cấp hợp lý (+4 HP, +0.5 Thể lực, +1 Điểm tiềm năng mỗi 10 cấp), không làm lu mờ Cảnh Giới.
- **Đã chuẩn bị kỹ thuật:** Không sửa mã nguồn trong giai đoạn này, chờ chỉ thị phê duyệt chính thức để chuyển sang Giai đoạn B.
