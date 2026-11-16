# Bộ Quy Chuẩn Tạo Hình Hoạt Ảnh Kỹ Năng (VFX Craft Gates)
### Tham chiếu từ: BeanFX Engine & Dự Án Kỳ Biến (Cổ Huyền Sử)

Tài liệu này quy định các tiêu chuẩn bắt buộc khi thiết kế, sinh ảnh AI hoặc vẽ hoạt ảnh chiêu thức (VFX Sprite Sheet) cho game.

---

## 1. Chiến Lược "Peak First" (Thiết Kế Frame Đỉnh Trước)

* **Nguyên tắc:** Không bao giờ bắt đầu vẽ từ Frame 1 một cách mù mờ. Luôn tạo và chốt **Frame Đỉnh (Peak Pose / Master Frame)** trước tiên.
* **Định nghĩa Peak Frame:** Là thời điểm hiệu ứng đạt quy mô, năng lượng, ánh sáng và độ mở rộng cực đại (ví dụ: cự kiếm cắm ngập đất bùng nổ sóng kiếm khí, đầu rồng vươn mình há miệng gầm vang uy dũng nhất).
* **Nội suy các trạng thái phái sinh:**
  - **Tích tụ (Anticipation / Wind-up):** Chiếm khoảng $15 - 25\%$ tổng thời lượng. Lấy các điểm gốc từ Peak Frame tụ dần về tâm. Điểm phát sáng cốt lõi (Hot Core) phải xuất hiện ngay từ Frame 0 để mắt người chơi có điểm neo thị giác.
  - **Cao trào (Peak / Strike):** $1 - 2$ frames cực sáng, kích thước lớn nhất.
  - **Tiêu tán (Dissolve / Recovery):** Chiếm $50 - 65\%$ thời lượng. Năng lượng tan biến thành các hạt nhỏ và tàn lửa/bọt nước.

---

## 2. Quy Tắc 5% Dissolve (Biến Mất Êm Dịu)

* Tuyệt đối không để hiệu ứng tắt phụt đột ngột (Pop-off) hoặc kết thúc bằng một frame trống rỗng lãng phí bộ nhớ.
* **Tiêu chuẩn:** Ở frame cuối cùng của chiêu thức, mật độ năng lượng/số pixel phát sáng chỉ được giữ lại **tối đa $5\%$** so với Peak Frame (vài tàn lửa nhỏ, vệt khói mỏng hoặc hạt kiếm khí tan biến).

---

## 3. Quy Tắc 3 Kích Cỡ Hạt Năng Lượng (3-Scale Particle Grouping)

* Khi vẽ các thành phần lặp lại (tia lửa, mảnh đá văng, bọt nước, mũi kiếm khí nhỏ, cánh hoa sen):
  * **Vài hạt lớn (Big):** Đóng vai trò điểm nhấn chính (Focal points).
  * **Một số hạt vừa (Medium):** Tạo cấu trúc lan tỏa.
  * **Nhiều hạt nhỏ (Small):** Tạo bụi năng lượng, tàn dư.
* **Cấm:** Không dàn hàng các hạt có cùng kích thước và cùng khoảng cách đều đặn, vì sẽ khiến hiệu ứng trông giống "giấy dán tường" vô hồn.

---

## 4. Đồng Bộ Khung Hình Va Chạm & Chấn Động (Contact Frame & Hit-Stop)

* **Contact Frame:** Là frame chính xác mà đòn đánh chạm vào mục tiêu hoặc mặt đất (ví dụ: mũi kiếm chạm đất ở $380\text{ ms}$).
* Tại đúng Contact Frame, bắt buộc phải kích hoạt đồng thời 4 hiệu ứng chấn động:
  1. **Khựng hình (Hit-Stop / Freeze):** Đóng băng chuyển động trong $50 - 90\text{ ms}$ để nhấn mạnh lực đánh khủng khiếp.
  2. **Rung lắc camera (`shake(amplitude, duration)`):** Rung mạnh theo hướng của đòn đánh.
  3. **Chớp sáng trắng (`flash`):** Chớp trắng mục tiêu hoặc tâm vụ nổ trong $1 - 2$ frame.
  4. **Sóng chấn động lan tỏa (`ringFx`):** $2 - 3$ vòng tròn xung kích mở rộng dần từ tâm.

---

## 5. Quy Chuẩn Thể Hiện Vật Liệu & Phối Màu (Materials & Values)

* **Đất đá, sắt thép, gỗ, xương:**
  - Nằm ở dải màu trung tính và tối của bảng màu.
  - Mặt đón sáng (thường là phía trên bên trái) sáng hơn 1 nấc; viền xa tối nhất; chỉ điểm highlight cực sáng ở vài gờ cạnh sắc bén.
  - Nếu tô toàn bộ vật liệu bằng màu trắng/vàng sáng rực, khối đá/thép sẽ bị hiểu nhầm thành bóng đèn hoặc mặt trăng.
* **Ngọn lửa & Năng lượng nhiệt:**
  - Tâm lõi nóng nhất (Trắng / Vàng nhạt) $\rightarrow$ Thân lửa (Cam / Đỏ) $\rightarrow$ Viền ngoài (Đỏ sẫm / Tàn khói đen). Không viền đen quanh ngọn lửa.
* **Kiếm khí & Lôi điện:**
  - Lõi tia sét màu trắng tinh; viền ngoài màu cyan/vàng kim; có các nhánh phụ răng cưa ngắn và các đốm sao lấp lánh (Sparkle) tại điểm tiếp xúc.
