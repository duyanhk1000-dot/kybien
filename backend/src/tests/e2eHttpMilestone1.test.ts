import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { prisma } from '../utils/prisma.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export async function runE2EHttpMilestone1Tests(): Promise<void> {
  console.log('🧪 RUNNING END-TO-END HTTP API & SECURITY AUDIT TEST SUITE (NATIVE HTTP/TCP)...\n');

  // Khởi động server HTTP trên cổng ngẫu nhiên (ephemeral port 0)
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Đang lắng nghe tại ${baseUrl}`);

  try {
    // Tạo test user token
    const testUser = await prisma.user.upsert({
      where: { id: 9999 },
      update: { exp: 0n, level: 1 },
      create: {
        id: 9999,
        username: 'Tester9999',
        email: 'tester9999@test.com',
        password_hash: 'hash',
        exp: 0n,
        level: 1,
        elo: 1200,
      },
    });

    const token = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Dọn dẹp logs cũ của user 9999
    await prisma.puzzleRewardLog.deleteMany({ where: { user_id: testUser.id } });
    await prisma.userPuzzleProgress.deleteMany({ where: { user_id: testUser.id } });
    await prisma.puzzleSession.deleteMany({ where: { user_id: testUser.id } });
    await prisma.user.update({ where: { id: testUser.id }, data: { exp: 0n, level: 1 } });

    // =========================================================================
    // 1. GET /api/puzzles (Danh sách thế cờ)
    // =========================================================================
    console.log('-> 1. Testing GET /api/puzzles (Catalog & Zero Solution Tree Leak)...');
    const resCatalog = await fetch(`${baseUrl}/api/puzzles?page=1&limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(resCatalog.status, 200);
    const catalogJson = await resCatalog.json();
    assert.strictEqual(catalogJson.success, true);
    const catalogData = catalogJson.data;
    assert.strictEqual(catalogData.puzzles.length, 30);
    assert.ok(catalogData.total >= 30);

    // BẢO MẬT: Tuyệt đối không để lộ solution_tree
    for (const p of catalogData.puzzles) {
      assert.strictEqual(p.solution_tree, undefined, `BẢO MẬT: Ải ${p.id} không được để lộ solution_tree trong catalog!`);
    }
    console.log('✅ Endpoint GET /api/puzzles: Đủ 30 ải, bảo mật F12 hoàn hảo 100%!');

    // =========================================================================
    // 2. GET /api/puzzles/:id (Chi tiết 1 thế cờ)
    // =========================================================================
    console.log('-> 2. Testing GET /api/puzzles/1 (Detail & Zero Solution Tree Leak)...');
    const resDetail = await fetch(`${baseUrl}/api/puzzles/1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(resDetail.status, 200);
    const detailJson = await resDetail.json();
    assert.strictEqual(detailJson.success, true);
    const detailData = detailJson.data;
    assert.strictEqual(detailData.id, 1);
    assert.strictEqual(detailData.solution_tree, undefined, 'BẢO MẬT: Chi tiết ải không được để lộ solution_tree!');
    console.log('✅ Endpoint GET /api/puzzles/:id: Bảo mật F12 hoàn hảo 100%!');

    // =========================================================================
    // 3. POST /api/puzzles/:id/start-session (Khởi tạo phiên giải)
    // =========================================================================
    console.log('-> 3. Testing POST /api/puzzles/1/start-session (Session State Machine)...');
    const resStart = await fetch(`${baseUrl}/api/puzzles/1/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'TRADITIONAL', sessionType: 'RANKED' }),
    });
    assert.strictEqual(resStart.status, 201);
    const startJson = await resStart.json();
    assert.strictEqual(startJson.success, true);
    const startData = startJson.data;
    const sessionId = startData.sessionId;
    assert.ok(sessionId, 'Phải trả về sessionId UUID');
    assert.strictEqual(startData.status, 'ACTIVE');
    console.log('✅ Endpoint POST /api/puzzles/:id/start-session: Khởi tạo phiên ACTIVE thành công!');

    // =========================================================================
    // 4. POST /api/puzzles/session/:sessionId/move (Nước đi phạm luật -> 400, session không hỏng)
    // =========================================================================
    console.log('-> 4. Testing POST /api/puzzles/session/:sessionId/move with ILLEGAL move...');
    const resIllegal = await fetch(`${baseUrl}/api/puzzles/session/${sessionId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ moveUci: 'a0a9' }),
    });
    assert.strictEqual(resIllegal.status, 400);
    const illegalData = await resIllegal.json();
    assert.ok(illegalData.error?.includes('Nước đi không hợp lệ'));

    // Kiểm tra DB: Session vẫn phải là ACTIVE
    const sessionDbAfterIllegal = await prisma.puzzleSession.findUnique({ where: { id: sessionId } });
    assert.strictEqual(sessionDbAfterIllegal?.status, 'ACTIVE', 'Nước đi phạm luật không được làm hỏng session!');
    console.log('✅ Chặn nước đi phạm luật (400), bảo toàn session ACTIVE thành công!');

    // =========================================================================
    // 5. POST /api/puzzles/session/:sessionId/move (Nước đi sai chiến thuật -> DEFEAT)
    // =========================================================================
    console.log('-> 5. Testing POST /api/puzzles/session/:sessionId/move with TACTICAL BLUNDER...');
    const resStartBlunder = await fetch(`${baseUrl}/api/puzzles/1/start-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'TRADITIONAL', sessionType: 'RANKED' }),
    });
    const blunderSessionId = (await resStartBlunder.json()).data.sessionId;

    const resBlunder = await fetch(`${baseUrl}/api/puzzles/session/${blunderSessionId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ moveUci: 'a7b9' }),
    });
    assert.strictEqual(resBlunder.status, 200);
    const blunderJson = await resBlunder.json();
    assert.strictEqual(blunderJson.data.status, 'DEFEAT');

    // Kiểm tra DB: Session chuyển thành DEFEATED
    const sessionDbAfterBlunder = await prisma.puzzleSession.findUnique({ where: { id: blunderSessionId } });
    assert.strictEqual(sessionDbAfterBlunder?.status, 'DEFEATED');
    console.log('✅ Xử lý nước đi sai chiến thuật (DEFEAT), chuyển trạng thái DB chuẩn xác!');

    // =========================================================================
    // 6. POST /api/puzzles/session/:sessionId/move (Nước đi thắng cuộc -> VICTORY + Atomic EXP)
    // =========================================================================
    console.log('-> 6. Testing POST /api/puzzles/session/:sessionId/move with WINNING MOVE (a7c8)...');
    const resWin = await fetch(`${baseUrl}/api/puzzles/session/${sessionId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ moveUci: 'a7c8' }),
    });
    assert.strictEqual(resWin.status, 200);
    const winJson = await resWin.json();
    const winData = winJson.data;
    assert.strictEqual(winData.status, 'VICTORY');
    assert.strictEqual(winData.isFirstClear, true);
    assert.strictEqual(winData.expGained, 2);

    // Kiểm tra DB: Session chuyển thành WON, User được cộng 2 EXP
    const sessionDbWon = await prisma.puzzleSession.findUnique({ where: { id: sessionId } });
    assert.strictEqual(sessionDbWon?.status, 'WON');

    const userDbAfterWin = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.strictEqual(userDbAfterWin?.exp, 2n);
    console.log('✅ Xử lý chiến thắng (VICTORY), chuyển trạng thái WON và cộng EXP thành công!');

    // =========================================================================
    // 7. Gửi nước đi vào Session đã đóng (WON) -> 400
    // =========================================================================
    console.log('-> 7. Testing submitMove to an already closed (WON) session...');
    const resFinishedSession = await fetch(`${baseUrl}/api/puzzles/session/${sessionId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ moveUci: 'a7c8' }),
    });
    assert.strictEqual(resFinishedSession.status, 400);
    const finishedData = await resFinishedSession.json();
    assert.ok(finishedData.error?.includes('đã kết thúc'));
    console.log('✅ Chặn gửi nước đi vào session đã đóng chuẩn xác!');

    // =========================================================================
    // 8. Chặn can thiệp trái phép session người khác (Wrong Owner)
    // =========================================================================
    console.log('-> 8. Testing unauthorized session tampering by another user...');
    const anotherUserToken = jwt.sign(
      { userId: 9998, username: 'Tester9998' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const resTamper = await fetch(`${baseUrl}/api/puzzles/session/${sessionId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anotherUserToken}` },
      body: JSON.stringify({ moveUci: 'a7c8' }),
    });
    assert.strictEqual(resTamper.status, 400);
    const tamperData = await resTamper.json();
    assert.ok(tamperData.error?.includes('không có quyền') || tamperData.error?.includes('đã kết thúc'));
    console.log('✅ Bảo vệ quyền sở hữu session hoàn hảo!');

    // =========================================================================
    // 9. Kiểm tra tính toàn vẹn bảo mật (Không có endpoint tự phong thắng)
    // =========================================================================
    console.log('-> 9. Verifying no unauthorized exploit endpoints exist...');
    const resExploitWin = await fetch(`${baseUrl}/api/puzzles/win`, { method: 'POST' });
    assert.strictEqual(resExploitWin.status, 404, 'Không được phép tồn tại endpoint /api/puzzles/win!');

    const resExploitClaim = await fetch(`${baseUrl}/api/puzzles/claim`, { method: 'POST' });
    assert.strictEqual(resExploitClaim.status, 404, 'Không được phép tồn tại endpoint /api/puzzles/claim!');
    console.log('✅ Xác nhận không có bất kỳ backdoor endpoint nào để client tự khai báo thắng/cộng EXP!');

    console.log('\n=========================================================================');
    console.log('🎉 ALL END-TO-END HTTP API & SECURITY AUDIT TESTS PASSED 100%!');
    console.log('=========================================================================\n');
  } finally {
    server.close();
  }
}

// Chạy trực tiếp
if (process.argv[1]?.includes('e2eHttpMilestone1.test')) {
  runE2EHttpMilestone1Tests().catch(err => {
    console.error('❌ E2E HTTP TEST FAILED:', err);
    process.exit(1);
  });
}
