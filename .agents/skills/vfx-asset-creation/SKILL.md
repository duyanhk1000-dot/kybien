---
name: vfx-asset-creation
description: >-
  Standardized guide and workflow for creating sequential VFX sprite sheets and ability animation assets for heroes in the 2.5D auto-chess game Ky Bien. Use whenever generating, designing, or integrating skill effects (VFX) such as Long Triều Triệu Tướng (Lạc Long Quân), Thiên Mã Xung Trận (Thánh Gióng), Thuận Thiên Kiếm (Lê Lợi), etc.
---

# Quy Trình Tạo Asset Chiêu Thức & Hiệu Ứng (VFX Sprite Sheet Creation)

Tài liệu chuẩn hóa phương pháp sản xuất asset hoạt ảnh kỹ năng (Skill VFX) cho tựa game chiến thuật cờ nhân phẩm 2.5D **Kỳ Biến (Cổ Huyền Sử)**.

---

## 1. Nguyên Tắc Cốt Lõi (Core Principles)

### Kỹ thuật: VFX Sprite Sheet – Sequential Animation
* **Tính nhất quán giải phẫu (Anatomical Consistency):** Tuyệt đối **không** tạo các hình rời rạc, ngẫu nhiên độc lập. Mọi frame trong một chuỗi hoạt ảnh phải mô tả:
  * **Cùng một chủ thể** (cùng tỷ lệ, sừng, râu, vảy, màu sắc, chi tiết).
  * **Cùng một trận địa / điểm gốc thi triển** (vị trí summoning point cố định).
  * **Cùng một góc camera / phối cảnh** (isometric 2.5D cố định, không đổi góc nhìn).
  * Thể hiện ở các mốc thời điểm thời gian nối tiếp nhau.
* **Phương án sản xuất chuẩn (Anchor Reference Workflow):**
  1. **Bước 1:** Tạo một hình ảnh chủ thể hoàn chỉnh (Anchor Master) để chốt thiết kế, bảng màu và giải phẫu chuẩn.
  2. **Bước 2:** Sử dụng hình chuẩn làm reference để sinh hoặc dựng biến đổi cho từng frame chuyển động nối tiếp.
  3. **Bước 3:** Ghép các frame riêng lẻ thành một dải **Horizontal Sprite Sheet** bằng script xử lý ảnh tự động (Python/PIL) để kiểm soát kích thước, canh lề và biên cách mép chính xác tuyệt đối.

---

## 2. Kiến Trúc 3 Lớp Hiệu Ứng (3-Layer VFX System)

Mọi kỹ năng phức tạp trong game được cấu thành từ 3 lớp độc lập để tối ưu hóa hiệu năng, dễ lập trình và tái sử dụng:

| Lớp | Thành phần | Vai trò & Cách hoạt động |
| :--- | :--- | :--- |
| **Layer 1** | **Ground / Surface VFX** | Sóng biển, vòng pháp trận, xoáy nước, nứt đất, dấu vết thiêu đốt trên mặt sàn ô cờ. Cố định tại điểm gốc thi triển. |
| **Layer 2** | **Main Subject VFX** | Chủ thể chính của chiêu thức (Rồng thần, Cự kiếm hoàng kim, Ngựa thần, Mũi tên sao băng) biến chuyển tuần tự qua các frame. |
| **Layer 3** | **Energy / Particle VFX** | Các hạt năng lượng bay tản mát, giọt nước bắn tung tóe, tia sét ma thuật, hào quang phát sáng (Additive/Screen blend). |

---

## 3. Tiêu Chuẩn Phân Loại Chiêu Thức & Số Lượng Frame Toàn Game

### Bảng phân loại giai đoạn chiêu thức:
* **Triệu hồi (Summoning):** `Tụ năng lượng` $\rightarrow$ `Xuất hiện` $\rightarrow$ `Hình thành` $\rightarrow$ `Hoàn chỉnh`
* **Tấn công (Offensive / Strike):** `Khởi động (Windup)` $\rightarrow$ `Phóng chiêu (Release)` $\rightarrow$ `Va chạm (Impact)` $\rightarrow$ `Bùng nổ (Burst)`
* **Phòng thủ (Shield / Ward):** `Kích hoạt` $\rightarrow$ `Dựng lá chắn` $\rightarrow$ `Chịu đòn` $\rightarrow$ `Tan biến`
* **Hồi phục (Healing / Buff):** `Tụ sáng` $\rightarrow$ `Bao phủ` $\rightarrow$ `Hồi phục` $\rightarrow$ `Tan sáng`
* **Biến hình (Transformation):** `Tích tụ` $\rightarrow$ `Biến đổi` $\rightarrow$ `Hoàn tất`
* **Tử trận (Defeat):** `Trúng đòn` $\rightarrow$ `Sụp đổ` $\rightarrow$ `Tan biến`

### Quy chuẩn số frame theo quy mô chiêu:
* **Chiêu thức nhỏ / Đòn đánh tăng cường:** 6 frames.
* **Chiêu thức lớn / Kỹ năng diện rộng (AoE):** 8 – 12 frames.
* **Chiêu thức tối thượng (Ultimate 5 Vàng):** 16 – 24 frames (hoặc kết hợp 6 frame chủ thể + hiệu ứng hạt bổ trợ).

---

## 4. Đặc Tả Chiêu Thức Mẫu: "Long Triều Triệu Tướng" (Lạc Long Quân)

### Diễn tiến 6 Frame Tuần Tự (Timeline: 1.700 ms)
* **Frame 1 (Biển thức tỉnh - 250ms):** Mặt biển dậy sóng, vòng xoáy nước tụ năng lượng ma thuật xanh ngọc, chưa thấy rồng. Thiết lập điểm gốc cố định.
* **Frame 2 (Đầu rồng xuất hiện - 200ms):** Đầu Thủy Long khổng lồ trồi lên từ tâm vòng xoáy, râu rồng, sừng hươu vàng, mắt phát sáng, nước bắn tung tóe xung quanh.
* **Frame 3 (Cổ rồng trồi lên - 250ms):** Thân cổ uốn lượn vươn cao, nước trút xuống từ lớp vảy ngọc, nét mặt đồng nhất với Frame 2.
* **Frame 4 (Thân trên và 2 chân trước - 250ms):** Thân trên và 2 móng vuốt trước lộ diện hoàn toàn, thân uốn lượn hướng lên trời, nước cuộn trào.
* **Frame 5 (Thân dưới và 2 chân sau - 250ms):** Thân giữa và 2 chân sau trồi lên, thân rồng tạo hình xoắn ốc uyển chuyển vươn cao, đuôi rồng bắt đầu rời mặt nước.
* **Frame 6 (Rồng bay lên hoàn toàn - 500ms):** Toàn bộ thân rồng, 4 móng vuốt và đuôi cuộn vút lên trời, đầu ngẩng cao uy dũng hướng về chiến trường, dưới chân là vòng xoáy nước dữ dội.

---

## 5. Master Prompt Template (Dành cho AI Image Generators)

Khi yêu cầu AI sinh sprite sheet, sử dụng prompt tiếng Anh chuẩn hóa để đạt độ chính xác cao nhất:

```text
LONG TRIỀU TRIỆU TƯỚNG – VFX SPRITE SHEET
Create ONE horizontal VFX animation sprite sheet, containing exactly 6 sequential animation frames arranged from LEFT to RIGHT in ONE single row.
Canvas: 2048 × 512 pixels, aspect ratio 4:1.
Layout: 6 equal-sized vertical frames, each frame approximately 341 × 512 pixels.
All six frames must show the SAME continuous animation sequence of one identical mythical Vietnamese-inspired Asian Azure Dragon emerging from the ocean.

1. MAIN SUBJECT – THE AZURE DRAGON
A majestic ancient East Asian celestial sea dragon, inspired by Vietnamese dragon mythology.
Dragon characteristics:
- Long serpentine Asian dragon body, NOT a western dragon.
- Four powerful clawed legs.
- Long elegant neck and elongated dragon head.
- Two golden antler-like horns.
- Long flowing whiskers.
- Sharp glowing turquoise eyes.
- Dense overlapping cyan-blue scales.
- Pale turquoise belly scales.
- Long flowing blue-green mane.
- Glowing turquoise energy flowing between its scales.
- Extremely long flexible serpentine tail.
- No wings.
- No humanoid features.
Color palette:
Deep ocean blue, turquoise, cyan, jade green, pale aqua and subtle antique gold accents.
The dragon must look identical in every frame: same head shape, same horns, same whiskers, same scales, same legs, same colors and same body proportions.

2. ANIMATION SEQUENCE – EXACTLY 6 FRAMES
FRAME 1 – OCEAN AWAKENING: Only ocean surface visible, swirling circular waves gathering energy, central water rising, glowing particles, NO dragon visible.
FRAME 2 – DRAGON HEAD EMERGES: Head emerges from center, horns, whiskers, open mouth, water splash. Rest submerged.
FRAME 3 – NECK RISES: Long elegant curved neck pushes upward, head higher, cascading water, lower body submerged.
FRAME 4 – UPPER BODY AND FRONT LEGS: Upper torso and both front clawed legs emerge, serpentine curve, water flowing down.
FRAME 5 – HIND BODY AND REAR LEGS: Middle and lower body emerge, both hind legs visible, spiral upward, tail partially in water.
FRAME 6 – COMPLETE DRAGON ASCENSION: ENTIRE dragon fully visible above ocean, coiling majestically into sky, head commanding, tail completely separated from ocean, massive whirlpool beneath.

3. COMPOSITION AND ANIMATION CONSISTENCY
Six equal-sized frames horizontally in one row. Each frame depicts one consecutive moment in time.
Ocean summoning point remains at exactly the same coordinates. Camera angle and isometric perspective completely fixed.
Keep dragon and water inside respective frames, leaving empty margin. No overlapping adjacent frames.

4. ART STYLE
Premium 2.5D fantasy auto-chess game VFX. Vietnamese mythological fantasy aesthetic.
Dong Ho folk-art inspired outlines combined with modern fantasy game illustration.
Bold readable silhouettes, luminous turquoise magical energy, rich contrast.

5. BACKGROUND
Transparent background (alpha channel) or pure solid black background for additive/screen blending.
No environment, no mountains, no ground shadows, no background gradient.

6. STRICT NEGATIVE CONSTRAINTS
NO text, NO numbers, NO labels, NO watermarks, NO logos, NO grid lines, NO panel borders, NO frame separators, NO additional dragons, NO duplicate dragon heads, NO western dragons, NO dragon wings, NO unrelated characters, NO scenery, NO camera movement, NO perspective changes, NO inconsistent dragon anatomy, NO cropped dragon body, NO cropped tail.
```

---

## 6. Checklist Kiểm Thử Asset VFX Trước Khi Đưa Vào Code
- [ ] Tính nhất quán hình ảnh: Đầu, sừng, chi tiết thân rồng có giữ nguyên vẹn giữa các frame không?
- [ ] Tọa độ điểm gốc: Điểm tâm thi triển dưới mặt đất có bị dịch chuyển lệch sang hai bên không?
- [ ] Không dính viền: Hiệu ứng ở biên frame có bị cắt cụt (cropped) hoặc lem sang ô bên cạnh không?
- [ ] Kênh Alpha / Nền: Đã làm sạch nền đen hoặc chuyển thành PNG trong suốt chưa?
- [ ] Hiệu năng: Dung lượng WebP đã tối ưu dưới 150 KB chưa?
