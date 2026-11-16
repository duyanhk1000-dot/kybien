# Dự Án Kỳ Biến (Cổ Huyền Sử) — Hướng Dẫn Kỹ Thuật & Quy Chuẩn VFX

Dự án game cờ nhân phẩm thần thoại Việt Nam (Auto-Chess 2.5D) chạy trên nền tảng Web (HTML5/Canvas/CSS/JS).

---

## Quy Chuẩn Tạo Asset Chiêu Thức (VFX Sprite Sheet Standard)

Khi tạo hoặc nâng cấp hiệu ứng chiêu thức (VFX) cho các vị tướng, luôn tuân thủ bộ kỹ năng chuẩn hóa tại:
👉 [SKILL: vfx-asset-creation](.agents/skills/vfx-asset-creation/SKILL.md)

### Nguyên Tắc Bắt Buộc:
1. **Hoạt ảnh tuần tự (Sequential Animation):** Không tạo nhiều hình độc lập. Mỗi chiêu thức là một chuỗi frame diễn tiến liên tục của cùng một chủ thể, cùng một trận địa, cùng một góc phối cảnh isometric cố định.
2. **Quy trình Reference Anchor:** Luôn tạo 1 ảnh chủ thể chuẩn (Anchor Master) để chốt giải phẫu/màu sắc, sau đó dùng làm reference để tạo các frame chuyển động tiếp theo nhằm tránh biến dạng chi tiết (như đổi kiểu đầu, lệch sừng, đổi số chân).
3. **Kiến trúc 3 lớp (3-Layer VFX):**
   - **Layer 1 (Mặt đất/Trận địa):** Sóng biển, vòng pháp trận, nứt đất, vết cháy.
   - **Layer 2 (Chủ thể chính):** Rồng thần, kiếm khí, ngựa thần bay lượn/xung trận qua từng frame.
   - **Layer 3 (Hạt năng lượng/Ánh sáng):** Sét, bọt nước, tia lửa phát sáng hòa trộn *Screen/Additive*.
4. **Tiêu chuẩn số lượng frame:**
   - Chiêu thức nhỏ: 6 frames
   - Chiêu thức lớn: 8–12 frames
   - Chiêu thức tối thượng (Ultimate): 16–24 frames
5. **Sprite Sheet 1 hàng ngang:** Sắp xếp từ trái sang phải, kích thước chuẩn (2048×512 hoặc tỷ lệ phù hợp), biên chừa lề an toàn để không lem viền giữa các frame.
