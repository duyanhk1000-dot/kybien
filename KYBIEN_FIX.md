# Kỳ Biến — Sửa lỗi Render deploy loop (`prisma db push` đòi xóa 7 bảng)

Ngày: 2026-11-06. Repo: `duyanhk1000-dot/kybien`, nhánh `main`, commit `99a2c1b`.

## Triệu chứng

- Render build thành công (`tsc` pass, Prisma Client generate OK), nhưng `npm start`
  exit 1 rồi restart liên tục, server không bao giờ chạy.
- `https://kybien-backend.onrender.com/ping` không trả lời, UptimeRobot báo lỗi —
  không phải do UptimeRobot sai, mà do server chưa từng lên.
- `npm audit fix` trong log chỉ là cảnh báo, không phải nguyên nhân.

## Nguyên nhân gốc

`backend/package.json`:

```json
"start": "npx prisma db push && node dist/server.js"
```

`prisma db push` đồng bộ DB về đúng `prisma/schema.prisma`. Schema trong repo
chỉ có 7 model: `users, matches, puzzles, user_puzzle_progress,
puzzle_reward_logs, puzzle_defeat_logs, puzzle_sessions`.

Nhưng DB Supabase (`aws-0-ap-south-1.pooler.supabase.com:5432`) còn 7 bảng khác
không có trong schema:

| Bảng | Số dòng theo log Render |
|---|---:|
| `xianxia_battle_logs` | 4 |
| `xianxia_characters` | 19 |
| `xianxia_inventory_items` | 11 |
| `xianxia_pvp_matches` | 26 |
| `xianxia_quest_progresses` | 3 |
| `xianxia_world_boss_damages` | 1 |
| `xianxia_world_bosses` | 1 |
| **Tổng** | **65 dòng** |

`db push` muốn DROP cả 7 bảng, Prisma chặn lại vì mất dữ liệu:

> `Error: Use the --accept-data-loss flag to ignore the data loss warnings`

Vì `&&` nên `node dist/server.js` không bao giờ chạy → deploy loop.

Đã kiểm tra: **không một dòng code nào trong repo nhắc tới `xianxia`**
(backend, frontend, docs, toàn bộ lịch sử git của `schema.prisma` — 3 commit
đều không có model Xianxia). Các bảng này được tạo ngoài repo, có thể là
thử nghiệm cũ / một tính năng Tiên Hiệp chưa đưa vào code, hoặc một project
khác dùng chung DB Supabase. Không có code nào đọc chúng, nhưng dữ liệu
(19 nhân vật, 26 trận PvP...) có thể vẫn là dữ liệu thật của người chơi.

## Đã sửa (commit này)

`backend/package.json` — chỉ đổi 1 dòng, không đụng code TS:

```diff
-    "start": "npx prisma db push && node dist/server.js",
+    "start": "node dist/server.js",
```

Đồng thời giữ `prisma db push` làm lệnh **thủ công** (`npm run db:sync`,
`npm run prisma:push`) — chỉ chạy khi bạn chủ động muốn đồng bộ schema,
không chạy mỗi lần Render restart.

Lý do: `db push` / migrate là bước deploy, không phải bước khởi động.
Server restart (Render free tier restart thường xuyên) không được phép
đụng tới schema, càng không được phép xóa bảng.

## TUYỆT ĐỐI KHÔNG làm điều này

```bash
npx prisma db push --accept-data-loss   # ❌ XÓA VĨNH VIỄN 7 bảng + 65 dòng
```

Đừng thêm `--accept-data-loss` vào `start`. Nếu 7 bảng Xianxia còn cần,
đó là mất dữ liệu không khôi phục được.

## Deploy lại trên Render (5 phút)

1. Push commit này lên GitHub (`main`).
2. Render → service `kybien-backend` → **Manual Deploy → Deploy latest commit**.
   Không cần đổi Build Command (vẫn `npm install && npm run build` hoặc như cũ).
   Không cần đổi Start Command nếu Render đang dùng `npm start` trong
   `backend/` — nếu Start Command trong dashboard đang ghi đè là
   `npx prisma db push && node dist/server.js`, sửa nó thành `npm start`.
3. Đợi log hiện `🚀 KỲ BIẾN CHESS BACKEND IS RUNNING` và `PORT: ...`
   (Render tự set `PORT`, không phải 4000).
4. Kiểm tra: `curl https://kybien-backend.onrender.com/ping`
   phải trả `{"status":"online",...}`. UptimeRobot sẽ xanh lại sau lần
   ping kế tiếp (mặc định 5 phút).

## Sau khi server đã lên — quyết định về 7 bảng Xianxia

Chọn **một** trong hai, sau khi đã backup. Đừng làm khi server đang lỗi.

### Bước 0 (bắt buộc trước cả hai): backup trong Supabase

Supabase Dashboard → SQL Editor, chạy và tải kết quả về, hoặc dùng
`pg_dump` với `DATABASE_URL` (chế độ transaction / pooler):

```sql
-- Kiểm tra nhanh 7 bảng còn gì
SELECT 'xianxia_battle_logs' t, COUNT(*) FROM xianxia_battle_logs
UNION ALL SELECT 'xianxia_characters', COUNT(*) FROM xianxia_characters
UNION ALL SELECT 'xianxia_inventory_items', COUNT(*) FROM xianxia_inventory_items
UNION ALL SELECT 'xianxia_pvp_matches', COUNT(*) FROM xianxia_pvp_matches
UNION ALL SELECT 'xianxia_quest_progresses', COUNT(*) FROM xianxia_quest_progresses
UNION ALL SELECT 'xianxia_world_boss_damages', COUNT(*) FROM xianxia_world_boss_damages
UNION ALL SELECT 'xianxia_world_bosses', COUNT(*) FROM xianxia_world_bosses;
```

### Phương án A — Giữ lại (khuyên dùng nếu không chắc)

Đưa 7 bảng vào schema bằng introspection, để `db push` sau này không đòi xóa:

```bash
cd backend
npx prisma db pull   # thêm model Xianxia* vào schema.prisma từ DB thật
git diff prisma/schema.prisma   # rà lại rồi mới commit
```

Sau đó `db push` sẽ là no-op với 7 bảng này.

### Phương án B — Xóa hẳn (chỉ khi chắc chắn đó là dữ liệu rác / thử nghiệm)

1. Backup xong (bước 0).
2. Chạy **một lần, thủ công, không đưa vào `start`**:
   ```bash
   npx prisma db push --accept-data-loss
   ```
3. Xác nhận 7 bảng đã biến mất, rồi deploy bình thường.

## UptimeRobot — không cần sửa gì

- URL giữ nguyên: `https://kybien-backend.onrender.com/ping`
- Interval 5 phút là đủ giữ Render free tier không ngủ (ngủ sau ~15 phút idle).
- `/ping` trong `src/app.ts` đã trả JSON 200 ngay cả khi DB ping lỗi
  (lỗi DB chỉ log warning), nên sau khi server lên là UptimeRobot sẽ xanh.
- Lưu ý: UptimeRobot chỉ giữ server thức, không giữ Supabase free tier
  khỏi pause sau 7 ngày không hoạt động — code đã có keep-alive
  `SELECT 1` mỗi 6 giờ trong `app.ts`, giữ nguyên là được.

## Kiểm chứng đã làm (2026-11-06)

- Clone repo, đọc `package.json`, `prisma/schema.prisma`, `src/server.ts`,
  `src/app.ts`, toàn bộ lịch sử `schema.prisma`: xác nhận Xianxia chưa từng
  có trong schema và không được code nào dùng.
- `curl https://kybien.blogspot.com/` → 200 (frontend Blogger vẫn sống).
- `https://kybien-backend.onrender.com/ping` → không trả lời (server chưa lên).
- Đổi `start` xong: `package.json` parse OK, `start = node dist/server.js`.
- `tsc --noEmit` local: 40 lỗi, toàn bộ là `TS2305` (18, thiếu Prisma Client
  do máy này không tải được Prisma engine qua proxy) + `TS7006` hệ quả (22),
  **0 lỗi khác**. Trên Render, Prisma Client đã generate thành công trong log
  build (`Generated Prisma Client v5.22.0`) nên các lỗi này không tồn tại ở đó;
  và bản sửa không đụng file `.ts` nào nên không ảnh hưởng build.
