---
name: vfx-asset-creation
description: >-
  Standardized guide and workflow for creating sequential VFX sprite sheets and ability animation assets for heroes in the 2.5D auto-chess game Ky Bien. Incorporates BeanFX production standards (craft gates, 3-layer architecture, color/light layer separation, peak-first design, 3-scale particle grouping, and contact frame hit-stop synchronization).
---

# Quy Trình Tạo Asset Chiêu Thức & Hiệu Ứng (VFX Production Standard)
### Dự án: Kỳ Biến (Cổ Huyền Sử) — Tích hợp Chuẩn Kỹ Thuật BeanFX Engine

Tài liệu chuẩn hóa phương pháp sản xuất asset hoạt ảnh kỹ năng (Skill VFX) cho tựa game chiến thuật cờ nhân phẩm 2.5D **Kỳ Biến (Cổ Huyền Sử)**, kết hợp kiến trúc phân lớp chuyên sâu từ hệ thống **BeanFX Engine**.

---

## 1. Nguyên Tắc Cốt Lõi (Core Principles)

### Kỹ thuật: VFX Sprite Sheet – Sequential Animation
* **Tính nhất quán giải phẫu (Anatomical Consistency):** Tuyệt đối **không** tạo các hình rời rạc, ngẫu nhiên độc lập. Mọi frame trong một chuỗi hoạt ảnh phải mô tả:
  * **Cùng một chủ thể** (cùng tỷ lệ, sừng, râu, vảy, màu sắc, chi tiết).
  * **Cùng một trận địa / điểm gốc thi triển** (vị trí summoning point cố định).
  * **Cùng một góc camera / phối cảnh** (isometric 2.5D cố định, tỷ lệ elip $\approx 1.72:1$, không đổi góc nhìn).
  * Thể hiện ở các mốc thời điểm thời gian nối tiếp nhau.

---

## 2. Kiến Trúc 3 Lớp Hiệu Ứng (3-Layer VFX System)

Mọi kỹ năng phức tạp trong game được cấu thành từ 3 lớp độc lập để tối ưu hóa hiệu năng, dễ lập trình và tái sử dụng:

| Lớp | Thành phần | Vị trí DOM / Render | Vai trò & Cách hoạt động |
| :--- | :--- | :--- | :--- |
| **Layer 1** | **Ground Decal / Array** | Container `#zl` (`zlEl`, `z-index: 0`) | **Nằm dưới chân tướng & quái:** Pháp trận, xoáy nước, nứt đất bốc khói, thảm lửa, bãi cọc nhọn... nằm bẹp theo phối cảnh sàn đấu 2.5D. |
| **Layer 2** | **Main Subject VFX** | Container `#fxl` (`z-index: 42 - 43`) | **Nằm trên tướng & quái:** Chủ thể chính của chiêu thức (Thần Long vươn mình, Cự kiếm Thuận Thiên cắm đất, Thiết Mã phi nước đại, Cự thạch giáng thế). |
| **Layer 3** | **Energy / Slash / Burst** | Container `#fxl` (`z-index: 44`) | **Nằm trên cùng:** Sóng kiếm khí quét ngang, cột lôi hỏa bộc phá, hào quang chiến ý, ấn ký chữ thần (`textFx`), sóng xung kích đa tầng (`ringFx`), hạt tia lửa (`spawnP`). |

---

## 3. Bộ Quy Chuẩn Tạo Hình BeanFX (VFX Craft Gates)

👉 Chi tiết đầy đủ tại: [references/craft-gates.md](references/craft-gates.md)

1. **Chiến lược "Peak First" (Thiết kế Frame Đỉnh trước):**
   * Luôn chốt **Frame Đỉnh (Peak Frame)** trước tiên (thời điểm năng lượng và kích thước bùng nổ cực đại).
   * Nội suy giai đoạn **Tích tụ (Windup, 15 - 25% thời lượng)** từ các điểm gốc của Peak Frame tụ về tâm. Điểm phát sáng cốt lõi (Hot Core) phải xuất hiện ngay từ Frame 0.
   * Nội suy giai đoạn **Tiêu tán (Dissolve, 50 - 65% thời lượng)** tản mát thành các hạt tàn dư.
2. **Quy tắc 5% Dissolve (Biến mất êm dịu):**
   * Frame cuối cùng chỉ giữ lại tối đa **$5\%$** số pixel năng lượng của Peak Frame. Tránh hiện tượng giật tắt phụt (pop-off).
3. **Quy tắc 3 Kích Cỡ Hạt (3-Scale Particle Grouping):**
   * Các hạt năng lượng lặp lại (tia lửa, bọt nước, mảnh đá) phải phân bổ theo: *vài hạt to, một số hạt vừa, nhiều hạt nhỏ*. Tuyệt đối không dàn hàng hạt cùng kích cỡ gây cảm giác "giấy dán tường".
4. **Đồng Bộ Khung Hình Va Chạm (Contact Frame & Hit-Stop):**
   * Tại đúng mili-giây tiếp đất (Contact Frame), kích hoạt đồng thời:
     - Khựng hình va chạm: `hitstop(60 - 90ms)`.
     - Rung chấn màn hình: `shake(amplitude, duration)`.
     - Sóng xung kích mở rộng: `ringFx(x, y, r, color)`.
     - Chớp trắng mục tiêu: `flash`.

---

## 4. Kỹ Thuật Tách 2 Lớp: Màu Gốc & Ánh Sáng (Color vs Additive Light)

👉 Chi tiết đầy đủ tại: [references/light-and-bloom.md](references/light-and-bloom.md)

* **Color Layer (`_color.webp`):** Thể hiện hình thể, vật liệu, viền sắc nét ở chế độ `source-over` (Normal).
* **Light Layer (`_light.webp`):** Thể hiện vầng sáng phát quang (Bloom/Glow) ở chế độ hòa trộn `lighter` (Additive) hoặc `screen`.
* **Cấp độ phát quang (Glow Levels):**
  - `Subtle`: Kỹ năng phụ, đốm lửa tàn tro.
  - `Medium`: Chiêu thức diện rộng bình thường (2 - 3 Vàng).
  - `Strong`: Chiêu thức Tối Thượng (4 - 5 Vàng: Thuận Thiên Kiếm, Triệu Long, Sát Thát).

---

## 5. Quy Chuẩn Master Prompt Template (Dành cho AI Image Generators)

Khi yêu cầu AI sinh asset hoặc sprite sheet, áp dụng cấu trúc chuẩn hóa tiếng Anh:

```text
[TÊN CHIÊU THỨC HOẶC ASSET] – VFX ASSET CREATION
Subject: [Mô tả chủ thể chính: Thần Long, Cự Kiếm, Pháp Trận, Vết Nứt...]
Style: Premium 2.5D fantasy auto-chess game VFX, Vietnamese mythological aesthetic (Dong Son / Later Le / Tay Son).
Perspective: 2.5D isometric view matching game board floor (for decals: elliptical aspect ratio 1.72:1; for strikes: vertical/diagonal downward orientation).
Color Palette: [Xác định rõ mã màu chính, ví dụ: Royal Gold #ffd700, Celestial Cyan #22d3ee, Emerald Jade #10b981].
Lighting: Intense glowing core fading into soft transparent aura edges. Clear readable silhouette.
Background: Isolated on a PURE SOLID BLACK background (RGB 0,0,0) for clean alpha cutout and screen/additive blending.
Strict Constraints: NO background environment, NO ground shadows, NO text, NO watermarks, NO cropped parts, NO western fantasy clichés.
```

---

## 6. Công Cụ Hỗ Trợ Kỹ Thuật (Tooling & Automation)

### ①. Python Utility: `scripts/process_vfx.py`
Tự động tách nền đen sang kênh Alpha RGBA trong suốt, tự động crop bounding box, resize chuẩn kích thước AoE ô cờ và xuất WebP:
```bash
python .agents/skills/vfx-asset-creation/scripts/process_vfx.py \
    path/to/raw_output.jpg \
    frontend/img/fx/skill-asset.webp \
    --width 512 --thresh 16.0 --quality 88
```
Tùy chọn tách riêng 2 lớp Color & Light:
```bash
python .agents/skills/vfx-asset-creation/scripts/process_vfx.py \
    path/to/raw_output.jpg \
    frontend/img/fx/skill-asset.webp \
    --width 512 --split
```

### ②. Lightweight Canvas Runtime: `runtime/beanfx.js`
Bộ phát hoạt ảnh canvas 2D siêu nhẹ (~200 dòng code ES Module) hỗ trợ đọc Sprite Sheet, tự động tính toán Heading theo góc bắn, căn chỉnh Pivot, xử lý Hit Timing, Freeze và Camera Shake:
```javascript
import { loadFx, createFx } from "./runtime/beanfx.js";
const fxData = await loadFx("fx/thuan_thien.json");
const fx = createFx(fxData, { x: 300, y: 250, onHit: (h) => shake(h.shake, h.freeze) });
```

---

## 7. Checklist Kiểm Thử Asset VFX Trước Khi Đưa Vào Game
- [ ] **Phân tầng hiển thị:** Layer 1 (pháp trận/xoáy nước) đã gắn vào `#zl` để nằm dưới chân tướng & quái chưa?
- [ ] **Kích thước AoE:** Kích thước hiển thị đã khớp chính xác với bán kính ô cờ ($r \times 2 \times \text{cell\_size}$) chưa?
- [ ] **Quy tắc 5% Dissolve:** Frame cuối cùng có biến mất êm dịu không bị giật tắt phụt không?
- [ ] **Contact Frame:** Đã đồng bộ đúng mili-giây va chạm với `hitstop`, `shake` và `ringFx` chưa?
- [ ] **Tối ưu WebP:** Dung lượng mỗi file asset đã được nén tối ưu dưới $150\text{ KB}$ chưa?
- [ ] **Đồng bộ CDN:** Đã commit lên GitHub và purge cache jsDelivr chưa?
