import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { prisma } from '../utils/prisma.js';
import { xianxiaPvpService } from '../services/xianxia/xianxiaPvpService.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export async function runXianxiaM4PvpTests(): Promise<void> {
  console.log('\n--- ⚔️ [TEST] BẮT ĐẦU KIỂM THỬ MỤC 4.2: ĐẤU TRƯỜNG THIÊN KIÊU (ASYNC PVP) ---');

  // Khởi động HTTP server trên ephemeral port 0
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[PVP Test Server] Lắng nghe kiểm thử tại ${baseUrl}`);

  try {
    // Dọn dẹp dữ liệu kiểm thử cũ nếu có
    const testUsernames = [
      'm4_pvp_attacker_test',
      'm4_pvp_defender_test',
      'm4_pvp_third_party_test',
      'm4_pvp_pair_a',
      'm4_pvp_pair_b',
      'm4_pvp_conc_a',
      'm4_pvp_conc_b',
    ];

    const oldUsers = await prisma.user.findMany({
      where: { username: { in: testUsernames } },
      select: { id: true },
    });
    const oldUserIds = oldUsers.map((u) => u.id);

    if (oldUserIds.length > 0) {
      await prisma.xianxiaPvpMatch.deleteMany({
        where: {
          OR: [
            { attacker: { user_id: { in: oldUserIds } } },
            { defender: { user_id: { in: oldUserIds } } },
          ],
        },
      });
      await prisma.xianxiaInventoryItem.deleteMany({
        where: { character: { user_id: { in: oldUserIds } } },
      });
      await prisma.xianxiaCharacter.deleteMany({
        where: { user_id: { in: oldUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: oldUserIds } },
      });
    }

    // Khởi tạo 3 Người dùng kiểm thử
    // User 1: Attacker (Lv 5, Luyện Khí 3, 100 Danh Vọng, 100 Thể Lực, 100 Bạc)
    const userAttacker = await prisma.user.create({
      data: {
        username: 'm4_pvp_attacker_test',
        email: 'attacker@pvp.test',
        password_hash: 'secret_attacker',
      },
    });
    const charAttacker = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userAttacker.id,
        name: 'Độc Cô Kiếm Khách',
        realm: 'LUYEN_KHI_3',
        level: 5,
        cultivation: 450,
        exp: 80,
        physique: 20,
        comprehension: 20,
        health: 250,
        max_health: 250,
        fatigue: 100,
        max_fatigue: 100,
        reputation: 100,
        silver: 100,
        stat_points: 0,
      },
    });

    // User 2: Defender (Lv 4, Luyện Khí 2, 100 Danh Vọng, 100 Thể Lực)
    const userDefender = await prisma.user.create({
      data: {
        username: 'm4_pvp_defender_test',
        email: 'defender@pvp.test',
        password_hash: 'secret_defender',
      },
    });
    const charDefender = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userDefender.id,
        name: 'Bạch Y Tiên Tử',
        realm: 'LUYEN_KHI_2',
        level: 4,
        cultivation: 320,
        exp: 40,
        physique: 18,
        comprehension: 18,
        health: 220,
        max_health: 220,
        fatigue: 100,
        max_fatigue: 100,
        reputation: 100,
        silver: 100,
        stat_points: 0,
      },
    });

    // User 3: Người thứ ba không liên quan (Third-party User)
    const userThird = await prisma.user.create({
      data: {
        username: 'm4_pvp_third_party_test',
        email: 'thirdparty@pvp.test',
        password_hash: 'secret_third',
      },
    });
    const charThird = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userThird.id,
        name: 'Lữ Khách Qua Đường',
        realm: 'PHAM_NHAN',
        level: 1,
        cultivation: 10,
        exp: 0,
        reputation: 100,
        silver: 50,
      },
    });

    // Tạo JWT Token cho 3 người dùng
    const tokenAttacker = jwt.sign(
      { userId: userAttacker.id, username: userAttacker.username },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const tokenDefender = jwt.sign(
      { userId: userDefender.id, username: userDefender.username },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const tokenThird = jwt.sign(
      { userId: userThird.id, username: userThird.username },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // ==========================================
    // TEST 1: Lấy Danh Sách Đối Thủ Trên Lôi Đài (GET /opponents)
    // ==========================================
    console.log('-> Test 1: Kiểm tra lấy danh sách đối thủ (không chứa chính mình)...');
    const opponents = await xianxiaPvpService.getOpponents(userAttacker.id, 10);
    assert(Array.isArray(opponents), 'Danh sách đối thủ phải là mảng');
    assert(opponents.length >= 2, 'Phải có ít nhất 2 đối thủ trong hệ thống');
    const hasSelf = opponents.some((op) => op.id === charAttacker.id);
    assert.strictEqual(hasSelf, false, 'Tuyệt đối không có chính mình trong danh sách đối thủ');
    const foundDefender = opponents.find((op) => op.id === charDefender.id);
    assert(foundDefender !== undefined, 'Defender phải có mặt trong danh sách đối thủ');
    console.log('✅ 1. Danh sách đối thủ gợi ý chuẩn xác, loại trừ 100% bản thân!');

    // ==========================================
    // TEST 2: Chặn Tự Khiêu Chiến Chính Mình
    // ==========================================
    console.log('-> Test 2: Kiểm tra chặn tự khiêu chiến chính mình trên lôi đài...');
    await assert.rejects(
      async () => {
        await xianxiaPvpService.challengeOpponent(userAttacker.id, charAttacker.id);
      },
      (err: any) => {
        assert(err.message.includes('không thể tự khiêu chiến chính mình'));
        return true;
      },
      'Phải ném lỗi khi tự khiêu chiến chính mình'
    );
    console.log('✅ 2. Cơ chế chặn tự khiêu chiến chính mình hoạt động hoàn hảo!');

    // ==========================================
    // TEST 3: Tạo Trận Đấu & Tạo Snapshot Bất Biến Của Đối Thủ
    // ==========================================
    console.log('-> Test 3: Tạo trận đấu và kiểm tra Snapshot đối thủ bất biến...');
    const challengeKey1 = `idemp_test_pvp_1_${Date.now()}`;
    const matchRes1 = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charDefender.id,
      challengeKey1
    );

    assert(matchRes1.matchId, 'Phải có matchId');
    assert.strictEqual(matchRes1.idempotent, false);
    assert(matchRes1.turnsCount >= 1 && matchRes1.turnsCount <= 30, 'Số lượt chiến đấu phải nằm trong khoảng 1 -> 30');
    assert(['ATTACKER_WIN', 'DEFENDER_WIN', 'DRAW_ADVANTAGE', 'DRAW_TIMEOUT'].includes(matchRes1.result));

    // Đọc snapshot lưu trong DB
    const savedMatch1 = await prisma.xianxiaPvpMatch.findUnique({
      where: { id: matchRes1.matchId },
    });
    assert(savedMatch1 !== null, 'Phải tìm thấy trận đấu trong DB');
    const snapshotObj = JSON.parse(savedMatch1.defender_snapshot);
    assert.strictEqual(snapshotObj.characterId, charDefender.id);
    assert.strictEqual(snapshotObj.name, 'Bạch Y Tiên Tử');
    assert.strictEqual(snapshotObj.level, 4);

    // Defender sau đó thăng cấp và đổi tên trong DB
    await prisma.xianxiaCharacter.update({
      where: { id: charDefender.id },
      data: {
        name: 'Bạch Y Nữ Ma Đầu (Đã Đổi Tên)',
        level: 50,
      },
    });

    // Kiểm tra lại snapshot của trận đã lưu: Không bị đổi theo defender!
    const recheckedMatch = await prisma.xianxiaPvpMatch.findUnique({
      where: { id: matchRes1.matchId },
    });
    const recheckedSnap = JSON.parse(recheckedMatch!.defender_snapshot);
    assert.strictEqual(recheckedSnap.name, 'Bạch Y Tiên Tử', 'Tên trong snapshot phải giữ nguyên giá trị cũ');
    assert.strictEqual(recheckedSnap.level, 4, 'Cấp độ trong snapshot phải giữ nguyên 4');
    console.log('✅ 3. Snapshot đối thủ bất biến 100%, độc lập hoàn toàn với thay đổi sau đó của nhân vật!');

    // Hoàn trả lại tên cho defender
    await prisma.xianxiaCharacter.update({
      where: { id: charDefender.id },
      data: { name: 'Bạch Y Tiên Tử', level: 4 },
    });

    // ==========================================
    // TEST 4: Chống Request Lặp Nhân Đôi Trận Đấu (Idempotency Key Verification)
    // ==========================================
    console.log('-> Test 4: Kiểm tra cơ chế Idempotency Key chống nhân đôi trận đấu và phần thưởng...');
    const charBeforeReplay = await prisma.xianxiaCharacter.findUnique({
      where: { id: charAttacker.id },
    });

    const replayRes = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charDefender.id,
      challengeKey1 // Gửi lại cùng key
    );

    assert.strictEqual(replayRes.idempotent, true, 'Request lặp phải báo idempotent = true');
    assert.strictEqual(replayRes.matchId, matchRes1.matchId, 'Phải trả về cùng matchId cũ');

    const charAfterReplay = await prisma.xianxiaCharacter.findUnique({
      where: { id: charAttacker.id },
    });
    assert.strictEqual(charAfterReplay!.fatigue, charBeforeReplay!.fatigue, 'Không được trừ thêm thể lực khi replay');
    assert.strictEqual(charAfterReplay!.reputation, charBeforeReplay!.reputation, 'Không được cộng/trừ thêm danh vọng khi replay');
    assert.strictEqual(charAfterReplay!.silver, charBeforeReplay!.silver, 'Không được cộng thêm bạc khi replay');
    console.log('✅ 4. Idempotency Key bảo vệ cấp cơ sở dữ liệu: Không dup trận, không dup thưởng 100%!');

    // ==========================================
    // TEST 5: Bảo Vệ Người Thua — Không Mất EXP, Tu Vi, Bạc, Trang Bị
    // ==========================================
    console.log('-> Test 5: Xác minh người thua không bị mất EXP, tu vi, bạc, trang bị hay tụt HP...');
    const defenderState = await prisma.xianxiaCharacter.findUnique({
      where: { id: charDefender.id },
    });
    assert.strictEqual(defenderState!.exp, 40, 'EXP của đối thủ phải được bảo toàn nguyên vẹn');
    assert.strictEqual(defenderState!.cultivation, 320, 'Tu vi của đối thủ phải được bảo toàn');
    assert.strictEqual(defenderState!.silver, 100, 'Bạc của đối thủ không bị cướp');
    assert.strictEqual(defenderState!.health, 220, 'HP ngoài thế giới của đối thủ không bị trừ');
    assert.strictEqual(defenderState!.fatigue, 100, 'Thể lực của đối thủ thụ động không bị trừ');
    console.log('✅ 5. An toàn tuyệt đối: Người chơi thua không bị trừ bất kỳ tài nguyên hay trang bị nào!');

    // ==========================================
    // TEST 6: Phân Quyền Truy Xuất Chiến Báo Chi Tiết (Access Control on Match Detail)
    // ==========================================
    console.log('-> Test 6: Kiểm tra bảo mật phân quyền xem chi tiết trận đấu (Người lạ bị từ chối 403)...');
    // 6a: Attacker xem -> Hợp lệ
    const detailAttacker = await xianxiaPvpService.getPvpMatch(userAttacker.id, matchRes1.matchId);
    assert.strictEqual(detailAttacker.matchId, matchRes1.matchId);
    assert(Array.isArray(detailAttacker.playbackTurns), 'Phải có playbackTurns');

    // 6b: Defender xem -> Hợp lệ
    const detailDefender = await xianxiaPvpService.getPvpMatch(userDefender.id, matchRes1.matchId);
    assert.strictEqual(detailDefender.matchId, matchRes1.matchId);

    // 6c: User thứ ba (người ngoài) xem -> Bị từ chối!
    await assert.rejects(
      async () => {
        await xianxiaPvpService.getPvpMatch(userThird.id, matchRes1.matchId);
      },
      (err: any) => {
        assert(err.message.includes('không có thẩm quyền truy xuất'));
        return true;
      },
      'Người ngoài không được quyền xem chiến báo chi tiết của trận đấu'
    );
    console.log('✅ 6. Phân quyền và bảo mật chiến báo cá nhân đạt chuẩn tuyệt đối!');

    // ==========================================
    // TEST 7: Cơ Chế Chống Cày Điểm (Anti-Farming Limit: Tối Đa 3 Trận/Ngày Có Thưởng)
    // ==========================================
    console.log('-> Test 7: Kiểm tra cơ chế chống cày điểm lặp lại (Tối đa 3 trận nhận thưởng/ngày)...');
    // Hồi lại thể lực cho attacker để test tiếp
    await prisma.xianxiaCharacter.update({
      where: { id: charAttacker.id },
      data: { fatigue: 100 },
    });

    // Đã có 1 trận (matchRes1). Chạy thêm trận 2 và trận 3
    const matchRes2 = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charDefender.id,
      `idemp_test_pvp_2_${Date.now()}`
    );
    const matchRes3 = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charDefender.id,
      `idemp_test_pvp_3_${Date.now()}`
    );

    // Trận 4: Vượt trần 3 trận trong 24h đối với cùng defender
    const matchRes4 = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charDefender.id,
      `idemp_test_pvp_4_${Date.now()}`
    );

    assert.strictEqual(matchRes4.dailyMatchesWithOpponent, 4);
    assert.strictEqual(matchRes4.reputationChange, 0, 'Trận thứ 4 với cùng đối thủ không được cộng danh vọng');
    assert.strictEqual(matchRes4.silverReward, 0, 'Trận thứ 4 với cùng đối thủ không được cộng bạc');
    assert(matchRes4.cappedRewardReason !== undefined, 'Phải có lý do chặn thưởng');
    console.log('✅ 7. Cơ chế Chống Cày Điểm (Anti-Farming Cap) hoạt động chuẩn xác 100%!');

    // ==========================================
    // TEST 8: Khóa Hàng Bi Quan & Race Condition Đồng Thời (Concurrency Row-level Lock)
    // ==========================================
    console.log('-> Test 8: Kiểm thử Concurrency Race Condition khi gửi yêu cầu thách đấu đồng thời...');
    // Đặt thể lực của attacker đúng bằng 15 Thể Lực (chỉ đủ cho đúng 1 trận 10 Thể Lực, không đủ cho 2 trận)
    await prisma.xianxiaCharacter.update({
      where: { id: charAttacker.id },
      data: { fatigue: 15 },
    });

    // Gửi 2 request khiêu chiến cùng lúc với 2 đối thủ khác nhau (Defender và Third)
    const [resA, resB] = await Promise.allSettled([
      xianxiaPvpService.challengeOpponent(userAttacker.id, charDefender.id, `concurrent_pvp_A_${Date.now()}`),
      xianxiaPvpService.challengeOpponent(userAttacker.id, charThird.id, `concurrent_pvp_B_${Date.now()}`),
    ]);

    // Vì thể lực chỉ có 15, đúng 1 request được thành công và 1 request phải bị từ chối do thiếu thể lực
    const fulfilled = [resA, resB].filter((r) => r.status === 'fulfilled');
    const rejected = [resA, resB].filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Đúng 1 request được thành công');
    assert.strictEqual(rejected.length, 1, '1 request phải bị từ chối do không đủ thể lực');
    console.log('✅ 8. Row-Level Lock FOR UPDATE ngăn chặn thành công Race Condition đồng thời!');

    // ==========================================
    // TEST 9: Lịch Sử Đấu Trường & Bảng Xếp Hạng Danh Vọng
    // ==========================================
    console.log('-> Test 9: Kiểm tra xem lịch sử trận đấu và Bảng Xếp Hạng Danh Vọng...');
    const history = await xianxiaPvpService.getPvpHistory(userAttacker.id, 10);
    assert(history.length >= 4, 'Lịch sử phải ghi nhận đầy đủ các trận đấu');
    assert.strictEqual(history[0].role, 'ATTACKER', 'Người thách đấu có vai trò ATTACKER');
    assert(typeof history[0].isVictory === 'boolean', 'Phải có cờ thắng thua boolean');

    const leaderboard = await xianxiaPvpService.getPvpLeaderboard(10, userAttacker.id);
    assert(leaderboard.entries.length > 0, 'BXH Danh Vọng phải có dữ liệu');
    assert(leaderboard.myRank !== null, 'Phải xác định được thứ hạng cá nhân myRank');
    console.log(`✅ 9. Lịch sử (${history.length} trận) và BXH Danh Vọng (Hạng của Attacker: #${leaderboard.myRank}) hoạt động chuẩn xác!`);

    // ==========================================
    // TEST 10: Kiểm Thử Native HTTP REST API (`/api/xianxia/gameplay/pvp/*`)
    // ==========================================
    console.log('-> Test 10: Kiểm thử Native HTTP REST API endpoints qua mạng fetch...');
    // 10a: GET /opponents có Bearer token
    const httpOpponents = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/opponents`, {
      headers: { Authorization: `Bearer ${tokenAttacker}` },
    });
    assert.strictEqual(httpOpponents.status, 200);
    const jsonOpponents = await httpOpponents.json();
    assert.strictEqual(jsonOpponents.success, true);
    assert(Array.isArray(jsonOpponents.data));

    // 10b: GET /history có Bearer token
    const httpHistory = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/history`, {
      headers: { Authorization: `Bearer ${tokenAttacker}` },
    });
    assert.strictEqual(httpHistory.status, 200);
    const jsonHistory = await httpHistory.json();
    assert.strictEqual(jsonHistory.success, true);

    // 10c: GET /leaderboard
    const httpLb = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/leaderboard`, {
      headers: { Authorization: `Bearer ${tokenAttacker}` },
    });
    assert.strictEqual(httpLb.status, 200);
    const jsonLb = await httpLb.json();
    assert.strictEqual(jsonLb.success, true);
    assert(Array.isArray(jsonLb.data));

    // 10d: Gọi khi không có token -> Bị từ chối 401
    const httpNoToken = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/opponents`);
    assert.strictEqual(httpNoToken.status, 401, 'Endpoint PvP bảo mật bắt buộc có JWT token');
    console.log('✅ 10. Toàn bộ HTTP REST Endpoints PvP phản hồi chuẩn mực 200 OK & 401 khi thiếu xác thực!');

    // ==========================================
    // TEST 11: Cross-User Idempotency Collision Test (Bảo Mật Chống Va Chạm Key Giữa Các Người Chơi)
    // ==========================================
    console.log('-> Test 11: Kiểm thử an toàn chống va chạm Idempotency Key chéo giữa 2 người chơi khác nhau...');
    // Cấp thể lực cho User 3 (charThird) để tham chiến
    await prisma.xianxiaCharacter.update({
      where: { id: charThird.id },
      data: { fatigue: 60 },
    });
    // Cấp thêm thể lực cho Attacker
    await prisma.xianxiaCharacter.update({
      where: { id: charAttacker.id },
      data: { fatigue: 60 },
    });

    const sharedKey = `shared_cross_user_key_${Date.now()}`;

    // Attacker khiêu chiến Defender dùng sharedKey
    const attackerCrossRes = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charDefender.id,
      sharedKey
    );
    assert.strictEqual(attackerCrossRes.idempotent, false, 'Lần gọi đầu tiên của Attacker là trận mới');

    // User 3 cũng khiêu chiến Defender dùng CÙNG CHÍNH XÁC sharedKey
    const thirdCrossRes = await xianxiaPvpService.challengeOpponent(
      userThird.id,
      charDefender.id,
      sharedKey
    );

    // Xác minh User 3 KHÔNG bị nhận nhầm kết quả trận của Attacker
    assert.strictEqual(thirdCrossRes.idempotent, false, 'User 3 dùng chung key không được coi là replay của Attacker');
    assert.notStrictEqual(thirdCrossRes.matchId, attackerCrossRes.matchId, 'Trận của User 3 phải là trận độc lập với matchId riêng biệt');

    // Kiểm tra dữ liệu trong DB
    const thirdMatchInDb = await prisma.xianxiaPvpMatch.findUnique({
      where: { id: thirdCrossRes.matchId },
    });
    assert.strictEqual(thirdMatchInDb!.attacker_id, charThird.id, 'Trận của User 3 phải ghi nhận attacker_id là User 3');
    assert(thirdMatchInDb!.idempotency_key?.includes(`pvp:u${userThird.id}:`), 'Idempotency key phải được scoped theo User 3');
    console.log('✅ 11. Scoped Idempotency Key cô lập hoàn toàn giữa các người chơi khác nhau, chống rò rỉ dữ liệu chéo 100%!');

    // ==========================================
    // TEST 12: Concurrency Race Condition cùng Idempotency Key (Double-Checked Locking & P2002 Resilience)
    // ==========================================
    console.log('-> Test 12: Kiểm thử 2 request đồng thời từ CÙNG 1 người chơi với CÙNG 1 Idempotency Key...');
    await prisma.xianxiaCharacter.update({
      where: { id: charAttacker.id },
      data: { fatigue: 50 },
    });

    const concurrentKey = `concurrent_same_user_key_${Date.now()}`;
    const [concRes1, concRes2] = await Promise.all([
      xianxiaPvpService.challengeOpponent(userAttacker.id, charDefender.id, concurrentKey),
      xianxiaPvpService.challengeOpponent(userAttacker.id, charDefender.id, concurrentKey),
    ]);

    // Cả 2 request phải thành công mượt mà, trả về cùng 1 matchId
    assert.strictEqual(concRes1.matchId, concRes2.matchId, 'Hai request đồng thời cùng key phải trả về cùng 1 trận đấu');

    // 1 request là trận mới (idempotent: false), 1 request là replay thành công (idempotent: true)
    const idempotentCount = [concRes1.idempotent, concRes2.idempotent].filter(Boolean).length;
    assert.strictEqual(idempotentCount, 1, 'Đúng 1 request tạo trận mới và 1 request trả kết quả idempotent');

    // Xác minh thể lực chỉ bị trừ đúng 1 lần (10 thể lực, từ 50 xuống 40)
    const charAfterConcurrent = await prisma.xianxiaCharacter.findUnique({
      where: { id: charAttacker.id },
    });
    assert.strictEqual(charAfterConcurrent!.fatigue, 40, 'Thể lực chỉ bị trừ đúng 10, không bị trừ trùng lặp');
    console.log('✅ 12. Double-Checked Locking và cơ chế xử lý P2002 giải quyết hoàn hảo Race Condition đồng thời cùng Idempotency Key!');

    // ==========================================
    // TEST 13: Tính Nguyên Tử & Rollback Giao Dịch Khi Gặp Sự Cố (Transaction Atomicity & Rollback)
    // ==========================================
    console.log('-> Test 13: Kiểm tra Transaction Rollback toàn vẹn khi có lỗi xảy ra...');
    const charBeforeFail = await prisma.xianxiaCharacter.findUnique({
      where: { id: charAttacker.id },
    });

    // Khiêu chiến đối thủ không tồn tại (ID 999999) -> Transaction phải ném lỗi và rollback
    await assert.rejects(
      async () => {
        await xianxiaPvpService.challengeOpponent(userAttacker.id, 999999, `failed_test_key_${Date.now()}`);
      },
      (err: any) => {
        assert(err.message.includes('không tồn tại'));
        return true;
      },
      'Khiêu chiến đối thủ không tồn tại phải ném lỗi'
    );

    // Xác minh mọi chỉ số nhân vật không bị biến động dở dang
    const charAfterFail = await prisma.xianxiaCharacter.findUnique({
      where: { id: charAttacker.id },
    });
    assert.strictEqual(charAfterFail!.fatigue, charBeforeFail!.fatigue, 'Thể lực không bị trừ khi transaction thất bại');
    assert.strictEqual(charAfterFail!.silver, charBeforeFail!.silver, 'Bạc không bị biến động');
    assert.strictEqual(charAfterFail!.reputation, charBeforeFail!.reputation, 'Danh vọng không bị biến động');
    assert.strictEqual(charAfterFail!.pvp_wins, charBeforeFail!.pvp_wins, 'Số trận thắng không bị ghi nhận nhầm');
    console.log('✅ 13. Transaction Rollback bảo đảm tính nguyên tử 100% khi phát sinh lỗi!');

    // ==========================================
    // TEST 14: Logic Đếm Giới Hạn Chống Cày Điểm (Anti-Farming Filter Logic)
    // ==========================================
    console.log('-> Test 14: Kiểm tra bộ lọc đếm Anti-Farming: Các trận giao lưu không thưởng không chặn nhận thưởng tương lai...');
    // Đếm các trận nhận thưởng giữa Attacker và Defender
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rewardedCount = await prisma.xianxiaPvpMatch.count({
      where: {
        attacker_id: charAttacker.id,
        defender_id: charDefender.id,
        created_at: { gte: oneDayAgo },
        OR: [
          { reputation_change: { not: 0 } },
          { silver_reward: { not: 0 } },
        ],
      },
    });

    // Tổng số trận có cả trận thứ 4 (giao lưu không thưởng)
    const totalCount = await prisma.xianxiaPvpMatch.count({
      where: {
        attacker_id: charAttacker.id,
        defender_id: charDefender.id,
        created_at: { gte: oneDayAgo },
      },
    });

    assert(totalCount > rewardedCount, 'Tổng số trận phải lớn hơn số trận có thưởng (do có trận giao lưu ở Test 7)');
    assert.strictEqual(rewardedCount, 3, 'Số trận nhận thưởng được đếm chuẩn xác đúng bằng 3 trận');
    console.log(`✅ 14. Bộ lọc Anti-Farming phân biệt chuẩn mực giữa trận nhận thưởng (${rewardedCount}) và tổng số trận (${totalCount})!`);

    // ==========================================
    // TEST 15: Phân Biệt Mã Trạng Thái HTTP REST (404 Not Found vs 403 Forbidden vs 400 Bad Request)
    // ==========================================
    console.log('-> Test 15: Kiểm thử chuẩn mực mã trạng thái HTTP REST (404 Not Found, 403 Forbidden, 400 Bad Request)...');
    // 15a: 404 Not Found khi truy vấn ID trận không tồn tại
    const http404 = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/match/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${tokenAttacker}` },
    });
    assert.strictEqual(http404.status, 404, 'Trận không tồn tại phải trả về HTTP 404');
    const json404 = await http404.json();
    assert.strictEqual(json404.success, false);

    // 15b: 403 Forbidden khi người ngoài cố xem chiến báo của người khác
    const http403 = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/match/${matchRes1.matchId}`, {
      headers: { Authorization: `Bearer ${tokenThird}` },
    });
    assert.strictEqual(http403.status, 403, 'Không có quyền xem trận phải trả về HTTP 403');
    const json403 = await http403.json();
    assert.strictEqual(json403.success, false);

    // 15c: 400 Bad Request khi truyền defenderId âm hoặc không hợp lệ
    const http400 = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/challenge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAttacker}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ defenderId: -99 }),
    });
    assert.strictEqual(http400.status, 400, 'defenderId không hợp lệ phải trả về HTTP 400');
    const json400 = await http400.json();
    assert.strictEqual(json400.success, false);
    console.log('✅ 15. Kiểm thử mã trạng thái HTTP (404 Not Found, 403 Forbidden, 400 Bad Request) phản hồi chuẩn xác theo REST Standard!');

    // ==========================================
    // TEST 16: Idempotency Key - Hai Raw Key Dài Khác Nhau Không Bị Va Chạm (No Key Truncation Collision)
    // ==========================================
    console.log('-> Test 16: Kiểm thử 2 raw key dài 64 ký tự khác nhau ở đuôi không bị va chạm do cắt chuỗi...');
    await prisma.xianxiaCharacter.update({
      where: { id: charAttacker.id },
      data: { fatigue: 60 },
    });

    // Key có độ dài chuẩn xác 64 ký tự (chạm trần cho phép)
    const longKeyA = 'idemp_long_prefix_test_12345678901234567890123456789012345678_AA';
    const longKeyB = 'idemp_long_prefix_test_12345678901234567890123456789012345678_BB';
    assert.strictEqual(longKeyA.length, 64, 'longKeyA phải có độ dài đúng 64 ký tự');
    assert.strictEqual(longKeyB.length, 64, 'longKeyB phải có độ dài đúng 64 ký tự');

    const longResA = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charThird.id,
      longKeyA
    );
    const longResB = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charThird.id,
      longKeyB
    );

    assert.strictEqual(longResA.idempotent, false, 'Trận A phải là trận mới');
    assert.strictEqual(longResB.idempotent, false, 'Trận B phải là trận mới độc lập');
    assert.notStrictEqual(longResA.matchId, longResB.matchId, 'Hai key khác nhau không được trả về cùng 1 trận đấu');

    const dbKeyA = await prisma.xianxiaPvpMatch.findUnique({ where: { id: longResA.matchId } });
    const dbKeyB = await prisma.xianxiaPvpMatch.findUnique({ where: { id: longResB.matchId } });
    assert(dbKeyA!.idempotency_key?.endsWith('_AA'), 'Key A trong DB phải giữ nguyên vẹn đuôi _AA');
    assert(dbKeyB!.idempotency_key?.endsWith('_BB'), 'Key B trong DB phải giữ nguyên vẹn đuôi _BB');
    console.log('✅ 16. Hai raw key dài khác nhau được lưu trữ trọn vẹn, không xảy ra va chạm cắt chuỗi!');

    // ==========================================
    // TEST 17: Idempotency Key - Key Quá Dài, Key Rỗng Hoặc Chứa Ký Tự Bất Thường Bị Từ Chối (HTTP 400)
    // ==========================================
    console.log('-> Test 17: Kiểm thử từ chối các Idempotency Key rỗng, quá dài (>64 chars), hoặc ký tự đặc biệt...');
    // 17a: Key rỗng
    const resEmptyKey = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/challenge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAttacker}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ defenderId: charDefender.id, idempotencyKey: '   ' }),
    });
    assert.strictEqual(resEmptyKey.status, 400);
    const jsonEmpty = await resEmptyKey.json();
    assert(jsonEmpty.error.includes('không được để trống'));

    // 17b: Key quá dài (> 64 ký tự)
    const tooLongKey = 'a'.repeat(65);
    const resTooLong = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/challenge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAttacker}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ defenderId: charDefender.id, idempotencyKey: tooLongKey }),
    });
    assert.strictEqual(resTooLong.status, 400);
    const jsonTooLong = await resTooLong.json();
    assert(jsonTooLong.error.includes('quá dài'));

    // 17c: Key chứa ký tự bất thường (spaces, quotes, symbols)
    const resBadChar = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/challenge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAttacker}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ defenderId: charDefender.id, idempotencyKey: 'invalid key with spaces & *^%' }),
    });
    assert.strictEqual(resBadChar.status, 400);
    const jsonBadChar = await resBadChar.json();
    assert(jsonBadChar.error.includes('ký tự không hợp lệ'));
    console.log('✅ 17. Xác thực nghiêm ngặt Idempotency Key (chặn rỗng, >64 ký tự, ký tự lạ) đạt chuẩn 400 Bad Request!');

    // ==========================================
    // TEST 18: Hai Request Cùng Key Nhưng Khác Payload (Payload Mismatch Detection)
    // ==========================================
    console.log('-> Test 18: Kiểm tra phát hiện Payload Mismatch khi gửi lại cùng key với đối thủ khác...');
    const payloadKey = `payload_mismatch_key_${Date.now()}`;

    // Request 1: Gửi key với Defender
    const pRes1 = await xianxiaPvpService.challengeOpponent(
      userAttacker.id,
      charDefender.id,
      payloadKey
    );
    assert.strictEqual(pRes1.idempotent, false);

    // Request 2: Gửi CÙNG KEY nhưng với đối thủ khác (charThird)
    await assert.rejects(
      async () => {
        await xianxiaPvpService.challengeOpponent(
          userAttacker.id,
          charThird.id, // Payload khác!
          payloadKey
        );
      },
      (err: any) => {
        assert(err.message.includes('Payload mismatch'));
        return true;
      },
      'Gửi lại key cũ nhưng khác đối thủ phải bị từ chối do Payload mismatch'
    );

    // Kiểm tra qua HTTP API
    const httpMismatch = await fetch(`${baseUrl}/api/xianxia/gameplay/pvp/challenge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAttacker}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ defenderId: charThird.id, idempotencyKey: payloadKey }),
    });
    assert.strictEqual(httpMismatch.status, 400);
    const jsonMismatch = await httpMismatch.json();
    assert(jsonMismatch.error.includes('Payload mismatch'));
    console.log('✅ 18. Payload Mismatch được phát hiện và ngăn chặn 100%, bảo đảm tính toàn vẹn ngữ nghĩa IETF!');

    // ==========================================
    // TEST 19: Lỗi Unique Constraint Khác Không Bị Xử Lý Nhầm Thành Replay
    // ==========================================
    console.log('-> Test 19: Kiểm tra lỗi unique constraint không liên quan đến idempotency không bị nuốt thành replay...');
    // Gọi challengeOpponent với hàm giả lập P2002 trên target khác (ví dụ: 'user_id')
    const originalTx = prisma.$transaction;
    try {
      (prisma as any).$transaction = async () => {
        const fakeError: any = new Error('Unique constraint failed on the fields: (user_id)');
        fakeError.code = 'P2002';
        fakeError.meta = { target: ['user_id'] };
        throw fakeError;
      };

      await assert.rejects(
        async () => {
          await xianxiaPvpService.challengeOpponent(userAttacker.id, charDefender.id, `test_p2002_${Date.now()}`);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'P2002');
          assert.deepStrictEqual(err.meta.target, ['user_id']);
          return true;
        },
        'Lỗi P2002 trên trường không phải idempotency_key phải được re-throw'
      );
    } finally {
      (prisma as any).$transaction = originalTx;
    }
    console.log('✅ 19. Bắt lỗi P2002 chính xác theo metadata target, không bao giờ nuốt lỗi DB khác!');

    // ==========================================
    // TEST 20: Anti-Farming - Giới Hạn Áp Dụng Cho Cặp Đấu Không Phụ Thuộc Attacker (Mutual Pair Cap)
    // ==========================================
    console.log('-> Test 20: Kiểm tra giới hạn 3 trận/ngày áp dụng cho CẶP ĐẤU (Defender đổi vai trò thách đấu lại Attacker)...');
    // User 1 và User 2 đã đấu 4 trận trước đó trong Test 7 (đã vượt ngưỡng 3 trận nhận thưởng).
    // Giờ User 2 (Defender) hồi thể lực và chủ động khiêu chiến ngược lại User 1 (Attacker):
    await prisma.xianxiaCharacter.update({
      where: { id: charDefender.id },
      data: { fatigue: 50 },
    });

    const reverseMatch = await xianxiaPvpService.challengeOpponent(
      userDefender.id,
      charAttacker.id,
      `reverse_pair_challenge_${Date.now()}`
    );

    // Dù User 2 chưa từng là Attacker với User 1, cặp đấu {User 1, User 2} đã dùng hết 3 trận có thưởng trong ngày
    assert.strictEqual(reverseMatch.reputationChange, 0, 'User 2 khiêu chiến ngược lại User 1 cũng phải bị chặn thưởng (0 danh vọng)');
    assert.strictEqual(reverseMatch.silverReward, 0, 'Không được nhận bạc');
    assert(reverseMatch.cappedRewardReason !== undefined, 'Phải có lý do chặn thưởng theo cặp đấu');
    console.log('✅ 20. Giới hạn 3 trận/ngày áp dụng chuẩn xác cho CẶP ĐẤU hai chiều, bất kể bên nào là người khiêu chiến!');

    // ==========================================
    // TEST 21: Anti-Farming - Trận Hòa & Đánh Dấu is_reward_eligible
    // ==========================================
    console.log('-> Test 21: Kiểm tra tính đủ điều kiện nhận thưởng (is_reward_eligible) cho cặp đấu mới...');
    // Tạo cặp người chơi mới Pair A và Pair B
    const userPairA = await prisma.user.create({
      data: { username: 'm4_pvp_pair_a', email: 'pair_a@pvp.test', password_hash: 'secret' },
    });
    const charPairA = await prisma.xianxiaCharacter.create({
      data: { user_id: userPairA.id, name: 'Kiếm Sĩ A', level: 3, health: 200, max_health: 200, fatigue: 100, max_fatigue: 100, reputation: 100 },
    });

    const userPairB = await prisma.user.create({
      data: { username: 'm4_pvp_pair_b', email: 'pair_b@pvp.test', password_hash: 'secret' },
    });
    const charPairB = await prisma.xianxiaCharacter.create({
      data: { user_id: userPairB.id, name: 'Kiếm Sĩ B', level: 3, health: 200, max_health: 200, fatigue: 100, max_fatigue: 100, reputation: 100 },
    });

    // Trận 1, 2, 3 giữa Pair A và Pair B: Phải có is_reward_eligible = true
    const pairM1 = await xianxiaPvpService.challengeOpponent(userPairA.id, charPairB.id, `pair_m1_${Date.now()}`);
    const pairM2 = await xianxiaPvpService.challengeOpponent(userPairA.id, charPairB.id, `pair_m2_${Date.now()}`);
    const pairM3 = await xianxiaPvpService.challengeOpponent(userPairA.id, charPairB.id, `pair_m3_${Date.now()}`);

    const dbM1 = await prisma.xianxiaPvpMatch.findUnique({ where: { id: pairM1.matchId } });
    const dbM2 = await prisma.xianxiaPvpMatch.findUnique({ where: { id: pairM2.matchId } });
    const dbM3 = await prisma.xianxiaPvpMatch.findUnique({ where: { id: pairM3.matchId } });
    assert.strictEqual(dbM1!.is_reward_eligible, true, 'Trận 1 phải có is_reward_eligible = true');
    assert.strictEqual(dbM2!.is_reward_eligible, true, 'Trận 2 phải có is_reward_eligible = true');
    assert.strictEqual(dbM3!.is_reward_eligible, true, 'Trận 3 phải có is_reward_eligible = true');

    // Trận 4: Vượt trần -> is_reward_eligible = false
    const pairM4 = await xianxiaPvpService.challengeOpponent(userPairA.id, charPairB.id, `pair_m4_${Date.now()}`);
    const dbM4 = await prisma.xianxiaPvpMatch.findUnique({ where: { id: pairM4.matchId } });
    assert.strictEqual(dbM4!.is_reward_eligible, false, 'Trận 4 phải có is_reward_eligible = false (không tính vào trần sau này)');
    console.log('✅ 21. Cột is_reward_eligible phân tách rành mạch trận nhận thưởng (true) và trận giao lưu vượt trần (false)!');

    // ==========================================
    // TEST 22: Anti-Farming - Qua Ranh Giới Ngày Theo Múi Giờ Việt Nam (00:00:00 ICT)
    // ==========================================
    console.log('-> Test 22: Kiểm tra reset trần nhận thưởng khi bước sang ngày mới theo múi giờ Việt Nam (UTC+7)...');
    // Giả lập thời gian vào 00:00:05 ngày hôm sau theo múi giờ Việt Nam (sau mốc 00:00:00 ICT)
    const tomorrowICT = new Date(Date.now() + 25 * 60 * 60 * 1000);
    await prisma.xianxiaCharacter.update({
      where: { id: charPairA.id },
      data: { fatigue: 50 },
    });

    const tomorrowMatch = await xianxiaPvpService.challengeOpponent(
      userPairA.id,
      charPairB.id,
      `tomorrow_match_${Date.now()}`,
      tomorrowICT
    );

    // Ngày mới: bộ đếm reset về 0, trận đấu nhận thưởng bình thường
    assert.strictEqual(tomorrowMatch.dailyMatchesWithOpponent, 1, 'Trận đầu tiên của ngày mới có dailyMatches = 1');
    assert.strictEqual(tomorrowMatch.cappedRewardReason, undefined, 'Không còn bị chặn thưởng');
    assert(tomorrowMatch.reputationChange !== 0 || tomorrowMatch.silverReward > 0 || tomorrowMatch.result === 'DRAW_TIMEOUT');

    const dbTomorrow = await prisma.xianxiaPvpMatch.findUnique({ where: { id: tomorrowMatch.matchId } });
    assert.strictEqual(dbTomorrow!.is_reward_eligible, true, 'Trận của ngày mới là trận đủ điều kiện nhận thưởng');
    console.log('✅ 22. Ranh giới ngày 00:00:00 ICT tự động reset trần nhận thưởng chuẩn xác 100%!');

    // ==========================================
    // TEST 23: Concurrency - Hai Người Chơi Đồng Thời Khiêu Chiến Lẫn Nhau (Deadlock-Free Locking)
    // ==========================================
    console.log('-> Test 23: Kiểm thử Concurrency khi 2 người chơi đồng thời khiêu chiến lẫn nhau (Triệt tiêu Deadlock)...');
    await prisma.xianxiaCharacter.update({
      where: { id: charPairA.id },
      data: { fatigue: 60 },
    });
    await prisma.xianxiaCharacter.update({
      where: { id: charPairB.id },
      data: { fatigue: 60 },
    });

    // Pair A khiêu chiến Pair B VÀ Pair B khiêu chiến Pair A cùng 1 thời điểm
    const mutualKeyA = `mutual_concurrent_a_${Date.now()}`;
    const mutualKeyB = `mutual_concurrent_b_${Date.now()}`;

    const [mutResA, mutResB] = await Promise.all([
      xianxiaPvpService.challengeOpponent(userPairA.id, charPairB.id, mutualKeyA),
      xianxiaPvpService.challengeOpponent(userPairB.id, charPairA.id, mutualKeyB),
    ]);

    // Nhờ khóa hàng theo thứ tự ID tăng dần ORDER BY id, cả 2 request hoàn tất mượt mà, KHÔNG BỊ DEADLOCK
    assert(mutResA.matchId !== undefined, 'Trận của Pair A hoàn tất thành công');
    assert(mutResB.matchId !== undefined, 'Trận của Pair B hoàn tất thành công');
    assert.notStrictEqual(mutResA.matchId, mutResB.matchId, 'Hai trận có ID độc lập');
    console.log('✅ 23. Deadlock-Free Pessimistic Locking xử lý xuất sắc thách đấu đối ứng đồng thời!');

    // ==========================================
    // TEST 24: Concurrency Stress Test Tại Ngưỡng 3 Trận (5 Request Đồng Thời Đổi Vai Trò)
    // ==========================================
    console.log('-> Test 24: Kiểm thử Concurrency Stress Test tại ngưỡng 3 trận (5 request đồng thời gửi cả 2 chiều)...');
    const userConcA = await prisma.user.create({
      data: { username: 'm4_pvp_conc_a', email: 'conc_a@pvp.test', password_hash: 'secret' },
    });
    const charConcA = await prisma.xianxiaCharacter.create({
      data: { user_id: userConcA.id, name: 'Chiến Tướng A', level: 5, health: 250, max_health: 250, fatigue: 100, max_fatigue: 100, reputation: 120, silver: 100 },
    });

    const userConcB = await prisma.user.create({
      data: { username: 'm4_pvp_conc_b', email: 'conc_b@pvp.test', password_hash: 'secret' },
    });
    const charConcB = await prisma.xianxiaCharacter.create({
      data: { user_id: userConcB.id, name: 'Chiến Tướng B', level: 5, health: 250, max_health: 250, fatigue: 100, max_fatigue: 100, reputation: 120, silver: 100 },
    });

    // 24a: Đấu trước 2 trận để chạm sát ngưỡng (2/3 trận nhận thưởng)
    const initM1 = await xianxiaPvpService.challengeOpponent(userConcA.id, charConcB.id, `init_conc_1_${Date.now()}`);
    const initM2 = await xianxiaPvpService.challengeOpponent(userConcB.id, charConcA.id, `init_conc_2_${Date.now()}`);
    assert.strictEqual(initM1.dailyMatchesWithOpponent, 1);
    assert.strictEqual(initM2.dailyMatchesWithOpponent, 2);

    // 24b: Gửi đồng thời 5 request hợp lệ từ cả 2 phía (3 req từ A->B, 2 req từ B->A)
    const stressKey1 = `stress_1_${Date.now()}`;
    const stressKey2 = `stress_2_${Date.now()}`;
    const stressKey3 = `stress_3_${Date.now()}`;
    const stressKey4 = `stress_4_${Date.now()}`;
    const stressKey5 = `stress_5_${Date.now()}`;

    const stressResults = await Promise.all([
      xianxiaPvpService.challengeOpponent(userConcA.id, charConcB.id, stressKey1),
      xianxiaPvpService.challengeOpponent(userConcA.id, charConcB.id, stressKey2),
      xianxiaPvpService.challengeOpponent(userConcB.id, charConcA.id, stressKey3),
      xianxiaPvpService.challengeOpponent(userConcA.id, charConcB.id, stressKey4),
      xianxiaPvpService.challengeOpponent(userConcB.id, charConcA.id, stressKey5),
    ]);

    // Trong 5 request đồng thời, đúng 1 request được nhận suất thưởng thứ 3, còn lại 4 request bị capped (0 thưởng)
    const rewardedInStress = stressResults.filter(
      (r) => r.reputationChange !== 0 || r.silverReward > 0
    );
    const cappedInStress = stressResults.filter(
      (r) => r.reputationChange === 0 && r.silverReward === 0 && r.cappedRewardReason !== undefined
    );

    assert.strictEqual(rewardedInStress.length, 1, 'Đúng 1 trong 5 request đồng thời được nhận thưởng thứ 3');
    assert.strictEqual(cappedInStress.length, 4, '4 request đồng thời còn lại bị chặn thưởng an toàn');

    // Kiểm tra trực tiếp trên PostgreSQL: Tổng số trận eligible của cặp ConcA & ConcB CHÍNH XÁC là 3
    const finalEligibleCount = await prisma.xianxiaPvpMatch.count({
      where: {
        is_reward_eligible: true,
        OR: [
          { attacker_id: charConcA.id, defender_id: charConcB.id },
          { attacker_id: charConcB.id, defender_id: charConcA.id },
        ],
      },
    });
    assert.strictEqual(finalEligibleCount, 3, 'Tổng số trận đủ điều kiện nhận thưởng của cặp trên DB không bao giờ vượt quá 3');

    // Tổng số trận lưu trữ đầy đủ là 7 trận (2 khởi đầu + 5 stress)
    const finalTotalMatches = await prisma.xianxiaPvpMatch.count({
      where: {
        OR: [
          { attacker_id: charConcA.id, defender_id: charConcB.id },
          { attacker_id: charConcB.id, defender_id: charConcA.id },
        ],
      },
    });
    assert.strictEqual(finalTotalMatches, 7, 'Tổng cộng 7 trận đấu được lưu trữ đầy đủ không thất thoát');

    // Kiểm tra thể lực: ConcA đánh 4 trận làm attacker -> trừ 40 thể lực (100 -> 60)
    // ConcB đánh 3 trận làm attacker -> trừ 30 thể lực (100 -> 70)
    const charAEnd = await prisma.xianxiaCharacter.findUnique({ where: { id: charConcA.id } });
    const charBEnd = await prisma.xianxiaCharacter.findUnique({ where: { id: charConcB.id } });
    assert.strictEqual(charAEnd!.fatigue, 60, 'Thể lực của ConcA bị khấu trừ chuẩn xác 40 điểm');
    assert.strictEqual(charBEnd!.fatigue, 70, 'Thể lực của ConcB bị khấu trừ chuẩn xác 30 điểm');
    console.log('✅ 24. Concurrency Stress Test (5 requests đồng thời) tại ngưỡng 3 trận: Không bao giờ cấp vượt trần 3 trận!');

    // ==========================================
    // TEST 25: Hàm Tính Mốc Ngày UTC+7 Độc Lập Hoàn Toàn Với Múi Giờ Hệ Điều Hành
    // ==========================================
    console.log('-> Test 25: Kiểm thử hàm tính mốc ngày UTC+7 độc lập với múi giờ OS và ranh giới nửa đêm 23:59:59 vs 00:00:01...');
    const { getStartOfDayInVietnam } = await import('../services/xianxia/xianxiaPvpService.js');

    // Thời điểm 23:59:59 ngày 24/10/2026 tại Việt Nam (UTC+7) tương ứng với 16:59:59 UTC ngày 24/10/2026
    const tDay1End = new Date('2026-10-24T16:59:59.000Z');
    // Thời điểm 00:00:01 ngày 25/10/2026 tại Việt Nam (UTC+7) tương ứng với 17:00:01 UTC ngày 24/10/2026
    const tDay2Start = new Date('2026-10-24T17:00:01.000Z');

    const sod1 = getStartOfDayInVietnam(tDay1End);
    const sod2 = getStartOfDayInVietnam(tDay2Start);

    // sod1 phải là 2026-10-23T17:00:00.000Z (00:00:00 ICT ngày 24/10)
    assert.strictEqual(sod1.toISOString(), '2026-10-23T17:00:00.000Z');
    // sod2 phải là 2026-10-24T17:00:00.000Z (00:00:00 ICT ngày 25/10)
    assert.strictEqual(sod2.toISOString(), '2026-10-24T17:00:00.000Z');

    // Chênh lệch đúng 24 giờ (86,400,000 ms)
    assert.strictEqual(sod2.getTime() - sod1.getTime(), 24 * 60 * 60 * 1000);

    // Kiểm tra tính độc lập với biến môi trường TZ
    const oldTz = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';
      const sodNY = getStartOfDayInVietnam(tDay1End);
      assert.strictEqual(sodNY.toISOString(), '2026-10-23T17:00:00.000Z');

      process.env.TZ = 'UTC';
      const sodUTC = getStartOfDayInVietnam(tDay1End);
      assert.strictEqual(sodUTC.toISOString(), '2026-10-23T17:00:00.000Z');
    } finally {
      process.env.TZ = oldTz;
    }
    console.log('✅ 25. Hàm getStartOfDayInVietnam chuẩn xác 100% tại ranh giới nửa đêm và miễn nhiễm với múi giờ OS!');

    console.log('\n========================================================================================');
    console.log('🏆 TẤT CẢ 25/25 BÀI KIỂM THỬ ĐẤU TRƯỜNG THIÊN KIÊU MỤC 4.2 ĐẠT PASS 100%!');
    console.log('========================================================================================\n');
  } finally {
    // Đóng server kiểm thử
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
