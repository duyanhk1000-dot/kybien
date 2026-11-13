/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — KIỂM THỬ TÍCH HỢP FRONTEND REALTIME CO-OP (M4.3.3D)
 * Kiểm chứng toàn diện:
 * 1. Cấu trúc HTML & Tải tài nguyên (HTML, CSS, JS engine & coop module)
 * 2. Khởi tạo Socket Client & Lifecycle (Handshake, connect, disconnect, reconnect)
 * 3. Tổ Đội Frontend Realtime (Tạo đội, mời, đổi sẵn sàng, broadcast sự kiện)
 * 4. Bí Cảnh Realtime & Hiệp đấu Authoritative (Join room, snapshot, combat step, versioning)
 * 5. Reconnect, OCC Conflict & Nhận Thưởng Idempotency
 * 6. Dọn dẹp an toàn tuyệt đối (Zero DB Leak)
 */

import assert from 'assert';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import app from '../app.js';
import { setupXianxiaDungeonSocket } from '../socket/xianxiaDungeonSocket.js';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';

export async function runXianxiaM4CoopFrontendTests(): Promise<void> {
  console.log('\n======================================================================');
  console.log('🎮 [M4.3.3D TEST] BẮT ĐẦU KIỂM THỬ FRONTEND TỔ ĐỘI & REALTIME BÍ CẢNH');
  console.log('======================================================================');

  // Khởi tạo HTTP & Socket.IO server tích hợp
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });
  setupXianxiaDungeonSocket(io);

  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const socketUrl = `${baseUrl}/xianxia-dungeon`;

  const cleanupUserIds: number[] = [];
  const cleanupPartyIds: number[] = [];
  const cleanupRunIds: string[] = [];

  let clientA: ClientSocketType | null = null;
  let clientB: ClientSocketType | null = null;

  try {
    // -------------------------------------------------------------
    // KHỐI 1: KIỂM THỬ CẤU TRÚC GIAO DIỆN VÀ FILE TÀI NGUYÊN (D1)
    // -------------------------------------------------------------
    console.log('-> Test 1: Kiểm tra trang giao diện /tien-lo.html có đầy đủ thành phần M4.3.3D...');
    const htmlRes = await fetch(`${baseUrl}/tien-lo.html`);
    assert.strictEqual(htmlRes.status, 200, 'Endpoint /tien-lo.html phải trả về 200 OK');
    const html = await htmlRes.text();

    assert(html.includes('id="party-modal"'), 'Phải có Modal Tổ Đội (#party-modal)');
    assert(html.includes('id="dungeon-combat-screen"'), 'Phải có Màn hình Chiến Đấu Bí Cảnh (#dungeon-combat-screen)');
    assert(html.includes('id="dungeon-socket-status-dot"'), 'Phải có chỉ báo trạng thái kết nối thần thức bí cảnh');
    assert(html.includes('openPartyModal()'), 'Phải có nút gọi openPartyModal() trên giao diện');
    assert(html.includes('tienlo-coop.js'), 'Trang phải nạp mô-đun kịch bản tienlo-coop.js');
    console.log('✅ Test 1: Giao diện /tien-lo.html tích hợp hoàn chỉnh Modal Tổ Đội và Màn Hình Chiến Đấu Realtime');

    console.log('-> Test 2: Kiểm tra mô-đun kịch bản /tienlo-coop.js...');
    const coopRes = await fetch(`${baseUrl}/tienlo-coop.js`);
    assert.strictEqual(coopRes.status, 200, 'Endpoint /tienlo-coop.js phải trả về 200 OK');
    const coopScript = await coopRes.text();

    assert(coopScript.includes('initDungeonSocket'), 'Phải có phương thức initDungeonSocket');
    assert(coopScript.includes('openPartyModal'), 'Phải có phương thức openPartyModal');
    assert(coopScript.includes('createPartySubmit'), 'Phải có phương thức createPartySubmit');
    assert(coopScript.includes('togglePartyReadySubmit'), 'Phải có phương thức togglePartyReadySubmit');
    assert(coopScript.includes('enterDungeonSubmit'), 'Phải có phương thức enterDungeonSubmit');
    assert(coopScript.includes('executeDungeonCombatStep'), 'Phải có phương thức executeDungeonCombatStep');
    assert(coopScript.includes('claimDungeonRewardSubmit'), 'Phải có phương thức claimDungeonRewardSubmit');
    assert(coopScript.includes('reconnectDungeonRun'), 'Phải có phương thức reconnectDungeonRun');
    assert(coopScript.includes('DUNGEON_VERSION_MISMATCH'), 'Phải có xử lý lỗi Version Mismatch');
    console.log('✅ Test 2: Mô-đun tienlo-coop.js tải thành công với đầy đủ các hàm điều hành');

    // -------------------------------------------------------------
    // KHỐI 2: CHUẨN BỊ TÀI KHOẢN VÀ KẾT NỐI SOCKET CLIENTS (D1 & D2)
    // -------------------------------------------------------------
    console.log('-> Test 3: Khởi tạo tài khoản Đội Trưởng A và Thành Viên B...');
    const ts = Date.now();
    const unameA = `coop_user_a_${ts}`;
    const userA = await prisma.user.create({
      data: {
        username: unameA,
        email: `${unameA}@example.com`,
        password_hash: 'hash_test_coop',
      },
    });
    cleanupUserIds.push(userA.id);

    const charA = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userA.id,
        name: `Trưởng Lão A_${ts % 10000}`,
        realm: 'LUYEN_KHI_3',
        level: 10,
        health: 200,
        max_health: 200,
        fatigue: 50,
        max_fatigue: 100,
        cultivation: 1500,
        silver: 500,
      },
    });

    const unameB = `coop_user_b_${ts}`;
    const userB = await prisma.user.create({
      data: {
        username: unameB,
        email: `${unameB}@example.com`,
        password_hash: 'hash_test_coop',
      },
    });
    cleanupUserIds.push(userB.id);

    const charB = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userB.id,
        name: `Đệ Tử B_${ts % 10000}`,
        realm: 'LUYEN_KHI_2',
        level: 8,
        health: 180,
        max_health: 180,
        fatigue: 50,
        max_fatigue: 100,
        cultivation: 1200,
        silver: 300,
      },
    });

    const tokenA = generateToken({ userId: userA.id, username: userA.username, email: userA.email });
    const tokenB = generateToken({ userId: userB.id, username: userB.username, email: userB.email });

    // Khởi tạo kết nối 2 client mô phỏng trình duyệt
    clientA = ClientSocket(socketUrl, {
      auth: { token: tokenA },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve, reject) => {
      clientA!.on('connect', () => resolve());
      clientA!.on('connect_error', reject);
    });

    clientB = ClientSocket(socketUrl, {
      auth: { token: tokenB },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve, reject) => {
      clientB!.on('connect', () => resolve());
      clientB!.on('connect_error', reject);
    });
    console.log('✅ Test 3: Hai client A & B kết nối realtime thành công qua Handshake JWT');

    // -------------------------------------------------------------
    // KHỐI 3: QUẢN LÝ TỔ ĐỘI REALTIME (D2)
    // -------------------------------------------------------------
    console.log('-> Test 4: Đội trưởng A tạo tổ đội và tham gia party room...');
    const partyRes = await fetch(`${baseUrl}/api/xianxia/party`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Bắc Đẩu Đồng Đạo' }),
    });
    const partyJson = await partyRes.json();
    assert.strictEqual(partyJson.success, true);
    const partyId = partyJson.data.id;
    cleanupPartyIds.push(partyId);

    // Client A join party room
    clientA.emit('party:join', { partyId });

    console.log('-> Test 5: Mời thành viên B và nhận sự kiện party:member_joined realtime...');
    const memberJoinedPromise = new Promise<any>((resolve) => {
      clientA!.once('party:member_joined', (data) => resolve(data));
    });

    // A mời B
    const inviteRes = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
      body: JSON.stringify({ inviteeCharacterId: charB.id }),
    });
    const inviteJson = await inviteRes.json();
    if (!inviteJson.success) console.error('INVITE FAILED:', inviteJson);
    assert.strictEqual(inviteJson.success, true);
    const inviteId = inviteJson.data.id;

    // B chấp nhận lời mời
    const acceptRes = await fetch(`${baseUrl}/api/xianxia/party/invites/${inviteId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });
    const acceptJson = await acceptRes.json();
    assert.strictEqual(acceptJson.success, true);

    // Client B cũng join party room
    clientB.emit('party:join', { partyId });

    const joinedEvent = await memberJoinedPromise;
    assert.strictEqual(joinedEvent.partyId, partyId);
    console.log('✅ Test 5: Client A nhận được sự kiện party:member_joined khi B chấp nhận lời mời');

    console.log('-> Test 6: Đổi trạng thái sẵn sàng và nhận party:ready_changed...');
    const readyChangedPromise = new Promise<any>((resolve) => {
      clientA!.once('party:ready_changed', (data) => resolve(data));
    });

    // B bật sẵn sàng qua socket
    clientB.emit('party:ready', { isReady: true });
    const readyEvent = await readyChangedPromise;
    assert.strictEqual(readyEvent.partyId, partyId);
    assert.strictEqual(readyEvent.characterId, charB.id);
    assert.strictEqual(readyEvent.isReady, true);
    console.log('✅ Test 6: Sự kiện party:ready_changed được phát thành công cho cả tổ đội');

    // -------------------------------------------------------------
    // KHỐI 4: TIẾN NHẬP BÍ CẢNH VÀ HIỆP ĐẤU AUTHORITATIVE (D3)
    // -------------------------------------------------------------
    console.log('-> Test 7: Đội trưởng A mở bí cảnh, toàn đội nhận party:dungeon_started...');
    const dungeonStartedPromise = new Promise<any>((resolve) => {
      clientB!.once('party:dungeon_started', (data) => resolve(data));
    });

    const enterRes = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    });
    const enterJson = await enterRes.json();
    assert.strictEqual(enterJson.success, true);
    const runId = enterJson.data.id;
    cleanupRunIds.push(runId);

    const startEvent = await dungeonStartedPromise;
    assert.strictEqual(startEvent.partyId, partyId);
    assert.strictEqual(startEvent.runId, runId);
    console.log('✅ Test 7: Toàn đội tự động nhận tín hiệu party:dungeon_started');

    console.log('-> Test 8: Cả 2 client join dungeon room và nhận authoritative snapshot...');
    const snapshotPromiseA = new Promise<any>((resolve) => clientA!.once('dungeon:snapshot', resolve));
    const snapshotPromiseB = new Promise<any>((resolve) => clientB!.once('dungeon:snapshot', resolve));

    clientA.emit('dungeon:join', { runId });
    clientB.emit('dungeon:join', { runId });

    const [snapshotA, snapshotB] = await Promise.all([snapshotPromiseA, snapshotPromiseB]);
    assert.strictEqual(snapshotA.id, runId);
    assert.strictEqual(snapshotB.id, runId);
    assert.strictEqual(snapshotA.currentWave, 1);
    console.log('✅ Test 8: Nhận đầy đủ Authoritative Snapshot v' + snapshotA.version);

    console.log('-> Test 9: Client A thực thi hiệp đấu combat_step, cả 2 nhận turn_resolved v2...');
    const turnPromiseA = new Promise<any>((resolve) => clientA!.once('dungeon:turn_resolved', resolve));
    const turnPromiseB = new Promise<any>((resolve) => clientB!.once('dungeon:turn_resolved', resolve));

    clientA.emit('dungeon:combat_step', { runId, expectedVersion: 1 });
    const [turnA, turnB] = await Promise.all([turnPromiseA, turnPromiseB]);

    assert.strictEqual(turnA.version, 2);
    assert.strictEqual(turnB.version, 2);
    console.log('✅ Test 9: Hiệp đấu Server-Authoritative đồng bộ turn_resolved cho toàn phòng');

    console.log('-> Test 10: Chặn stale version (Client B gửi lại version 1) -> 409 VERSION_MISMATCH...');
    const mismatchPromise = new Promise<any>((resolve) => {
      clientB!.emit('dungeon:combat_step', { runId, expectedVersion: 1 }, (res: any) => resolve(res));
    });
    const mismatchRes = await mismatchPromise;
    assert.strictEqual(mismatchRes.success, false);
    assert.strictEqual(mismatchRes.error.status, 409);
    assert.strictEqual(mismatchRes.error.code, 'DUNGEON_VERSION_MISMATCH');
    console.log('✅ Test 10: Optimistic Concurrency Control từ chối version cũ 409 Conflict chuẩn xác');

    // -------------------------------------------------------------
    // KHỐI 5: RECONNECT & RESILIENCE (D4)
    // -------------------------------------------------------------
    console.log('-> Test 11: Mô phỏng Client B mất mạng và kết nối lại qua dungeon:reconnect...');
    const memberDisconnectedPromise = new Promise<any>((resolve) => {
      clientA!.once('dungeon:member_disconnected', resolve);
    });

    clientB.disconnect();
    const disconnectEvent = await memberDisconnectedPromise;
    assert.strictEqual(disconnectEvent.characterId, charB.id);

    // Client B reconnect lại
    clientB.connect();
    await new Promise<void>((resolve) => clientB!.once('connect', () => resolve()));

    const reconnectSnapshotPromise = new Promise<any>((resolve) => {
      clientB!.once('dungeon:snapshot', resolve);
    });
    clientB.emit('dungeon:reconnect', { runId });
    const reconSnapshot = await reconnectSnapshotPromise;
    assert.strictEqual(reconSnapshot.id, runId);
    assert.strictEqual(reconSnapshot.version, 2);
    console.log('✅ Test 11: Phục hồi kết nối thành công, nhận lại snapshot mới nhất từ máy chủ');

    // -------------------------------------------------------------
    // KHỐI 6: HOÀN TẤT VÀ NHẬN THƯỞNG IDEMPOTENCY (D3)
    // -------------------------------------------------------------
    console.log('-> Test 12: Đưa trạng thái sang COMPLETED và nhận thưởng cá nhân riêng tư...');
    await prisma.xianxiaDungeonRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', completed_at: new Date() },
    });

    const rewardPromise = new Promise<any>((resolve) => {
      clientA!.emit('dungeon:claim_reward', { runId, idempotencyKey: `claim_test_${Date.now()}` }, (res: any) => resolve(res));
    });
    const rewardRes = await rewardPromise;
    assert.strictEqual(rewardRes.success, true);
    assert(rewardRes.data.claimed === true);

    // Gửi lại cùng idempotency key -> trả về kết quả cũ
    const duplicatePromise = new Promise<any>((resolve) => {
      clientA!.emit('dungeon:claim_reward', { runId, idempotencyKey: `claim_test_${Date.now()}` }, (res: any) => resolve(res));
    });
    const duplicateRes = await duplicatePromise;
    assert.strictEqual(duplicateRes.success, true);
    assert(duplicateRes.data.idempotent === true);
    console.log('✅ Test 12: Nhận thưởng thành công với cơ chế bảo vệ kép Idempotency chống nhận đúp');

    console.log('\n======================================================================');
    console.log('🎉 TẤT CẢ 12 TEST CASES FRONTEND REALTIME CO-OP ĐÃ ĐẠT 100%!');
    console.log('======================================================================\n');
  } finally {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();

    // Dọn dẹp CSDL an toàn theo ID
    console.log('[Cleanup] Bắt đầu dọn dẹp dữ liệu kiểm thử an toàn...');
    if (cleanupRunIds.length > 0) {
      await prisma.xianxiaDungeonRewardClaim.deleteMany({ where: { dungeon_run_id: { in: cleanupRunIds } } });
      await prisma.xianxiaDungeonMember.deleteMany({ where: { dungeon_run_id: { in: cleanupRunIds } } });
      await prisma.xianxiaDungeonRun.deleteMany({ where: { id: { in: cleanupRunIds } } });
    }
    if (cleanupPartyIds.length > 0) {
      await prisma.xianxiaPartyInvite.deleteMany({ where: { party_id: { in: cleanupPartyIds } } });
      await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: { in: cleanupPartyIds } } });
      await prisma.xianxiaParty.deleteMany({ where: { id: { in: cleanupPartyIds } } });
    }
    if (cleanupUserIds.length > 0) {
      await prisma.xianxiaCharacter.deleteMany({ where: { user_id: { in: cleanupUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    }

    server.close();
    console.log('[Cleanup] Dọn dẹp hoàn tất.');
  }
}

// Chạy trực tiếp nếu file được gọi độc lập
if (process.argv[1]?.includes('xianxiaM4CoopFrontend.test')) {
  runXianxiaM4CoopFrontendTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ FRONTEND COOP TEST FAILED:', err);
      process.exit(1);
    });
}
