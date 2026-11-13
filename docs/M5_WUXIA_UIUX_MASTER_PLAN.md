# M5 — TIÊN LỘ WUXIA UI/UX TRANSFORMATION MASTER PLAN
> Tái cấu trúc toàn diện Giao diện & Trải nghiệm người dùng Tiên Lộ theo chuẩn kiến trúc Wuxia Logs (docs/wuxia_reference & docs/wuxia_mechanics_bible.md) kết hợp Thư pháp Kiếm hiệp cổ phong.

---

## 1. Mục tiêu & Định hướng Kiến trúc

### 1.1. Mục tiêu cốt lõi
1. **Giải quyết triệt để "Dashboard Bloat"**:
   - Thay thế thanh điều hướng ngang hơn 10 nút bấm (`.wuxia-icon-nav`) và giao diện cuộn trang web dài thành **Mobile-First App Shell** (Khung dọc `max-w-xl` tập trung, tối ưu thao tác 1 tay trên điện thoại).
2. **Đồng bộ chuẩn Wuxia Logs (5 Core Tabs)**:
   - **Tab 1: [🏠 Động Phủ] (Dashboard)**: Trạng thái sinh tồn hiệp khách, tu luyện ngầm (Train), địa điểm tương tác (Places: Lò đan, Lò rèn, Tiêu cục, Chợ).
   - **Tab 2: [👤 Nhân Vật] (Character)**: Cảnh giới tu vi, Ngũ đại căn bản (Sức mạnh, Thân pháp, Thể chất, Nội lực, Ý chí), điểm tiềm năng, danh hiệu.
   - **Tab 3: [🏔️ Bát Hoang] (Exploration)**: Thám hiểm 3 phân khu theo cỗ máy sự kiện phân nhánh (Roam/Wander), nhật ký tương tác (Story logs), sàn đấu `BattleView` khi gặp quái thú.
   - **Tab 4: [📜 Công Pháp] (Skill Modal/View)**: Bảng võ học, thần thông, trang bị chiêu thức thi đấu.
   - **Tab 5: [🎒 Túi Đồ] (Inventory Modal)**: Túi trữ vật dạng lưới, kiểm soát sức chứa, trang bị và sử dụng đan dược/pháp bảo.
3. **Tích hợp tính năng Nâng cao / Nhiều người chơi (Multiplayer Hub)**:
   - Đưa **Tông Môn (Guild)**, **Tổ Đội Co-op Bí Cảnh (M4.3)**, **Toàn Dân Trảm Ma (M4.4 World Boss)**, và **Đấu Trường (PvP)** vào Menu Mở Rộng (`MenuModal` - nút `☰` góc trên) và các trigger sự kiện bối cảnh, giữ giao diện chính luôn sạch sẽ, tối giản.
4. **Kiếm hiệp Thư pháp Cổ phong (Typography & Aesthetics)**:
   - Sử dụng phông chữ kiếm hiệp cổ điển: `'Noto Serif TC'` cho toàn bộ tiêu đề, phân khu, cảnh giới, bí kíp võ học; kết hợp `'Be Vietnam Pro'` cho chỉ số, nhật ký chiến báo để đảm bảo 100% hiển thị tiếng Việt có dấu sắc nét, không lỗi font.
   - Bảng màu: Nền đen mực tàu (Ink-wash Charcoal `#090b0e`), viền ngọc lục bảo (Celestial Jade `#10b981`), ánh hổ phách hoàng kim (Antique Gold `#f59e0b`).
5. **Bảo toàn 100% Logic & Dữ liệu**:
   - Tuyệt đối không thay đổi schema database, giữ nguyên toàn bộ endpoint REST APIs và Socket.IO namespaces (`/xianxia-chat`, `/xianxia-dungeon`, `/xianxia-worldboss`).
   - Đảm bảo toàn bộ 37 bộ test suite hiện có tiếp tục PASS 100%.

---

## 2. Đề xuất Phân kỳ thực hiện (Draft Phases)

- **Phase M5.1 — Typography, Design Tokens & Wuxia Mobile App Shell**:
  - Tích hợp chuẩn font Kiếm hiệp cổ điển (`Noto Serif TC` & `Be Vietnam Pro`), bộ token Wuxia Logs (`--bg-canvas`, `--border-subtle`, `--amber-glow`, `--jade-glow`).
  - Xây dựng khung ứng dụng dọc (`#wuxia-app-shell` với `max-w-xl mx-auto min-h-screen`), thanh đỉnh `GlobalUserBar` và thanh đáy `BottomNavBar` (5 Tab chuẩn).
- **Phase M5.2 — Dashboard Động Phủ & Nhân Vật (Tabs 1 & 2)**:
  - Tái cấu trúc Tab Động Phủ: Hiển thị thanh máu/thể lực/tinh thần, bế quan tu luyện (AFK Train), các cơ sở chế tác (Lò Luyện Đan, Lò Luyện Khí).
  - Tái cấu trúc Tab Nhân Vật: Ngũ đại căn bản, cảnh giới tu chân, huy hiệu thông báo điểm tiềm năng chưa cộng.
- **Phase M5.3 — Bát Hoang Thám Hiểm & Sàn Đấu BattleView (Tab 3)**:
  - Thiết kế lại `ExplorationView` theo phong cách Wuxia Logs: Nhật ký hành trình câu chuyện (Story log), các nút lựa chọn kỳ ngộ phân nhánh.
  - Tích hợp sàn đấu `BattleView` tinh gọn hai bên đối kháng với nhật ký hiệp đấu chi tiết.
- **Phase M5.4 — Modals: Túi Đồ, Công Pháp & Menu Mở Rộng Multiplayer (Tabs 4, 5 & Menu)**:
  - Modal Túi đồ dạng lưới (`InventoryModal`) và Modal Bí kíp (`SkillModal`) dạng sheet trồi lên, không mất bối cảnh.
  - `MenuModal` tổng hợp: Tông Môn, Tổ Đội Bí Cảnh Co-op Realtime, Toàn Dân Trảm Ma Ma Long, Đấu Trường PvP.
- **Phase M5.5 — E2E Testing, Mobile Polish & Claude Sign-Off**:
  - Kiểm thử responsive trên các kích thước màn hình ($360\text{px}$, $390\text{px}$, $412\text{px}$, $768\text{px}$, $1024\text{px}$).
  - Chạy toàn bộ test suites frontend & backend.
  - Claude Code thẩm định độc lập và nghiệm thu cuối cùng.
