# ĐẶC TẢ HỆ THỐNG ÂM THANH: BỘ GIỌNG NÓI "CÀ KHÍA KIẾM HIỆP"
## DỰ ÁN: NỀN TẢNG KỲ BIẾN (KYBIEN.BLOGSPOT.COM)
*Tài liệu nghiên cứu, ghi nhớ và đặc tả kỹ thuật kịch bản lồng tiếng & cơ chế phát âm thanh trong game*

---

### 1. ĐỊNH HƯỚNG NGHỆ THUẬT & PHONG CÁCH CỐT LÕI (TONE & PERSONA)
* **Hình tượng nhân vật**: Tiền bối võ lâm nửa chính nửa tà, công lực thâm hậu, ẩn cư sa trường, miệng lưỡi sắc bén, châm chọc sâu cay.
* **Chất giọng**: Vừa mang phong vị chưởng kiếm hiệp cổ trang (xưng hô bổn tọa, tại hạ, thí chủ, đại hiệp, cửu cung, sa trường...), vừa pha trộn ngôn từ "chọc tức / cà khịa" hiện đại (mũ bảo hiểm, nướng than hoa, bẻ cua 90 độ, mạng lag, chuột đơ...).
* **Mục tiêu tâm lý (Player Psychology & Retention)**:
  * Đánh trúng tâm lý hiếu thắng và cảm xúc của kỳ thủ.
  * Khiến người chơi vừa cay cú vừa bật cười thích thú.
  * Thôi thúc người thua đỏ mặt nhưng nhất quyết phải bấm nút **"Tái Đấu"** để phục thù và gỡ lại thể diện.

---

### 2. TỔNG HỢP DANH MỤC THOẠI "CÀ KHÍA KIẾM HIỆP" (7 NHÓM TÌNH HUỐNG)

#### ⚡ Nhóm 1: Khi Đối Thủ Nghĩ Quá Lâu (> 15 Giây) — Châm chọc sự chần chừ
*Tình huống kích hoạt: Khi đến lượt đối thủ suy nghĩ và đồng hồ đếm trôi qua quá 15 giây mà chưa hạ quân.*
1. *"Cờ thì gà ngan vịt, mà ngâm như kỳ thánh trăm năm!"*
2. *"Định ngồi thiền nhập định hay ngủ gật trên bàn cờ đấy?"*
3. *"Nghĩ nửa ngày trời... rồi cũng đi vào ngõ cụt thôi, hạ thủ mau!"*
4. *"Trà nguội ba tuần rồi kìa, có đi không để bổn tọa đi ngủ một giấc?"*
5. *"Kỳ nghệ có hạn mà thời gian suy nghĩ thì vô biên!"*
6. *"Gãi đầu rụng hết tóc rồi kìa, không tìm ra đường sống đâu con sâu!"*

---

#### ⚡ Nhóm 2: Khi Ăn Mất Xe / Pháo / Mã — Xát muối vào nỗi đau mất quân chủ lực
*Tình huống kích hoạt: Khi người chơi hoặc AI ăn được quân Xe (`r`), Pháo (`c`), hoặc Mã (`n`) của đối phương. Từng quân cờ có 3 câu châm chọc riêng biệt, xát muối cực cay:*

* **🚗 Khi Ăn Mất XE (Chiến xa gãy cánh - Nỗi đau tột cùng):**
  1. *"Chiến xa béo mẫm thế này... tại hạ xin không khách khí nhé! Đi xe không đội mũ bảo hiểm thì rụng đài là đúng rồi, kêu ca gì!"*
  2. *"Mất đứt một chiến xa, ruột gan đau như cắt nước mắt đầm đìa chưa? Đa tạ thí chủ đã hào phóng dâng mồi ngon nướng than hoa nhé!"*
  3. *"Một Xe bằng mười quân, mất Xe coi như gãy nửa giang sơn rồi! Giờ lấy cái gì ra mà hoành hành sa trường đây đại hiệp?"*

* **💣 Khi Ăn Mất PHÁO (Pháo xịt nổ nòng - Mất hỏa lực):**
  1. *"Pháo xịt ngòi tịt khói rồi! Không có ngòi thì nổ vào mắt à, giờ lấy cái gì mà gầm rú sa trường?"*
  2. *"Đầu tư quả pháo bắn chim gãy cánh, dâng đạn tận họng đối thủ thế này thì đánh đấm cái nỗi gì!"*
  3. *"Tưởng pháo kích oanh tạc cửu cung thế nào, hóa ra là pháo hoa xịt nước mua vui cho thiên hạ!"*

* **🐎 Khi Ăn Mất MÃ (Mã què gãy vó - Tuyệt đường khinh công):**
  1. *"Mã què cụt chân rồi con sâu! Khinh công bay qua cửa sổ hộ cái xem nào?"*
  2. *"Chiến mã vấp đá gãy cả bốn vó, cắm đầu xuống hố sâu! Phiên mã nhảy lung tung rồi tự chui vào nồi lẩu thế này à?"*
  3. *"Cản chân Mã mà không biết đường gỡ, nuôi ngựa tốn cỏ dâng thịt cho bổn tọa làm đĩa xào lăn, đa tạ nhé!"*

---

#### ⚡ Nhóm 3: Khi Nước Cờ Đưa Vào Thế Chiếu Tướng — Gây hoảng loạn tinh thần
*Tình huống kích hoạt: Nước đi tạo ra thế chiếu tướng (`inCheck(oppCol) == true`).*
1. *"Chiếu tướng! Nhảy đi đâu con sâu!"*
2. *"Long thể bất an, chui vào gầm giường mà trốn mau!"*
3. *"Cửu cung rung chuyển, chuẩn bị lo hậu sự đi là vừa!"*
4. *"Chạy đằng trời! Chạy đi đâu cho hết nắng đồ cờ non!"*
5. *"Đầu hàng sớm bớt đau khổ, giãy giụa làm chi cho thêm nhục nhã!"*

---

#### ⚡ Nhóm 4: Khi Thua Cuộc / Chiếu Bí (Đỉnh cao gây cay cú)
*Tình huống kích hoạt: Khi trận đấu kết thúc bằng Chiếu bí (Checkmate / Resign / Timeout) dẫn đến đối thủ thất bại.*
1. *"Cờ thấp như gián cắt chân, mà cũng dám xuống núi hành tẩu giang hồ!"*
2. *"Kỳ nghệ cỡ này... chỉ xứng quét lá đa ngoài cổng Thiếu Lâm Tự thôi!"*
3. *"Về núi bế quan luyện thêm ba vạn sáu ngàn năm nữa rồi hẵng tiếp chiêu bổn tọa!"*
4. *"Có cay không? Mặt đỏ bừng lên rồi kìa! Cay thì bấm Tái Đấu!"*
5. *"Cầm cờ mà run như cầy sấy thế này, ai dạy chơi cờ thế?"*
6. *"Thua tâm phục khẩu phục chưa? Hay lại đổ tại chuột đơ, mạng lag?"*
7. *"Đánh đấm thế này bảo sao danh hiệu Kỳ Đồng mãi không ngóc đầu lên nổi!"*

---

#### ⚡ Nhóm 5: Khi Đối Thủ Đi Nước Hớ / Đi Nước Ngu (Blunder)
*Tình huống kích hoạt: Đối thủ đi nước cờ sai lầm nặng (thả quân không công, để mất quân lớn hoặc điểm đánh giá tụt dốc thê thảm).*
1. *"Nước cờ mù mắt quần hùng! Đi xong có thấy hối hận đến tận ruột gan không?"*
2. *"Đúng là thần cơ diệu toán... phiên bản tấu hài mua vui thiên hạ!"*
3. *"Dâng quân tận mồm thế này, lòng tốt của thí chủ bần đạo xin nhận nhé!"*
4. *"Mắt để ngắm cảnh à mà thí quân hào phóng thế đại hiệp?"*

---

#### ⚡ Nhóm 6: Khi Kích Hoạt Thập Lục Bí Pháp — Khoe khoang tuyệt kỹ
*Tình huống kích hoạt: Khi người chơi thi triển một trong 16 thẻ bài Bí Pháp Kỳ Biến.*
1. *"Xem tuyệt kỹ Thiểm Điện Trảm chém rách bàn cờ của ngươi đây!"*
2. *"Trúng một quả Bích Lịch Hỏa thì cháy cả lông mày nhé con!"*
3. *"Phá Lãng Bộ bẻ cua 90 độ, đỡ bằng niềm tin à?"*
4. *"Bí kíp gia truyền xuất thế, quỳ xuống mà chiêm ngưỡng!"*

---

#### ⚡ Nhóm 7: Khi Đối Thủ Bấm Nút "Xin Hòa" Hoặc "Đầu Hàng"
*Tình huống kích hoạt: Khi nhận sự kiện đối phương gửi đề nghị Hòa hoặc bấm Đầu hàng (Surrender).*
1. *"Đánh không lại bắt đầu dở trò xin xỏ à? Bổn tọa không có lòng từ bi đâu nhé!"*
2. *"Biết thân biết phận đầu hàng sớm là tốt, đỡ phải rước thêm nhục!"*

---

### 3. TỔNG HỢP HIỆU ỨNG ÂM THANH CỔ ĐIỂN BẰNG WEB AUDIO API (NATIVE SYNTHESIZER)
Không chỉ dừng lại ở giọng nói, toàn bộ hiệu ứng âm thanh va chạm sa trường được kiến tạo trực tiếp bằng **Web Audio API** native của trình duyệt:
* 🎯 **Ưu điểm tuyệt đối**:
  * **Hoàn toàn không dùng file âm thanh bên ngoài** (`.mp3`, `.wav`...): Giảm 100% dung lượng tải trang, không lo lỗi 404/CORS từ CDN.
  * **Độ trễ bằng 0 (Zero Latency)**: Âm thanh phát tức thì ngay mili-giây người chơi chạm/thả cờ.
  * **Tương thích hoàn hảo**: Chạy mượt mà trên mọi thiết bị di động, PC và cả mạng lag/yếu.

#### 🎼 Chi tiết 3 Hiệu ứng Âm thanh Cốt lõi:
1. 🪵 **Tiếng "CẠCH!" giòn tan khi quân cờ gõ xuống bàn (Move Sound)**:
   * *Nguyên lý sóng*: Sử dụng sóng `triangle` (hoặc kết hợp xung `sine` decay cao), quét tần số từ $340\text{ Hz} \to 70\text{ Hz}$ trong thời gian cực ngắn ($0.06 - 0.08\text{ s}$).
   * *Cảm giác*: Mô phỏng chân thực tiếng gỗ gõ đanh, chắc nịch xuống mặt bàn cờ truyền thống.
2. ⚔️ **Tiếng "KENG!" sắc lẹm khi hai quân chém nhau (Capture Sound)**:
   * *Nguyên lý sóng*: Sử dụng sóng răng cưa `sawtooth` kết hợp hài âm cao, tần số xuất phát từ $980\text{ Hz} \to 320\text{ Hz}$ hoặc đập tần kim loại $1200\text{ Hz}$ phân rã trong $0.12 - 0.15\text{ s}$.
   * *Cảm giác*: Tạo âm hưởng vũ khí binh đao chém phạt kim loại tóe lửa, sắc lẹm và dứt khoát.
3. 🔥 **Tiếng "ÙM...!" vang rền khi kích hoạt Bí pháp hỏa công (Spell Sound)**:
   * *Nguyên lý sóng*: Sử dụng dao động siêu trầm (Sub-bass Rumble) sóng `sawtooth` hoặc `square` hạ tần số cực dốc từ $180\text{ Hz} \to 35\text{ Hz}$ kéo dài $0.4 - 0.6\text{ s}$, chồng thêm lớp dao động bùng nổ.
   * *Cảm giác*: Mô phỏng tiếng chưởng lực chấn động cửu cung, hỏa công bùng phát rền vang sa trường.

```javascript
/* ---------- MODULE TỔNG HỢP ÂM THANH NATIVE (WEB AUDIO API SYNTHESIZER) ---------- */
const SndFX = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  return {
    // 1. Tiếng "CẠCH!" giòn tan khi gõ quân cờ
    cach: () => {
      try {
        const c = getCtx(), t = c.currentTime;
        const osc = c.createOscillator(), gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(360, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.07);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.07);
      } catch(e){}
    },

    // 2. Tiếng "KENG!" sắc lẹm khi hai quân chém nhau
    keng: () => {
      try {
        const c = getCtx(), t = c.currentTime;
        // Lớp kim loại cao tần + Lớp va chạm
        const o1 = c.createOscillator(), g1 = c.createGain();
        o1.type = 'sawtooth';
        o1.frequency.setValueAtTime(920, t);
        o1.frequency.exponentialRampToValueAtTime(260, t + 0.12);
        g1.gain.setValueAtTime(0.85, t);
        g1.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        o1.connect(g1); g1.connect(c.destination);
        o1.start(t); o1.stop(t + 0.12);
      } catch(e){}
    },

    // 3. Tiếng "ÙM...!" vang rền khi kích hoạt Bí pháp hỏa công
    umHoaCong: () => {
      try {
        const c = getCtx(), t = c.currentTime;
        const osc = c.createOscillator(), gain = c.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(32, t + 0.55);
        gain.gain.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.55);
      } catch(e){}
    }
  };
})();
```

---

### 4. ĐẶC TẢ THIẾT KẾ UX/UI & LOGIC ĐIỀU HƯỚNG

#### 4.1. Nút Chuyển Đổi "Gáy Khô Máu" vs "Tĩnh Tâm" (Banter Audio Switch)
* **Vị trí hiển thị**: Góc trên thanh công cụ bàn cờ (cạnh icon Âm lượng / Bảng điểm / Lật bàn cờ).
* **Trạng thái 1: "Gáy Khô Máu" (Bật)**:
  * Icon: Chiếc loa phát lửa hoặc Loa chiến đấu (`🔊🔥` hoặc `⚔️🔊`).
  * Tooltip: *"Chế độ Cà Khía: Bật (Gáy Khô Máu)"*.
  * Hiệu ứng: Cho phép phát các câu thoại châm chọc ngẫu nhiên theo tình huống.
* **Trạng thái 2: "Tĩnh Tâm" (Tắt)**:
  * Icon: Chiếc loa gạch chéo hoặc Chữ Thiền (`🔇` hoặc `🧘`).
  * Tooltip: *"Chế độ Cà Khía: Tắt (Tĩnh Tâm thiền định)"*.
  * Hiệu ứng: Vẫn giữ âm thanh di chuyển quân/ăn quân (SFX "Cạch", "Keng", "Ùm...") nhưng hoàn toàn tắt voice cà khía chọc tức.
* **Lưu trữ**: Lưu cấu hình người dùng vào `localStorage.getItem('kybien_taunt_voice')` (mặc định: `true`).

#### 4.2. Thuật toán Tần suất & Ngẫu nhiên (Probability & Cooldown Algorithm)
* **Quy tắc vàng**: Không nói liên tục từng nước đi tránh gây ức chế tiêu cực, phản tác dụng hoặc nhàm chán.
* **Tỷ lệ kích hoạt (Trigger Chance)**:
  * Tình huống thường (Nghĩ lâu, Ăn quân Xe/Pháo/Mã, Chiếu tướng, Bí pháp): **30% - 40%** xác suất khi biến cố xảy ra (`Math.random() < 0.35`).
  * Tình huống kết thúc (Chiếu bí / Thua cuộc / Đầu hàng): **100%** phát 1 câu ngẫu nhiên trong danh sách để tạo ấn tượng chốt hạ sâu cay.
* **Cơ chế Cooldown (Thời gian giãn cách tối thiểu)**:
  * Giãn cách tối thiểu giữa 2 câu thoại thoại: $\ge 12 - 15$ giây (`Date.now() - lastVoiceTime >= 12000`).
  * Ngăn voice này đè lên voice khác (Voice Queue / Busy flag: `if (isVoicePlaying) return;`).

---

### 5. ÁNH XẠ KIẾN TRÚC KỸ THUẬT VÀO FRONTEND (`arena-page.html`)

```javascript
/* ---------- HỆ THỐNG GIỌNG NÓI CÀ KHÍA KIẾM HIỆP (VOICE TAUNT SYSTEM) ---------- */
const TAUNT_LINES = {
  idle: [
    "Cờ thì gà ngan vịt, mà ngâm như kỳ thánh trăm năm!",
    "Định ngồi thiền nhập định hay ngủ gật trên bàn cờ đấy?",
    "Nghĩ nửa ngày trời... rồi cũng đi vào ngõ cụt thôi, hạ thủ mau!",
    "Trà nguội ba tuần rồi kìa, có đi không để bổn tọa đi ngủ một giấc?",
    "Kỳ nghệ có hạn mà thời gian suy nghĩ thì vô biên!",
    "Gãi đầu rụng hết tóc rồi kìa, không tìm ra đường sống đâu con sâu!"
  ],
  // 3 câu xát muối cực cay cho từng quân chủ lực:
  capture_r: [
    "Chiến xa béo mẫm thế này... tại hạ xin không khách khí nhé! Đi xe không đội mũ bảo hiểm thì rụng đài là đúng rồi, kêu ca gì!",
    "Mất đứt một chiến xa, ruột gan đau như cắt nước mắt đầm đìa chưa? Đa tạ thí chủ đã hào phóng dâng mồi ngon nướng than hoa nhé!",
    "Một Xe bằng mười quân, mất Xe coi như gãy nửa giang sơn rồi! Giờ lấy cái gì ra mà hoành hành sa trường đây đại hiệp?"
  ],
  capture_c: [
    "Pháo xịt ngòi tịt khói rồi! Không có ngòi thì nổ vào mắt à, giờ lấy cái gì mà gầm rú sa trường?",
    "Đầu tư quả pháo bắn chim gãy cánh, dâng đạn tận họng đối thủ thế này thì đánh đấm cái nỗi gì!",
    "Tưởng pháo kích oanh tạc cửu cung thế nào, hóa ra là pháo hoa xịt nước mua vui cho thiên hạ!"
  ],
  capture_n: [
    "Mã què cụt chân rồi con sâu! Khinh công bay qua cửa sổ hộ cái xem nào?",
    "Chiến mã vấp đá gãy cả bốn vó, cắm đầu xuống hố sâu! Phiên mã nhảy lung tung rồi tự chui vào nồi lẩu thế này à?",
    "Cản chân Mã mà không biết đường gỡ, nuôi ngựa tốn cỏ dâng thịt cho bổn tọa làm đĩa xào lăn, đa tạ nhé!"
  ],
  check: [
    "Chiếu tướng! Nhảy đi đâu con sâu!",
    "Long thể bất an, chui vào gầm giường mà trốn mau!",
    "Cửu cung rung chuyển, chuẩn bị lo hậu sự đi là vừa!",
    "Chạy đằng trời! Chạy đi đâu cho hết nắng đồ cờ non!",
    "Đầu hàng sớm bớt đau khổ, giãy giụa làm chi cho thêm nhục nhã!"
  ],
  mate: [
    "Cờ thấp như gián cắt chân, mà cũng dám xuống núi hành tẩu giang hồ!",
    "Kỳ nghệ cỡ này... chỉ xứng quét lá đa ngoài cổng Thiếu Lâm Tự thôi!",
    "Về núi bế quan luyện thêm ba vạn sáu ngàn năm nữa rồi hẵng tiếp chiêu bổn tọa!",
    "Có cay không? Mặt đỏ bừng lên rồi kìa! Cay thì bấm Tái Đấu!",
    "Cầm cờ mà run như cầy sấy thế này, ai dạy chơi cờ thế?",
    "Thua tâm phục khẩu phục chưa? Hay lại đổ tại chuột đơ, mạng lag?",
    "Đánh đấm thế này bảo sao danh hiệu Kỳ Đồng mãi không ngóc đầu lên nổi!"
  ],
  blunder: [
    "Nước cờ mù mắt quần hùng! Đi xong có thấy hối hận đến tận ruột gan không?",
    "Đúng là thần cơ diệu toán... phiên bản tấu hài mua vui thiên hạ!",
    "Dâng quân tận mồm thế này, lòng tốt của thí chủ bần đạo xin nhận nhé!",
    "Mắt để ngắm cảnh à mà thí quân hào phóng thế đại hiệp?"
  ],
  spell: [
    "Xem tuyệt kỹ Thiểm Điện Trảm chém rách bàn cờ của ngươi đây!",
    "Trúng một quả Bích Lịch Hỏa thì cháy cả lông mày nhé con!",
    "Phá Lãng Bộ bẻ cua 90 độ, đỡ bằng niềm tin à?",
    "Bí kíp gia truyền xuất thế, quỳ xuống mà chiêm ngưỡng!"
  ],
  surrender: [
    "Đánh không lại bắt đầu dở trò xin xỏ à? Bổn tọa không có lòng từ bi đâu nhé!",
    "Biết thân biết phận đầu hàng sớm là tốt, đỡ phải rước thêm nhục!"
  ]
};

// Cấu hình Controller
const VoiceController = {
  enabled: localStorage.getItem('kybien_taunt_enabled') !== 'false',
  lastTime: 0,
  cooldownMs: 15000,
  busy: false,
  
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('kybien_taunt_enabled', this.enabled ? 'true' : 'false');
    return this.enabled;
  },

  play(category, force = false) {
    if (!this.enabled) return;
    const now = Date.now();
    if (!force && (now - this.lastTime < this.cooldownMs)) return;
    if (!force && Math.random() > 0.35) return; // 35% xác suất kích hoạt
    
    const list = TAUNT_LINES[category];
    if (!list || !list.length) return;
    const line = list[Math.floor(Math.random() * list.length)];
    
    this.lastTime = now;
    this.speak(line);
  },

  speak(text) {
    // 1. Hiển thị Bubble Chat / Floating Taunt Text trên sa trường
    if (typeof showFloatingTaunt === 'function') {
      showFloatingTaunt(text);
    }
    // 2. Tích hợp Web Speech API (TTS) hoặc Audio Assets
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'vi-VN';
      u.rate = 1.05;
      u.pitch = 0.9; // Hơi trầm, uy nghiêm châm chọc
      window.speechSynthesis.speak(u);
    }
  }
};
```

---

### 6. LỘ TRÌNH TRIỂN KHAI VÀ TỐI ƯU
1. **Giai đoạn 1 (Web Audio API Synthesizer & Floating Bubble Banner & Web Speech)**: Tích hợp bộ âm thanh native 3 âm "Cạch", "Keng", "Ùm..." không cần file ngoài; hiển thị khung đối thoại kiếm hiệp (Speech Bubble) trên đỉnh bàn cờ + Web Speech Synthesis tiếng Việt.
2. **Giai đoạn 2 (Studio Audio Asset Recording / AI Voice Studio)**: Thu âm chuẩn chất giọng lão tiền bối võ lâm hoặc tạo file MP3/OGG nén bằng ElevenLabs / TopMediai tiếng Việt để đạt thần thái châm chọc cao nhất.
3. **Giai đoạn 3 (Đồng bộ phòng đấu trực tiếp Socket.io)**: Cho phép gửi emoticon cà khía hoặc âm thanh tương tác hai chiều trong các phòng thách đấu người thật.
