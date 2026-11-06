# Kỳ Biến — Cách đưa bản sửa vào game (chạy trên Blogger)

Game chạy bằng **3 lớp**, mỗi lớp cập nhật một kiểu khác nhau. Nhầm kiểu là
bản sửa không lên, hoặc đè mất bản live.

## 1. Bản đồ 3 lớp

| Lớp | File trong repo | Nơi nó chạy thật | Cập nhật bằng cách |
|---|---|---|---|
| **Theme** (trang chủ, header/footer, widget, SEO) | `frontend/blogger-theme.xml` | Blogger → Theme | Dán toàn bộ file XML vào Theme → Edit HTML |
| **Trang tĩnh** (nội dung từng trang) | `frontend/arena-page.html` → `/p/arena.html` | Blogger → Pages → trang Đấu Trường | Mở trang → HTML view → dán toàn bộ file HTML |
|  | `frontend/co-the.html` → `/p/co-the.html` | Blogger → Pages → trang Cờ Thế | Như trên |
|  | `frontend/cam-nang.html` → `/p/cam-nang.html` | Blogger → Pages → trang Cẩm Nang | Như trên |
| **JS + âm thanh** (logic game) | `frontend/kybien-client.js`, `frontend/kybien-puzzle.js`, `frontend/audio/taunts/*.mp3` | jsDelivr CDN trỏ về GitHub `@main` | **Push lên GitHub là tự lên** (xem mục 3) |
| **Backend** | `backend/` | Render | Push GitHub → Render Manual Deploy |
| `index.html` (gốc repo + `frontend/`) | — | **Không dùng trên Blogger** — trang chủ do Theme vẽ. Hai bản này đã lệch nhau; chỉ để xem trước local, đừng dán vào đâu. |

Vì sao trang tĩnh không tự chứa JS: trang Blogger render **bên trong Theme**,
nên `arena-page.html` không cần (và không có) dòng nạp `kybien-client.js` —
Theme đã nạp ở `blogger-theme.xml:75`. Tương tự, `cam-nang.html` là nội dung
tĩnh, không cần JS riêng.

## 2. Quy trình khi có bản sửa (chuẩn)

Mỗi đợt sửa mình sẽ giao 3 thứ:

1. **Push GitHub** (mình làm, qua GitHub App đã kết nối): toàn bộ file repo
   đã sửa, gồm cả JS. Bạn không cần đụng vào.
2. **File dán Blogger**: `blogger-theme.xml` và/hoặc các file `*-page.html`
   đã sửa, kèm bảng "đổi chỗ nào" (file nào, dòng nào, đổi gì) để bạn có thể
   chỉ dán đoạn đổi thay vì cả file, nếu muốn.
3. **Checklist kiểm tra** sau khi dán (mở từng URL, bấm thử tính năng sửa).

Bạn làm theo thứ tự: **push GitHub trước → dán Theme/trang sau → purge
jsDelivr (mục 3) → kiểm tra**.

## 3. JS qua jsDelivr — push xong chưa lên ngay

Theme và trang Cờ Thế nạp JS kiểu này:

```html
https://cdn.jsdelivr.net/gh/duyanhk1000-dot/kybien@main/frontend/kybien-client.js?v=3.2.4
https://cdn.jsdelivr.net/gh/duyanhk1000-dot/kybien@main/frontend/kybien-puzzle.js?v=1.0.1
```

- Push lên GitHub xong, jsDelivr **vẫn có thể trả bản cũ trong nhiều giờ**
  (cache của CDN). `?v=3.2.4` chỉ chống cache trình duyệt, không xóa cache
  jsDelivr.
- Cách chắc chắn: sau mỗi lần push có sửa JS, mở 2 link purge này (chỉ cần
  mở bằng trình duyệt, không cần đăng nhập):
  - `https://purge.jsdelivr.net/gh/duyanhk1000-dot/kybien@main/frontend/kybien-client.js`
  - `https://purge.jsdelivr.net/gh/duyanhk1000-dot/kybien@main/frontend/kybien-puzzle.js`
  Rồi **tăng số `?v=`** trong Theme/trang (vd. `v=3.2.4` → `v=3.2.5`) và dán
  lại Theme/trang đó — để trình duyệt người chơi cũng tải bản mới.
- Cách chắc chắn hơn nữa (khi sửa lớn): pin theo tag/commit thay vì `@main`,
  vd. `@v1.2.0/...`, nhưng mỗi lần release phải sửa lại URL trong Theme.

## 4. Cách dán Theme (XML)

1. Blogger Dashboard → **Theme** → bấm **⋮ (ba chấm) → Backup → Download**
   để lưu bản theme đang chạy (phòng khi dán lỗi còn khôi phục).
2. Theme → **Customize → Edit HTML** (hoặc ⋮ → Edit HTML).
3. Chọn hết (Ctrl+A), dán toàn bộ nội dung `frontend/blogger-theme.xml` mới.
4. Bấm **Save theme**. Blogger báo lỗi XML là do file sai cú pháp — đừng
   Save đè khi còn lỗi, gửi lại file cho mình kiểm tra.
5. Mở `https://kybien.blogspot.com/` kiểm tra trang chủ.

Lưu ý: Theme là **một file XML duy nhất**, không dán từng đoạn rời rạc nếu
không chắc — dán cả file thì an toàn hơn.

## 5. Cách dán trang tĩnh (HTML)

1. Blogger Dashboard → **Pages** → mở trang cần sửa (Đấu Trường / Cờ Thế /
   Cẩm Nang).
2. Trong trình soạn thảo, bấm **biểu tượng bút chì → HTML view**.
3. Chọn hết, dán toàn bộ nội dung file `*-page.html` mới → **Update/Publish**.
4. Mở URL trang đó (`/p/arena.html`, `/p/co-the.html`, `/p/cam-nang.html`)
   kiểm tra.

Lưu ý: Blogger Pages có thể tự sửa/xóa bớt thẻ khi lưu (đặc biệt `<script>`
lạ). Sau khi Update, mở lại HTML view kiểm tra xem đoạn script quan trọng
còn không. Nếu Blogger xóa mất, báo mình để đổi cách nhúng.

## 6. ⚠️ Bẫy đã gặp: bản live đã lệch khỏi repo

Kiểm tra ngày 2026-11-06: trang Cờ Thế **live** đang nạp puzzle JS bằng URL
tuyệt đối jsDelivr `.../kybien-puzzle.js?v=1.0.1`, trong khi file
`frontend/co-the.html` trong repo vẫn là đường dẫn tương đối
`kybien-puzzle.js?v=1.0.0`.

- Đường dẫn tương đối trên Blogger sẽ resolve sai thành
  `/p/kybien-puzzle.js` (404) — tức là **dán nguyên file repo lên sẽ làm hỏng
  trang Cờ Thế live**.
- Đã sửa repo cho khớp live: `frontend/co-the.html:13` giờ dùng URL tuyệt
  đối jsDelivr `v1.0.1` (commit sau).
- Bài học: trước mỗi đợt dán, mình sẽ **tải bản live về đối chiếu với repo**
  để không đè mất chỉnh sửa tay trên Blogger. Nếu bạn sửa tay trên Blogger,
  nhớ báo mình để mình đồng bộ ngược về repo.

## 7. Sau mỗi đợt sửa, kiểm tra nhanh

- [ ] Trang chủ `kybien.blogspot.com` tải được, hero + 4 chế độ hiện đủ
- [ ] `/p/arena.html` mở được, chơi PvE với máy được
- [ ] `/p/co-the.html` mở được, danh sách ải tải được, bấm vào 1 ải chơi được
- [ ] `/p/cam-nang.html` mở được
- [ ] `kybien-backend.onrender.com/ping` trả `{"status":"online",...}`
- [ ] Đăng nhập thử 1 tài khoản, xem bảng xếp hạng tải được

## 8. ⚠️ BẮT BUỘC trước khi deploy bản sửa bảo mật (từ commit quick win backend)

Bản này bỏ fallback tự sinh JWT secret — server sẽ **từ chối khởi động**
nếu thiếu `JWT_SECRET` mạnh. Đây là chủ ý, không phải lỗi deploy.

1. Tạo secret (chạy trên máy bạn):
   ```bash
   openssl rand -hex 32
   ```
2. Render Dashboard → service `kybien-backend` → **Environment** → thêm:
   - `JWT_SECRET` = chuỗi vừa tạo (≥ 32 ký tự, giữ kín, không commit lên GitHub)
   - `ADMIN_EMAILS` = email tài khoản admin của bạn, vd. `duyanhk1000@gmail.com`
     (nhiều admin thì phân tách dấu phẩy; chỉ các email này mới gọi được
     `POST /api/puzzles/daily/publish` — chưa set là endpoint bị khóa hẳn)
   - `NODE_ENV` = `production` (để chế độ fail-fast có hiệu lực)
3. Sau đó mới Manual Deploy. Kiểm tra log: nếu thấy dòng
   `JWT_SECRET chưa được cấu hình...` thì quay lại bước 2 — server cố tình
   không chạy khi thiếu secret.

Lưu ý: đổi `JWT_SECRET` sẽ làm **mọi token JWT cũ mất hiệu lực** — người chơi
đang đăng nhập sẽ phải đăng nhập lại 1 lần. Đổi 1 lần này thôi, đừng đổi lại
thường xuyên.
