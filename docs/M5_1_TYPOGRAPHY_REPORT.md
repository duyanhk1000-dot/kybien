# M5.1 — FOUNDATION & TYPOGRAPHY ACCEPTANCE REPORT
> Báo cáo nghiệm thu Bước M5.1: Thiết lập Hệ thống Font chữ Kiếm hiệp Cổ phong & Bảng màu Wuxia Logs cho phân hệ Tiên Lộ.

---

## 1. Thông tin thực thi
- **Mã phân hệ**: M5.1 — Foundation & Typography
- **Kỹ sư thực hiện**: Antigravity (Maker & Architect)
- **Đơn vị kiểm định độc lập**: Claude Code (Tech Lead & Checker)
- **Trạng thái**: SẴN SÀNG NGHIỆM THU (READY FOR AUDIT)

---

## 2. Các thay đổi kỹ thuật cốt lõi

### 2.1. Cấu hình Typography Kiếm hiệp Cổ điển (Google Fonts)
Tích hợp bộ 3 phông chữ chuẩn Kiếm hiệp / Tiên Hiệp:
1. `'Cinzel'` (weights 600, 700, 900): Dành cho số la mã, huy hiệu cổ điển, chữ số thuộc tính uy nghi.
2. `'Noto Serif TC'` (weights 400, 600, 700, 900): Dành cho thư pháp Hán Việt, tiêu đề phân khu, cảnh giới tu vi, tên công pháp thần thông.
3. `'Be Vietnam Pro'` (weights 300, 400, 500, 600, 700): Đảm bảo 100% tiếng Việt có dấu sắc nét, mượt mà, không vỡ layout hoặc lỗi tofu.

```html
<!-- Google Fonts: Be Vietnam Pro, Noto Serif TC & Cinzel (Wuxia Classical Swordsman Typography) -->
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Cinzel:wght@600;700;900&family=Noto+Serif+TC:wght@400;600;700;900&display=swap" rel="stylesheet"/>
```

CSS Variables:
```css
--font-body: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-serif: 'Noto Serif TC', 'Cinzel', serif;
--font-title: 'Noto Serif TC', 'Cinzel', serif;
```
Và quy tắc toàn cục:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-title);
  letter-spacing: 0.04em;
}
```

### 2.2. Bảng màu Wuxia Logs (Color Palette Tokens)
Thiết lập đầy đủ 5 sắc độ Wuxia chuẩn mực:
1. **Trắng ngà cổ phong (Parchment Ivory)**:
   - `--parchment-100: #faf6ee`
   - `--parchment-200: #f4ede2`
   - `--parchment-300: #e2d7c5`
2. **Đen mực tàu (Ink-wash Charcoal)**:
   - `--bg-canvas: #07090b`
   - `--bg-surface: rgba(16, 20, 26, 0.82)`
   - `--bg-surface-elevated: rgba(24, 29, 39, 0.92)`
3. **Đỏ chu sa (Cinnabar Crimson)**:
   - `--crimson-700: #991b1b`
   - `--crimson-600: #dc2626`
   - `--crimson-500: #ef4444`
   - `--crimson-400: #f87171`
   - `--crimson-glow: rgba(220, 38, 38, 0.28)`
4. **Vàng hoàng kim / Đồng thau (Antique Gold & Bronze)**:
   - `--gold-600: #d97706`
   - `--gold-500: #f59e0b`
   - `--gold-400: #fbbf24`
   - `--gold-glow: rgba(245, 158, 11, 0.28)`
5. **Lục bảo thiên thanh (Celestial Jade)**:
   - `--jade-600: #059669`
   - `--jade-500: #10b981`
   - `--jade-400: #34d399`
   - `--jade-glow: rgba(16, 185, 129, 0.28)`

### 2.3. Lớp tiện ích Kiếm Hiệp (Wuxia Utility Classes)
- `.font-wuxia-title`: Áp dụng font thư pháp tiêu đề với khoảng cách ký tự nới rộng `0.06em`.
- `.font-wuxia-serif`: Thừa hưởng font serif cổ phong.
- `.text-parchment`: Màu chữ giấy da ngà cổ kính.
- `.text-wuxia-gold`: Chữ màu vàng kim phát sáng ánh hào quang.
- `.text-wuxia-jade`: Chữ màu lục bảo phát sáng ngọc thạch.
- `.text-wuxia-crimson`: Chữ màu đỏ chu sa cảnh báo ma đạo.

---

## 3. Kết quả Kiểm thử & Tính nhất quán (Consistency)

| Hạng mục kiểm tra | Lệnh / Thao tác | Kết quả |
| :--- | :--- | :--- |
| **Kiểm tra cú pháp JS Frontend** | `node --check frontend/tienlo-engine.js; ...` | **PASS (0 syntax errors)** |
| **Kiểm tra Token CSS trong HTML** | Node inspection script | **Đầy đủ 100% token & font imports** |
| **Kiểm thử hồi quy Frontend** | `npx tsx backend/src/tests/xianxiaM4WorldBossFrontend.test.ts` | **PASS 10/10 test cases (100%)** |
| **Độ tương thích hiển thị tiếng Việt** | UTF-8 rendering test | **100% không lỗi font / không tofu** |
