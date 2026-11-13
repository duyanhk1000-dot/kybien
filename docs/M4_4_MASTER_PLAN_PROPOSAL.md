# ĐỀ XUẤT KẾ HOẠCH TỔNG HỢP M4.4
## TOÀN DÂN TRẢM MA (WORLD BOSS REALTIME) & PRODUCTION HARDENING
### DỰ ÁN: TIÊN LỘ: VẠN GIỚI TRANH PHONG

---

### I. BỐI CẢNH & MỤC TIÊU M4.4

Sau khi hoàn thành và nghiệm thu độc lập M4.3.3 (Hệ thống Tổ Đội & Bí Cảnh Co-op Server-Authoritative qua Socket.IO đạt 100% test cases), hệ thống đã có nền tảng realtime vững chắc.

Tuy nhiên, theo kết quả khảo sát và đánh giá kỹ thuật của Claude Code:
1. **Frontend:** Giao diện tối ưu rất tốt trên Desktop nhưng thiếu Responsive cho Mobile/Tablet (chiếm >60% người chơi web game).
2. **Hạ tầng Production:** Cần gia cố bảo mật (Rate Limiting chống spam socket/API, CORS bảo vệ chặt, Logging có cấu trúc thay vì console thô sơ).
3. **Gameplay Đỉnh Cao:** Cần một sự kiện cộng đồng quy mô toàn server để gắn kết Tông Môn và người chơi: **Ma Hoàng Xuất Thế (World Boss Realtime)**.

---

### II. NỘI DUNG KẾ HOẠCH TỔNG HỢP (MASTER PLAN PROPOSAL)

#### PHẦN 1: PRODUCTION HARDENING & MOBILE RESPONSIVE (HẠ TẦNG & GIAO DIỆN)
1. **Responsive Mobile UI cho Toàn Bộ Tiên Lộ:**
   - Bổ sung Media Queries CSS Wuxia cho viewport dưới 768px và 480px.
   - Thanh điều hướng Mobile (Bottom Navigation Bar / Floating Action Menu).
   - Tối ưu kích thước chạm (Touch target >= 44px) cho các nút xuất chiêu, đả tọa, chuyển tab.
   - Màn hình Bí cảnh `#dungeon-combat-screen` và Modal Tổ Đội `#party-modal` tự động co giãn 1 cột trên màn hình dọc điện thoại.
2. **Gia Cố Bảo Mật & Ổn Định Máy Chủ:**
   - Thêm middleware Rate Limiting (chống DDoS / spam click API).
   - Rate limiting tầng Socket.IO (chặn spam socket event vượt ngưỡng 2 chiêu/giây).
   - Bộ lọc xử lý lỗi tập trung và logging có cấu trúc.

#### PHẦN 2: PHÂN HỆ WORLD BOSS — MA HOÀNG XUẤT THẾ (GAMEPLAY CO-OP TOÀN SERVER)
1. **Cơ Chế Máy Chủ (Server-Authoritative World Boss):**
   - Boss Thế Giới (Ví dụ: *Xích Diễm Ma Long* hoặc *Hắc Ám Ma Tôn*) sở hữu lượng Khí Huyết khổng lồ (ví dụ: 10.000.000 HP).
   - Sự kiện kích hoạt theo khung giờ cố định hoặc người chơi triệu hồi.
   - Toàn bộ tu sĩ trong server đều có thể tham chiến cùng lúc.
   - Máy chủ ghi nhận sát thương tích lũy của từng người chơi theo cơ chế nguyên tử (Atomic Counter).
2. **Realtime Broadcast & Bảng Xếp Hạng Sát Thương:**
   - Namespace Socket `/xianxia-worldboss` phát thanh HP Boss toàn server định kỳ mỗi giây.
   - Top 10 sát thương cao nhất được vinh danh trực tiếp trên bảng vàng thời gian thực.
3. **Cơ Chế Phần Thưởng Xếp Hạng (Ranked Rewards & Participation):**
   - Thưởng kết liễu (Last Hit Bonus).
   - Thưởng theo xếp hạng Top sát thương (Top 1, Top 2-3, Top 4-10).
   - Thưởng tham gia cho toàn thể tu sĩ đã góp ít nhất 1 đòn đánh.
   - Bảo vệ kép Idempotency chống nhận thưởng đúp.

---

### III. YÊU CẦU DÀNH CHO CLAUDE CODE (CHECKER & TECH LEAD)

Kính chuyển Tech Lead **Claude Code** xem xét đề xuất kế hoạch tổng hợp này:
1. Đánh giá tính khả thi và độ ưu tiên của các hạng mục trên.
2. Phân rã (Deconstruct) Kế hoạch Tổng hợp này thành các **Bước nhỏ (Micro-steps: M4.4A, M4.4B, M4.4C...)** có tính độc lập cao, thứ tự trước sau hợp lý.
3. Với mỗi bước nhỏ, hãy xác định rõ:
   - **Mục tiêu kỹ thuật cụ thể.**
   - **Tệp mã nguồn liên quan cần tạo/sửa.**
   - **Tiêu chuẩn nghiệm thu (Acceptance Criteria / Definition of Done).**
   - **Phương pháp kiểm thử độc lập.**
4. Gửi lại danh sách các bước đã phân tách để Antigravity bắt đầu triển khai code cho Bước 1.
