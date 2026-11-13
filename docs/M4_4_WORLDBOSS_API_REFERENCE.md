# M4.4 WORLD BOSS (TOÀN DÂN TRẢM MA) — API & WEBSOCKET SPECIFICATION

## 1. Tổng quan kiến trúc
Tính năng **Toàn Dân Trảm Ma (World Boss — Xích Diễm Ma Long)** được xây dựng dựa trên mô hình lai (Hybrid Architecture):
- **REST API (`/api/xianxia/world-boss`)**: Dành cho truy vấn snapshot ban đầu, tạo boss (Admin/System), nhận thưởng bảo đảm tính toàn vẹn tài nguyên (Idempotent Transaction).
- **Socket.IO (`/xianxia-worldboss`)**: Dành cho tương tác thời gian thực cao tần (High-frequency Realtime Combat), phát sóng sát thương, cập nhật thanh máu boss tức thời và thông báo trảm sát (Fatal Blow Broadcast).

---

## 2. REST API Specification

Base URL: `/api/xianxia/world-boss`  
Xác thực: Bearer Token (`Authorization: Bearer <JWT_TOKEN>`)

### 2.1. Lấy thông tin Boss đang hoạt động
- **Endpoint**: `GET /api/xianxia/world-boss/active`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "wb-dragon-001",
    "boss_instance_id": "boss_inst_12345",
    "name": "Xích Diễm Ma Long",
    "level": 99,
    "max_hp": 10000000,
    "current_hp": 8452300,
    "status": "ACTIVE",
    "defense": 200,
    "started_at": "2026-10-26T00:00:00.000Z",
    "ended_at": null,
    "killer_character_id": null
  }
}
```

### 2.2. Khởi tạo/Hồi sinh Boss (Admin / Scheduler)
- **Endpoint**: `POST /api/xianxia/world-boss/spawn`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
```json
{
  "name": "Xích Diễm Ma Long",
  "level": 99,
  "maxHp": 10000000,
  "defense": 200
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "wb-dragon-002",
    "boss_instance_id": "boss_inst_67890",
    "name": "Xích Diễm Ma Long",
    "level": 99,
    "max_hp": 10000000,
    "current_hp": 10000000,
    "status": "ACTIVE"
  }
}
```

### 2.3. Bảng xếp hạng sát thương (Damage Leaderboard)
- **Endpoint**: 
  - `GET /api/xianxia/world-boss/:bossInstanceId/leaderboard`
  - `GET /api/xianxia/world-boss/leaderboard/:bossInstanceId` (Route alias)
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "bossInstanceId": "boss_inst_12345",
    "leaderboard": [
      {
        "rank": 1,
        "characterId": "char_01",
        "name": "Tiêu Dao Kiếm Tiên",
        "damage": 1250000,
        "percentage": 12.5
      },
      {
        "rank": 2,
        "characterId": "char_02",
        "name": "Bắc Đẩu Chân Nhân",
        "damage": 980000,
        "percentage": 9.8
      }
    ],
    "myContribution": {
      "rank": 1,
      "damage": 1250000,
      "percentage": 12.5
    }
  }
}
```

### 2.4. Nhận thưởng Trảm Ma (Claim Reward)
- **Endpoint**: `POST /api/xianxia/world-boss/claim-reward`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
```json
{
  "bossInstanceId": "boss_inst_12345",
  "idempotencyKey": "wb_claim_boss_inst_12345_1730000000000_abc12"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "claimed": true,
    "tier": "TOP1",
    "rewards": {
      "exp": 5000,
      "silver": 10000,
      "items": [
        { "itemTemplateId": "item_long_linh_dan", "quantity": 5 },
        { "itemTemplateId": "item_long_hon_thach", "quantity": 2 }
      ],
      "isLastHit": true,
      "lastHitBonus": {
        "exp": 1000,
        "silver": 2000,
        "items": [{ "itemTemplateId": "item_nanh_ma_long", "quantity": 1 }]
      }
    }
  }
}
```
- **Error `400 Bad Request` / `409 Conflict`**:
  - `WORLDBOSS_NOT_DEFEATED`: Boss chưa bị tiêu diệt.
  - `NO_DAMAGE_CONTRIBUTION`: Người chơi không có đóng góp sát thương.
  - `REWARD_ALREADY_CLAIMED`: Đã nhận thưởng trước đó (Idempotency bảo vệ).

---

## 3. Socket.IO Realtime Specification

- **Namespace**: `/xianxia-worldboss`
- **Handshake Authentication**:
  - `auth: { token: "<JWT_TOKEN>" }` hoặc `query: { token: "<JWT_TOKEN>" }`
  - Server giải mã JWT, kiểm tra character sở hữu. Nếu không hợp lệ, từ chối kết nối (`UNAUTHORIZED` / `CHARACTER_NOT_FOUND`).
- **Room Subscriptions**: `boss:${bossInstanceId}`

### 3.1. Client-to-Server Events

| Event Name | Payload | Mô tả |
| :--- | :--- | :--- |
| `worldboss:join` | `{ bossInstanceId: string }` | Đăng ký vào phòng chiến đấu của Boss. Nhận ngay snapshot ban đầu. |
| `worldboss:attack` | `{ bossInstanceId: string }` | Thực hiện 1 đòn tấn công. Sát thương tính toán hoàn toàn phía server. Server kiểm tra cooldown 400ms. |
| `worldboss:get_leaderboard` | `{ bossInstanceId: string }` | Yêu cầu bảng xếp hạng Top 10 mới nhất. |
| `worldboss:claim_reward` | `{ bossInstanceId: string, idempotencyKey: string }` | Yêu cầu nhận thưởng qua Socket.IO (hoặc dùng REST). |

### 3.2. Server-to-Client Events

| Event Name | Payload Format | Mô tả & Tần suất |
| :--- | :--- | :--- |
| `worldboss:snapshot` | `{ boss: Object, leaderboard: Array, myContribution: Object }` | Gửi riêng cho client vừa `join` thành công. |
| `worldboss:hp_updated` | `{ bossInstanceId, currentHp, maxHp, damage, attackerName, isCrit, timestamp }` | Broadcast toàn bộ phòng khi có người đánh trúng Boss. |
| `worldboss:defeated` | `{ bossInstanceId, killerName, killerId, defeatedAt, totalDamage }` | Broadcast toàn bộ phòng khi Boss chạm mốc 0 HP. Kích hoạt hiệu ứng diệt Ma Long. |
| `worldboss:leaderboard_updated` | `{ leaderboard: Array }` | Broadcast định kỳ hoặc khi có biến động vị trí Top 10. |
| `worldboss:reward_claimed` | `{ success: boolean, rewards: Object, tier: string }` | Phản hồi riêng cho client yêu cầu nhận thưởng. |
| `worldboss:error` | `{ message: string, code: string }` | Báo lỗi (`WORLDBOSS_COOLDOWN`, `WORLDBOSS_ALREADY_DEFEATED`, `INVALID_REQUEST`). |

---

## 4. Bảo mật, Chống Gian Lận (Anti-Cheat) & Hiệu Năng

1. **Server-Authoritative Combat**:
   - Client **tuyệt đối không gửi chỉ số sát thương**. Client chỉ gửi tín hiệu `attack`.
   - Server tính toán: $\text{BaseDamage} = \text{Character.atk} \times \text{Multiplier} \times (1 - \frac{\text{Boss.def}}{\text{Boss.def} + 400}) \pm \text{Variance}$.
   - Khống chế trần sát thương tối đa (Damage Sanity Ceiling): `Math.min(100000, calculatedDamage)` để ngăn chặn tràn số hoặc exploit tiềm tàng.
2. **Rate-Limiting & Anti-Spam**:
   - Máy chủ áp dụng Rate-limit 400ms giữa 2 lần tấn công liên tiếp của một nhân vật. Vi phạm trả về `WORLDBOSS_COOLDOWN` (HTTP 429 hoặc socket error).
   - Bộ nhớ `inMemoryCooldowns` có cơ chế tự động dọn dẹp (Pruning mechanism) khi vượt quá 2.000 phần tử, giải phóng các bản ghi cũ hơn 60 giây, chống rò rỉ RAM (Memory Leak).
   - Frontend áp dụng debounce lock 450ms và disable nút tấn công trực quan.
3. **Atomic Decrement & Concurrency Control**:
   - Sử dụng Prisma `$transaction` để trừ máu atomic `current_hp = Math.max(0, current_hp - damage)`.
   - Khi HP = 0, cập nhật trạng thái `status = 'DEFEATED'` và ghi nhận `killer_character_id` chính xác chỉ cho đòn kết liễu đầu tiên (First-commit wins).
4. **Dual-layer Idempotency cho phần thưởng**:
   - Tầng 1: In-memory lock ngăn chặn double-click gửi song song 2 request trong cùng 1 tick.
   - Tầng 2: Ràng buộc duy nhất `@@unique([boss_id, character_id])` trong bảng cơ sở dữ liệu `XianxiaWorldBossRewardClaim`, đảm bảo mỗi nhân vật chỉ nhận thưởng duy nhất 1 lần.
