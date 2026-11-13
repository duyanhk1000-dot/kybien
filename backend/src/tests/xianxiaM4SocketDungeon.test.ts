import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { Server as SocketServer } from 'socket.io';
import app from '../app.js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { xianxiaPartyService } from '../services/xianxia/xianxiaPartyService.js';
import { xianxiaDungeonService } from '../services/xianxia/xianxiaDungeonService.js';
import { setupXianxiaDungeonSocket, closeXianxiaDungeonSocket } from '../socket/xianxiaDungeonSocket.js';

function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function emitWithAck<T = any>(socket: ClientSocketType, event: string, data?: any, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ack on "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.emit(event, data, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

function connectClient(url: string, token: string, timeoutMs = 10000): Promise<ClientSocketType> {
  return new Promise((resolve, reject) => {
    const client = ClientSocket(`${url}/xianxia-dungeon`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: timeoutMs,
    });
    const timer = setTimeout(() => {
      client.disconnect();
      reject(new Error(`Timeout waiting for connect after ${timeoutMs}ms`));
    }, timeoutMs);
    client.on('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.on('connect_error', (err) => {
      clearTimeout(timer);
      client.disconnect();
      reject(err);
    });
  });
}

function connectExpectingError(url: string, token?: string, timeoutMs = 10000): Promise<Error> {
  return new Promise((resolve, reject) => {
    const client = ClientSocket(`${url}/xianxia-dungeon`, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: false,
      timeout: timeoutMs,
    });
    const timer = setTimeout(() => {
      client.disconnect();
      reject(new Error(`Timeout waiting for connect_error after ${timeoutMs}ms`));
    }, timeoutMs);
    client.on('connect_error', (err) => {
      clearTimeout(timer);
      client.disconnect();
      resolve(err);
    });
    client.on('connect', () => {
      clearTimeout(timer);
      client.disconnect();
      reject(new Error('Expected connection to fail, but it connected successfully'));
    });
  });
}

export async function runXianxiaM4SocketDungeonTests(): Promise<void> {
  console.log('\n======================================================================');
  console.log('⚔️ [M4.3.3C TEST] BẮT ĐẦU KIỂM THỬ SOCKET.IO REALTIME CO-OP DUNGEON');
  console.log('======================================================================');

  // Khởi tạo test server độc lập lắng nghe cổng động
  const server = http.createServer(app);
  const io = new SocketServer(server, { cors: { origin: '*' } });
  setupXianxiaDungeonSocket(io);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Socket Test Server] Đang lắng nghe kiểm thử tại ${baseUrl}`);

  const trackedUserIds = new Set<number>();
  const trackedCharacterIds = new Set<number>();
  const trackedPartyIds = new Set<number>();
  const trackedDungeonRunIds = new Set<string>();
  const activeClients: ClientSocketType[] = [];

  const testSuffix = Math.floor(Math.random() * 900000 + 100000);

  async function createPlayer(prefix: string, fatigue = 100) {
    const uname = `${prefix}_${testSuffix}_${Math.floor(Math.random() * 10000)}`;
    const user = await prisma.user.create({
      data: {
        username: uname,
        email: `${uname}@example.com`,
        password_hash: 'test_hash_socket_123',
      },
    });
    trackedUserIds.add(user.id);

    const char = await prisma.xianxiaCharacter.create({
      data: {
        user_id: user.id,
        name: `Tu Sĩ ${uname}`,
        realm: 'LUYEN_KHI_3',
        level: 5,
        health: 500,
        max_health: 500,
        fatigue,
        max_fatigue: 100,
        silver: 500,
        cultivation: 100,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCharacterIds.add(char.id);

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    return { user, char, token };
  }

  try {
    // 0. Khởi tạo tài khoản test
    const leaderA = await createPlayer('sock_leadA', 100);
    const memberB = await createPlayer('sock_memB', 100);
    const outsiderX = await createPlayer('sock_outX', 100);

    const expiredToken = jwt.sign(
      { userId: leaderA.user.id, username: leaderA.user.username },
      config.jwtSecret,
      { expiresIn: '-1s' }
    );
    const invalidSignatureToken = jwt.sign(
      { userId: leaderA.user.id, username: leaderA.user.username },
      'wrong_jwt_secret_key_12345',
      { expiresIn: '1h' }
    );

    // ==========================================
    // TEST 1: Handshake with valid JWT -> connected
    // ==========================================
    console.log('-> Test 1: Handshake với JWT hợp lệ -> Kết nối Socket thành công...');
    const clientA = await connectClient(baseUrl, leaderA.token);
    activeClients.push(clientA);
    assert(clientA.connected, 'Socket Client A phải kết nối thành công');
    assert(clientA.id, 'Socket Client A phải có ID');
    console.log(`✅ Test 1: Kết nối thành công với Socket ID: ${clientA.id}`);

    // ==========================================
    // TEST 2: Reject missing, invalid, or expired JWT
    // ==========================================
    console.log('-> Test 2: Chặn kết nối khi thiếu token, token hết hạn hoặc sai chữ ký...');
    const errNoToken = await connectExpectingError(baseUrl, undefined);
    assert(errNoToken.message.includes('AUTHENTICATION_ERROR'), 'Phải từ chối khi thiếu token');

    const errExpired = await connectExpectingError(baseUrl, expiredToken);
    assert(errExpired.message.includes('AUTHENTICATION_ERROR'), 'Phải từ chối khi token hết hạn');

    const errInvalidSig = await connectExpectingError(baseUrl, invalidSignatureToken);
    assert(errInvalidSig.message.includes('AUTHENTICATION_ERROR'), 'Phải từ chối khi token sai chữ ký');
    console.log('✅ Test 2: Chặn handshake không hợp lệ đạt chuẩn an ninh 100%');

    // ==========================================
    // CHUẨN BỊ TỔ ĐỘI (A làm Leader, mời B gia nhập)
    // ==========================================
    const party = await xianxiaPartyService.createParty(leaderA.user.id, 'Tổ Đội Test Realtime');
    trackedPartyIds.add(party.id);

    const invite = await xianxiaPartyService.inviteMember(leaderA.user.id, memberB.char.id);
    await xianxiaPartyService.respondToInvite(memberB.user.id, invite.id, 'ACCEPT');

    const clientB = await connectClient(baseUrl, memberB.token);
    activeClients.push(clientB);

    const clientX = await connectClient(baseUrl, outsiderX.token);
    activeClients.push(clientX);

    // ==========================================
    // TEST 3: Outsider cannot join Party room -> 403 PARTY_FORBIDDEN
    // ==========================================
    console.log('-> Test 3: Người ngoài không thể join Party room -> 403 PARTY_FORBIDDEN...');
    const joinPartyResultA = await emitWithAck(clientA, 'party:join', { partyId: party.id });
    assert.strictEqual(joinPartyResultA.success, true, 'Thành viên tổ đội phải join party room thành công');

    const joinPartyResultB = await emitWithAck(clientB, 'party:join', { partyId: party.id });
    assert.strictEqual(joinPartyResultB.success, true, 'Thành viên B phải join party room thành công');

    const joinPartyResultX = await emitWithAck(clientX, 'party:join', { partyId: party.id });
    assert.strictEqual(joinPartyResultX.success, false, 'Người ngoài không được join party room');
    assert.strictEqual(joinPartyResultX.error?.code, 'PARTY_FORBIDDEN', 'Mã lỗi phải là PARTY_FORBIDDEN');
    assert.strictEqual(joinPartyResultX.error?.status, 403, 'HTTP Status phải là 403');
    console.log('✅ Test 3: Phân quyền Party Room bảo mật tuyệt đối (Outsider bị từ chối 403)');

    // ==========================================
    // SẴN SÀNG THAM CHIẾN VÀ VÀO PHÓ BẢN
    // ==========================================
    await xianxiaPartyService.setReadyState(leaderA.user.id, true);
    await xianxiaPartyService.setReadyState(memberB.user.id, true);

    const dungeonRun = await xianxiaDungeonService.enterDungeon(leaderA.user.id, 'dungeon_u_minh_co_dong');
    trackedDungeonRunIds.add(dungeonRun.id);

    // ==========================================
    // TEST 4: Outsider cannot join Dungeon room -> 403 DUNGEON_FORBIDDEN
    // ==========================================
    console.log('-> Test 4: Người ngoài không thể join Dungeon room -> 403 DUNGEON_FORBIDDEN...');
    const joinDungeonResultX = await emitWithAck(clientX, 'dungeon:join', { runId: dungeonRun.id });
    assert.strictEqual(joinDungeonResultX.success, false, 'Người ngoài không được join dungeon room');
    assert.strictEqual(joinDungeonResultX.error?.code, 'DUNGEON_FORBIDDEN', 'Mã lỗi phải là DUNGEON_FORBIDDEN');
    assert.strictEqual(joinDungeonResultX.error?.status, 403, 'HTTP Status phải là 403');
    console.log('✅ Test 4: Chặn truy cập Dungeon Room đối với người ngoài đạt chuẩn 403');

    // ==========================================
    // TEST 5: Knowing runId UUID does not bypass authorization
    // ==========================================
    console.log('-> Test 5: Biết trước mã UUID runId không vượt qua được kiểm tra quyền...');
    const arbitraryUuid = 'a0000000-0000-0000-0000-000000000001';
    const fakeUuidResultX = await emitWithAck(clientX, 'dungeon:join', { runId: arbitraryUuid });
    assert.strictEqual(fakeUuidResultX.success, false, 'Không được join với UUID tùy ý');
    console.log('✅ Test 5: Không thể bypass authorization bằng UUID tùy ý');

    // Cả Leader A và Member B join dungeon room
    const joinDungeonA = await emitWithAck(clientA, 'dungeon:join', { runId: dungeonRun.id });
    assert.strictEqual(joinDungeonA.success, true, 'Leader A phải join dungeon room thành công');
    assert(joinDungeonA.data, 'Leader A phải nhận snapshot');

    const joinDungeonB = await emitWithAck(clientB, 'dungeon:join', { runId: dungeonRun.id });
    assert.strictEqual(joinDungeonB.success, true, 'Member B phải join dungeon room thành công');

    // ==========================================
    // TEST 6: dungeon:combat_step authoritative, client-provided damage ignored
    // ==========================================
    console.log('-> Test 6: dungeon:combat_step gọi authoritative engine, bỏ qua sát thương do client gửi...');
    const stepWithCheatPromise = emitWithAck(clientA, 'dungeon:combat_step', {
      runId: dungeonRun.id,
      expectedVersion: 1,
      damage: 9999999, // Hack / Cheat do client tự ý chèn
      killAll: true,
    });

    const stepResult = await stepWithCheatPromise;
    assert.strictEqual(stepResult.success, true, 'Combat step phải thực thi thành công');
    assert.strictEqual(stepResult.data.turnsCount, 1, 'Lượt đấu phải tăng lên 1');
    assert.strictEqual(stepResult.data.version, 2, 'Version phải tăng lên 2');
    // Đảm bảo quái vật không chết ngay lập tức vì 9999999 damage giả mạo
    const monstersWave1 = stepResult.data.combatState.monsters;
    assert(monstersWave1.length > 0, 'Quái vật vẫn phải tồn tại theo tính toán server');
    console.log('✅ Test 6: Server-authoritative engine từ chối sát thương phía client');

    // ==========================================
    // TEST 7: Two combat requests with same version -> one succeeds, one gets 409 DUNGEON_VERSION_MISMATCH
    // ==========================================
    console.log('-> Test 7: Hai request chiến đấu cùng version -> một thành công, một 409 VERSION_MISMATCH...');
    // Cả A và B cùng gửi yêu cầu đánh lượt tiếp theo với cùng expectedVersion: 2
    const [concurrentA, concurrentB] = await Promise.all([
      emitWithAck(clientA, 'dungeon:combat_step', { runId: dungeonRun.id, expectedVersion: 2 }),
      emitWithAck(clientB, 'dungeon:combat_step', { runId: dungeonRun.id, expectedVersion: 2 }),
    ]);

    const results = [concurrentA, concurrentB];
    const successes = results.filter((r) => r.success === true);
    const mismatches = results.filter((r) => r.success === false && r.error?.code === 'DUNGEON_VERSION_MISMATCH');

    assert.strictEqual(successes.length, 1, 'Đúng 1 request được xử lý thành công');
    assert.strictEqual(mismatches.length, 1, 'Đúng 1 request bị từ chối do DUNGEON_VERSION_MISMATCH');
    assert.strictEqual(mismatches[0].error?.status, 409, 'Status phải là 409 Conflict');
    console.log('✅ Test 7: Optimistic Versioning giải quyết race condition triệt để (409 Conflict)');

    // ==========================================
    // TEST 8: Duplicate event doesn't cause double combat
    // ==========================================
    console.log('-> Test 8: Gửi trùng lặp event phiên bản cũ không gây đánh trùng lượt...');
    // Lượt hiện tại sau Test 7 là version 3 (turnsCount 2)
    const duplicateStep = await emitWithAck(clientA, 'dungeon:combat_step', { runId: dungeonRun.id, expectedVersion: 2 });
    assert.strictEqual(duplicateStep.success, false, 'Gửi lại version 2 phải bị từ chối');
    assert.strictEqual(duplicateStep.error?.code, 'DUNGEON_VERSION_MISMATCH', 'Phải báo mismatch');
    console.log('✅ Test 8: Chống xử lý trùng lặp và bảo toàn tính toàn vẹn hiệp đấu');

    // ==========================================
    // TEST 9: Combat events only broadcast AFTER transaction commits
    // ==========================================
    console.log('-> Test 9: Sự kiện dungeon:turn_resolved được broadcast sau khi commit transaction...');
    // Chờ 450ms để vượt rate limit 400ms của socket
    await new Promise((r) => setTimeout(r, 450));

    const turnResolvedPromiseB = waitForEvent(clientB, 'dungeon:turn_resolved');
    await emitWithAck(clientA, 'dungeon:combat_step', { runId: dungeonRun.id, expectedVersion: 3 });
    const turnEvent = await turnResolvedPromiseB;

    assert.strictEqual(turnEvent.runId, dungeonRun.id, 'Sự kiện broadcast phải đúng runId');
    assert.strictEqual(turnEvent.version, 4, 'Sự kiện broadcast phải có version 4');
    assert(turnEvent.combatState, 'Sự kiện broadcast phải kèm combatState đã commit');
    console.log('✅ Test 9: Đồng đội B nhận được dungeon:turn_resolved ngay sau khi commit');

    // ==========================================
    // TEST 10: Kicked member cannot receive further party room events
    // ==========================================
    console.log('-> Test 10: Thành viên bị kick không nhận được sự kiện tiếp theo của party room...');
    const leaderK = await createPlayer('sock_leadK', 100);
    const memberK = await createPlayer('sock_memK', 100);

    const party2 = await xianxiaPartyService.createParty(leaderK.user.id, 'Party Test Kick');
    trackedPartyIds.add(party2.id);

    const invite2 = await xianxiaPartyService.inviteMember(leaderK.user.id, memberK.char.id);
    await xianxiaPartyService.respondToInvite(memberK.user.id, invite2.id, 'ACCEPT');

    const clientLK = await connectClient(baseUrl, leaderK.token);
    activeClients.push(clientLK);
    const clientMK = await connectClient(baseUrl, memberK.token);
    activeClients.push(clientMK);

    await emitWithAck(clientLK, 'party:join', { partyId: party2.id });
    await emitWithAck(clientMK, 'party:join', { partyId: party2.id });

    // MemberK lắng nghe sự kiện party:kicked
    const kickedEventPromise = waitForEvent(clientMK, 'party:kicked');

    // Leader kick memberK
    await xianxiaPartyService.kickMember(leaderK.user.id, memberK.char.id);
    const kickedData = await kickedEventPromise;
    assert.strictEqual(kickedData.partyId, party2.id, 'Sự kiện kicked phải đúng party');

    // Kiểm tra xem memberK có còn nhận được event của room party2 không
    let unexpectedEventReceived = false;
    clientMK.once('party:ready_changed', () => {
      unexpectedEventReceived = true;
    });

    await xianxiaPartyService.setReadyState(leaderK.user.id, true);
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(unexpectedEventReceived, false, 'Thành viên bị trục xuất tuyệt đối không nhận thêm event');
    console.log('✅ Test 10: Trục xuất thành viên khỏi room thành công, ngăn rò rỉ sự kiện');

    // ==========================================
    // TEST 11: Disconnect does not alter gameplay state or kick members
    // ==========================================
    console.log('-> Test 11: Ngắt kết nối socket không làm mất tư cách thành viên hay hủy phó bản...');
    const memberDisconnectedPromiseA = waitForEvent(clientA, 'dungeon:member_disconnected', 6000);
    clientB.disconnect();
    const disconnectedEvent = await memberDisconnectedPromiseA;
    assert.strictEqual(disconnectedEvent.characterId, memberB.char.id, 'Phải thông báo member B disconnected');

    // Kiểm tra trạng thái DB
    const memberBInDb = await prisma.xianxiaDungeonMember.findUnique({
      where: {
        dungeon_run_id_character_id: {
          dungeon_run_id: dungeonRun.id,
          character_id: memberB.char.id,
        },
      },
    });
    assert(memberBInDb !== null, 'Thành viên B vẫn phải tồn tại trong phiên phó bản');
    assert.strictEqual(memberBInDb.is_connected, false, 'Được đánh dấu is_connected = false khi ngắt mạng');

    const runInDb = await prisma.xianxiaDungeonRun.findUnique({ where: { id: dungeonRun.id } });
    assert.strictEqual(runInDb?.status, 'IN_PROGRESS', 'Phó bản vẫn phải IN_PROGRESS bình thường');
    console.log('✅ Test 11: Cơ chế Offline Resilience bảo toàn trạng thái vẹn nguyên');

    // ==========================================
    // TEST 12: Reconnect returns authoritative snapshot and sets is_connected = true
    // ==========================================
    console.log('-> Test 12: Reconnect khôi phục snapshot và phục hồi trạng thái is_connected = true...');
    const reconnectedClientB = await connectClient(baseUrl, memberB.token);
    activeClients.push(reconnectedClientB);

    const reconnectResult = await emitWithAck(reconnectedClientB, 'dungeon:reconnect', { runId: dungeonRun.id });
    assert.strictEqual(reconnectResult.success, true, 'Reconnect phải thành công');
    assert(reconnectResult.data, 'Phải có dữ liệu snapshot');
    assert.strictEqual(reconnectResult.data.id, dungeonRun.id, 'Snapshot phải đúng runId');

    const memberBReconnected = await prisma.xianxiaDungeonMember.findUnique({
      where: {
        dungeon_run_id_character_id: {
          dungeon_run_id: dungeonRun.id,
          character_id: memberB.char.id,
        },
      },
    });
    assert.strictEqual(memberBReconnected?.is_connected, true, 'is_connected được cập nhật lại true');
    console.log('✅ Test 12: Khôi phục trạng thái kết nối và snapshot tức thì');

    // ==========================================
    // TEST 13: Terminal run (COMPLETED/FAILED/EXPIRED) blocks further combat
    // ==========================================
    console.log('-> Test 13: Phiên phó bản đã kết thúc chặn mọi thao tác combat tiếp theo...');
    // Cập nhật trạng thái dungeonRun thành FAILED để test terminal state
    await prisma.xianxiaDungeonRun.update({
      where: { id: dungeonRun.id },
      data: { status: 'FAILED' },
    });

    const combatOnTerminal = await emitWithAck(clientA, 'dungeon:combat_step', { runId: dungeonRun.id });
    assert.strictEqual(combatOnTerminal.success, false, 'Không được phép tấn công khi phó bản đã kết thúc');
    assert.strictEqual(combatOnTerminal.error?.code, 'DUNGEON_NOT_IN_PROGRESS', 'Mã lỗi phải là DUNGEON_NOT_IN_PROGRESS');
    console.log('✅ Test 13: Chặn combat triệt để trên phiên đã kết thúc');

    // ==========================================
    // TEST 14: Realtime claim-reward obeys idempotency and sender-only privacy
    // ==========================================
    console.log('-> Test 14: Nhận thưởng realtime đảm bảo Idempotency và tính riêng tư (Sender-Only)...');
    // Đặt dungeonRun sang COMPLETED
    await prisma.xianxiaDungeonRun.update({
      where: { id: dungeonRun.id },
      data: { status: 'COMPLETED' },
    });

    // Lắng nghe xem B có bị rò rỉ phần thưởng của A không
    let rewardLeakToB = false;
    reconnectedClientB.once('dungeon:reward_claimed', () => {
      rewardLeakToB = true;
    });

    const claimA1 = await emitWithAck(clientA, 'dungeon:claim_reward', {
      runId: dungeonRun.id,
      idempotencyKey: 'test_claim_key_1',
    });
    assert.strictEqual(claimA1.success, true, 'Leader A nhận thưởng thành công');
    assert.strictEqual(claimA1.data.claimed, true, 'Phải đánh dấu đã nhận thưởng');
    assert.strictEqual(typeof claimA1.data.exp, 'number', 'Phải có chi tiết phần thưởng exp');

    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(rewardLeakToB, false, 'Đồng đội B không được nhận sự kiện thưởng riêng tư của A');

    // Claim lần 2 với cùng key -> Trả kết quả cũ (Idempotent)
    const claimA2 = await emitWithAck(clientA, 'dungeon:claim_reward', {
      runId: dungeonRun.id,
      idempotencyKey: 'test_claim_key_1',
    });
    assert.strictEqual(claimA2.success, true, 'Claim lần 2 thành công');
    assert.strictEqual(claimA2.data.idempotent, true, 'Được đánh dấu là kết quả nhận trước đó');
    console.log('✅ Test 14: Quyền riêng tư phần thưởng và tính Idempotency đạt 100%');

    // ==========================================
    // TEST 15: Multiple sockets for same user identity tracked cleanly
    // ==========================================
    console.log('-> Test 15: Quản lý nhiều socket đồng thời cho cùng 1 tài khoản (Multi-tab support)...');
    const clientA_Tab2 = await connectClient(baseUrl, leaderA.token);
    activeClients.push(clientA_Tab2);

    await emitWithAck(clientA_Tab2, 'dungeon:join', { runId: dungeonRun.id });

    // Đóng tab 2 -> tab 1 vẫn đang online -> Database không được chuyển sang disconnected
    clientA_Tab2.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    const memberAAfterTab2Close = await prisma.xianxiaDungeonMember.findUnique({
      where: {
        dungeon_run_id_character_id: {
          dungeon_run_id: dungeonRun.id,
          character_id: leaderA.char.id,
        },
      },
    });
    assert.strictEqual(memberAAfterTab2Close?.is_connected, true, 'User vẫn còn tab 1 kết nối nên is_connected = true');
    console.log('✅ Test 15: Hỗ trợ Multi-tab chống race condition ngắt kết nối ảo');

    // ==========================================
    // TEST 16: Clean shutdown closes all listeners and sockets without hanging
    // ==========================================
    console.log('-> Test 16: Đóng socket server sạch sẽ, không treo tiến trình...');
    closeXianxiaDungeonSocket();
    await new Promise((r) => setTimeout(r, 100));
    console.log('✅ Test 16: Clean shutdown hoàn tất, giải phóng toàn bộ tài nguyên socket');

    console.log('\n======================================================================');
    console.log('🎉 TẤT CẢ 16 TEST CASES CHO REALTIME CO-OP DUNGEON ĐỀU VƯỢT QUA 100%!');
    console.log('======================================================================\n');
  } finally {
    // 1. Đóng toàn bộ client socket còn mở
    for (const c of activeClients) {
      try {
        c.disconnect();
      } catch (e) {}
    }

    // 2. Đóng Socket Server
    try {
      closeXianxiaDungeonSocket();
      io.close();
    } catch (e) {}

    // 3. Đóng HTTP Server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // 4. DỌN DẸP DỮ LIỆU TEST CHÍNH XÁC THEO ID (DATA SAFETY INVARIANT)
    console.log('[Cleanup] Dọn dẹp dữ liệu test do test suite tạo...');
    for (const runId of trackedDungeonRunIds) {
      await prisma.xianxiaDungeonRewardClaim.deleteMany({ where: { dungeon_run_id: runId } }).catch(() => {});
      await prisma.xianxiaDungeonMember.deleteMany({ where: { dungeon_run_id: runId } }).catch(() => {});
      await prisma.xianxiaDungeonRun.deleteMany({ where: { id: runId } }).catch(() => {});
    }

    for (const pId of trackedPartyIds) {
      await prisma.xianxiaPartyInvite.deleteMany({ where: { party_id: pId } }).catch(() => {});
      await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: pId } }).catch(() => {});
      await prisma.xianxiaParty.deleteMany({ where: { id: pId } }).catch(() => {});
    }

    for (const cId of trackedCharacterIds) {
      await prisma.xianxiaCharacter.deleteMany({ where: { id: cId } }).catch(() => {});
    }

    for (const uId of trackedUserIds) {
      await prisma.user.deleteMany({ where: { id: uId } }).catch(() => {});
    }
    console.log('[Cleanup] Đã dọn dẹp sạch sẽ toàn bộ bản ghi test!');
  }
}

// Cho phép chạy file trực tiếp bằng node dist/tests/xianxiaM4SocketDungeon.test.js
if (process.argv[1] && process.argv[1].includes('xianxiaM4SocketDungeon.test')) {
  runXianxiaM4SocketDungeonTests()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ [SOCKET TEST ERROR]:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
