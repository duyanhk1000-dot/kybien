import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { xianxiaPartyService } from '../services/xianxia/xianxiaPartyService.js';
import { ensurePartyIndexes } from '../scripts/ensurePartyIndexes.js';

export async function runXianxiaM4PartyTests(): Promise<void> {
  console.log('\n--- ⚔️ [TEST] BẮT ĐẦU KIỂM THỬ M4.3.3A: TỔ ĐỘI TU TIÊN (PARTY SYSTEM) ---');

  // Đảm bảo partial unique indexes đã tồn tại
  await ensurePartyIndexes();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Party Test Server] Lắng nghe kiểm thử tại ${baseUrl}`);

  const trackedUserIds = new Set<number>();
  const trackedCharacterIds = new Set<number>();
  const trackedPartyIds = new Set<number>();

  try {
    // ==========================================
    // 0. CHUẨN BỊ DỮ LIỆU TÀI KHOẢN VÀ NHÂN VẬT TEST
    // ==========================================
    const testSuffix = Math.floor(Math.random() * 900000 + 100000);

    // Helper tạo tài khoản và nhân vật test
    async function createTestPlayer(namePrefix: string, level = 5) {
      const uname = `${namePrefix}_${testSuffix}_${Math.floor(Math.random() * 10000)}`;
      const user = await prisma.user.create({
        data: {
          username: uname,
          email: `${uname}@example.com`,
          password_hash: 'test_hash_party_123',
        },
      });
      trackedUserIds.add(user.id);

      const char = await prisma.xianxiaCharacter.create({
        data: {
          user_id: user.id,
          name: `Tu Sĩ ${uname}`,
          realm: 'LUYEN_KHI_3',
          level,
          silver: 500,
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

    const leaderA = await createTestPlayer('party_leadA');
    const memberB = await createTestPlayer('party_memB');
    const memberC = await createTestPlayer('party_memC');
    const memberD = await createTestPlayer('party_memD');
    const memberE = await createTestPlayer('party_memE');

    console.log('✅ [TEST 0] Khởi tạo tài khoản và nhân vật kiểm thử thành công.');

    // ==========================================
    // 1. KIỂM THỬ TẠO TỔ ĐỘI & TRUY VẤN TỔ ĐỘI (CRUD)
    // ==========================================
    // 1.1 Kiểm tra khi chưa có đội: GET /api/xianxia/party/me -> Trả về null
    const resNoParty = await fetch(`${baseUrl}/api/xianxia/party/me`, {
      headers: { Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonNoParty = await resNoParty.json();
    assert.strictEqual(resNoParty.status, 200);
    assert.strictEqual(jsonNoParty.success, true);
    assert.strictEqual(jsonNoParty.data, null, 'Chưa vào đội thì data phải là null.');

    // 1.2 Tạo tổ đội mới: POST /api/xianxia/party
    const partyName = `Chiến Đội Vạn Kiếm ${testSuffix}`;
    const resCreate = await fetch(`${baseUrl}/api/xianxia/party`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ name: partyName }),
    });
    const jsonCreate = await resCreate.json();
    assert.strictEqual(resCreate.status, 201, 'Tạo tổ đội thành công trả về 201.');
    assert.strictEqual(jsonCreate.success, true);
    assert.strictEqual(jsonCreate.data.name, partyName);
    assert.strictEqual(jsonCreate.data.leaderId, leaderA.char.id);
    assert.strictEqual(jsonCreate.data.memberCount, 1);
    assert.strictEqual(jsonCreate.data.status, 'FORMING');
    assert.strictEqual(jsonCreate.data.members[0].role, 'LEADER');
    assert.strictEqual(jsonCreate.data.members[0].isReady, false);

    const partyAId = jsonCreate.data.id;
    trackedPartyIds.add(partyAId);

    // 1.3 Kiểm tra lại bằng GET /api/xianxia/party/me
    const resMyParty = await fetch(`${baseUrl}/api/xianxia/party/me`, {
      headers: { Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonMyParty = await resMyParty.json();
    assert.strictEqual(resMyParty.status, 200);
    assert.strictEqual(jsonMyParty.data.id, partyAId);
    assert.strictEqual(jsonMyParty.data.members.length, 1);

    // 1.4 Invariant: Đã có đội thì không thể tạo đội thứ hai (chặn cả API lẫn DB)
    const resDupParty = await fetch(`${baseUrl}/api/xianxia/party`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ name: 'Đội Trùng' }),
    });
    const jsonDupParty = await resDupParty.json();
    assert.strictEqual(resDupParty.status, 400, 'Đã có đội không được tạo thêm đội.');
    assert.ok(jsonDupParty.error.includes('PARTY_ALREADY_IN_PARTY'));

    console.log('✅ [TEST 1] Tạo tổ đội, xem chi tiết và chống tạo trùng tổ đội PASSED.');

    // ==========================================
    // 2. KIỂM THỬ LỜI MỜI, LẤY LỜI MỜI VÀ PHẢN HỒI (INVITE & RESPOND)
    // ==========================================
    // 2.1 Không thể tự mời chính mình
    const resSelfInvite = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: leaderA.char.id }),
    });
    const jsonSelfInvite = await resSelfInvite.json();
    assert.strictEqual(resSelfInvite.status, 400);
    assert.ok(jsonSelfInvite.error.includes('PARTY_CANNOT_INVITE_SELF'));

    // 2.2 Leader mời Member B hợp lệ
    const resInviteB = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberB.char.id }),
    });
    const jsonInviteB = await resInviteB.json();
    assert.strictEqual(resInviteB.status, 201, 'Mời thành viên thành công trả về 201.');
    assert.strictEqual(jsonInviteB.success, true);
    assert.strictEqual(jsonInviteB.data.status, 'PENDING');
    assert.strictEqual(jsonInviteB.data.inviteeId, memberB.char.id);
    const inviteBId = jsonInviteB.data.id;

    // 2.3 Chặn gửi trùng lời mời khi lời mời cũ vẫn đang PENDING
    const resDupInvite = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberB.char.id }),
    });
    const jsonDupInvite = await resDupInvite.json();
    assert.strictEqual(resDupInvite.status, 400);
    assert.ok(jsonDupInvite.error.includes('PARTY_INVITE_ALREADY_PENDING'), 'Không thể gửi trùng lời mời đang chờ.');

    // 2.4 Member B lấy danh sách lời mời đang chờ: GET /api/xianxia/party/invites
    const resGetInvitesB = await fetch(`${baseUrl}/api/xianxia/party/invites`, {
      headers: { Authorization: `Bearer ${memberB.token}` },
    });
    const jsonGetInvitesB = await resGetInvitesB.json();
    assert.strictEqual(resGetInvitesB.status, 200);
    assert.strictEqual(jsonGetInvitesB.success, true);
    assert.ok(jsonGetInvitesB.data.some((inv: any) => inv.id === inviteBId), 'Danh sách phải có lời mời vừa gửi.');

    // 2.5 Phân quyền: Người khác (Member C) không thể xử lý lời mời của Member B
    const resWrongPerson = await fetch(`${baseUrl}/api/xianxia/party/invites/${inviteBId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberC.token}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });
    const jsonWrongPerson = await resWrongPerson.json();
    assert.strictEqual(resWrongPerson.status, 403, 'Người khác xử lý lời mời phải bị chặn 403.');
    assert.ok(jsonWrongPerson.error.includes('PARTY_FORBIDDEN'));

    // 2.6 Member B chấp nhận lời mời (ACCEPT)
    const resAcceptB = await fetch(`${baseUrl}/api/xianxia/party/invites/${inviteBId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });
    const jsonAcceptB = await resAcceptB.json();
    assert.strictEqual(resAcceptB.status, 200);
    assert.strictEqual(jsonAcceptB.success, true);
    assert.strictEqual(jsonAcceptB.data.action, 'ACCEPT');
    assert.strictEqual(jsonAcceptB.data.party.memberCount, 2, 'Tổ đội giờ đây có đúng 2 thành viên.');

    // 2.7 Kiểm tra trạng thái lời mời trong DB: Phải chuyển thành ACCEPTED
    const inviteBRecord = await prisma.xianxiaPartyInvite.findUnique({ where: { id: inviteBId } });
    assert.strictEqual(inviteBRecord?.status, 'ACCEPTED');

    // 2.8 Không thể xử lý lại lời mời đã được giải quyết (Chặn request lặp)
    const resRetryAccept = await fetch(`${baseUrl}/api/xianxia/party/invites/${inviteBId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });
    const jsonRetryAccept = await resRetryAccept.json();
    assert.strictEqual(resRetryAccept.status, 400);
    assert.ok(jsonRetryAccept.error.includes('PARTY_INVITE_ALREADY_PROCESSED'));

    // 2.9 Mời Member C và Member C từ chối (REJECT)
    const resInviteC = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberC.char.id }),
    });
    const jsonInviteC = await resInviteC.json();
    const inviteCId = jsonInviteC.data.id;

    const resRejectC = await fetch(`${baseUrl}/api/xianxia/party/invites/${inviteCId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberC.token}` },
      body: JSON.stringify({ action: 'REJECT' }),
    });
    const jsonRejectC = await resRejectC.json();
    assert.strictEqual(resRejectC.status, 200);
    assert.strictEqual(jsonRejectC.data.action, 'REJECT');

    const inviteCRecord = await prisma.xianxiaPartyInvite.findUnique({ where: { id: inviteCId } });
    assert.strictEqual(inviteCRecord?.status, 'REJECTED');

    console.log('✅ [TEST 2] Mời, từ chối, chấp nhận và bảo vệ quyền xử lý lời mời PASSED.');

    // ==========================================
    // 3. KIỂM THỬ SẴN SÀNG, PHÂN QUYỀN VÀ TRỤC XUẤT (READY & KICK)
    // ==========================================
    // 3.1 Thành viên B bật trạng thái sẵn sàng
    const resReadyB = await fetch(`${baseUrl}/api/xianxia/party/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
      body: JSON.stringify({ isReady: true }),
    });
    const jsonReadyB = await resReadyB.json();
    assert.strictEqual(resReadyB.status, 200);
    assert.strictEqual(jsonReadyB.data.isReady, true);

    const memBInDb = await prisma.xianxiaPartyMember.findUnique({ where: { character_id: memberB.char.id } });
    assert.strictEqual(memBInDb?.is_ready, true);

    // 3.2 Phân quyền: Thành viên thường (Member B) không có quyền mời hoặc trục xuất
    const resForbiddenInvite = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberD.char.id }),
    });
    assert.strictEqual(resForbiddenInvite.status, 403, 'Member thường không thể gửi lời mời.');

    const resForbiddenKick = await fetch(`${baseUrl}/api/xianxia/party/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
      body: JSON.stringify({ targetCharacterId: leaderA.char.id }),
    });
    assert.strictEqual(resForbiddenKick.status, 403, 'Member thường không thể kick ai.');

    // 3.3 Đội trưởng không thể tự trục xuất chính mình
    const resSelfKick = await fetch(`${baseUrl}/api/xianxia/party/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ targetCharacterId: leaderA.char.id }),
    });
    const jsonSelfKick = await resSelfKick.json();
    assert.strictEqual(resSelfKick.status, 400);
    assert.ok(jsonSelfKick.error.includes('PARTY_CANNOT_KICK_LEADER'));

    // 3.4 Thêm Member C vào đội và sau đó Đội trưởng trục xuất Member C
    const resInviteCAgain = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberC.char.id }),
    });
    const jsonInviteCAgain = await resInviteCAgain.json();
    await fetch(`${baseUrl}/api/xianxia/party/invites/${jsonInviteCAgain.data.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberC.token}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });

    // Đội trưởng kick Member C
    const resKickC = await fetch(`${baseUrl}/api/xianxia/party/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ targetCharacterId: memberC.char.id }),
    });
    const jsonKickC = await resKickC.json();
    assert.strictEqual(resKickC.status, 200);
    assert.strictEqual(jsonKickC.data.memberCount, 2, 'Sau khi kick C thì đội còn lại 2 thành viên.');

    const memCInDb = await prisma.xianxiaPartyMember.findUnique({ where: { character_id: memberC.char.id } });
    assert.strictEqual(memCInDb, null, 'Member C đã bị xóa khỏi bảng party members.');

    console.log('✅ [TEST 3] Trạng thái sẵn sàng, phân quyền RBAC và trục xuất thành viên PASSED.');

    // ==========================================
    // 4. KIỂM THỬ RỜI ĐỘI, CHUYỂN QUYỀN ĐỘI TRƯỞNG & GIẢI TÁN (LEAVE & DISBAND)
    // ==========================================
    // 4.1 Đội trưởng A rời đội -> Quyền Đội trưởng phải được chuyển cho Member B
    const resLeaveLeader = await fetch(`${baseUrl}/api/xianxia/party/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leaderA.token}` },
    });
    const jsonLeaveLeader = await resLeaveLeader.json();
    assert.strictEqual(resLeaveLeader.status, 200);
    assert.strictEqual(jsonLeaveLeader.data.left, true);
    assert.strictEqual(jsonLeaveLeader.data.disbanded, false);
    assert.strictEqual(jsonLeaveLeader.data.newLeaderId, memberB.char.id, 'Quyền đội trưởng chuyển cho Member B.');

    // Xác minh trong DB: Member B giờ là LEADER
    const memBUpdated = await prisma.xianxiaPartyMember.findUnique({ where: { character_id: memberB.char.id } });
    assert.strictEqual(memBUpdated?.role, 'LEADER');
    const partyAUpdated = await prisma.xianxiaParty.findUnique({ where: { id: partyAId } });
    assert.strictEqual(partyAUpdated?.leader_id, memberB.char.id);

    // 4.2 Member B (Đội trưởng mới) giải tán tổ đội
    const resDisband = await fetch(`${baseUrl}/api/xianxia/party/disband`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberB.token}` },
    });
    const jsonDisband = await resDisband.json();
    assert.strictEqual(resDisband.status, 200);
    assert.strictEqual(jsonDisband.data.disbanded, true);

    const partyADisbanded = await prisma.xianxiaParty.findUnique({ where: { id: partyAId } });
    assert.strictEqual(partyADisbanded?.status, 'DISBANDED');

    const remainingMembersInPartyA = await prisma.xianxiaPartyMember.findMany({ where: { party_id: partyAId } });
    assert.strictEqual(remainingMembersInPartyA.length, 0, 'Toàn bộ thành viên được giải phóng khi giải tán đội.');

    console.log('✅ [TEST 4] Rời đội, tự động chuyển giao quyền lực và giải tán tổ đội PASSED.');

    // ==========================================
    // 5. KIỂM THỬ LỜI MỜI HẾT HẠN (EXPIRATION ENFORCEMENT)
    // ==========================================
    // Tạo tổ đội mới bởi Leader A
    const resNewParty = await fetch(`${baseUrl}/api/xianxia/party`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ name: `Đội Mới ${testSuffix}` }),
    });
    const jsonNewParty = await resNewParty.json();
    const newPartyId = jsonNewParty.data.id;
    trackedPartyIds.add(newPartyId);

    // Mời Member D
    const resInviteD = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberD.char.id }),
    });
    const jsonInviteD = await resInviteD.json();
    const inviteDId = jsonInviteD.data.id;

    // Giả lập thời gian server trôi qua 3 phút (quá hạn 2 phút) bằng cách sửa expires_at trong DB
    await prisma.xianxiaPartyInvite.update({
      where: { id: inviteDId },
      data: { expires_at: new Date(Date.now() - 3 * 60 * 1000) },
    });

    // Member D thử chấp nhận lời mời đã hết hạn -> Phải bị từ chối 400 PARTY_INVITE_EXPIRED
    const resAcceptExpired = await fetch(`${baseUrl}/api/xianxia/party/invites/${inviteDId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberD.token}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });
    const jsonAcceptExpired = await resAcceptExpired.json();
    assert.strictEqual(resAcceptExpired.status, 400);
    assert.ok(jsonAcceptExpired.error.includes('PARTY_INVITE_EXPIRED'), 'Lời mời hết hạn phải bị từ chối.');

    const inviteDInDb = await prisma.xianxiaPartyInvite.findUnique({ where: { id: inviteDId } });
    assert.strictEqual(inviteDInDb?.status, 'EXPIRED', 'Trạng thái phải được tự động chuyển thành EXPIRED.');

    console.log('✅ [TEST 5] Kiểm tra thời hạn lời mời 2 phút (Expiration Invariant) PASSED.');

    // ==========================================
    // 6. KIỂM THỬ CONCURRENCY 1: 10 REQUEST CHẤP NHẬN ĐỒNG THỜI VÀO ĐỘI GẦN ĐẦY (MAX 4 MEMBERS)
    // ==========================================
    console.log('--- 🚀 [CONCURRENCY 1] Kiểm tra 10 requests chấp nhận lời mời đồng thời vào đội gần đầy (3/4) ---');

    // Tạo thêm 2 thành viên để đội có sẵn 3/4 người (Leader A + MemB + MemC)
    const resInvB = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberB.char.id }),
    });
    const jsonInvB = await resInvB.json();
    await fetch(`${baseUrl}/api/xianxia/party/invites/${jsonInvB.data.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberB.token}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });

    const resInvC = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
      body: JSON.stringify({ inviteeCharacterId: memberC.char.id }),
    });
    const jsonInvC = await resInvC.json();
    await fetch(`${baseUrl}/api/xianxia/party/invites/${jsonInvC.data.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberC.token}` },
      body: JSON.stringify({ action: 'ACCEPT' }),
    });

    // Lúc này đội newPartyId đã có 3 thành viên: Leader A, Member B, Member C. Chỉ còn DUY NHẤT 1 slot!
    const partyCheck = await prisma.xianxiaPartyMember.findMany({ where: { party_id: newPartyId } });
    assert.strictEqual(partyCheck.length, 3, 'Đội hiện tại phải có đúng 3 thành viên.');

    // Tạo 10 ứng viên độc lập
    const concurrentCandidates: any[] = [];
    const concurrentInviteIds: number[] = [];

    for (let i = 0; i < 10; i++) {
      const cand = await createTestPlayer(`cand_${i}`);
      concurrentCandidates.push(cand);

      // Leader A gửi lời mời cho từng ứng viên
      const resInvCand = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderA.token}` },
        body: JSON.stringify({ inviteeCharacterId: cand.char.id }),
      });
      const jsonInvCand = await resInvCand.json();
      assert.strictEqual(resInvCand.status, 201, `Gửi lời mời cho ứng viên ${i} thành công.`);
      concurrentInviteIds.push(jsonInvCand.data.id);
    }

    // Cả 10 ứng viên BẤM ACCEPT ĐỒNG THỜI (Promise.all)
    const acceptPromises = concurrentCandidates.map((cand, idx) => {
      const inviteId = concurrentInviteIds[idx];
      return fetch(`${baseUrl}/api/xianxia/party/invites/${inviteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cand.token}` },
        body: JSON.stringify({ action: 'ACCEPT' }),
      }).then(async (res) => {
        const body = await res.json();
        return { status: res.status, body };
      });
    });

    const results = await Promise.all(acceptPromises);
    console.log('  -> Results details:', JSON.stringify(results.map(r => ({ status: r.status, err: r.body?.error }))));
    const successResponses = results.filter((r) => r.status === 200 && r.body.success === true);
    const fullResponses = results.filter((r) => r.status === 400 && r.body.error?.includes('PARTY_FULL'));

    console.log(`  -> Kết quả Concurrency: ${successResponses.length} Thành Công (200), ${fullResponses.length} Bị Chặn Vì Đầy Đội (400)`);
    assert.strictEqual(successResponses.length, 1, 'Chỉ duy nhất 1 ứng viên được chấp nhận vào slot thứ 4.');
    assert.strictEqual(fullResponses.length, 9, '9 ứng viên còn lại phải bị từ chối với lỗi PARTY_FULL.');

    // Kiểm tra CSDL thực tế: Số lượng thành viên của đội TUYỆT ĐỐI KHÔNG ĐƯỢC VƯỢT QUÁ 4!
    const finalMembers = await prisma.xianxiaPartyMember.findMany({ where: { party_id: newPartyId } });
    assert.strictEqual(finalMembers.length, 4, 'CSDL khẳng định số lượng thành viên chính xác là 4, không vượt ngưỡng.');

    console.log('✅ [CONCURRENCY 1] Pessimistic Lock & DB Invariant chặn đứng vượt quá 4 thành viên PASSED 100%.');

    // ==========================================
    // 7. KIỂM THỬ CONCURRENCY 2: MỘT NHÂN VẬT CHẤP NHẬN ĐỒNG THỜI TỪ 2 ĐỘI KHÁC NHAU
    // ==========================================
    console.log('--- 🚀 [CONCURRENCY 2] Một nhân vật chấp nhận đồng thời lời mời từ 2 tổ đội khác nhau ---');

    // Tạo 2 đội mới (Đội X của Leader X, Đội Y của Leader Y)
    const leaderX = await createTestPlayer('party_leadX');
    const leaderY = await createTestPlayer('party_leadY');

    const resPartyX = await fetch(`${baseUrl}/api/xianxia/party`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderX.token}` },
      body: JSON.stringify({ name: `Đội X ${testSuffix}` }),
    });
    const partyXId = (await resPartyX.json()).data.id;
    trackedPartyIds.add(partyXId);

    const resPartyY = await fetch(`${baseUrl}/api/xianxia/party`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderY.token}` },
      body: JSON.stringify({ name: `Đội Y ${testSuffix}` }),
    });
    const partyYId = (await resPartyY.json()).data.id;
    trackedPartyIds.add(partyYId);

    // Tạo ứng viên Solo Z
    const soloZ = await createTestPlayer('party_soloz');

    // Cả 2 đội cùng mời Solo Z
    const resInvFromX = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderX.token}` },
      body: JSON.stringify({ inviteeCharacterId: soloZ.char.id }),
    });
    const invXId = (await resInvFromX.json()).data.id;

    const resInvFromY = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderY.token}` },
      body: JSON.stringify({ inviteeCharacterId: soloZ.char.id }),
    });
    const invYId = (await resInvFromY.json()).data.id;

    // Solo Z bấm Accept CẢ 2 LỜI MỜI CÙNG LÚC
    const dualAcceptPromises = [
      fetch(`${baseUrl}/api/xianxia/party/invites/${invXId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${soloZ.token}` },
        body: JSON.stringify({ action: 'ACCEPT' }),
      }).then(async (res) => ({ target: 'X', status: res.status, body: await res.json() })),
      fetch(`${baseUrl}/api/xianxia/party/invites/${invYId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${soloZ.token}` },
        body: JSON.stringify({ action: 'ACCEPT' }),
      }).then(async (res) => ({ target: 'Y', status: res.status, body: await res.json() })),
    ];

    const dualResults = await Promise.all(dualAcceptPromises);
    const dualSuccess = dualResults.filter((r) => r.status === 200);
    const dualFailure = dualResults.filter(
      (r) =>
        r.status === 400 &&
        (r.body.error?.includes('PARTY_ALREADY_IN_PARTY') ||
          r.body.error?.includes('PARTY_INVITE_ALREADY_PROCESSED'))
    );

    assert.strictEqual(dualSuccess.length, 1, 'Chỉ duy nhất 1 đội được chấp nhận.');
    assert.strictEqual(dualFailure.length, 1, 'Đội còn lại phải bị từ chối với lỗi 400.');

    // Kiểm tra CSDL: Solo Z chỉ thuộc ĐÚNG 1 ĐỘI
    const zMemberships = await prisma.xianxiaPartyMember.findMany({ where: { character_id: soloZ.char.id } });
    assert.strictEqual(zMemberships.length, 1, 'Solo Z chỉ có duy nhất 1 bản ghi thành viên trong CSDL.');

    console.log('✅ [CONCURRENCY 2] Row-Level Lock & Unique Constraint bảo vệ 1 người không thể ở 2 đội PASSED.');

    // ==========================================
    // 8. KIỂM THỬ CONCURRENCY 3: HAI REQUEST TẠO ĐỘI ĐỒNG THỜI CHO CÙNG 1 NHÂN VẬT
    // ==========================================
    console.log('--- 🚀 [CONCURRENCY 3] Hai requests đồng thời tạo đội cho cùng một nhân vật ---');

    const creatorW = await createTestPlayer('party_creatorw');

    const createDualPromises = [
      fetch(`${baseUrl}/api/xianxia/party`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorW.token}` },
        body: JSON.stringify({ name: `Đội W1 ${testSuffix}` }),
      }).then(async (res) => ({ status: res.status, body: await res.json() })),
      fetch(`${baseUrl}/api/xianxia/party`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorW.token}` },
        body: JSON.stringify({ name: `Đội W2 ${testSuffix}` }),
      }).then(async (res) => ({ status: res.status, body: await res.json() })),
    ];

    const createDualResults = await Promise.all(createDualPromises);
    const createSuccess = createDualResults.filter((r) => r.status === 201);
    const createFailure = createDualResults.filter((r) => r.status === 400);

    assert.strictEqual(createSuccess.length, 1, 'Chỉ có 1 request tạo đội thành công.');
    assert.strictEqual(createFailure.length, 1, 'Request tạo đội thứ hai phải bị từ chối.');

    if (createSuccess[0]?.body?.data?.id) {
      trackedPartyIds.add(createSuccess[0].body.data.id);
    }

    // CSDL chỉ có 1 tổ đội do W làm Đội trưởng
    const wParties = await prisma.xianxiaParty.findMany({
      where: { leader_id: creatorW.char.id, status: { not: 'DISBANDED' } },
    });
    assert.strictEqual(wParties.length, 1, 'Chỉ có đúng 1 tổ đội tồn tại trong CSDL cho nhân vật này.');

    console.log('✅ [CONCURRENCY 3] Chống tạo tổ đội đồng thời PASSED 100%.');

    // ==========================================
    // 9. KIỂM THỬ CONCURRENCY 4: HAI REQUEST XỬ LÝ CÙNG MỘT LỜI MỜI ĐỒNG THỜI
    // ==========================================
    console.log('--- 🚀 [CONCURRENCY 4] Hai requests đồng thời xử lý cùng một lời mời ---');

    const targetK = await createTestPlayer('party_targetk');
    const resInvK = await fetch(`${baseUrl}/api/xianxia/party/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${leaderX.token}` },
      body: JSON.stringify({ inviteeCharacterId: targetK.char.id }),
    });
    const invKId = (await resInvK.json()).data.id;

    // Gửi đồng thời: 1 request ACCEPT và 1 request REJECT
    const raceInvitePromises = [
      fetch(`${baseUrl}/api/xianxia/party/invites/${invKId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${targetK.token}` },
        body: JSON.stringify({ action: 'ACCEPT' }),
      }).then(async (res) => ({ action: 'ACCEPT', status: res.status, body: await res.json() })),
      fetch(`${baseUrl}/api/xianxia/party/invites/${invKId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${targetK.token}` },
        body: JSON.stringify({ action: 'REJECT' }),
      }).then(async (res) => ({ action: 'REJECT', status: res.status, body: await res.json() })),
    ];

    const raceInviteResults = await Promise.all(raceInvitePromises);
    const raceSuccess = raceInviteResults.filter((r) => r.status === 200);
    const raceFailure = raceInviteResults.filter((r) => r.status === 400 && r.body.error?.includes('PARTY_INVITE_ALREADY_PROCESSED'));

    assert.strictEqual(raceSuccess.length, 1, 'Chỉ có đúng 1 hành động được áp dụng.');
    assert.strictEqual(raceFailure.length, 1, 'Hành động thứ hai đến sau phải bị chặn vì lời mời đã được xử lý.');

    console.log('✅ [CONCURRENCY 4] Chống xử lý trùng lời mời đồng thời PASSED 100%.');

    console.log('\n==================================================');
    console.log('🏆 TẤT CẢ 9 NHÓM KIỂM THỬ M4.3.3A PARTY BACKEND ĐÃ VƯỢT QUA 100%!');
    console.log('==================================================\n');
  } finally {
    // ==========================================
    // DỌN DẸP AN TOÀN TUYỆT ĐỐI THEO ĐÚNG ID ĐÃ TRACK
    // ==========================================
    const userIds = Array.from(trackedUserIds);
    const characterIds = Array.from(trackedCharacterIds);
    const partyIds = Array.from(trackedPartyIds);

    console.log(`🧹 [CLEANUP] Đang dọn dẹp ${userIds.length} users, ${characterIds.length} characters, ${partyIds.length} parties...`);

    try {
      // 1. Xóa lời mời tổ đội liên quan
      await prisma.xianxiaPartyInvite.deleteMany({
        where: {
          OR: [
            ...(partyIds.length > 0 ? [{ party_id: { in: partyIds } }] : []),
            ...(characterIds.length > 0 ? [{ inviter_id: { in: characterIds } }] : []),
            ...(characterIds.length > 0 ? [{ invitee_id: { in: characterIds } }] : []),
          ],
        },
      }).catch(() => {});

      // 2. Xóa thành viên tổ đội liên quan
      await prisma.xianxiaPartyMember.deleteMany({
        where: {
          OR: [
            ...(partyIds.length > 0 ? [{ party_id: { in: partyIds } }] : []),
            ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
          ],
        },
      }).catch(() => {});

      // 3. Xóa các tổ đội test
      if (partyIds.length > 0) {
        await prisma.xianxiaParty.deleteMany({
          where: { id: { in: partyIds } },
        }).catch(() => {});
      }

      // 4. Xóa nhân vật test
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

      // 5. Xóa user test
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        }).catch(() => {});
      }

      console.log('🧹 [CLEANUP] Dọn dẹp an toàn hoàn tất.');
    } catch (err: any) {
      console.warn('⚠️ Lỗi trong cleanup test:', err?.message || err);
    }

    // Đóng test server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

// Cho phép chạy độc lập qua CLI
if (process.argv[1]?.endsWith('xianxiaM4Party.test.ts') || process.argv[1]?.endsWith('xianxiaM4Party.test.js')) {
  runXianxiaM4PartyTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ PARTY TEST FAILED:', err);
      process.exit(1);
    });
}
