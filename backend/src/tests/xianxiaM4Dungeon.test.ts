import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { XianxiaDungeonService } from '../services/xianxia/xianxiaDungeonService.js';
import { ensurePartyIndexes } from '../scripts/ensurePartyIndexes.js';

export async function runXianxiaM4DungeonTests(): Promise<void> {
  console.log('\n--- 🏰 [TEST] BẮT ĐẦU KIỂM THỬ M4.3.3B: PHÓ BẢN CO-OP PVE (DUNGEON BACKEND) ---');

  // Đảm bảo partial unique indexes đã tồn tại
  await ensurePartyIndexes();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Dungeon Test Server] Lắng nghe kiểm thử tại ${baseUrl}`);

  const trackedUserIds = new Set<number>();
  const trackedCharacterIds = new Set<number>();
  const trackedPartyIds = new Set<number>();
  const trackedRunIds = new Set<string>();

  try {
    // ==========================================
    // 0. CHUẨN BỊ DỮ LIỆU TÀI KHOẢN VÀ NHÂN VẬT TEST
    // ==========================================
    const testSuffix = Math.floor(Math.random() * 900000 + 100000);

    async function createTestPlayer(namePrefix: string, physique = 60, fatigue = 100) {
      const uname = `${namePrefix}_${testSuffix}_${Math.floor(Math.random() * 10000)}`;
      const user = await prisma.user.create({
        data: {
          username: uname,
          email: `${uname}@example.com`,
          password_hash: 'test_hash_dungeon_123',
        },
      });
      trackedUserIds.add(user.id);

      const char = await prisma.xianxiaCharacter.create({
        data: {
          user_id: user.id,
          name: `Đạo Sĩ ${uname}`,
          realm: 'LUYEN_KHI_3',
          level: 10,
          exp: 0,
          exp_required: 5000,
          physique,
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

    const leaderA = await createTestPlayer('dg_leadA', 70, 100);
    const memberB = await createTestPlayer('dg_memB', 70, 100);
    const memberC = await createTestPlayer('dg_memC', 70, 100);
    const outsiderX = await createTestPlayer('dg_outX', 50, 100);

    console.log('✅ [TEST 0] Khởi tạo tài khoản và nhân vật kiểm thử thành công.');

    // Helper tạo tổ đội và thêm thành viên
    async function createFormedParty(leader: typeof leaderA, members: (typeof memberB)[]) {
      const party = await prisma.xianxiaParty.create({
        data: {
          name: `Đội Thám Hiểm ${testSuffix}_${Math.floor(Math.random() * 1000)}`,
          leader_id: leader.char.id,
          status: 'FORMING',
          max_members: 4,
        },
      });
      trackedPartyIds.add(party.id);

      await prisma.xianxiaPartyMember.create({
        data: {
          party_id: party.id,
          character_id: leader.char.id,
          role: 'LEADER',
          is_ready: true,
        },
      });

      for (const m of members) {
        await prisma.xianxiaPartyMember.create({
          data: {
            party_id: party.id,
            character_id: m.char.id,
            is_ready: true,
          },
        });
      }

      return party;
    }

    const party1 = await createFormedParty(leaderA, [memberB, memberC]);

    // ==========================================
    // GROUP A: DANH SÁCH PHÓ BẢN (GET /api/xianxia/dungeons)
    // ==========================================
    console.log('\n--- GROUP A: DANH SÁCH PHÓ BẢN ---');
    const resList = await fetch(`${baseUrl}/api/xianxia/dungeons`, {
      headers: { Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonList = await resList.json();
    assert.strictEqual(resList.status, 200, 'Lấy danh sách phó bản phải trả về 200.');
    assert.strictEqual(jsonList.success, true);
    assert.ok(Array.isArray(jsonList.data), 'Dữ liệu trả về phải là một mảng.');
    assert.strictEqual(jsonList.data.length, 1);
    const dungeonConfig = jsonList.data[0];
    assert.strictEqual(dungeonConfig.id, 'dungeon_u_minh_co_dong');
    assert.strictEqual(dungeonConfig.totalWaves, 3);
    assert.strictEqual(dungeonConfig.fatigueCost, 15);
    console.log('✅ [GROUP A] Lấy danh sách phó bản thành công.');

    // ==========================================
    // GROUP B: KIỂM THỰC VÀO PHÓ BẢN (ENTER DUNGEON)
    // ==========================================
    console.log('\n--- GROUP B: KIỂM THỰC VÀO PHÓ BẢN (VALIDATION & ENTER) ---');

    // B1: Thành viên không phải trưởng nhóm cố tình vào phó bản -> 403 Forbidden
    const resNonLeader = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
    });
    const jsonNonLeader = await resNonLeader.json();
    assert.strictEqual(resNonLeader.status, 403, 'Thành viên thường không được quyền mở phó bản.');
    assert.ok(jsonNonLeader.error.includes('DUNGEON_NOT_LEADER'));

    // B2: Có thành viên chưa sẵn sàng (is_ready = false) -> 400 Bad Request
    await prisma.xianxiaPartyMember.update({
      where: { character_id: memberC.char.id },
      data: { is_ready: false },
    });

    const resNotReady = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonNotReady = await resNotReady.json();
    assert.strictEqual(resNotReady.status, 400, 'Chưa sẵn sàng thì không thể vào phó bản.');
    assert.ok(jsonNotReady.error.includes('DUNGEON_MEMBER_NOT_READY'));

    // Khôi phục is_ready = true cho memberC
    await prisma.xianxiaPartyMember.update({
      where: { character_id: memberC.char.id },
      data: { is_ready: true },
    });

    // B3: Có thành viên thiếu thể lực (< 15) -> 400 Bad Request & Rollback
    await prisma.xianxiaCharacter.update({
      where: { id: memberC.char.id },
      data: { fatigue: 10 }, // Thiếu 5 thể lực
    });

    const resNoFatigue = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonNoFatigue = await resNoFatigue.json();
    assert.strictEqual(resNoFatigue.status, 400, 'Thiếu thể lực phải bị từ chối.');
    assert.ok(jsonNoFatigue.error.includes('DUNGEON_INSUFFICIENT_FATIGUE'));

    // Kiểm tra không ai bị trừ thể lực do transaction đã rollback
    const leaderCharCheck = await prisma.xianxiaCharacter.findUnique({ where: { id: leaderA.char.id } });
    assert.strictEqual(leaderCharCheck?.fatigue, 100, 'Thể lực của trưởng nhóm không được bị trừ khi giao dịch thất bại.');

    // B4: Hồi đầy thể lực và Trưởng nhóm vào phó bản hợp lệ -> 201 Created
    await prisma.xianxiaCharacter.update({
      where: { id: memberC.char.id },
      data: { fatigue: 100 },
    });

    const resEnter = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${leaderA.token}`,
        'x-idempotency-key': `enter_key_${testSuffix}`,
      },
    });
    const jsonEnter = await resEnter.json();
    assert.strictEqual(resEnter.status, 201, 'Vào phó bản thành công trả về 201.');
    assert.strictEqual(jsonEnter.success, true);
    const activeRun = jsonEnter.data;
    trackedRunIds.add(activeRun.id);

    assert.strictEqual(activeRun.status, 'IN_PROGRESS');
    assert.strictEqual(activeRun.currentWave, 1);
    assert.strictEqual(activeRun.turnsCount, 0);
    assert.strictEqual(activeRun.version, 1);
    assert.strictEqual(activeRun.partyId, party1.id);
    assert.strictEqual(activeRun.leaderCharacterId, leaderA.char.id);
    assert.strictEqual(activeRun.combatState.players.length, 3);
    assert.strictEqual(activeRun.combatState.monsters.length, 2);

    // Kiểm tra trạng thái party và trừ thể lực nguyên tử
    const partyAfterEnter = await prisma.xianxiaParty.findUnique({ where: { id: party1.id } });
    assert.strictEqual(partyAfterEnter?.status, 'IN_DUNGEON', 'Trạng thái tổ đội phải chuyển sang IN_DUNGEON.');

    const checkLeader = await prisma.xianxiaCharacter.findUnique({ where: { id: leaderA.char.id } });
    const checkMemB = await prisma.xianxiaCharacter.findUnique({ where: { id: memberB.char.id } });
    const checkMemC = await prisma.xianxiaCharacter.findUnique({ where: { id: memberC.char.id } });
    assert.strictEqual(checkLeader?.fatigue, 85, 'Trưởng nhóm bị trừ đúng 15 thể lực.');
    assert.strictEqual(checkMemB?.fatigue, 85, 'Thành viên B bị trừ đúng 15 thể lực.');
    assert.strictEqual(checkMemC?.fatigue, 85, 'Thành viên C bị trừ đúng 15 thể lực.');
    console.log('✅ [GROUP B] Kiểm thực và trừ thể lực nguyên tử khi vào phó bản thành công.');

    // ==========================================
    // GROUP C: HIỆP ĐẤU SERVER-AUTHORITATIVE & OPTIMISTIC VERSIONING
    // ==========================================
    console.log('\n--- GROUP C: HIỆP ĐẤU SERVER-AUTHORITATIVE & PHIÊN BẢN (COMBAT-STEP) ---');

    // C0: Người ngoài truy vấn trạng thái phó bản -> 403 Forbidden
    const resOutsiderGet = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}`, {
      headers: { Authorization: `Bearer ${outsiderX.token}` },
    });
    const jsonOutsiderGet = await resOutsiderGet.json();
    assert.strictEqual(resOutsiderGet.status, 403, 'Người ngoài không được truy vấn thông tin phó bản của tổ đội khác.');
    assert.ok(jsonOutsiderGet.error.includes('DUNGEON_FORBIDDEN'));

    // C0.1: Thành viên hợp lệ truy vấn trạng thái phó bản -> 200 OK
    const resMemberGet = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}`, {
      headers: { Authorization: `Bearer ${memberB.token}` },
    });
    const jsonMemberGet = await resMemberGet.json();
    assert.strictEqual(resMemberGet.status, 200, 'Thành viên phó bản truy vấn trạng thái thành công.');
    assert.strictEqual(jsonMemberGet.data.id, activeRun.id);

    // C1: Người ngoài không trong phiên phó bản đánh trận -> 403 Forbidden
    const resOutsiderCombat = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/combat-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outsiderX.token}` },
    });
    const jsonOutsiderCombat = await resOutsiderCombat.json();
    assert.strictEqual(resOutsiderCombat.status, 403, 'Người ngoài không được can thiệp vào hiệp đấu.');
    assert.ok(jsonOutsiderCombat.error.includes('DUNGEON_FORBIDDEN'));

    // C2: Thực hiện hiệp đấu hợp lệ (Expected Version = 1) -> Version tăng lên 2
    const resStep1 = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/combat-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ version: 1 }),
    });
    const jsonStep1 = await resStep1.json();
    assert.strictEqual(resStep1.status, 200, 'Thực thi hiệp đấu 1 thành công.');
    assert.strictEqual(jsonStep1.data.version, 2, 'Version phải tăng từ 1 lên 2.');
    assert.strictEqual(jsonStep1.data.turnsCount, 1, 'Số lượt đếm phải tăng lên 1.');
    assert.ok(jsonStep1.data.combatLog.length > 2, 'Phải có log chiến đấu chi tiết.');

    // C3: Gửi lại lượt đánh với version cũ (version = 1 khi hiện tại là 2) -> 409 Conflict
    const resStaleVersion = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/combat-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
      body: JSON.stringify({ version: 1 }),
    });
    const jsonStaleVersion = await resStaleVersion.json();
    assert.strictEqual(resStaleVersion.status, 409, 'Gửi version cũ phải bị từ chối 409 Conflict.');
    assert.ok(jsonStaleVersion.error.includes('DUNGEON_VERSION_MISMATCH'));
    console.log('✅ [GROUP C] Hiệp đấu Server-Authoritative và Optimistic Versioning chuẩn xác.');

    // ==========================================
    // GROUP D & E: TIẾN TRÌNH WAVE, BOSS & HOÀN THÀNH PHÓ BẢN
    // ==========================================
    console.log('\n--- GROUP D & E: TIẾN TRÌNH WAVE, TRẢM BOSS VÀ HOÀN THÀNH PHÓ BẢN ---');

    // Chạy tiếp các hiệp đấu cho đến khi phó bản hoàn thành (Tối đa 15 hiệp với chỉ số tu sĩ cao)
    let currentRunState = jsonStep1.data;
    let maxSteps = 15;
    while (currentRunState.status === 'IN_PROGRESS' && maxSteps > 0) {
      maxSteps--;
      const resStep = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/combat-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
        body: JSON.stringify({ version: currentRunState.version }),
      });
      const jsonStep = await resStep.json();
      assert.strictEqual(resStep.status, 200);
      currentRunState = jsonStep.data;
      console.log(
        `   [Hiệp ${currentRunState.turnsCount}] Đợt ${currentRunState.currentWave}/${currentRunState.totalWaves} - Trạng thái: ${currentRunState.status} - Version: ${currentRunState.version}`
      );
    }

    assert.strictEqual(currentRunState.status, 'COMPLETED', 'Phó bản phải hoàn thành với chiến thắng của tổ đội.');
    assert.strictEqual(currentRunState.currentWave, 3, 'Phải trải qua đến Wave 3.');
    assert.ok(currentRunState.completedAt, 'completedAt phải được ghi nhận thời điểm hoàn thành.');

    // Kiểm tra tổ đội được trả về trạng thái FORMING
    const partyAfterWin = await prisma.xianxiaParty.findUnique({ where: { id: party1.id } });
    assert.strictEqual(partyAfterWin?.status, 'FORMING', 'Sau khi kết thúc phó bản, tổ đội được mở khóa về FORMING.');

    // E3: Đánh tiếp khi đã COMPLETED -> 400 Bad Request
    const resOverCombat = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/combat-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ version: currentRunState.version }),
    });
    const jsonOverCombat = await resOverCombat.json();
    assert.strictEqual(resOverCombat.status, 400);
    assert.ok(jsonOverCombat.error.includes('DUNGEON_NOT_IN_PROGRESS'));
    console.log('✅ [GROUP D & E] Đợt sóng, Boss U Minh Lang Vương và chuyển trạng thái hoàn thành thành công.');

    // ==========================================
    // GROUP F: NHẬN THƯỞNG PHÓ BẢN & CHỐNG LẶP (IDEMPOTENCY DUAL-LAYER)
    // ==========================================
    console.log('\n--- GROUP F: NHẬN THƯỞNG PHÓ BẢN & BẢO VỆ KÉP (CLAIM REWARDS) ---');

    // F1: Người ngoài không trong phó bản cố nhận thưởng -> 403 Forbidden
    const resOutsiderClaim = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/claim-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outsiderX.token}` },
    });
    const jsonOutsiderClaim = await resOutsiderClaim.json();
    assert.strictEqual(resOutsiderClaim.status, 403);
    assert.ok(jsonOutsiderClaim.error.includes('DUNGEON_FORBIDDEN'));

    // F2: Thành viên phó bản nhận thưởng lần đầu -> 200 OK
    const silverBefore = (await prisma.xianxiaCharacter.findUnique({ where: { id: memberB.char.id } }))?.silver || 0;
    const expBefore = (await prisma.xianxiaCharacter.findUnique({ where: { id: memberB.char.id } }))?.exp || 0;

    const claimKey = `reward_claim_${testSuffix}_b`;
    const resClaim1 = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberB.token}`,
        'x-idempotency-key': claimKey,
      },
    });
    const jsonClaim1 = await resClaim1.json();
    assert.strictEqual(resClaim1.status, 200);
    assert.strictEqual(jsonClaim1.success, true);
    assert.strictEqual(jsonClaim1.data.claimed, true);
    assert.strictEqual(jsonClaim1.data.idempotent, false, 'Lần nhận đầu tiên không phải idempotent cache.');
    assert.strictEqual(jsonClaim1.data.exp, 300);
    assert.ok(jsonClaim1.data.silver >= 80 && jsonClaim1.data.silver <= 150);
    assert.ok(jsonClaim1.data.items.length >= 1, 'Phải nhận được ít nhất 1 Yêu Đan Nhất Giai cố định.');

    const charAfterClaim = await prisma.xianxiaCharacter.findUnique({ where: { id: memberB.char.id } });
    assert.strictEqual(charAfterClaim?.silver, silverBefore + jsonClaim1.data.silver, 'Bạc phải tăng đúng mức thưởng.');
    assert.strictEqual(charAfterClaim?.exp, expBefore + 300, 'EXP phải tăng đúng mức thưởng.');

    // F3: Replay nhận thưởng với cùng Idempotency Key -> 200 Trả về cache cũ (idempotent: true), KHÔNG cộng dồn tài nguyên
    const resClaimReplay = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/claim-reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberB.token}`,
        'x-idempotency-key': claimKey,
      },
    });
    const jsonClaimReplay = await resClaimReplay.json();
    assert.strictEqual(resClaimReplay.status, 200);
    assert.strictEqual(jsonClaimReplay.data.idempotent, true, 'Lần gọi lại phải trả về kết quả idempotent cache.');
    assert.strictEqual(jsonClaimReplay.data.silver, jsonClaim1.data.silver);

    const charAfterReplay = await prisma.xianxiaCharacter.findUnique({ where: { id: memberB.char.id } });
    assert.strictEqual(charAfterReplay?.silver, charAfterClaim?.silver, 'Bạc tuyệt đối không bị cộng trùng lặp.');
    assert.strictEqual(charAfterReplay?.exp, charAfterClaim?.exp, 'EXP tuyệt đối không bị cộng trùng lặp.');

    // F4: Kiểm tra ràng buộc duy nhất trong DB (@@unique([dungeon_run_id, character_id]))
    const claimsInDb = await prisma.xianxiaDungeonRewardClaim.findMany({
      where: { dungeon_run_id: activeRun.id, character_id: memberB.char.id },
    });
    assert.strictEqual(claimsInDb.length, 1, 'Chỉ duy nhất 1 bản ghi nhận thưởng được lưu trong cơ sở dữ liệu.');
    console.log('✅ [GROUP F] Nhận thưởng và bảo vệ kép Idempotency chống gian lận thành công.');

    // ==========================================
    // GROUP G: ĐỒNG BỘ KẾT NỐI LẠI (RECONNECT) & TIMEOUT 15 PHÚT
    // ==========================================
    console.log('\n--- GROUP G: KẾT NỐI LẠI (RECONNECT) & TIMEOUT 15 PHÚT ---');

    // G1: Thành viên hợp lệ kết nối lại -> 200 OK, trả snapshot
    const resReconnect = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberC.token}` },
    });
    const jsonReconnect = await resReconnect.json();
    assert.strictEqual(resReconnect.status, 200);
    assert.strictEqual(jsonReconnect.data.id, activeRun.id);

    // G2: Người ngoài không trong tổ đội gọi reconnect -> 403 Forbidden
    const resOutsiderReconnect = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${activeRun.id}/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${outsiderX.token}` },
    });
    const jsonOutsiderReconnect = await resOutsiderReconnect.json();
    assert.strictEqual(resOutsiderReconnect.status, 403);
    assert.ok(jsonOutsiderReconnect.error.includes('DUNGEON_FORBIDDEN'));

    // G3: Mô phỏng hết hạn 15 phút (Timeout Expired)
    // Giải phóng party1 trước khi tạo partyTimeout
    await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: party1.id } });
    await prisma.xianxiaParty.update({ where: { id: party1.id }, data: { status: 'DISBANDED' } });

    // Tạo 1 phiên phó bản mới đang IN_PROGRESS nhưng có expires_at trong quá khứ
    const partyTimeout = await createFormedParty(leaderA, [memberB]);
    const expiredRun = await prisma.xianxiaDungeonRun.create({
      data: {
        dungeon_id: 'dungeon_u_minh_co_dong',
        party_id: partyTimeout.id,
        leader_character_id: leaderA.char.id,
        status: 'IN_PROGRESS',
        current_wave: 1,
        total_waves: 3,
        turns_count: 0,
        version: 1,
        combat_state: JSON.stringify({ currentWave: 1, totalWaves: 3, monsters: [], players: [] }),
        combat_log: JSON.stringify([]),
        started_at: new Date(Date.now() - 20 * 60 * 1000),
        expires_at: new Date(Date.now() - 5 * 60 * 1000), // Đã hết hạn 5 phút trước
      },
    });
    trackedRunIds.add(expiredRun.id);

    await prisma.xianxiaDungeonMember.create({
      data: {
        dungeon_run_id: expiredRun.id,
        character_id: leaderA.char.id,
        initial_hp: 500,
        current_hp: 500,
        max_hp: 500,
        current_qi: 50,
      },
    });

    await prisma.xianxiaParty.update({
      where: { id: partyTimeout.id },
      data: { status: 'IN_DUNGEON' },
    });

    // Gọi reconnect khi phiên đã quá hạn -> Bị từ chối và đổi status thành EXPIRED
    const resExpiredReconnect = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${expiredRun.id}/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonExpiredReconnect = await resExpiredReconnect.json();
    assert.strictEqual(resExpiredReconnect.status, 400);
    assert.ok(jsonExpiredReconnect.error.includes('DUNGEON_EXPIRED'));

    const expiredRunInDb = await prisma.xianxiaDungeonRun.findUnique({ where: { id: expiredRun.id } });
    assert.strictEqual(expiredRunInDb?.status, 'EXPIRED', 'Trạng thái phiên phải đổi sang EXPIRED.');

    const partyAfterTimeout = await prisma.xianxiaParty.findUnique({ where: { id: partyTimeout.id } });
    assert.strictEqual(partyAfterTimeout?.status, 'FORMING', 'Tổ đội được tự động giải phóng về FORMING.');
    console.log('✅ [GROUP G] Kết nối lại và tự động xử lý hết hạn 15 phút thành công.');

    // ==========================================
    // GROUP H: KIỂM THỬ ĐỒNG THỜI & RACE CONDITIONS (CONCURRENCY)
    // ==========================================
    console.log('\n--- GROUP H: KIỂM THỬ ĐỒNG THỜI & RACE CONDITIONS (CONCURRENCY) ---');

    // H1: Đội trưởng click đúp / spam 5 request enterDungeon cùng lúc
    console.log('   [H1] Kiểm thử 5 request đồng thời mở phó bản (Double-click Enter)...');
    // Giải phóng partyTimeout trước khi tạo partyConcurrent
    await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: partyTimeout.id } });
    await prisma.xianxiaParty.update({ where: { id: partyTimeout.id }, data: { status: 'DISBANDED' } });

    const partyConcurrent = await createFormedParty(leaderA, [memberB]);
    await prisma.xianxiaCharacter.update({ where: { id: leaderA.char.id }, data: { fatigue: 100 } });
    await prisma.xianxiaCharacter.update({ where: { id: memberB.char.id }, data: { fatigue: 100 } });

    const sharedEnterKey = `concurrent_enter_${testSuffix}`;
    const enterPromises = Array.from({ length: 5 }).map(() =>
      fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${leaderA.token}`,
          'x-idempotency-key': sharedEnterKey,
        },
      })
    );

    const enterResponses = await Promise.all(enterPromises);
    const enterResults = await Promise.all(enterResponses.map((r) => r.json()));

    const successEnters = enterResults.filter((r) => r.success === true);
    assert.ok(successEnters.length >= 1, 'Phải có ít nhất 1 request thành công.');
    const firstRunId = successEnters[0].data.id;
    trackedRunIds.add(firstRunId);

    // Mọi request thành công đều phải trỏ về cùng 1 Run ID duy nhất
    for (const s of successEnters) {
      assert.strictEqual(s.data.id, firstRunId, 'Các request thành công đều phải trả về cùng 1 phiên phó bản.');
    }

    // Kiểm tra số bản ghi run được tạo trong DB cho party này
    const createdRunsForParty = await prisma.xianxiaDungeonRun.findMany({
      where: { party_id: partyConcurrent.id },
    });
    assert.strictEqual(createdRunsForParty.length, 1, 'Chỉ duy nhất 1 phiên phó bản được tạo ra cho tổ đội.');

    // Kiểm tra thể lực chỉ bị trừ đúng 15 điểm cho mỗi người
    const leaderFatigueAfter = await prisma.xianxiaCharacter.findUnique({ where: { id: leaderA.char.id } });
    const memBFatigueAfter = await prisma.xianxiaCharacter.findUnique({ where: { id: memberB.char.id } });
    assert.strictEqual(leaderFatigueAfter?.fatigue, 85, 'Thể lực trưởng nhóm chỉ bị trừ đúng 1 lần 15.');
    assert.strictEqual(memBFatigueAfter?.fatigue, 85, 'Thể lực thành viên chỉ bị trừ đúng 1 lần 15.');
    console.log('   ✅ [H1 PASS] 5 request vào phó bản đồng thời được xử lý an toàn (1 run duy nhất).');

    // H2: 2 thành viên cùng gửi hiệp đấu đồng thời với version 1
    console.log('   [H2] Kiểm thử 2 hiệp đấu gửi đồng thời cùng version (Combat race condition)...');
    const combatPromises = [
      fetch(`${baseUrl}/api/xianxia/dungeons/run/${firstRunId}/combat-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
        body: JSON.stringify({ version: 1 }),
      }),
      fetch(`${baseUrl}/api/xianxia/dungeons/run/${firstRunId}/combat-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
        body: JSON.stringify({ version: 1 }),
      }),
    ];

    const combatResponses = await Promise.all(combatPromises);
    const statuses = combatResponses.map((r) => r.status);

    // 1 request phải thành công (200) và 1 request phải bị từ chối do version mismatch (409)
    assert.ok(statuses.includes(200), 'Phải có 1 hiệp đấu thành công.');
    assert.ok(statuses.includes(409), 'Hiệp đấu gửi trùng version còn lại phải bị từ chối với mã 409.');
    console.log('   ✅ [H2 PASS] Chống race condition hiệp đấu bằng Optimistic Lock thành công.');

    // H3: Spam 5 request nhận thưởng đồng thời
    console.log('   [H3] Kiểm thử 5 request nhận thưởng gửi đồng thời (Reward spam)...');
    // Hoàn thành phiên phó bản firstRunId
    await prisma.xianxiaDungeonRun.update({
      where: { id: firstRunId },
      data: { status: 'COMPLETED', completed_at: new Date() },
    });

    const concurrentClaimKey = `claim_spam_${testSuffix}`;
    const claimPromises = Array.from({ length: 5 }).map(() =>
      fetch(`${baseUrl}/api/xianxia/dungeons/run/${firstRunId}/claim-reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${leaderA.token}`,
          'x-idempotency-key': concurrentClaimKey,
        },
      })
    );

    const claimResponses = await Promise.all(claimPromises);
    const claimResults = await Promise.all(claimResponses.map((r) => r.json()));

    // Tất cả request trả về 200, nhưng chỉ đúng 1 bản ghi nhận thưởng trong DB
    for (const r of claimResponses) {
      assert.strictEqual(r.status, 200, 'Tất cả các claim request đều trả về 200 (hoặc qua replay cache).');
    }

    const claimsCount = await prisma.xianxiaDungeonRewardClaim.count({
      where: { dungeon_run_id: firstRunId, character_id: leaderA.char.id },
    });
    assert.strictEqual(claimsCount, 1, 'Chỉ duy nhất 1 bản ghi nhận thưởng được lưu trong DB.');
    console.log('   ✅ [H3 PASS] Spam nhận thưởng được chặn đứng bởi bảo vệ kép Idempotency.');

    // H4: Tổ đội đang ở phó bản cố tình enter phó bản khác
    console.log('   [H4] Kiểm thử tổ đội đang ở phó bản cố tình enter phó bản khác...');
    // Giải phóng partyConcurrent trước khi tạo partyInRun
    await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: partyConcurrent.id } });
    await prisma.xianxiaParty.update({ where: { id: partyConcurrent.id }, data: { status: 'DISBANDED' } });

    const partyInRun = await createFormedParty(leaderA, [memberB]);
    const runInProg = await prisma.xianxiaDungeonRun.create({
      data: {
        dungeon_id: 'dungeon_u_minh_co_dong',
        party_id: partyInRun.id,
        leader_character_id: leaderA.char.id,
        status: 'IN_PROGRESS',
        current_wave: 1,
        total_waves: 3,
        turns_count: 0,
        version: 1,
        combat_state: JSON.stringify({ currentWave: 1, totalWaves: 3, monsters: [], players: [] }),
        combat_log: JSON.stringify([]),
        started_at: new Date(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    trackedRunIds.add(runInProg.id);

    await prisma.xianxiaParty.update({
      where: { id: partyInRun.id },
      data: { status: 'IN_DUNGEON' },
    });

    const resEnterAgain = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonEnterAgain = await resEnterAgain.json();
    assert.strictEqual(resEnterAgain.status, 400);
    assert.ok(jsonEnterAgain.error.includes('DUNGEON_PARTY_NOT_FORMING') || jsonEnterAgain.error.includes('DUNGEON_PARTY_ALREADY_IN_DUNGEON'));
    console.log('   ✅ [H4 PASS] Chặn đứng tổ đội đang trong phó bản mở phiên thứ hai.');

    // ==========================================
    // GROUP I: FINAL HARDENING AUDIT (9 MANDATORY SCENARIOS)
    // ==========================================
    console.log('\n--- GROUP I: FINAL HARDENING AUDIT (9 MANDATORY SCENARIOS) ---');

    // Dọn dẹp partyInRun trước khi bắt đầu Group I
    await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: partyInRun.id } });
    await prisma.xianxiaParty.update({ where: { id: partyInRun.id }, data: { status: 'DISBANDED' } });

    // -------------------------------------------------------------
    // SCENARIO 1: Toàn đội tử trận (Team Wipe) -> FAILED -> Party freed (FORMING)
    // -------------------------------------------------------------
    console.log('   [SCENARIO 1] Kiểm thử toàn đội tử trận: Run -> FAILED, Party -> FORMING...');
    const partyWipe = await createFormedParty(leaderA, [memberB]);
    await prisma.xianxiaCharacter.update({ where: { id: leaderA.char.id }, data: { fatigue: 100 } });
    await prisma.xianxiaCharacter.update({ where: { id: memberB.char.id }, data: { fatigue: 100 } });

    const resEnterWipe = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonEnterWipe = await resEnterWipe.json();
    assert.strictEqual(resEnterWipe.status, 201);
    const wipeRunId = jsonEnterWipe.data.id;
    trackedRunIds.add(wipeRunId);

    // Chỉnh sửa snapshot: người chơi 1 HP, 0 def, 0 dodge; quái 999 atk, 999 speed
    const runWipeInDb = await prisma.xianxiaDungeonRun.findUnique({ where: { id: wipeRunId } });
    const wipeState = JSON.parse(runWipeInDb!.combat_state!);
    for (const p of wipeState.players) {
      p.hp = 1;
      p.def = 0;
      p.dodgeRate = 0;
      p.atk = 0;
      p.speed = 1;
    }
    for (const m of wipeState.monsters) {
      m.speed = 999;
      m.atk = 999;
    }
    await prisma.xianxiaDungeonRun.update({
      where: { id: wipeRunId },
      data: { combat_state: JSON.stringify(wipeState) },
    });

    let wipeStatus = 'IN_PROGRESS';
    for (let i = 0; i < 5; i++) {
      const resStepWipe = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${wipeRunId}/combat-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      });
      const jsonStepWipe = await resStepWipe.json();
      assert.strictEqual(resStepWipe.status, 200);
      wipeStatus = jsonStepWipe.data.status;
      if (wipeStatus === 'FAILED') break;
    }
    assert.strictEqual(wipeStatus, 'FAILED');

    // Kiểm tra DB: run -> FAILED, party -> FORMING
    const runWipeAfter = await prisma.xianxiaDungeonRun.findUnique({ where: { id: wipeRunId } });
    assert.strictEqual(runWipeAfter!.status, 'FAILED', 'Trạng thái phiên phó bản phải chuyển sang FAILED.');

    const partyWipeAfter = await prisma.xianxiaParty.findUnique({ where: { id: partyWipe.id } });
    assert.strictEqual(partyWipeAfter!.status, 'FORMING', 'Tổ đội phải được giải phóng về FORMING sau khi tử trận.');
    console.log('   ✅ [SCENARIO 1 PASS] Toàn đội tử trận chuyển run sang FAILED và giải phóng party sang FORMING thành công.');

    // -------------------------------------------------------------
    // SCENARIO 2: Tổ đội tiếp tục vào phó bản mới sau khi hoàn thành (COMPLETED)
    // -------------------------------------------------------------
    console.log('   [SCENARIO 2] Kiểm thử tổ đội vào phó bản mới sau khi COMPLETED...');
    // Tạo 1 run COMPLETED cho partyWipe
    const runCompleted = await prisma.xianxiaDungeonRun.create({
      data: {
        dungeon_id: 'dungeon_u_minh_co_dong',
        party_id: partyWipe.id,
        leader_character_id: leaderA.char.id,
        status: 'COMPLETED',
        current_wave: 3,
        total_waves: 3,
        turns_count: 5,
        version: 5,
        combat_state: JSON.stringify({ currentWave: 3, totalWaves: 3, monsters: [], players: [] }),
        combat_log: JSON.stringify(['Chiến thắng']),
        started_at: new Date(Date.now() - 3600000),
        completed_at: new Date(),
        expires_at: new Date(Date.now() + 600000),
      },
    });
    trackedRunIds.add(runCompleted.id);

    // Hồi thể lực cho tổ đội
    await prisma.xianxiaCharacter.update({ where: { id: leaderA.char.id }, data: { fatigue: 100 } });
    await prisma.xianxiaCharacter.update({ where: { id: memberB.char.id }, data: { fatigue: 100 } });

    const resEnterAfterCompleted = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonEnterAfterCompleted = await resEnterAfterCompleted.json();
    assert.strictEqual(resEnterAfterCompleted.status, 201, 'Tổ đội phải vào được phó bản mới sau khi phiên cũ COMPLETED.');
    const newRunAfterCompId = jsonEnterAfterCompleted.data.id;
    trackedRunIds.add(newRunAfterCompId);
    assert.notStrictEqual(newRunAfterCompId, runCompleted.id);
    console.log('   ✅ [SCENARIO 2 PASS] Vào phó bản mới sau COMPLETED thành công, không bị cản bởi partial unique index.');

    // -------------------------------------------------------------
    // SCENARIO 3: Tổ đội tiếp tục vào phó bản mới sau khi phó bản trước FAILED
    // -------------------------------------------------------------
    console.log('   [SCENARIO 3] Kiểm thử tổ đội vào phó bản mới sau khi FAILED...');
    // Đánh dấu newRunAfterCompId sang FAILED và giải phóng party sang FORMING
    await prisma.xianxiaDungeonRun.update({
      where: { id: newRunAfterCompId },
      data: { status: 'FAILED' },
    });
    await prisma.xianxiaParty.update({
      where: { id: partyWipe.id },
      data: { status: 'FORMING' },
    });

    // Hồi thể lực cho tổ đội
    await prisma.xianxiaCharacter.update({ where: { id: leaderA.char.id }, data: { fatigue: 100 } });
    await prisma.xianxiaCharacter.update({ where: { id: memberB.char.id }, data: { fatigue: 100 } });

    const resEnterAfterFailed = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonEnterAfterFailed = await resEnterAfterFailed.json();
    assert.strictEqual(resEnterAfterFailed.status, 201, 'Tổ đội phải vào được phó bản mới sau khi phiên cũ FAILED.');
    const newRunAfterFailedId = jsonEnterAfterFailed.data.id;
    trackedRunIds.add(newRunAfterFailedId);
    assert.notStrictEqual(newRunAfterFailedId, newRunAfterCompId);
    console.log('   ✅ [SCENARIO 3 PASS] Vào phó bản mới sau FAILED thành công, partial index hợp lệ.');

    // -------------------------------------------------------------
    // SCENARIO 4: Timeout & combat-step: Không thể vừa EXPIRED vừa COMPLETED
    // -------------------------------------------------------------
    console.log('   [SCENARIO 4] Kiểm thử timeout và combat-step: không thể vừa EXPIRED vừa COMPLETED...');
    // Cố tình ép expires_at của newRunAfterFailedId về quá khứ (hết hạn)
    await prisma.xianxiaDungeonRun.update({
      where: { id: newRunAfterFailedId },
      data: { expires_at: new Date(Date.now() - 10000) },
    });

    const resStepExpired = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${newRunAfterFailedId}/combat-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonStepExpired = await resStepExpired.json();
    assert.strictEqual(resStepExpired.status, 400);
    assert.ok(jsonStepExpired.error.includes('DUNGEON_ALREADY_EXPIRED'));

    // Kiểm tra DB: run phải là EXPIRED và party phải là FORMING
    const runExpiredInDb = await prisma.xianxiaDungeonRun.findUnique({ where: { id: newRunAfterFailedId } });
    assert.strictEqual(runExpiredInDb!.status, 'EXPIRED');

    const partyExpiredInDb = await prisma.xianxiaParty.findUnique({ where: { id: partyWipe.id } });
    assert.strictEqual(partyExpiredInDb!.status, 'FORMING');
    console.log('   ✅ [SCENARIO 4 PASS] Phiên hết hạn bị chặn chiến đấu, chuyển sang EXPIRED và trả party về FORMING.');

    // -------------------------------------------------------------
    // SCENARIO 5: Timeout & claim-reward: từ chối và không cấp thưởng bất hợp lệ
    // -------------------------------------------------------------
    console.log('   [SCENARIO 5] Kiểm thử timeout và claim-reward: từ chối cấp thưởng phiên quá hạn...');
    const charBeforeClaimExp = await prisma.xianxiaCharacter.findUnique({ where: { id: leaderA.char.id } });
    const silverBeforeExp = charBeforeClaimExp!.silver;
    const expBeforeExp = charBeforeClaimExp!.exp;

    const resClaimExpired = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${newRunAfterFailedId}/claim-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonClaimExpired = await resClaimExpired.json();
    assert.strictEqual(resClaimExpired.status, 400);
    assert.ok(jsonClaimExpired.error.includes('DUNGEON_NOT_COMPLETED'));

    // Xác nhận không tạo reward claim và không cộng tài nguyên
    const claimRecord = await prisma.xianxiaDungeonRewardClaim.findUnique({
      where: {
        dungeon_run_id_character_id: {
          dungeon_run_id: newRunAfterFailedId,
          character_id: leaderA.char.id,
        },
      },
    });
    assert.strictEqual(claimRecord, null);

    const charAfterClaimExp = await prisma.xianxiaCharacter.findUnique({ where: { id: leaderA.char.id } });
    assert.strictEqual(charAfterClaimExp!.silver, silverBeforeExp);
    assert.strictEqual(charAfterClaimExp!.exp, expBeforeExp);
    console.log('   ✅ [SCENARIO 5 PASS] Chặn claim reward trên phiên đã hết hạn/chưa hoàn thành.');

    // -------------------------------------------------------------
    // SCENARIO 6: Concurrent enter fatigue atomicity: không trừ 2 lần thể lực
    // -------------------------------------------------------------
    console.log('   [SCENARIO 6] Kiểm thử 2 request enter đồng thời: không trừ thể lực 2 lần...');
    await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: partyWipe.id } });
    await prisma.xianxiaParty.update({ where: { id: partyWipe.id }, data: { status: 'DISBANDED' } });

    const partyAtomicity = await createFormedParty(leaderA, [memberB]);
    await prisma.xianxiaCharacter.update({ where: { id: leaderA.char.id }, data: { fatigue: 60 } });
    await prisma.xianxiaCharacter.update({ where: { id: memberB.char.id }, data: { fatigue: 60 } });

    // Gửi 2 request enter đồng thời (không dùng chung idempotency key để kiểm tra race condition)
    const enterPromise1 = fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const enterPromise2 = fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });

    const [resAt1, resAt2] = await Promise.all([enterPromise1, enterPromise2]);
    const jsonAt1 = await resAt1.json();
    const jsonAt2 = await resAt2.json();

    const successCount = (resAt1.status === 201 ? 1 : 0) + (resAt2.status === 201 ? 1 : 0);
    assert.strictEqual(successCount, 1, 'Chỉ đúng 1 request enter đồng thời được thành công.');

    const successRunId = resAt1.status === 201 ? jsonAt1.data.id : jsonAt2.data.id;
    trackedRunIds.add(successRunId);

    // Kiểm tra thể lực trong DB: chỉ được trừ đúng 15 điểm (từ 60 còn 45)
    const leaderCharAfterEnter = await prisma.xianxiaCharacter.findUnique({ where: { id: leaderA.char.id } });
    assert.strictEqual(leaderCharAfterEnter!.fatigue, 45, 'Thể lực Đội Trưởng chỉ bị trừ đúng 1 lần (15 điểm).');

    const memberCharAfterEnter = await prisma.xianxiaCharacter.findUnique({ where: { id: memberB.char.id } });
    assert.strictEqual(memberCharAfterEnter!.fatigue, 45, 'Thể lực Thành Viên chỉ bị trừ đúng 1 lần (15 điểm).');
    console.log('   ✅ [SCENARIO 6 PASS] Concurrency enter an toàn, không bị trừ thể lực 2 lần.');

    // -------------------------------------------------------------
    // SCENARIO 7: Một thành viên thiếu thể lực khiến toàn bộ transaction rollback
    // -------------------------------------------------------------
    console.log('   [SCENARIO 7] Kiểm thử 1 thành viên thiếu thể lực gây rollback toàn bộ...');
    // Dọn partyAtomicity
    await prisma.xianxiaPartyMember.deleteMany({ where: { party_id: partyAtomicity.id } });
    await prisma.xianxiaParty.update({ where: { id: partyAtomicity.id }, data: { status: 'DISBANDED' } });

    const partyRollback = await createFormedParty(leaderA, [memberB]);
    await prisma.xianxiaCharacter.update({ where: { id: leaderA.char.id }, data: { fatigue: 80 } });
    await prisma.xianxiaCharacter.update({ where: { id: memberB.char.id }, data: { fatigue: 5 } }); // Thiếu thể lực (< 15)

    const resLackFatigue = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonLackFatigue = await resLackFatigue.json();
    assert.strictEqual(resLackFatigue.status, 400);
    assert.ok(jsonLackFatigue.error.includes('DUNGEON_INSUFFICIENT_FATIGUE'));

    // Xác nhận thể lực của leaderA không bị trừ lẻ (vẫn là 80)
    const leaderCharRollback = await prisma.xianxiaCharacter.findUnique({ where: { id: leaderA.char.id } });
    assert.strictEqual(leaderCharRollback!.fatigue, 80, 'Thể lực Đội Trưởng phải nguyên vẹn do transaction rollback.');

    const partyRollbackInDb = await prisma.xianxiaParty.findUnique({ where: { id: partyRollback.id } });
    assert.strictEqual(partyRollbackInDb!.status, 'FORMING', 'Tổ đội vẫn phải ở trạng thái FORMING.');
    console.log('   ✅ [SCENARIO 7 PASS] Thiếu thể lực kích hoạt rollback nguyên tử thành công.');

    // -------------------------------------------------------------
    // SCENARIO 8: Stale version: version cũ không làm thay đổi state hoặc log
    // -------------------------------------------------------------
    console.log('   [SCENARIO 8] Kiểm thử stale version: version cũ không thay đổi state và log...');
    // Cấp đủ thể lực cho memberB và enter phó bản
    await prisma.xianxiaCharacter.update({ where: { id: memberB.char.id }, data: { fatigue: 100 } });
    const resEnterStale = await fetch(`${baseUrl}/api/xianxia/dungeons/dungeon_u_minh_co_dong/enter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonEnterStale = await resEnterStale.json();
    assert.strictEqual(resEnterStale.status, 201);
    const staleRunId = jsonEnterStale.data.id;
    trackedRunIds.add(staleRunId);

    const runBeforeStale = await prisma.xianxiaDungeonRun.findUnique({ where: { id: staleRunId } });
    const initialVersion = runBeforeStale!.version;
    const initialTurns = runBeforeStale!.turns_count;
    const initialLog = runBeforeStale!.combat_log;

    // Gửi request step với expectedVersion không khớp (stale version = 999)
    const resStepStale = await fetch(`${baseUrl}/api/xianxia/dungeons/run/${staleRunId}/combat-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ version: 999 }),
    });
    const jsonStepStale = await resStepStale.json();
    assert.strictEqual(resStepStale.status, 409, 'Version cũ phải trả về 409 Conflict.');
    assert.ok(jsonStepStale.error.includes('DUNGEON_VERSION_MISMATCH'));

    // Kiểm tra DB: version, turns_count và log không bị biến động
    const runAfterStale = await prisma.xianxiaDungeonRun.findUnique({ where: { id: staleRunId } });
    assert.strictEqual(runAfterStale!.version, initialVersion);
    assert.strictEqual(runAfterStale!.turns_count, initialTurns);
    assert.strictEqual(runAfterStale!.combat_log, initialLog);
    console.log('   ✅ [SCENARIO 8 PASS] Stale version bị từ chối 409 và giữ nguyên bất biến state/log.');

    // -------------------------------------------------------------
    // SCENARIO 9: Party đang IN_DUNGEON: Chặn leave, kick, disband
    // -------------------------------------------------------------
    console.log('   [SCENARIO 9] Kiểm thử chặn leave, kick, disband khi tổ đội đang IN_DUNGEON...');
    // Xác nhận tổ đội đang IN_DUNGEON
    const partyInDungeonCheck = await prisma.xianxiaParty.findUnique({ where: { id: partyRollback.id } });
    assert.strictEqual(partyInDungeonCheck!.status, 'IN_DUNGEON');

    // 9.1 Thành viên thường gọi leaveParty -> Bị từ chối
    const resLeave = await fetch(`${baseUrl}/api/xianxia/party/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
    });
    const jsonLeave = await resLeave.json();
    assert.strictEqual(resLeave.status, 400);
    assert.ok(jsonLeave.error.includes('PARTY_IN_DUNGEON'));

    // 9.2 Đội trưởng gọi kickMember -> Bị từ chối
    const resKick = await fetch(`${baseUrl}/api/xianxia/party/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ characterId: memberB.char.id }),
    });
    const jsonKick = await resKick.json();
    assert.strictEqual(resKick.status, 400);
    assert.ok(jsonKick.error.includes('PARTY_IN_DUNGEON'));

    // 9.3 Đội trưởng gọi disbandParty -> Bị từ chối
    const resDisband = await fetch(`${baseUrl}/api/xianxia/party/disband`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonDisband = await resDisband.json();
    assert.strictEqual(resDisband.status, 400);
    assert.ok(jsonDisband.error.includes('PARTY_IN_DUNGEON'));

    // Kiểm tra DB: thành viên vẫn còn nguyên và trạng thái vẫn là IN_DUNGEON
    const memberCountStill = await prisma.xianxiaPartyMember.count({ where: { party_id: partyRollback.id } });
    assert.strictEqual(memberCountStill, 2);
    console.log('   ✅ [SCENARIO 9 PASS] Chặn thành công leave, kick, disband khi party IN_DUNGEON.');

    console.log('\n==================================================');
    console.log('🏆 TOÀN BỘ CÁC NHÓM KIỂM THỬ M4.3.3B (A - I) ĐÃ ĐẠT 100%!');
    console.log('==================================================\n');
  } finally {
    // ==========================================
    // CLEANUP TUYỆT ĐỐI AN TOÀN (CHỈ DỌN DỮ LIỆU CỦA TEST THEO ID)
    // ==========================================
    console.log('\n🧹 [CLEANUP] Bắt đầu dọn dẹp dữ liệu kiểm thử M4.3.3B...');
    try {
      const userIds = Array.from(trackedUserIds);
      const characterIds = Array.from(trackedCharacterIds);
      const partyIds = Array.from(trackedPartyIds);
      const runIds = Array.from(trackedRunIds);

      // 1. Xóa nhận thưởng phó bản
      if (runIds.length > 0 || characterIds.length > 0) {
        await prisma.xianxiaDungeonRewardClaim.deleteMany({
          where: {
            OR: [
              ...(runIds.length > 0 ? [{ dungeon_run_id: { in: runIds } }] : []),
              ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
            ],
          },
        }).catch(() => {});
      }

      // 2. Xóa thành viên phó bản
      if (runIds.length > 0 || characterIds.length > 0) {
        await prisma.xianxiaDungeonMember.deleteMany({
          where: {
            OR: [
              ...(runIds.length > 0 ? [{ dungeon_run_id: { in: runIds } }] : []),
              ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
            ],
          },
        }).catch(() => {});
      }

      // 3. Xóa các phiên phó bản
      if (runIds.length > 0 || partyIds.length > 0) {
        await prisma.xianxiaDungeonRun.deleteMany({
          where: {
            OR: [
              ...(runIds.length > 0 ? [{ id: { in: runIds } }] : []),
              ...(partyIds.length > 0 ? [{ party_id: { in: partyIds } }] : []),
            ],
          },
        }).catch(() => {});
      }

      // 4. Xóa vật phẩm túi đồ của nhân vật test
      if (characterIds.length > 0) {
        await prisma.xianxiaInventoryItem.deleteMany({
          where: { character_id: { in: characterIds } },
        }).catch(() => {});
      }

      // 5. Xóa lời mời tổ đội
      if (partyIds.length > 0 || characterIds.length > 0) {
        await prisma.xianxiaPartyInvite.deleteMany({
          where: {
            OR: [
              ...(partyIds.length > 0 ? [{ party_id: { in: partyIds } }] : []),
              ...(characterIds.length > 0 ? [{ inviter_id: { in: characterIds } }] : []),
              ...(characterIds.length > 0 ? [{ invitee_id: { in: characterIds } }] : []),
            ],
          },
        }).catch(() => {});
      }

      // 6. Xóa thành viên tổ đội
      if (partyIds.length > 0 || characterIds.length > 0) {
        await prisma.xianxiaPartyMember.deleteMany({
          where: {
            OR: [
              ...(partyIds.length > 0 ? [{ party_id: { in: partyIds } }] : []),
              ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
            ],
          },
        }).catch(() => {});
      }

      // 7. Xóa tổ đội test
      if (partyIds.length > 0) {
        await prisma.xianxiaParty.deleteMany({
          where: { id: { in: partyIds } },
        }).catch(() => {});
      }

      // 8. Xóa nhân vật test
      if (characterIds.length > 0 || userIds.length > 0) {
        await prisma.xianxiaCharacter.deleteMany({
          where: {
            OR: [
              ...(characterIds.length > 0 ? [{ id: { in: characterIds } }] : []),
              ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
            ],
          },
        }).catch(() => {});
      }

      // 9. Xóa user test
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        }).catch(() => {});
      }

      console.log('🧹 [CLEANUP] Dọn dẹp phó bản an toàn hoàn tất.');
    } catch (err: any) {
      console.warn('⚠️ Lỗi trong cleanup phó bản:', err?.message || err);
    }

    // Đóng test server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

// Cho phép chạy độc lập qua CLI
if (process.argv[1]?.endsWith('xianxiaM4Dungeon.test.ts') || process.argv[1]?.endsWith('xianxiaM4Dungeon.test.js')) {
  runXianxiaM4DungeonTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ DUNGEON TEST FAILED:', err);
      process.exit(1);
    });
}
