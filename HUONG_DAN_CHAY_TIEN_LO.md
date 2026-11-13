# HƯỚNG DẪN KHỞI CHẠY GAME TIÊN LỘ: VẠN GIỚI TRANH PHONG

## 1. Giới Thiệu
Gói mã nguồn này chỉ chứa toàn bộ các thành phần của phân hệ **Tiên Lộ: Vạn Giới Tranh Phong (Xianxia RPG System)**, hoàn toàn độc lập và không chứa các phân hệ cờ tướng Kỳ Biến hay cờ Tam Quốc Giang Hồ.

Hệ thống bao gồm:
1. **Frontend Web App (`frontend/`)**:
   - `tien-lo.html`: Giao diện Wuxia/Xianxia phong cách Tiên Hiệp cổ phong, tích hợp HUD nhân vật, Bảng nhiệm vụ, Bách Thú Đồ Giám, Đấu Trường, Tông Môn, Tổ Đội & Chiến Trường Bí Cảnh Co-op.
   - `tienlo-engine.js`: Engine điều phối toàn bộ game tu tiên (Bát Hoang 3 phân khu, Turn-based battle, Luyện Đan, Luyện Khí, Idle cultivation, Tiêu cục, v.v.).
   - `tienlo-coop.js`: Mô-đun Socket.IO Client + Party System UI + Realtime Co-op Dungeon UI (Server-authoritative, OCC versioning, Reconnect resilience).
   - `data/xianxia/` & `assets/xianxia/`: Toàn bộ 9 tệp dữ liệu JSON và tài nguyên hình ảnh (avatars, banners, monsters, items, events).
2. **Backend Server (`backend/`)**:
   - 12 phân hệ REST APIs: World, Bestiary, Events, Crafting, Quests, Agency, Gameplay, Leaderboard, Chat, Guilds, Party, Dungeons.
   - 2 Socket.IO namespaces: `/xianxia-chat` (Truyền Âm Các) & `/xianxia-dungeon` (Tổ Đội & Bí Cảnh Co-op).
   - Máy chủ `tienlo-server.js` chạy độc lập.

---

## 2. Cách Khởi Chạy Nhanh (1 Phút)

### Bước 1: Cài đặt thư viện phụ thuộc (nếu chưa cài)
```bash
cd backend
npm install
```

### Bước 2: Khởi chạy máy chủ Tiên Lộ
```bash
node tienlo-server.js
```
*(Hoặc chạy qua máy chủ chính `npm start`)*

### Bước 3: Mở trình duyệt trải nghiệm
Truy cập:
👉 **http://localhost:3000/tien-lo.html** (hoặc http://localhost:3000)

---

## 3. Cấu Trúc Các Tệp Tin

```
tien_lo/
├── frontend/
│   ├── tien-lo.html                      # Trang giao diện chính của game Tiên Lộ
│   ├── tienlo-engine.js                  # Engine JavaScript điều phối thế giới tu tiên
│   ├── tienlo-coop.js                    # Mô-đun Tổ Đội & Bí Cảnh Realtime Co-op
│   ├── data/xianxia/                     # 9 tệp dữ liệu JSON thế giới, quái, nhiệm vụ
│   └── assets/xianxia/                   # Tài nguyên hình ảnh, avatar, banner, bảo vật
├── backend/
│   ├── tienlo-server.js                  # Máy chủ Express + Socket.IO độc lập chạy riêng cho Tiên Lộ
│   ├── package.json                      # Danh sách thư viện phụ thuộc
│   ├── tsconfig.json                     # Cấu hình biên dịch TypeScript
│   ├── prisma/schema.prisma              # Schema CSDL chứa các bảng Tiên Lộ
│   ├── src/                              # Mã nguồn TypeScript gốc
│   │   ├── controllers/xianxia/          # Controllers (Gameplay, Leaderboard, Guild, Party, Dungeon, PvP)
│   │   ├── routes/xianxia/               # 12 router REST API
│   │   ├── services/xianxia/             # 17 service nghiệp vụ tu chân
│   │   ├── socket/                       # Socket.IO handlers (Chat & Dungeon Co-op)
│   │   ├── data/xianxia/                 # Dữ liệu JSON thế giới
│   │   ├── types/xianxia.ts              # Định nghĩa kiểu dữ liệu Cảnh giới, Thể lực...
│   │   └── tests/                        # Toàn bộ bộ kiểm thử phân hệ Tiên Lộ
│   └── dist/                             # Bản biên dịch JavaScript sẵn sàng chạy
├── docs/                                 # Toàn bộ tài liệu thiết kế & báo cáo nghiệm thu
│   ├── wuxia_mechanics_bible.md          # Kinh thư thiết kế cơ chế Tiên Lộ
│   ├── wuxia_reference/                  # Dữ liệu tham khảo cơ chế thám hiểm
│   └── M4_*.md                           # Báo cáo các giai đoạn M4.1 - M4.3.3D.1
└── HUONG_DAN_CHAY_TIEN_LO.md             # Tệp hướng dẫn này
```

---

## 4. Chạy Kiểm Thử Độc Lập Cho Tiên Lộ (Unit & Integration Tests)
Để xác minh 100% các phân hệ hoạt động hoàn hảo:
```bash
cd backend
node dist/tests/xianxiaWorld.test.js
node dist/tests/xianxiaBestiary.test.js
node dist/tests/xianxiaEvents.test.js
node dist/tests/xianxiaCrafting.test.js
node dist/tests/xianxiaQuest.test.js
node dist/tests/xianxiaAgency.test.js
node dist/tests/xianxiaM3Progression.test.js
node dist/tests/xianxiaM4Leaderboard.test.js
node dist/tests/xianxiaM4Pvp.test.js
node dist/tests/xianxiaM4Chat.test.js
node dist/tests/xianxiaM4Guild.test.js
node dist/tests/xianxiaM4Party.test.js
node dist/tests/xianxiaM4Dungeon.test.js
node dist/tests/xianxiaM4SocketDungeon.test.js
node dist/tests/xianxiaM4CoopFrontend.test.js
node dist/tests/xianxiaFrontendIntegration.test.js
```
Toàn bộ kiểm thử đều hoạt động độc lập và đạt chuẩn an toàn 100%.
