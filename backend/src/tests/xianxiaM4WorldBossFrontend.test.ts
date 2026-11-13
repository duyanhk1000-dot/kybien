/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — KIỂM THỬ FRONTEND TOÀN DÂN TRẢM MA (M4.4B)
 * Kiểm chứng toàn diện:
 * 1. Cấu trúc HTML & File tài nguyên (/tien-lo.html, CSS responsive, /tienlo-worldboss.js)
 * 2. Khởi tạo World Boss Socket Client & Handshake JWT (/xianxia-worldboss)
 * 3. Đón nhận Realtime Snapshot, Realtime HP Update, Floating Damage, Leaderboard
 * 4. Trảm sát Ma Long & Phát sự kiện Defeated toàn phòng
 * 5. Lĩnh thưởng Trảm Ma và bảo vệ Idempotency
 * 6. Kiểm tra quy chuẩn Responsive Mobile (Touch targets, Media queries)
 * 7. Dọn dẹp dữ liệu an toàn tuyệt đối (Zero DB Leak)
 */

import assert from 'assert';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import app from '../app.js';
import { setupXianxiaWorldBossSocket } from '../socket/xianxiaWorldBossSocket.js';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../utils/prisma.js';
import { generateToken } from '../utils/jwt.js';

export async function runXianxiaM4WorldBossFrontendTests(): Promise<void> {
  console.log('\n======================================================================');
  console.log('🐉 [M4.4B TEST] BẮT ĐẦU KIỂM THỬ FRONTEND TOÀN DÂN TRẢM MA & RESPONSIVE');
  console.log('======================================================================');

  // Khởi tạo HTTP & Socket.IO server tích hợp cho bài test
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

  function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeoutMs = 6000): Promise<T> {
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

  try {
    // -------------------------------------------------------------
    // KHỐI 1: KIỂM THỬ GIAO DIỆN HTML & FILE SCRIPT (B1 & B2)
    // -------------------------------------------------------------
    console.log('-> Test 1: Kiểm tra trang giao diện /tien-lo.html có đầy đủ thành phần M4.4B...');
    const htmlRes = await fetch(`${baseUrl}/tien-lo.html`);
    assert.strictEqual(htmlRes.status, 200, 'Endpoint /tien-lo.html phải trả về 200 OK');
    const html = await htmlRes.text();

    // Kiểm tra nút mở modal trên header
    assert(html.includes('id="btn-open-worldboss"'), 'Phải có nút mở Toàn Dân Trảm Ma (#btn-open-worldboss)');
    assert(html.includes('🐉 Toàn Dân Trảm Ma'), 'Nút phải có nhãn "🐉 Toàn Dân Trảm Ma"');

    // Kiểm tra cấu trúc Modal Toàn Dân Trảm Ma
    assert(html.includes('id="worldboss-modal"'), 'Phải có Modal Toàn Dân Trảm Ma (#worldboss-modal)');
    assert(html.includes('id="wb-boss-name"'), 'Phải có phần tử hiển thị tên Boss (#wb-boss-name)');
    assert(html.includes('id="wb-status-pill"'), 'Phải có huy hiệu trạng thái (#wb-status-pill)');
    assert(html.includes('id="wb-countdown"'), 'Phải có đồng hồ đếm ngược (#wb-countdown)');
    assert(html.includes('id="wb-hp-track"'), 'Phải có khung thanh máu (#wb-hp-track)');
    assert(html.includes('id="wb-hp-fill"'), 'Phải có thanh máu trượt (#wb-hp-fill)');
    assert(html.includes('id="wb-hp-text"'), 'Phải có số hiển thị máu (#wb-hp-text)');
    assert(html.includes('id="wb-hp-pct"'), 'Phải có phần trăm máu (#wb-hp-pct)');

    // Kiểm tra các nút hành động chiến đấu
    assert(html.includes('id="wb-btn-attack"'), 'Phải có nút Xuất Chiêu (#wb-btn-attack)');
    assert(html.includes('id="wb-btn-auto"'), 'Phải có nút Tự Động Xuất Chiêu (#wb-btn-auto)');
    assert(html.includes('id="wb-defeat-section"'), 'Phải có vùng thông báo trảm sát (#wb-defeat-section)');
    assert(html.includes('id="wb-btn-claim"'), 'Phải có nút Nhận Thưởng Trảm Ma (#wb-btn-claim)');

    // Kiểm tra Bảng Xếp Hạng & Nhật Ký
    assert(html.includes('id="wb-leaderboard-body"'), 'Phải có thân bảng xếp hạng Top 10 (#wb-leaderboard-body)');
    assert(html.includes('id="wb-combat-feed"'), 'Phải có nhật ký chiến trường thế giới (#wb-combat-feed)');
    assert(html.includes('id="wb-my-damage"'), 'Phải có hiển thị sát thương cá nhân (#wb-my-damage)');
    assert(html.includes('id="wb-my-rank"'), 'Phải có hiển thị thứ hạng cá nhân (#wb-my-rank)');

    // Kiểm tra script tag
    assert(html.includes('tienlo-worldboss.js'), 'Trang phải nạp kịch bản tienlo-worldboss.js');
    console.log('✅ Test 1: Giao diện /tien-lo.html tích hợp hoàn chỉnh Modal và các phần tử World Boss');

    console.log('-> Test 2: Kiểm tra mô-đun kịch bản /tienlo-worldboss.js...');
    const scriptRes = await fetch(`${baseUrl}/tienlo-worldboss.js`);
    assert.strictEqual(scriptRes.status, 200, 'Endpoint /tienlo-worldboss.js phải trả về 200 OK');
    const script = await scriptRes.text();

    assert(script.includes('initSocket'), 'Phải có phương thức initSocket');
    assert(script.includes('openModal'), 'Phải có phương thức openModal');
    assert(script.includes('attack'), 'Phải có phương thức attack');
    assert(script.includes('toggleAutoAttack'), 'Phải có phương thức toggleAutoAttack');
    assert(script.includes('claimReward'), 'Phải có phương thức claimReward');
    assert(script.includes('applySnapshot'), 'Phải có phương thức applySnapshot');
    assert(script.includes('handleHpUpdated'), 'Phải có phương thức handleHpUpdated');
    assert(script.includes('handleBossDefeated'), 'Phải có phương thức handleBossDefeated');
    assert(script.includes('spawnFloatingDamage'), 'Phải có phương thức spawnFloatingDamage');
    assert(script.includes('WORLDBOSS_ATTACK_COOLDOWN'), 'Phải có mã lỗi Cooldown');
    console.log('✅ Test 2: Mô-đun tienlo-worldboss.js tải thành công với đầy đủ các hàm điều hành');

    console.log('-> Test 3: Kiểm tra tiêu chuẩn Mobile Responsive trong CSS...');
    assert(html.includes('@media (max-width: 768px)'), 'Phải có Media Query cho màn hình máy tính bảng / di động (<= 768px)');
    assert(html.includes('@media (max-width: 480px)'), 'Phải có Media Query cho điện thoại nhỏ (<= 480px)');
    assert(html.includes('min-height: 48px'), 'Nút xuất chiêu trên di động phải đạt tối thiểu 48px chiều cao chạm');
    console.log('✅ Test 3: Tiêu chuẩn Mobile Responsive đạt chuẩn giao diện cảm ứng');

    // -------------------------------------------------------------
    // KHỐI 2: CHUẨN BỊ TÀI KHOẢN VÀ KẾT NỐI REALTIME CLIENTS (B4)
    // -------------------------------------------------------------
    console.log('-> Test 4: Khởi tạo 2 tu sĩ thử nghiệm A và B...');
    const ts = Date.now();
    const unameA = `wb_fe_user_a_${ts}`;
    const userA = await prisma.user.create({
      data: {
        username: unameA,
        email: `${unameA}@example.com`,
        password_hash: 'hash_test_wb_fe',
      },
    });
    cleanupUserIds.push(userA.id);

    const charA = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userA.id,
        name: `Đao Khách A_${ts % 10000}`,
        realm: 'TRUC_CO_1',
        level: 15,
        health: 300,
        max_health: 300,
        physique: 25,
        comprehension: 20,
        silver: 1000,
      },
    });

    const unameB = `wb_fe_user_b_${ts}`;
    const userB = await prisma.user.create({
      data: {
        username: unameB,
        email: `${unameB}@example.com`,
        password_hash: 'hash_test_wb_fe',
      },
    });
    cleanupUserIds.push(userB.id);

    const charB = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userB.id,
        name: `Kiếm Tiên B_${ts % 10000}`,
        realm: 'TRUC_CO_3',
        level: 18,
        health: 350,
        max_health: 350,
        physique: 30,
        comprehension: 25,
        silver: 1500,
      },
    });

    const tokenA = generateToken({ userId: userA.id, username: userA.username, email: userA.email });
    const tokenB = generateToken({ userId: userB.id, username: userB.username, email: userB.email });

    // Kết nối Socket Client A & B
    clientA = ClientSocket(socketUrl, {
      auth: { token: tokenA },
      transports: ['websocket'],
      forceNew: true,
    });
    clientB = ClientSocket(socketUrl, {
      auth: { token: tokenB },
      transports: ['websocket'],
      forceNew: true,
    });

    await Promise.all([
      new Promise<void>((res, rej) => {
        clientA!.on('connect', () => res());
        clientA!.on('connect_error', rej);
      }),
      new Promise<void>((res, rej) => {
        clientB!.on('connect', () => res());
        clientB!.on('connect_error', rej);
      }),
    ]);
    console.log('✅ Test 4: Hai client A & B kết nối realtime thành công qua Handshake JWT');

    // -------------------------------------------------------------
    // KHỐI 3: TRIỆU HOÁN MA LONG & GIA NHẬP ARENA
    // -------------------------------------------------------------
    console.log('-> Test 5: Triệu hoán Xích Diễm Ma Long phiên bản thử nghiệm (100,000 HP)...');
    const spawnRes = await fetch(`${baseUrl}/api/xianxia/world-boss/spawn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bossId: `dragon_fe_test_${ts}`,
        name: 'Xích Diễm Ma Long Thử Nghiệm',
        maxHp: 100000,
        durationMinutes: 10,
      }),
    });
    const spawnJson = await spawnRes.json();
    assert.strictEqual(spawnJson.success, true, 'Triệu hoán Ma Long phải thành công');
    const bossInstanceId = spawnJson.data.id;
    cleanupBossIds.push(bossInstanceId);

    console.log('-> Test 6: Client A và B gia nhập phòng Ma Long và nhận Authoritative Snapshot...');
    const snapshotPromiseA = waitForEvent(clientA!, 'worldboss:snapshot');
    clientA.emit('worldboss:join', { bossInstanceId });
    clientB.emit('worldboss:join', { bossInstanceId });

    const snapA = await snapshotPromiseA;
    assert.strictEqual(snapA.boss.id, bossInstanceId, 'Snapshot phải trả đúng bossInstanceId');
    assert.strictEqual(snapA.boss.current_hp ?? snapA.boss.currentHp, 100000, 'Máu khởi đầu phải là 100000');
    console.log('✅ Test 6: Nhận thành công Authoritative Snapshot từ máy chủ');

    // -------------------------------------------------------------
    // KHỐI 4: KỊCH CHIẾN REALTIME & BROADCAST CẬP NHẬT MÁU
    // -------------------------------------------------------------
    console.log('-> Test 7: Client A xuất chiêu worldboss:attack, cả 2 client cùng nhận hp_updated...');
    const hpUpdatePromiseA = waitForEvent(clientA!, 'worldboss:hp_updated');
    const hpUpdatePromiseB = waitForEvent(clientB!, 'worldboss:hp_updated');

    clientA.emit('worldboss:attack', { bossInstanceId });

    const [hpA, hpB] = await Promise.all([hpUpdatePromiseA, hpUpdatePromiseB]);
    assert.strictEqual(hpA.bossInstanceId, bossInstanceId, 'Cập nhật máu phải khớp ID boss');
    assert.strictEqual(hpB.bossInstanceId, bossInstanceId, 'Client B cũng phải nhận cùng ID boss');
    assert.strictEqual(hpA.currentHp, hpB.currentHp, 'Máu đồng bộ nguyên tử giữa các client');
    const dmgDone = hpA.damageDealt ?? hpA.damage;
    assert(dmgDone > 0, 'Sát thương phải lớn hơn 0');
    assert.strictEqual(hpA.attackerName, charA.name, 'Người xuất chiêu phải là Đao Khách A');
    console.log(`✅ Test 7: Xuất chiêu thành công, gây ${dmgDone} sát thương, đồng bộ cho toàn bộ tu sĩ`);

    // -------------------------------------------------------------
    // KHỐI 5: TRẢM SÁT MA LONG & BROADCAST DEFEATED
    // -------------------------------------------------------------
    console.log('-> Test 8: Đưa máu Ma Long về mức thấp và thực hiện đòn kết liễu (Last Hit)...');
    // Cập nhật máu còn 1 để Client B kết liễu
    await prisma.xianxiaWorldBoss.update({
      where: { id: bossInstanceId },
      data: { current_hp: 1, status: 'ACTIVE' },
    });

    const defeatedPromiseA = waitForEvent(clientA!, 'worldboss:defeated');
    const defeatedPromiseB = waitForEvent(clientB!, 'worldboss:defeated');

    clientB.emit('worldboss:attack', { bossInstanceId });

    const [defA, defB] = await Promise.all([defeatedPromiseA, defeatedPromiseB]);
    assert.strictEqual(defA.bossInstanceId, bossInstanceId);
    assert.strictEqual(defB.bossInstanceId, bossInstanceId);
    const killerIdReceived = defA.killerId ?? defA.killerCharacterId;
    assert.strictEqual(killerIdReceived, charB.id, 'Người kết liễu phải là Kiếm Tiên B');
    assert.strictEqual(defA.killerName, charB.name, 'Tên người kết liễu phải đồng bộ');
    console.log('✅ Test 8: Ma Long bị trảm sát, phát sự kiện worldboss:defeated vinh danh người kết liễu');

    // -------------------------------------------------------------
    // KHỐI 6: LĨNH THƯỞNG TRẢM MA VÀ BẢO VỆ IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('-> Test 9: Tu sĩ B lĩnh thưởng qua HTTP REST API (có Last Hit bonus)...');
    const claimResB = await fetch(`${baseUrl}/api/xianxia/world-boss/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`,
        'x-idempotency-key': `wb_test_claim_b_${ts}`,
      },
      body: JSON.stringify({
        bossInstanceId,
        idempotencyKey: `wb_test_claim_b_${ts}`,
      }),
    });
    const claimJsonB = await claimResB.json();
    assert.strictEqual(claimJsonB.success, true, 'Lĩnh thưởng B phải thành công');
    assert.strictEqual(claimJsonB.data.isKiller, true, 'B phải nhận cờ Last Hit (isKiller)');
    const bExp = claimJsonB.data.expReward ?? claimJsonB.data.exp ?? 0;
    const bSilver = claimJsonB.data.silverReward ?? claimJsonB.data.silver ?? 0;
    assert(bExp > 0, 'Phải nhận EXP');
    assert(bSilver > 0, 'Phải nhận Bạc');
    console.log(`✅ Test 9: Lĩnh thưởng thành công (+${bExp} EXP, +${bSilver} Bạc, Last Hit Bonus)`);

    console.log('-> Test 10: Thử lĩnh thưởng lần 2 với cùng key -> Trả kết quả cũ (Idempotent)...');
    const duplicateRes = await fetch(`${baseUrl}/api/xianxia/world-boss/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`,
        'x-idempotency-key': `wb_test_claim_b_${ts}`,
      },
      body: JSON.stringify({
        bossInstanceId,
        idempotencyKey: `wb_test_claim_b_${ts}`,
      }),
    });
    const duplicateJson = await duplicateRes.json();
    assert.strictEqual(duplicateJson.success, true);
    const dupSilver = duplicateJson.data.silverReward ?? duplicateJson.data.silver;
    assert.strictEqual(dupSilver, bSilver, 'Bạc phải trùng khớp với lần 1');
    console.log('✅ Test 10: Chống nhận thưởng đúp (Idempotency) hoạt động hoàn hảo');

    console.log('\n======================================================================');
    console.log('🎉 TẤT CẢ 10 TEST CASES FRONTEND TOÀN DÂN TRẢM MA ĐÃ ĐẠT 100%!');
    console.log('======================================================================\n');

  } finally {
    // -------------------------------------------------------------
    // DỌN DẸP AN TOÀN TUYỆT ĐỐI (ZERO LEAK)
    // -------------------------------------------------------------
    console.log('[Cleanup] Dọn dẹp tài nguyên và dữ liệu kiểm thử Frontend World Boss...');
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();

    await new Promise<void>(res => io.close(() => server.close(() => res())));

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

if (process.argv[1]?.includes('xianxiaM4WorldBossFrontend.test')) {
  runXianxiaM4WorldBossFrontendTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Kiểm thử thất bại:', err);
      process.exit(1);
    });
}
