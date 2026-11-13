# QUY CHẾ PHỐI HỢP PHÁT TRIỂN GAME TIÊN LỘ
## CƠ CHẾ ĐÔI BẠN CÙNG TIẾN: ANTIGRAVITY & CLAUDE CODE

---

### 1. PHÂN CÔNG VAI TRÒ & TRÁCH NHIỆM

Hệ thống phát triển game Tiên Lộ: Vạn Giới Tranh Phong từ giai đoạn này được vận hành bởi 2 nhân sự AI độc lập theo mô hình **Maker - Checker (Người Thực Hiện - Người Kiểm Toán)**:

| Tiêu Chí | Antigravity (Maker & Architect) | Claude Code (Tech Lead & Checker) |
| :--- | :--- | :--- |
| **Vai trò chính** | Kiến trúc sư hệ thống & Kỹ sư triển khai chính | Trưởng nhóm kỹ thuật & Kiểm toán viên chất lượng độc lập |
| **Nhiệm vụ 1** | Khảo sát hiện trạng, xây dựng Kế hoạch Tổng hợp (Master Plan / SRS) cho từng Milestone. | Đọc Kế hoạch Tổng hợp, mổ xẻ và phân tách thành các bước nhỏ (Micro-steps) kèm tiêu chuẩn nghiệm thu cụ thể. |
| **Nhiệm vụ 2** | Trực tiếp viết code, tạo file, cấu hình DB, sửa lỗi, biên dịch và chạy kiểm thử tự động. | Kiểm tra độc lập (Independent Audit) code, schema, kiểm thử và báo cáo sau khi Antigravity code xong. |
| **Nhiệm vụ 3** | Tiếp nhận phản hồi / bug reports từ Claude, thực hiện fix lỗi cho đến khi đạt chuẩn. | Đưa ra yêu cầu sửa lỗi chi tiết (nếu có lỗi) hoặc cấp phê duyệt **PASS** để chốt bước. |
| **Nguyên tắc vàng** | Không tự ý chuyển bước nếu Claude chưa đồng ý và phê chuẩn. | Không phê chuẩn hời hợt; kiểm toán khắt khe trên bằng chứng thực thi thực tế. |

---

### 2. QUY TRÌNH VÒNG LẶP 5 BƯỚC (5-STEP DEVELOPMENT LOOP)

```
[BƯỚC 1: ANTIGRAVITY] Lập Kế hoạch Tổng hợp Milestone
          │
          ▼
[BƯỚC 2: CLAUDE CODE] Phân rã Kế hoạch thành các Bước nhỏ (Micro-steps) & Tiêu chí nghiệm thu
          │
          ▼
    ┌───► [BƯỚC 3: ANTIGRAVITY] Triển khai code & chạy test nội bộ cho Bước hiện tại
    │           │
    │           ▼
    │     [BƯỚC 4: CLAUDE CODE] Kiểm toán độc lập chất lượng code & kết quả test
    │           │
    │           ├─► Có lỗi / Chưa đạt: Gửi yêu cầu sửa lỗi ──┐
    │           │                                             │
    │           └─► ĐẠT YÊU CẦU: Cấp phê duyệt PASS ──────────┤
    │                                                         ▼
    └───────────────────────────────────────────── [BƯỚC 5] Lặp lại hoặc Chuyển bước tiếp theo
```

---

### 3. QUY ƯỚC AN TOÀN BẮT BUỘC (SAFETY INVARIANTS)
1. **Bảo tồn dữ liệu:** Tuyệt đối không reset CSDL, không xóa tài khoản người chơi thật. Mọi test phải tự dọn dữ liệu theo ID.
2. **Authoritative & Concurrency:** Mọi logic trừ tài nguyên/chiến đấu phải nằm ở Backend; xử lý race condition bằng versioning/locking; chống nhận đúp bằng Idempotency.
3. **Thực thi trung thực:** Cả hai bên chỉ báo cáo kết quả dựa trên mã lệnh và exit code thực tế trên máy, không bịa đặt thông tin.
