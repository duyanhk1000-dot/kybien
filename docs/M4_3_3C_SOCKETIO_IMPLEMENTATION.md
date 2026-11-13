# TIÊN LỘ: VẠN GIỚI TRANH PHONG — M4.3.3C REALTIME CO-OP DUNGEON
# TÀI LIỆU THIẾT KẾ & TRIỂN KHAI KIẾN TRÚC SOCKET.IO REALTIME

> **Hệ thống:** Tiên Lộ: Vạn Giới Tranh Phong (Nền tảng Kỳ Biến)  
> **Repository:** `D:\Lap trinh game\ky_bien\`  
> **Phân hệ:** M4.3.3C — Socket.IO Realtime Co-op Dungeon  
> **Tác giả:** Senior Backend Engineer & Realtime Architecture Specialist  
> **Thời gian:** 25/10/2026  
> **Trạng thái:** ✅ **HOÀN TẤT TRIỂN KHAI & KIỂM THỬ 100%**  

---

## 1. TỔNG QUAN KIẾN TRÚC (REALTIME ARCHITECTURE)

Hệ thống Realtime Co-op Dungeon (M4.3.3C) xây dựng kênh kết nối hai chiều (Full-Duplex) với độ trễ thấp dựa trên **Socket.IO 4.x**, chạy song hành cùng hệ thống REST API hiện hữu của Express và Prisma ORM trên PostgreSQL.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT APPLICATIONS                               |
|        (Leader & Party Members / Combatants via Socket.IO Client / REST API)       |
+-----------------------------------------------------------------------------------+
                                         │  ▲
       Handshake (Bearer JWT)            │  │  Push Notifications / Snapshots
       Party / Dungeon Inbound Events    │  │  Combat Events / Wave Updates
                                         ▼  │
+───────────────────────────────────────────────────────────────────────────────────+
|                           HTTP SERVER / SOCKET.IO ENGINE                          |
|                               (backend/src/server.ts)                             |
+───────────────────────────────────────────────────────────────────────────────────+
                                         │
                   Namespace Isolation: `/xianxia-dungeon`
                                         │
+───────────────────────────────────────────────────────────────────────────────────+
|               REALTIME CO-OP HUB (xianxiaDungeonSocket.ts)                        |
|                                                                                   |
|  [Handshake Auth]   JWT Token Verification -> Decoded { userId, username }       |
|  [Conn Registry]   activeUsers: Map<userId, Set<socketId>>                        |
|                     socketUserMap: Map<socketId, { userId, characterId }>         |
|  [Rate Limiter]     combatCooldowns: Map<string, number> (500ms cooldown)         |
|  [Rooms]            party:${partyId}   |   dungeon:${runId}                       |
+───────────────────────────────────────────────────────────────────────────────────+
       ▲                                 │                                 ▲
       │ Observer Hooks                  │ Delegate Service Calls          │
       │ (After Commit)                  ▼                                 │
+───────────────────────────+   +────────────────────────────+   +──────────────────+
|    PartyEventHooks        |   |   XianxiaPartyService      |   | DungeonEventHooks|
|    (xianxiaPartyService)  |   |   XianxiaDungeonService    |   | (DungeonService) |
+───────────────────────────+   +────────────────────────────+   +──────────────────+
                                         │
                                         ▼
+───────────────────────────────────────────────────────────────────────────────────+
|                     DATABASE LAYER (PostgreSQL / Supabase)                         |
|   Prisma ORM | Row-level Locks (FOR UPDATE) | Versioned State (Optimistic Lock)   |
+───────────────────────────────────────────────────────────────────────────────────+
```

### 1.1. Các nguyên tắc kiến trúc cốt lõi

1. **Namespace Isolation (`/xianxia-dungeon`)**:
   - Toàn bộ lưu lượng realtime của tổ đội và phó bản Tiên Lộ được cô lập hoàn toàn tại namespace `/xianxia-dungeon`.
   - Không gây xung đột, ô nhiễm bộ nhớ hay ảnh hưởng đến room mặc định (`/`) của môn cờ Kỳ Biến hoặc Chat Tông Môn.

2. **Server-Authoritative Toàn Phần**:
   - Client tuyệt đối không tự quyết định trạng thái chiến đấu, sát thương, lượng máu còn lại, chuyển wave hay phần thưởng.
   - Client chỉ gửi hành động ý định (`dungeon:combat_step`) kèm `version` của phiên đấu. Server xác thực quyền hạn, áp dụng khóa dữ liệu (`FOR UPDATE`), tính toán logic chiến đấu từ `monsters.json` và cấu hình nhân vật, lưu vết CSDL, rồi broadcast kết quả (`dungeon:turn_resolved`) đến tất cả thành viên trong room.

3. **Decoupled Cross-Service Observer Pattern (After-Commit Hooks)**:
   - Nhằm tránh phụ thuộc vòng (circular dependency) giữa tầng Service (`xianxiaPartyService`, `xianxiaDungeonService`) và tầng Socket Hub (`xianxiaDungeonSocket`), hệ thống sử dụng Observer Pattern.
   - Các hook sự kiện (`PartyEventHooks`, `DungeonEventHooks`) chỉ được kích hoạt **sau khi** giao dịch CSDL (`prisma.$transaction`) đã `COMMIT` thành công. Điều này triệt tiêu hoàn toàn rủi ro dirty read hoặc broadcast sự kiện ma (phantom event) khi giao dịch bị rollback.

4. **Multi-Device / Multi-Socket Tracking**:
   - Quản lý kết nối hai chiều thông qua cấu trúc dữ liệu `activeUsers: Map<number, Set<string>>` và `socketUserMap: Map<string, { userId: number, characterId?: number }>`.
   - Một người chơi mở nhiều tab/thiết bị vẫn được định danh nhất quán; sự cố ngắt kết nối trên một tab không làm ảnh hưởng trạng thái chung cho đến khi toàn bộ socket của người dùng đó đóng hẳn.

---

## 2. XÁC THỰC HANDSHAKE & VÒNG ĐỜI KẾT NỐI

### 2.1. Middleware Xác Thực Handshake
Mỗi client kết nối tới `/xianxia-dungeon` bắt buộc phải gửi kèm JWT qua một trong hai cơ chế:
1. `socket.handshake.auth.token`: Chuỗi JWT (có hoặc không có tiền tố `Bearer `).
2. `socket.handshake.headers.authorization`: Header `Bearer <JWT>`.

```typescript
dungeonNs.use(async (socket, next) => {
  try {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!rawToken) {
      return next(new Error('AUTH_TOKEN_MISSING: Token xác thực là bắt buộc'));
    }
    const token = typeof rawToken === 'string' && rawToken.startsWith('Bearer ')
      ? rawToken.slice(7).trim()
      : String(rawToken).trim();

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    const char = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: decoded.userId },
      select: { id: true, name: true, level: true }
    });

    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    socket.data.characterId = char?.id;
    socket.data.characterName = char?.name;
    return next();
  } catch (err: any) {
    return next(new Error('AUTH_INVALID_TOKEN: Token không hợp lệ hoặc đã hết hạn'));
  }
});
```

### 2.2. Vòng Đời Kết Nối (Connection Lifecycle)
- **Khi kết nối thành công (`connection`)**:
  - Ghi nhận `socketId` vào `activeUsers.get(userId)`.
  - Tự động kiểm tra xem nhân vật có đang thuộc một tổ đội hoạt động (`FORMING` / `READY` / `IN_DUNGEON`) không. Nếu có, tự động đưa socket vào room `party:${party.id}`.
  - Tự động kiểm tra xem tổ đội có đang trong phó bản hoạt động (`WAITING` / `IN_PROGRESS`) không. Nếu có, tự động đưa socket vào room `dungeon:${run.id}` và đánh dấu `is_connected = true`.
- **Khi ngắt kết nối (`disconnect`)**:
  - Loại bỏ `socketId` khỏi `activeUsers.get(userId)`.
  - Nếu người chơi không còn socket nào mở:
    - Tìm phó bản đang tham gia và cập nhật `XianxiaDungeonMember.is_connected = false`, `last_seen_at = now()`.
    - Broadcast sự kiện `dungeon:member_disconnected` đến room `dungeon:${runId}` để các đồng đội nắm bắt kịp thời.

---

## 3. PHÂN HỆ REALTIME TỔ ĐỘI (PARTY REALTIME)

Mỗi tổ đội được gán một room socket định dạng `party:${partyId}`.

### 3.1. Xác thực quyền gia nhập Room
Bất kỳ yêu cầu join room `party:join` đều truy vấn CSDL để xác minh người dùng hiện tại là Leader hoặc Active Member của tổ đội. Người ngoài tổ đội không thể nghe lén thông tin.

### 3.2. Danh mục sự kiện Broadcast Tổ Đội

| Sự kiện (Event Name) | Nguồn kích hoạt | Payload Data | Ý nghĩa & Hành vi phía Client |
|:---|:---|:---|:---|
| `party:member_joined` | Thành viên chấp nhận lời mời (`respondToInvite`) | `{ partyId, member: { characterId, name, role, isReady } }` | Cập nhật danh sách thành viên trong giao diện tổ đội. |
| `party:member_left` | Thành viên tự rời đội (`leaveParty`) | `{ partyId, characterId, newLeaderId? }` | Cập nhật UI; chuyển giao băng đội trưởng nếu trưởng đội cũ rời đội. |
| `party:member_kicked` | Đội trưởng trục xuất thành viên (`kickMember`) | `{ partyId, kickedCharacterId, kickedUserId, reason }` | Buộc socket của người bị đuổi rời room `party:${partyId}` và thông báo bị kích. |
| `party:disbanded` | Đội trưởng giải tán đội (`disbandParty`) | `{ partyId, reason }` | Thông báo tổ đội đã giải tán; toàn bộ thành viên rời room. |
| `party:ready_changed` | Thành viên đổi trạng thái sẵn sàng (`setReadyStatus`) | `{ partyId, characterId, isReady, allReady }` | Hiển thị tick xanh/đỏ sẵn sàng; bật sáng nút "Bắt đầu phó bản" cho đội trưởng nếu `allReady === true`. |
| `party:dungeon_started` | Đội trưởng bắt đầu phó bản (`enterDungeon`) | `{ partyId, runId, dungeonId, expiresAt }` | Toàn bộ thành viên lập tức chuyển màn hình sang giao diện chiến đấu phó bản. |

---

## 4. PHÂN HỆ REALTIME PHÓ BẢN (DUNGEON REALTIME)

Mỗi phiên phó bản được quản lý qua room `dungeon:${runId}`.

### 4.1. Danh mục sự kiện Inbound (Client $\rightarrow$ Server)

1. `dungeon:join` `{ runId }`:
   - Xác thực nhân vật có trong danh sách `XianxiaDungeonMember` của `runId`.
   - Tham gia room `dungeon:${runId}`.
   - Cập nhật `is_connected = true`.
   - Trả lời ACK: `{ success: true, data: { run, combatState, members } }`.
   - Broadcast `dungeon:member_connected` tới toàn room.

2. `dungeon:leave` `{ runId }`:
   - Thành viên chủ động thoát phó bản. Rời room socket.

3. `dungeon:combat_step` `{ runId, action, targetIndex, skillId, version }`:
   - **Rate Limiting**: Áp dụng cooldown 500ms giữa các hiệp của cùng một nhân vật (`COMBAT_ACTION_COOLDOWN`).
   - **Xác thực phiên bản**: So khớp `version` với CSDL máy chủ bằng hàng khóa `SELECT ... FOR UPDATE`.
   - Nếu version không khớp: Trả về lỗi `409 Conflict (DUNGEON_VERSION_MISMATCH)` kèm snapshot trạng thái mới nhất để client đồng bộ lại.
   - Nếu version khớp: Tính toán hiệp đấu, cập nhật HP/Qi của người chơi và quái vật.
   - Nếu quái vật wave hiện tại bị tiêu diệt hết:
     - Nếu chưa phải wave cuối: Chuyển sang wave tiếp theo, nạp quái vật mới, phát sự kiện `dungeon:wave_updated`.
     - Nếu là wave cuối (Boss tử trận): Cập nhật trạng thái `COMPLETED`, mở khóa tổ đội về `FORMING`, phát sự kiện `dungeon:completed`.
   - Nếu toàn bộ thành viên tử trận: Cập nhật `FAILED`, phát sự kiện `dungeon:failed`.
   - Nếu trận đấu tiếp diễn: Phát sự kiện `dungeon:turn_resolved`.

4. `dungeon:reconnect` `{ runId }`:
   - Cho phép người chơi rớt mạng lấy lại trạng thái tức thời.
   - Tự động kiểm tra thời hạn 15 phút. Nếu đã quá giờ, cập nhật `EXPIRED`, giải phóng tổ đội và phát `dungeon:expired`.
   - Nếu còn hiệu lực, cập nhật `is_connected = true` và trả về full snapshot qua ACK hoặc sự kiện `dungeon:snapshot`.

5. `dungeon:claim_reward` `{ runId }`:
   - Thực thi nhận thưởng an toàn kép (Bảo vệ Idempotency Key + Khóa bản ghi `XianxiaDungeonRewardClaim`).
   - Trả về danh sách EXP, Tu vi, Bạc và vật phẩm nhận được.

### 4.2. Danh mục sự kiện Outbound (Server $\rightarrow$ Room)

| Sự kiện | Payload | Mô tả |
|:---|:---|:---|
| `dungeon:snapshot` | `{ runId, status, currentWave, totalWaves, version, members, monsters, combatLog }` | Trạng thái đồng bộ toàn diện |
| `dungeon:turn_resolved` | `{ runId, version, turnResult, members, monsters, combatLog }` | Kết quả sau mỗi hiệp đánh |
| `dungeon:wave_updated` | `{ runId, currentWave, totalWaves, monsters, message }` | Bắt đầu đợt quái vật mới |
| `dungeon:completed` | `{ runId, totalTurns, rewardPreview, completedAt }` | Toàn thắng phó bản |
| `dungeon:failed` | `{ runId, currentWave, reason }` | Thất bại do diệt vong toàn đội |
| `dungeon:expired` | `{ runId, message }` | Hết hạn 15 phút |
| `dungeon:error` | `{ code, message, snapshot? }` | Lỗi nghiệp vụ hoặc xung đột phiên bản |
| `dungeon:member_connected` | `{ runId, characterId, characterName }` | Thông báo đồng đội vào phòng |
| `dungeon:member_disconnected` | `{ runId, characterId, characterName }` | Thông báo đồng đội mất kết nối |

---

## 5. CƠ CHẾ BẢO VỆ CONCURRENCY VÀ AN TOÀN DỮ LIỆU

1. **Optimistic Concurrency Control (OCC) kết hợp Row-Level Lock**:
   - Khi nhận `dungeon:combat_step`, server chạy trong giao dịch CSDL với `SELECT ... FOR UPDATE` trên bản ghi `xianxia_dungeon_runs`.
   - `version` tăng tịnh tiến `+1` sau mỗi lượt hành động hợp lệ.
   - Khi hai người chơi gửi thao tác đồng thời: Giao dịch đầu tiên thành công và tăng version. Giao dịch thứ hai kiểm tra thấy version cũ, lập tức rollback và phản hồi mã lỗi `DUNGEON_VERSION_MISMATCH` mà không làm hỏng trạng thái phòng đấu.

2. **Decoupled Event Hooks sau Giao Dịch (Commit-Guaranteed Emits)**:
   - Tất cả sự kiện WebSocket được phát qua callback `PartyEventHooks` và `DungeonEventHooks`.
   - Callback chỉ được gọi **sau khi block `$transaction` trả về kết quả**. Đảm bảo dữ liệu đã ghi xuống ổ đĩa CSDL trước khi loan báo qua mạng.

3. **Rate Limiting Cooldown (Chống Spam Hiệp Đấu)**:
   - Bản đồ `combatCooldowns` lưu mốc thời gian hành động cuối cùng của từng nhân vật.
   - Từ chối các gói tin gửi nhanh hơn 500ms (`COMBAT_ACTION_COOLDOWN`), ngăn chặn macro / auto-click làm quá tải server.

4. **Kiểm Soát Quyền Truy Cập Nghiêm Ngặt**:
   - Mọi API truy vấn phó bản (`getDungeonRunById`) và socket event đều kiểm tra quyền hạn `userId`.
   - Người ngoài không thể xem snapshot hay can thiệp vào trận chiến của tổ đội khác.

---

## 6. DANH MỤC FILE THAY ĐỔI & BỔ SUNG

```
backend/
├── src/
│   ├── socket/
│   │   └── xianxiaDungeonSocket.ts       # [MỚI] Socket.IO hub chính cho namespace /xianxia-dungeon
│   ├── services/xianxia/
│   │   ├── xianxiaPartyService.ts         # [SỬA] Bổ sung PartyEventHooks và phát sau commit
│   │   └── xianxiaDungeonService.ts       # [SỬA] Bổ sung DungeonEventHooks, access check, hook sau commit
│   ├── controllers/xianxia/
│   │   └── xianxiaDungeonController.ts    # [SỬA] Truyền userId vào getDungeonRunById kiểm soát truy cập
│   ├── server.ts                          # [SỬA] Khởi tạo setupXianxiaDungeonSocket(io)
│   └── tests/
│       ├── xianxiaM4SocketDungeon.test.ts # [MỚI] Suite kiểm thử tích hợp 16 kịch bản realtime
│       └── runAllTests.ts                 # [SỬA] Tích hợp suite test vào master test runner
docs/
├── M4_3_3C_SOCKETIO_IMPLEMENTATION.md    # [MỚI] Tài liệu kiến trúc realtime chi tiết
└── M4_3_3C_ACCEPTANCE_REPORT.md           # [MỚI] Báo cáo nghiệm thu kỹ thuật M4.3.3C
```
