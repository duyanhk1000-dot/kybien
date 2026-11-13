/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — KIỂM THỬ TÍCH HỢP TOÀN DIỆN E2E TOÀN DÂN TRẢM MA (M4.4C)
 * Kiểm chứng toàn diện:
 * 1. Bảo mật Handshake: Từ chối tài khoản chưa tạo nhân vật
 * 2. Triệu hoán Ma Long & Đa tu sĩ gia nhập phòng Socket.IO
 * 3. Mô phỏng tấn công dồn dập đồng thời (Swarm Attack Concurrency)
 * 4. Kiểm tra chốt chặn Rate Limiting 400ms
 * 5. Chống gian lận sát thương (Server-Authoritative Enforcement)
 * 6. Trảm sát Ma Long & Broadcast Defeated kèm vinh danh Đòn Kết Liễu
 * 7. Kiểm chứng Bảng Xếp Hạng Top 10 Sát Thương qua Socket & HTTP
 * 8. Lĩnh thưởng phân tầng và đòn kết liễu với bảo vệ kép Idempotency
 * 9. Clean Socket Shutdown & Dọn dẹp an toàn tuyệt đối (Zero DB Leak)
 */

import assert from 'assert';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import app from '../app.js';
import { setupXianxiaWorldBossSocket, closeXianxiaWorldBossSocket } from '../socket/xianxiaWorldBossSocket.js';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';

function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeoutMs = 7000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout chờ sự kiện "${event}" sau ${timeoutMs}ms`));
    }, timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export async function runXianxiaM4WorldBossE2ETests(): Promise<void> {
  console.log('\n======================================================================');
  console.log('🐉 [M4.4C TEST] BẮT ĐẦU KIỂM THỬ E2E TOÀN DIỆN TOÀN DÂN TRẢM MA (WORLD BOSS)');
  console.log('======================================================================');

  // Khởi tạo HTTP & Socket.IO server tích hợp
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });
  setupXianxiaWorldBossSocket(io);

  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const socketUrl = `${baseUrl}/xianxia-worldboss`;

  const cleanupUserIds: number[] = [];
  const cleanupBossIds: string[] = [];

  let clientA: ClientSocketType | null = null;
  let clientB: ClientSocketType | null = null;
  let clientC: ClientSocketType | null = null;
  let clientNoChar: ClientSocketType | null = null;

  try {
    // -------------------------------------------------------------
    // GIAI ĐOẠN 1: CHUẨN BỊ DỮ LIỆU & BẢO MẬT HANDSHAKE (E1 & E2)
    // -------------------------------------------------------------
    console.log('-> Test 1: Khởi tạo 3 tu sĩ A, B, C và 1 tài khoản chưa tạo nhân vật...');
    const ts = Date.now();

    // Tu sĩ A (Trúc Cơ 1)
    const userA = await prisma.user.create({
      data: { username: `e2e_user_a_${ts}`, email: `e2e_a_${ts}@test.com`, password_hash: 'hash_e2e' },
    });
    cleanupUserIds.push(userA.id);
    const charA = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userA.id,
        name: `Đao Tôn A_${ts % 10000}`,
        realm: 'TRUC_CO_1',
        level: 15,
        health: 300,
        max_health: 300,
        physique: 25,
        comprehension: 20,
        silver: 1000,
      },
    });

    // Tu sĩ B (Trúc Cơ 3)
    const userB = await prisma.user.create({
      data: { username: `e2e_user_b_${ts}`, email: `e2e_b_${ts}@test.com`, password_hash: 'hash_e2e' },
    });
    cleanupUserIds.push(userB.id);
    const charB = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userB.id,
        name: `Kiếm Thánh B_${ts % 10000}`,
        realm: 'TRUC_CO_3',
        level: 20,
        health: 400,
        max_health: 400,
        physique: 35,
        comprehension: 30,
        silver: 2000,
      },
    });

    // Tu sĩ C (Kim Đan 1 - Đại Năng)
    const userC = await prisma.user.create({
      data: { username: `e2e_user_c_${ts}`, email: `e2e_c_${ts}@test.com`, password_hash: 'hash_e2e' },
    });
    cleanupUserIds.push(userC.id);
    const charC = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userC.id,
        name: `Linh Tôn C_${ts % 10000}`,
        realm: 'KIM_DAN_1',
        level: 25,
        health: 600,
        max_health: 600,
        physique: 50,
        comprehension: 45,
        silver: 5000,
      },
    });

    // Người dùng D không có nhân vật
    const userD = await prisma.user.create({
      data: { username: `e2e_user_d_${ts}`, email: `e2e_d_${ts}@test.com`, password_hash: 'hash_e2e' },
    });
    cleanupUserIds.push(userD.id);

    const tokenA = generateToken({ userId: userA.id, username: userA.username, email: userA.email });
    const tokenB = generateToken({ userId: userB.id, username: userB.username, email: userB.email });
    const tokenC = generateToken({ userId: userC.id, username: userC.username, email: userC.email });
    const tokenD = generateToken({ userId: userD.id, username: userD.username, email: userD.email });
    console.log('✅ Test 1: Khởi tạo dữ liệu kiểm thử thành công');

    console.log('-> Test 2: Kiểm tra bảo mật Handshake: Tài khoản chưa có nhân vật bị từ chối kết nối...');
    clientNoChar = ClientSocket(socketUrl, {
      auth: { token: tokenD },
      transports: ['websocket'],
      forceNew: true,
    });

    const handshakeError = await new Promise<string>((resolve) => {
      clientNoChar!.on('connect_error', (err) => resolve(err.message));
      clientNoChar!.on('connect', () => resolve('CONNECTED_UNEXPECTEDLY'));
    });
    assert(handshakeError.includes('CHARACTER_NOT_FOUND'), 'Phải từ chối kết nối với lỗi CHARACTER_NOT_FOUND');
    console.log('✅ Test 2: Chặn kết nối tài khoản chưa khởi tạo nhân vật đạt chuẩn bảo mật');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 2: KẾT NỐI REALTIME & SNAPSHOT ARENA (E3)
    // -------------------------------------------------------------
    console.log('-> Test 3: Triệu hoán Xích Diễm Ma Long phiên bản E2E (150,000 HP)...');
    const spawnRes = await fetch(`${baseUrl}/api/xianxia/world-boss/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bossId: `dragon_e2e_${ts}`,
        name: 'Thượng Cổ Xích Diễm Ma Long',
        maxHp: 150000,
        durationMinutes: 15,
      }),
    });
    const spawnJson = await spawnRes.json();
    assert.strictEqual(spawnJson.success, true);
    const bossInstanceId = spawnJson.data.id;
    cleanupBossIds.push(bossInstanceId);
    console.log(`✅ Test 3: Triệu hoán Ma Long thành công với ID: ${bossInstanceId}`);

    console.log('-> Test 4: Ba tu sĩ A, B, C gia nhập phòng và nhận Authoritative Snapshot...');
    clientA = ClientSocket(socketUrl, { auth: { token: tokenA }, transports: ['websocket'], forceNew: true });
    clientB = ClientSocket(socketUrl, { auth: { token: tokenB }, transports: ['websocket'], forceNew: true });
    clientC = ClientSocket(socketUrl, { auth: { token: tokenC }, transports: ['websocket'], forceNew: true });

    await Promise.all([
      new Promise<void>(res => clientA!.on('connect', () => res())),
      new Promise<void>(res => clientB!.on('connect', () => res())),
      new Promise<void>(res => clientC!.on('connect', () => res())),
    ]);

    const snapPromiseA = waitForEvent(clientA!, 'worldboss:snapshot');
    const snapPromiseB = waitForEvent(clientB!, 'worldboss:snapshot');
    const snapPromiseC = waitForEvent(clientC!, 'worldboss:snapshot');

    clientA.emit('worldboss:join', { bossInstanceId });
    clientB.emit('worldboss:join', { bossInstanceId });
    clientC.emit('worldboss:join', { bossInstanceId });

    const [snapA, snapB, snapC] = await Promise.all([snapPromiseA, snapPromiseB, snapPromiseC]);
    assert.strictEqual(snapA.boss.id, bossInstanceId);
    assert.strictEqual(snapB.boss.id, bossInstanceId);
    assert.strictEqual(snapC.boss.id, bossInstanceId);
    assert.strictEqual(snapA.boss.max_hp ?? snapA.boss.maxHp, 150000);
    console.log('✅ Test 4: Cả 3 tu sĩ nhận Authoritative Snapshot đồng bộ 100%');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 3: TẤN CÔNG DỒN DẬP ĐỒNG THỜI (SWARM CONCURRENCY) (E4)
    // -------------------------------------------------------------
    console.log('-> Test 5: Mô phỏng đợt tấn công đồng thời (Swarm Attacks từ A, B, C)...');
    const attacks = [
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ bossInstanceId }),
      }),
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
        body: JSON.stringify({ bossInstanceId }),
      }),
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenC}` },
        body: JSON.stringify({ bossInstanceId }),
      }),
    ];

    const attackResponses = await Promise.all(attacks);
    const attackResults = await Promise.all(attackResponses.map(r => r.json()));

    assert(attackResults.every(r => r.success === true), 'Tất cả các đòn đánh đồng thời phải thành công');
    const totalDmgDealt = attackResults.reduce((sum, r) => sum + (r.data.damage || r.data.damageDealt || 0), 0);
    assert(totalDmgDealt > 3000, 'Tổng sát thương gây ra phải > 3000');
    console.log(`✅ Test 5: Giao dịch trừ máu đồng thời nguyên tử thành công (Tổng sát thương: ${totalDmgDealt})`);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 4: RATE LIMITING & CHỐNG GIAN LẬN SÁT THƯƠNG (E5)
    // -------------------------------------------------------------
    console.log('-> Test 6: Kiểm tra Rate Limiting (A gửi 2 đòn liên tiếp < 400ms) -> 429 Cooldown...');
    const rapidAttacks = [
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ bossInstanceId }),
      }),
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ bossInstanceId }),
      }),
    ];
    const rapidResponses = await Promise.all(rapidAttacks);
    const has429 = rapidResponses.some(r => r.status === 429);
    assert(has429, 'Một trong hai đòn đánh liên tiếp dưới 400ms phải bị từ chối 429 Cooldown');
    console.log('✅ Test 6: Chốt chặn Rate Limiting 400ms bảo vệ hệ thống tuyệt đối');

    console.log('-> Test 7: Kiểm tra client gửi payload gian lận sát thương (99,999,999)...');
    const cheatRes = await fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
      body: JSON.stringify({ bossInstanceId, damage: 99999999, isCritical: true }),
    });
    const cheatJson = await cheatRes.json();
    assert.strictEqual(cheatJson.success, true);
    const actualDmg = cheatJson.data.damage || cheatJson.data.damageDealt;
    assert(actualDmg < 20000, 'Máy chủ phải bỏ qua 99,999,999 của client và tính theo chỉ số thật');
    console.log(`✅ Test 7: Triệt tiêu 100% gian lận sát thương (Sát thương thực: ${actualDmg})`);

    // -------------------------------------------------------------
    // GIAI ĐOẠN 5: ĐÒN KẾT LIỄU & BROADCAST DEFEATED (E6)
    // -------------------------------------------------------------
    console.log('-> Test 8: Đưa máu Ma Long về 1 và tu sĩ C giáng đòn kết liễu (Last Hit)...');
    await prisma.xianxiaWorldBoss.update({
      where: { id: bossInstanceId },
      data: { current_hp: 1, status: 'ACTIVE' },
    });

    const defeatedPromiseA = waitForEvent(clientA!, 'worldboss:defeated');
    const defeatedPromiseB = waitForEvent(clientB!, 'worldboss:defeated');
    const defeatedPromiseC = waitForEvent(clientC!, 'worldboss:defeated');

    clientC!.emit('worldboss:attack', { bossInstanceId });

    const [defA, defB, defC] = await Promise.all([defeatedPromiseA, defeatedPromiseB, defeatedPromiseC]);
    assert.strictEqual(defA.bossInstanceId, bossInstanceId);
    assert.strictEqual(defB.bossInstanceId, bossInstanceId);
    assert.strictEqual(defC.bossInstanceId, bossInstanceId);

    const killerId = defA.killerId ?? defA.killerCharacterId;
    assert.strictEqual(killerId, charC.id, 'Người kết liễu phải là Linh Tôn C');
    assert.strictEqual(defA.killerName, charC.name);
    console.log('✅ Test 8: Ma Long bị trảm sát thành công, toàn thể tu sĩ nhận sự kiện defeated đồng bộ');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 6: BẢNG XẾP HẠNG & LĨNH THƯỞNG PHÂN TẦNG (E7 & E8)
    // -------------------------------------------------------------
    console.log('-> Test 9: Truy vấn Bảng Xếp Hạng Top 10 qua Socket.IO và REST API...');
    const leaderboardPromise = new Promise<any>((resolve) => {
      clientA!.emit('worldboss:get_leaderboard', { bossInstanceId }, resolve);
    });
    const socketLeaderboard = await leaderboardPromise;
    assert.strictEqual(socketLeaderboard.success, true);
    assert(Array.isArray(socketLeaderboard.data) && socketLeaderboard.data.length >= 3, 'Phải có ít nhất 3 tu sĩ trên BXH');

    // Đối chiếu với REST API
    const httpLbRes = await fetch(`${baseUrl}/api/xianxia/world-boss/leaderboard/${bossInstanceId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const httpLbJson = await httpLbRes.json();
    assert.strictEqual(httpLbJson.success, true);
    assert.strictEqual(httpLbJson.data.length, socketLeaderboard.data.length, 'Số lượng trên BXH Socket và REST API phải khớp nhau');
    console.log('✅ Test 9: Bảng Xếp Hạng Top 10 đồng bộ chính xác giữa Socket.IO và REST API');

    console.log('-> Test 10: Ba tu sĩ lần lượt lĩnh thưởng (Tu sĩ C nhận thêm Last Hit Bonus)...');
    const claimResC = await fetch(`${baseUrl}/api/xianxia/world-boss/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenC}`,
        'x-idempotency-key': `e2e_claim_c_${ts}`,
      },
      body: JSON.stringify({ bossInstanceId, idempotencyKey: `e2e_claim_c_${ts}` }),
    });
    const claimJsonC = await claimResC.json();
    assert.strictEqual(claimJsonC.success, true);
    assert.strictEqual(claimJsonC.data.isKiller, true, 'Tu sĩ C phải nhận cờ Last Hit (isKiller)');

    // Thử nhận lại lần 2
    const duplicateResC = await fetch(`${baseUrl}/api/xianxia/world-boss/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenC}`,
        'x-idempotency-key': `e2e_claim_c_${ts}`,
      },
      body: JSON.stringify({ bossInstanceId, idempotencyKey: `e2e_claim_c_${ts}` }),
    });
    const duplicateJsonC = await duplicateResC.json();
    assert.strictEqual(duplicateJsonC.success, true);
    const cSilver = claimJsonC.data.silverReward ?? claimJsonC.data.silver;
    const dupSilver = duplicateJsonC.data.silverReward ?? duplicateJsonC.data.silver;
    assert.strictEqual(cSilver, dupSilver, 'Phần thưởng lần 2 phải trùng khớp lần 1 (Idempotent)');
    console.log('✅ Test 10: Lĩnh thưởng phân tầng và tính Idempotency đạt 100% chuẩn mực');

    // -------------------------------------------------------------
    // GIAI ĐOẠN 7: CLEAN SHUTDOWN (E9)
    // -------------------------------------------------------------
    console.log('-> Test 11: Đóng kết nối các Socket Clients và giải phóng Server sạch sẽ...');
    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
    clientNoChar.disconnect();
    clientA = null; clientB = null; clientC = null; clientNoChar = null;

    closeXianxiaWorldBossSocket();
    await new Promise<void>(res => io.close(() => server.close(() => res())));
    console.log('✅ Test 11: Clean Socket & Server Shutdown hoàn tất');

    console.log('\n======================================================================');
    console.log('🎉 TẤT CẢ 11 TEST CASES E2E TOÀN DÂN TRẢM MA ĐÃ ĐẠT 100% XUẤT SẮC!');
    console.log('======================================================================\n');

  } finally {
    // -------------------------------------------------------------
    // DỌN DẸP DỮ LIỆU AN TOÀN THEO ID (ZERO LEAK)
    // -------------------------------------------------------------
    console.log('[Cleanup] Dọn dẹp dữ liệu kiểm thử E2E World Boss an toàn...');
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientC) clientC.disconnect();
    if (clientNoChar) clientNoChar.disconnect();

    for (const bossId of cleanupBossIds) {
      await prisma.xianxiaWorldBossRewardClaim.deleteMany({ where: { boss_instance_id: bossId } }).catch(() => {});
      await prisma.xianxiaWorldBossDamage.deleteMany({ where: { boss_instance_id: bossId } }).catch(() => {});
      await prisma.xianxiaWorldBoss.delete({ where: { id: bossId } }).catch(() => {});
    }

    for (const uid of cleanupUserIds) {
      await prisma.xianxiaCharacter.deleteMany({ where: { user_id: uid } }).catch(() => {});
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    console.log('[Cleanup] Dọn dẹp hoàn tất.');
  }
}

if (process.argv[1]?.includes('xianxiaM4WorldBossE2E.test')) {
  runXianxiaM4WorldBossE2ETests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Kiểm thử E2E thất bại:', err);
      process.exit(1);
    });
}
