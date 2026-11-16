# Kỹ Thuật Ánh Sáng, Phát Quang & Phân Tách Lớp (Light, Bloom & Layering)
### Tham chiếu từ: BeanFX Engine & Dự Án Kỳ Biến

---

## 1. Kiến Trúc Phân Tách 2 Lớp: Màu Gốc & Ánh Sáng (Color vs Light Layer)

Thay vì xuất 1 ảnh gộp chung toàn bộ hào quang (dễ bị bết dính và khó kiểm soát trên các nền bản đồ khác nhau), hệ thống hỗ trợ phân tách làm 2 lớp:

| Lớp | Ký hiệu | Chế độ hòa trộn (Blend Mode) | Vai trò |
| :--- | :--- | :--- | :--- |
| **Color Layer** | `_color.png` / `_color.webp` | `source-over` (Normal) | Thể hiện hình thể, khối vật thể, đường viền, chi tiết sắc nét của chủ thể (kiếm, rồng, đá, cuộn hịch). |
| **Light Layer** | `_light.png` / `_light.webp` | `lighter` (Additive) hoặc `screen` | Thể hiện vầng sáng tỏa ra (Bloom), hào quang mềm mại xung quanh vật thể phát sáng. |

### Lợi ích:
* **Tương thích mọi loại nền:** Trên nền tối, ánh sáng rực rỡ tự nhiên; trên nền sáng, không bị bệt quầng xám/đen xung quanh.
* **Tùy chỉnh linh hoạt (`lightGain`):** Khi ở chế độ tiết kiệm pin hoặc màn hình điện thoại yếu, engine có thể giảm `lightGain = 0.5` hoặc tắt lớp light mà hình ảnh vẫn rõ ràng sắc nét.

---

## 2. Tiêu Chuẩn Mức Độ Phát Quang (Glow Levels)

| Cấp độ (Level) | Độ sáng lõi (Core $k$) | Bán kính vầng sáng (Pool Radius $r$) | Ngữ cảnh sử dụng |
| :--- | :--- | :--- | :--- |
| **Subtle (Nhẹ)** | $0.25 - 0.50$ | $r \times 2.0$ | Kỹ năng phụ, đòn đánh cơ bản, bùa chú hồi phục nhỏ, đốm sáng tàn tro. |
| **Medium (Vừa)** | $0.30 - 0.70$ | $r \times 2.5$ | Chiêu thức diện rộng thông thường của tướng $2 - 3$ vàng, vệt chém kiếm khí. |
| **Strong (Mạnh)** | $0.70 - 1.00$ | $r \times 3.0$ | Tuyệt chiêu Tối Thượng (Ultimate 4 & 5 Vàng: Thuận Thiên Kiếm, Long Triều, Sát Thát). |

---

## 3. Độ Trong Suốt & Tản Sáng (Clarity Guidelines)

* **Clear (Sắc nét - Mặc định cho Kỳ Biến):** Độ bao phủ ánh sáng chỉ chiếm $15 - 25\%$ diện tích frame. Giữ khoảng không gian tối giữa các chi tiết phát sáng để đòn đánh có điểm nhấn rõ rệt, không biến thành một đám sương mù mờ mịt.
* **Balanced (Cân bằng):** Có khói/sương mỏng bao quanh ở mức alpha $0.3 - 0.5$. Thích hợp cho chiêu tạo đầm lầy, sương mù của Thủy Tinh hoặc Sơn Tinh.
* **Hazy (Mù mịt):** Chỉ dùng cho các hiệu ứng bão tuyết hoặc lốc cát sa mạc diện rộng.
