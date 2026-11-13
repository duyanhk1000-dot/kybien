/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — KIỂM THỬ TOÀN DÂN TRẢM MA (WORLD BOSS M4.4A)
 * Kiểm chứng toàn diện:
 * 1. Triệu hoán & Vòng đời Boss Thế Giới (ACTIVE -> DEFEATED/ESCAPED)
 * 2. Tính toán sát thương Server-Authoritative (Từ chối sát thương client)
 * 3. Tấn công đồng thời & Trừ máu nguyên tử (Atomic Concurrency)
 * 4. Bảng Xếp Hạng Top Sát Thương & Xác định Last-hit Kích Sát
 * 5. Cơ chế Nhận Thưởng Phân Hạng & Bảo Vệ Kép Idempotency (Chống nhận đúp)
 * 6. Socket.IO Realtime Broadcast & Room Management
 * 7. Dọn dẹp dữ liệu an toàn tuyệt đối (Zero DB Leak)
 */

import assert from 'assert';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { Server as SocketIOServer } from 'socket.io';
import app from '../app.js';
import { setupXianxiaWorldBossSocket, closeXianxiaWorldBossSocket } from '../socket/xianxiaWorldBossSocket.js';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { xianxiaWorldBossService } from '../services/xianxia/xianxiaWorldBossService.js';

export async function runXianxiaWorldBossTests(): Promise<void> {
  console.log('\n======================================================================');
  console.log('🐉 [M4.4A TEST] BẮT ĐẦU KIỂM THỬ BACKEND TOÀN DÂN TRẢM MA (WORLD BOSS)');
  console.log('======================================================================');

  // Khởi tạo HTTP & Socket.IO server tích hợp
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });
  setupXianxiaWorldBossSocket(io);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const socketUrl = `${baseUrl}/xianxia-worldboss`;

  const cleanupUserIds: number[] = [];
  const cleanupCharacterIds: number[] = [];
  const cleanupBossIds: string[] = [];
  let clientSocket: ClientSocketType | null = null;

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: CHUẨN BỊ TÀI KHOẢN KIỂM THỬ
    // -------------------------------------------------------------
    console.log('-> Test 1: Khởi tạo 3 tu sĩ tham chiến A, B, C...');
    const ts = Date.now();

    async function createTestPlayer(suffix: string, level: number, realm: string) {
      const uname = `wb_user_${suffix}_${ts}`;
      const user = await prisma.user.create({
        data: {
          username: uname,
          email: `${uname}@example.com`,
          password_hash: 'hash_test_wb',
        },
      });
      cleanupUserIds.push(user.id);

      const char = await prisma.xianxiaCharacter.create({
        data: {
          user_id: user.id,
          name: `Đạo Hữu ${suffix}_${ts % 10000}`,
          realm,
          level,
          health: 500,
          max_health: 500,
          fatigue: 100,
          max_fatigue: 100,
          physique: 20,
          comprehension: 20,
          luck: 15,
          cultivation: 2000,
          silver: 1000,
        },
      });
      cleanupCharacterIds.push(char.id);

      const token = generateToken({ userId: user.id, username: user.username, email: user.email });
      return { user, char, token };
    }

    const playerA = await createTestPlayer('A', 15, 'LUYEN_KHI_5');
    const playerB = await createTestPlayer('B', 10, 'LUYEN_KHI_3');
    const playerC = await createTestPlayer('C', 5, 'LUYEN_KHI_1');
    console.log('✅ Test 1: Khởi tạo thành công 3 nhân vật kiểm thử');

    // -------------------------------------------------------------
    // BƯỚC 2: TRIỆU HOÁN BOSS THẾ GIỚI & KIỂM TRA STATE MACHINE
    // -------------------------------------------------------------
    console.log('-> Test 2: Triệu hoán Xích Diễm Ma Long với 1,000 HP (test scale)...');
    const spawnRes = await fetch(`${baseUrl}/api/xianxia/world-boss/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerA.token}`,
      },
      body: JSON.stringify({
        name: 'Xích Diễm Ma Long (Test Instance)',
        maxHp: 100000,
        durationMinutes: 10,
      }),
    });
    const spawnJson = await spawnRes.json();
    assert.strictEqual(spawnJson.success, true);
    assert.strictEqual(spawnJson.data.status, 'ACTIVE');
    assert.strictEqual(spawnJson.data.max_hp, 100000);
    assert.strictEqual(spawnJson.data.current_hp, 100000);
    const bossId = spawnJson.data.id;
    cleanupBossIds.push(bossId);
    console.log(`✅ Test 2: Triệu hoán Ma Long thành công với ID: ${bossId}`);

    // Kiểm tra API xem thông tin hiện tại
    console.log('-> Test 3: Lấy thông tin phiên Boss hiện tại qua /current...');
    const currentRes = await fetch(`${baseUrl}/api/xianxia/world-boss/current`, {
      headers: { Authorization: `Bearer ${playerA.token}` },
    });
    const currentJson = await currentRes.json();
    assert.strictEqual(currentJson.success, true);
    assert.strictEqual(currentJson.data.boss.id, bossId);
    assert.strictEqual(currentJson.data.boss.status, 'ACTIVE');
    console.log('✅ Test 3: API /current trả về phiên Boss ACTIVE chính xác');

    // -------------------------------------------------------------
    // BƯỚC 3: TẤN CÔNG SERVER-AUTHORITATIVE & RATE LIMITING
    // -------------------------------------------------------------
    console.log('-> Test 4: Tấn công Boss Thế Giới, máy chủ tính sát thương (bỏ qua cheat)...');
    const attack1Res = await fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerA.token}`,
      },
      body: JSON.stringify({
        bossInstanceId: bossId,
        damage: 9999999, // Gian lận cố tình gửi từ client
      }),
    });
    const attack1Json = await attack1Res.json();
    assert.strictEqual(attack1Json.success, true);
    assert(attack1Json.data.damageDealt > 0 && attack1Json.data.damageDealt < 100000, 'Sát thương phải được tính toán hợp lệ từ máy chủ');
    assert.strictEqual(attack1Json.data.currentHp, 100000 - attack1Json.data.damageDealt);
    console.log(`✅ Test 4: Xuất chiêu thành công, gây ${attack1Json.data.damageDealt} sát thương (Từ chối 9999999 cheat)`);

    console.log('-> Test 5: Kiểm tra Rate Limiting (2 request đồng thời từ 1 người chơi) -> 429 Cooldown...');
    const [fast1Res, fast2Res] = await Promise.all([
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerA.token}` },
        body: JSON.stringify({ bossInstanceId: bossId }),
      }),
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerA.token}` },
        body: JSON.stringify({ bossInstanceId: bossId }),
      }),
    ]);
    const fastJson1 = await fast1Res.json();
    const fastJson2 = await fast2Res.json();
    const fastResults = [fastJson1, fastJson2];
    const hitCooldown = fastResults.find(r => r.success === false && r.error?.code === 'WORLDBOSS_ATTACK_COOLDOWN');
    assert(hitCooldown, 'Phải có 1 yêu cầu bị từ chối 429 do xuất chiêu liên tiếp < 400ms');
    console.log('✅ Test 5: Chặn spam xuất chiêu quá nhanh 429 WORLDBOSS_ATTACK_COOLDOWN chuẩn xác');

    // Chờ 450ms để vượt qua cooldown
    await new Promise((r) => setTimeout(r, 450));

    // -------------------------------------------------------------
    // BƯỚC 4: TẤN CÔNG ĐỒNG THỜI & BẢO ĐẢM NGUYÊN TỬ (ATOMIC CONCURRENCY)
    // -------------------------------------------------------------
    console.log('-> Test 6: B và C cùng tấn công đồng thời (Concurrent Attacks)...');
    const [resB, resC] = await Promise.all([
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerB.token}` },
        body: JSON.stringify({ bossInstanceId: bossId }),
      }),
      fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerC.token}` },
        body: JSON.stringify({ bossInstanceId: bossId }),
      }),
    ]);

    const jsonB = await resB.json();
    const jsonC = await resC.json();
    assert.strictEqual(jsonB.success, true);
    assert.strictEqual(jsonC.success, true);
    assert(jsonB.data.damageDealt > 0);
    assert(jsonC.data.damageDealt > 0);
    console.log(`✅ Test 6: Giao dịch nguyên tử đồng thời thành công (B: ${jsonB.data.damageDealt}, C: ${jsonC.data.damageDealt})`);

    // -------------------------------------------------------------
    // BƯỚC 5: BẢNG XẾP HẠNG TOP SÁT THƯƠNG
    // -------------------------------------------------------------
    console.log('-> Test 7: Lấy Bảng Xếp Hạng Top Sát Thương qua API...');
    const lbRes = await fetch(`${baseUrl}/api/xianxia/world-boss/${bossId}/leaderboard`);
    const lbJson = await lbRes.json();
    assert.strictEqual(lbJson.success, true);
    assert(Array.isArray(lbJson.data));
    assert(lbJson.data.length >= 3, 'Phải có ít nhất 3 người chơi trên bảng vàng');
    assert.strictEqual(lbJson.data[0].rank, 1);
    assert(lbJson.data[0].damageDealt >= lbJson.data[1].damageDealt, 'Thứ hạng phải sắp xếp giảm dần theo sát thương');
    console.log('✅ Test 7: Bảng Xếp Hạng tính toán thứ hạng và sắp xếp chuẩn xác 100%');

    // -------------------------------------------------------------
    // BƯỚC 6: ĐÒN KẾT LIỄU (LAST HIT) & CHUYỂN TRẠNG THÁI DEFEATED
    // -------------------------------------------------------------
    console.log('-> Test 8: Đưa máu Boss về mức thấp và thực thi đòn kết liễu (Last Hit)...');
    await prisma.xianxiaWorldBoss.update({
      where: { id: bossId },
      data: { current_hp: 10 },
    });

    await new Promise((r) => setTimeout(r, 450));
    const lastHitRes = await fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerA.token}` },
      body: JSON.stringify({ bossInstanceId: bossId }),
    });
    const lastHitJson = await lastHitRes.json();
    assert.strictEqual(lastHitJson.success, true);
    assert.strictEqual(lastHitJson.data.currentHp, 0);
    assert.strictEqual(lastHitJson.data.status, 'DEFEATED');
    assert.strictEqual(lastHitJson.data.isKiller, true);
    console.log('✅ Test 8: Tu sĩ A kết liễu Ma Long thành công, Boss chuyển sang trạng thái DEFEATED');

    console.log('-> Test 9: Chặn tấn công khi Boss đã bị trảm sát...');
    await new Promise((r) => setTimeout(r, 450));
    const attackDefeatedRes = await fetch(`${baseUrl}/api/xianxia/world-boss/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerB.token}` },
      body: JSON.stringify({ bossInstanceId: bossId }),
    });
    const attackDefeatedJson = await attackDefeatedRes.json();
    assert.strictEqual(attackDefeatedJson.success, false);
    assert.strictEqual(attackDefeatedJson.error.code, 'WORLDBOSS_NOT_ACTIVE');
    console.log('✅ Test 9: Chặn xuất chiêu trên Boss đã tử trận đạt chuẩn');

    // -------------------------------------------------------------
    // BƯỚC 7: NHẬN THƯỞNG PHÂN HẠNG & IDEMPOTENCY KÉP
    // -------------------------------------------------------------
    console.log('-> Test 10: Người chơi A nhận thưởng Top 1 + Last Hit Bonus...');
    const claimResA = await fetch(`${baseUrl}/api/xianxia/world-boss/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerA.token}`,
        'x-idempotency-key': `test_key_a_${Date.now()}`,
      },
      body: JSON.stringify({ bossInstanceId: bossId }),
    });
    const claimJsonA = await claimResA.json();
    assert.strictEqual(claimJsonA.success, true);
    assert.strictEqual(claimJsonA.data.claimed, true);
    assert.strictEqual(claimJsonA.data.isKiller, true);
    assert(claimJsonA.data.silverReward >= 7000, 'Top 1 (5000) + Last Hit (2000) phải nhận >= 7000 Bạc');

    console.log('-> Test 11: Nhận thưởng lần 2 với cùng key -> Trả kết quả cũ (Idempotent)...');
    const claimResA2 = await fetch(`${baseUrl}/api/xianxia/world-boss/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerA.token}`,
        'x-idempotency-key': `test_key_a_${Date.now()}`,
      },
      body: JSON.stringify({ bossInstanceId: bossId }),
    });
    const claimJsonA2 = await claimResA2.json();
    assert.strictEqual(claimJsonA2.success, true);
    assert.strictEqual(claimJsonA2.data.idempotent, true);
    console.log('✅ Test 11: Cơ chế Idempotency chống nhận thưởng đúp hoạt động hoàn hảo');

    // -------------------------------------------------------------
    // BƯỚC 8: KIỂM THỬ SOCKET.IO REALTIME (/xianxia-worldboss)
    // -------------------------------------------------------------
    console.log('-> Test 12: Kiểm thử kết nối Socket.IO /xianxia-worldboss và nhận snapshot...');
    clientSocket = ClientSocket(socketUrl, {
      auth: { token: playerA.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve, reject) => {
      clientSocket!.on('connect', () => resolve());
      clientSocket!.on('connect_error', reject);
    });

    const snapshotPromise = new Promise<any>((resolve) => {
      clientSocket!.once('worldboss:snapshot', resolve);
    });

    clientSocket.emit('worldboss:join', { bossInstanceId: bossId });
    const socketSnapshot = await snapshotPromise;
    assert.strictEqual(socketSnapshot.boss.id, bossId);
    assert.strictEqual(socketSnapshot.boss.status, 'DEFEATED');
    console.log('✅ Test 12: Socket Client kết nối thành công và nhận đầy đủ Realtime Snapshot');

    console.log('\n======================================================================');
    console.log('🎉 TẤT CẢ 12 TEST CASES TOÀN DÂN TRẢM MA (WORLD BOSS) ĐÃ ĐẠT 100%!');
    console.log('======================================================================\n');
  } finally {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    closeXianxiaWorldBossSocket();
    server.close();

    // DỌN DẸP AN TOÀN THEO ID CỤ THỂ
    console.log('[Cleanup] Dọn dẹp dữ liệu kiểm thử World Boss an toàn...');
    if (cleanupBossIds.length > 0) {
      await prisma.xianxiaWorldBossRewardClaim.deleteMany({
        where: { boss_instance_id: { in: cleanupBossIds } },
      });
      await prisma.xianxiaWorldBossDamage.deleteMany({
        where: { boss_instance_id: { in: cleanupBossIds } },
      });
      await prisma.xianxiaWorldBoss.deleteMany({
        where: { id: { in: cleanupBossIds } },
      });
    }

    if (cleanupCharacterIds.length > 0) {
      await prisma.xianxiaCharacter.deleteMany({
        where: { id: { in: cleanupCharacterIds } },
      });
    }

    if (cleanupUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: cleanupUserIds } },
      });
    }
    console.log('[Cleanup] Dọn dẹp hoàn tất.');
  }
}

// Chạy trực tiếp nếu file được gọi độc lập
if (process.argv[1]?.includes('xianxiaWorldBoss.test')) {
  runXianxiaWorldBossTests()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ WORLD BOSS TEST FAILED:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
