import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { xianxiaGuildService } from '../services/xianxia/xianxiaGuildService.js';
import { xianxiaChatService } from '../services/xianxia/xianxiaChatService.js';
import { setupXianxiaChatSocket } from '../socket/xianxiaChatSocket.js';
import { Server as SocketServer } from 'socket.io';

export async function runXianxiaM4GuildTests(): Promise<void> {
  console.log('\n--- 🏯 [TEST] BẮT ĐẦU KIỂM THỬ MỤC 4.3.2: TÔNG MÔN / BANG HỘI (GUILD SYSTEM) ---');

  const server = http.createServer(app);
  const io = new SocketServer(server, { cors: { origin: '*' } });
  setupXianxiaChatSocket(io);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Guild Test Server] Lắng nghe kiểm thử tại ${baseUrl}`);

  const trackedUserIds = new Set<number>();
  const trackedCharacterIds = new Set<number>();
  const trackedGuildIds = new Set<number>();

  try {
    // ==========================================
    // 0. CHUẨN BỊ TÀI KHOẢN VÀ DỮ LIỆU TEST
    // ==========================================
    const testSuffix = Math.floor(Math.random() * 900000 + 100000);
    const usernameLeader = `guild_lead_${testSuffix}`;
    const usernameMemberA = `guild_memA_${testSuffix}`;
    const usernameMemberB = `guild_memB_${testSuffix}`;
    const usernameLowRealm = `guild_low_${testSuffix}`;
    const usernameNoSilver = `guild_nosilver_${testSuffix}`;

    // 1. User Leader: Cảnh giới Luyện Khí 3, 1000 Bạc (Đủ điều kiện lập Tông Môn)
    const userLeader = await prisma.user.create({
      data: {
        username: usernameLeader,
        email: `${usernameLeader}@example.com`,
        password_hash: 'test_hash_guild_123',
      },
    });
    trackedUserIds.add(userLeader.id);

    const charLeader = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userLeader.id,
        name: `Chưởng Môn ${testSuffix}`,
        realm: 'LUYEN_KHI_3',
        level: 5,
        silver: 1000,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCharacterIds.add(charLeader.id);
    const tokenLeader = jwt.sign({ userId: userLeader.id, username: usernameLeader }, config.jwtSecret, { expiresIn: '1h' });

    // 2. User Member A: Cảnh giới Luyện Khí 2, 200 Bạc
    const userMemA = await prisma.user.create({
      data: {
        username: usernameMemberA,
        email: `${usernameMemberA}@example.com`,
        password_hash: 'test_hash_guild_123',
      },
    });
    trackedUserIds.add(userMemA.id);

    const charMemA = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userMemA.id,
        name: `Đệ Tử A ${testSuffix}`,
        realm: 'LUYEN_KHI_2',
        level: 2,
        silver: 200,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCharacterIds.add(charMemA.id);
    const tokenMemA = jwt.sign({ userId: userMemA.id, username: usernameMemberA }, config.jwtSecret, { expiresIn: '1h' });

    // 3. User Member B: Cảnh giới Luyện Khí 1
    const userMemB = await prisma.user.create({
      data: {
        username: usernameMemberB,
        email: `${usernameMemberB}@example.com`,
        password_hash: 'test_hash_guild_123',
      },
    });
    trackedUserIds.add(userMemB.id);

    const charMemB = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userMemB.id,
        name: `Đệ Tử B ${testSuffix}`,
        realm: 'LUYEN_KHI_1',
        level: 1,
        silver: 100,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCharacterIds.add(charMemB.id);
    const tokenMemB = jwt.sign({ userId: userMemB.id, username: usernameMemberB }, config.jwtSecret, { expiresIn: '1h' });

    // 4. User Low Realm: Phàm Nhân (Cảnh giới chưa đủ Luyện Khí 3)
    const userLowRealm = await prisma.user.create({
      data: {
        username: usernameLowRealm,
        email: `${usernameLowRealm}@example.com`,
        password_hash: 'test_hash_guild_123',
      },
    });
    trackedUserIds.add(userLowRealm.id);

    const charLowRealm = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userLowRealm.id,
        name: `Phàm Nhân ${testSuffix}`,
        realm: 'PHAM_NHAN',
        level: 1,
        silver: 1000,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCharacterIds.add(charLowRealm.id);
    const tokenLowRealm = jwt.sign({ userId: userLowRealm.id, username: usernameLowRealm }, config.jwtSecret, { expiresIn: '1h' });

    // 5. User No Silver: Luyện Khí 4 nhưng chỉ có 100 Bạc (< 500 Bạc)
    const userNoSilver = await prisma.user.create({
      data: {
        username: usernameNoSilver,
        email: `${usernameNoSilver}@example.com`,
        password_hash: 'test_hash_guild_123',
      },
    });
    trackedUserIds.add(userNoSilver.id);

    const charNoSilver = await prisma.xianxiaCharacter.create({
      data: {
        user_id: userNoSilver.id,
        name: `Nghèo Tu ${testSuffix}`,
        realm: 'LUYEN_KHI_4',
        level: 4,
        silver: 100,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCharacterIds.add(charNoSilver.id);
    const tokenNoSilver = jwt.sign({ userId: userNoSilver.id, username: usernameNoSilver }, config.jwtSecret, { expiresIn: '1h' });

    console.log('✅ [GUILD TEST 0] Chuẩn bị dữ liệu tài khoản và nhân vật thử nghiệm thành công.');

    // ==========================================
    // 1. KIỂM THỬ ĐIỀU KIỆN THÀNH LẬP TÔNG MÔN
    // ==========================================
    const guildName = `Vạn Kiếm Tông ${testSuffix}`;

    // 1.1 Thử tạo khi cảnh giới chưa đủ (Phàm Nhân) -> Mong đợi lỗi 400 GUILD_REALM_TOO_LOW
    const resLowRealm = await fetch(`${baseUrl}/api/xianxia/guilds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLowRealm}` },
      body: JSON.stringify({ name: `Phàm Tông ${testSuffix}`, description: 'Mô tả' }),
    });
    const jsonLowRealm = await resLowRealm.json();
    assert.strictEqual(resLowRealm.status, 400, 'Tạo Tông môn khi cảnh giới thấp phải trả về mã 400.');
    assert.strictEqual(jsonLowRealm.success, false);
    assert.ok(jsonLowRealm.error.includes('GUILD_REALM_TOO_LOW'), 'Phải trả về mã lỗi GUILD_REALM_TOO_LOW.');

    // 1.2 Thử tạo khi ngân lượng không đủ (< 500 Bạc) -> Mong đợi lỗi 400 GUILD_INSUFFICIENT_SILVER
    const resNoSilver = await fetch(`${baseUrl}/api/xianxia/guilds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenNoSilver}` },
      body: JSON.stringify({ name: `Nghèo Tông ${testSuffix}`, description: 'Mô tả' }),
    });
    const jsonNoSilver = await resNoSilver.json();
    assert.strictEqual(resNoSilver.status, 400, 'Tạo Tông môn khi thiếu Bạc phải trả về mã 400.');
    assert.ok(jsonNoSilver.error.includes('GUILD_INSUFFICIENT_SILVER'), 'Phải trả về mã lỗi GUILD_INSUFFICIENT_SILVER.');

    // 1.3 Thử tạo với tên quá ngắn (< 3 ký tự)
    const resShortName = await fetch(`${baseUrl}/api/xianxia/guilds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLeader}` },
      body: JSON.stringify({ name: 'VK', description: 'Mô tả' }),
    });
    assert.strictEqual(resShortName.status, 400, 'Tên quá ngắn phải trả về lỗi 400.');

    // 1.4 Thành lập Tông Môn thành công bởi User Leader (Luyện Khí 3 + 1000 Bạc)
    const resCreate = await fetch(`${baseUrl}/api/xianxia/guilds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLeader}` },
      body: JSON.stringify({ name: guildName, description: 'Thiên hạ đệ nhất kiếm tông!' }),
    });
    const jsonCreate = await resCreate.json();
    assert.strictEqual(resCreate.status, 201, 'Thành lập Tông môn thành công phải trả về HTTP 201.');
    assert.strictEqual(jsonCreate.success, true);
    assert.strictEqual(jsonCreate.data.name, guildName);
    assert.strictEqual(jsonCreate.data.leaderId, charLeader.id);
    assert.strictEqual(jsonCreate.data.memberCount, 1);
    const createdGuildId = jsonCreate.data.id;
    trackedGuildIds.add(createdGuildId);

    // Xác minh trừ đúng 500 Bạc của nhân vật
    const charLeaderUpdated = await prisma.xianxiaCharacter.findUnique({ where: { id: charLeader.id } });
    assert.strictEqual(charLeaderUpdated?.silver, 500, 'Phải trừ chính xác 500 Bạc khi lập Tông môn.');

    // 1.5 Kiểm tra trùng tên Tông Môn
    const resDupName = await fetch(`${baseUrl}/api/xianxia/guilds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLeader}` },
      body: JSON.stringify({ name: guildName, description: 'Trùng tên' }),
    });
    assert.strictEqual(resDupName.status, 400, 'Đặt trùng tên Tông môn phải bị từ chối 400.');

    console.log('✅ [GUILD TEST 1] Kiểm thử điều kiện thành lập Tông môn và khấu trừ Bạc đạt chuẩn 100%.');

    // ==========================================
    // 2. KIỂM THỬ TRUY VẤN DANH SÁCH & XEM THÔNG TIN
    // ==========================================
    // 2.1 Xem thông tin Tông môn của tôi (GET /api/xianxia/guilds/me)
    const resMyGuild = await fetch(`${baseUrl}/api/xianxia/guilds/me`, {
      headers: { Authorization: `Bearer ${tokenLeader}` },
    });
    const jsonMyGuild = await resMyGuild.json();
    assert.strictEqual(resMyGuild.status, 200);
    assert.strictEqual(jsonMyGuild.success, true);
    assert.strictEqual(jsonMyGuild.data.hasGuild, true);
    assert.strictEqual(jsonMyGuild.data.myRole, 'LEADER');
    assert.strictEqual(jsonMyGuild.data.guild.id, createdGuildId);
    assert.strictEqual(jsonMyGuild.data.members.length, 1);

    // 2.2 Xem danh sách Tông môn công khai (GET /api/xianxia/guilds)
    const resList = await fetch(`${baseUrl}/api/xianxia/guilds?search=${encodeURIComponent(guildName)}`, {
      headers: { Authorization: `Bearer ${tokenMemA}` },
    });
    const jsonList = await resList.json();
    assert.strictEqual(resList.status, 200);
    assert.strictEqual(jsonList.success, true);
    assert.ok(jsonList.data.guilds.some((g: any) => g.id === createdGuildId), 'Danh sách phải chứa Tông môn vừa tạo.');

    console.log('✅ [GUILD TEST 2] Kiểm thử truy vấn danh sách và chi tiết Tông môn đạt chuẩn.');

    // ==========================================
    // 3. KIỂM THỬ BÁI KIẾN / NỘP ĐƠN GIA NHẬP
    // ==========================================
    // 3.1 Đệ tử A nộp đơn xin gia nhập Tông Môn
    const resApplyA = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMemA}` },
      body: JSON.stringify({ message: 'Ngưỡng mộ danh tiếng đã lâu, kính xin gia nhập!' }),
    });
    const jsonApplyA = await resApplyA.json();
    assert.strictEqual(resApplyA.status, 201);
    assert.strictEqual(jsonApplyA.success, true);
    const appIdA = jsonApplyA.data.id;

    // 3.2 Đệ tử A thử nộp đơn lần 2 vào cùng Tông môn -> Bị từ chối trùng lặp
    const resApplyADup = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMemA}` },
      body: JSON.stringify({ message: 'Nộp lại' }),
    });
    assert.strictEqual(resApplyADup.status, 400, 'Nộp đơn trùng lặp phải trả về mã 400.');

    // 3.3 Đệ tử B nộp đơn gia nhập
    const resApplyB = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMemB}` },
      body: JSON.stringify({ message: 'Xin bái nhập môn hạ!' }),
    });
    const jsonApplyB = await resApplyB.json();
    assert.strictEqual(resApplyB.status, 201);
    const appIdB = jsonApplyB.data.id;

    // 3.4 Xem danh sách đơn bái kiến (Chỉ LEADER hoặc ELDER)
    // Thử dùng tài khoản MemB xem đơn -> Mong đợi 403 FORBIDDEN
    const resAppsForbidden = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/applications`, {
      headers: { Authorization: `Bearer ${tokenMemB}` },
    });
    assert.strictEqual(resAppsForbidden.status, 403, 'Người không có thẩm quyền xem đơn phải bị từ chối 403.');

    // Chưởng Môn xem danh sách đơn
    const resAppsLeader = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/applications`, {
      headers: { Authorization: `Bearer ${tokenLeader}` },
    });
    const jsonAppsLeader = await resAppsLeader.json();
    assert.strictEqual(resAppsLeader.status, 200);
    assert.strictEqual(jsonAppsLeader.data.length, 2, 'Phải có 2 đơn bái kiến đang chờ duyệt.');

    console.log('✅ [GUILD TEST 3] Kiểm thử bái kiến và phân quyền xem đơn đạt chuẩn.');

    // ==========================================
    // 4. KIỂM THỬ TIẾP NHẬN & KHƯỚC TỪ ĐƠN BÁI KIẾN
    // ==========================================
    // 4.1 Chưởng Môn tiếp nhận Đệ tử A (Accept Application)
    const resAcceptA = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/applications/${appIdA}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenLeader}` },
    });
    const jsonAcceptA = await resAcceptA.json();
    assert.strictEqual(resAcceptA.status, 200);
    assert.strictEqual(jsonAcceptA.success, true);

    // Kiểm tra số lượng thành viên đã tăng lên 2
    const guildAfterA = await prisma.xianxiaGuild.findUnique({ where: { id: createdGuildId } });
    assert.strictEqual(guildAfterA?.member_count, 2, 'Số lượng thành viên phải tăng lên 2.');

    // Đệ tử A kiểm tra lại thông tin Tông Môn của mình
    const resMyGuildA = await fetch(`${baseUrl}/api/xianxia/guilds/me`, {
      headers: { Authorization: `Bearer ${tokenMemA}` },
    });
    const jsonMyGuildA = await resMyGuildA.json();
    assert.strictEqual(jsonMyGuildA.data.hasGuild, true);
    assert.strictEqual(jsonMyGuildA.data.myRole, 'MEMBER');

    // 4.2 Chưởng Môn từ chối đơn của Đệ tử B (Reject Application)
    const resRejectB = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/applications/${appIdB}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenLeader}` },
    });
    const jsonRejectB = await resRejectB.json();
    assert.strictEqual(resRejectB.status, 200);
    assert.strictEqual(jsonRejectB.success, true);

    const appBRecord = await prisma.xianxiaGuildApplication.findUnique({ where: { id: appIdB } });
    assert.strictEqual(appBRecord?.status, 'REJECTED', 'Đơn của B phải chuyển trạng thái REJECTED.');

    console.log('✅ [GUILD TEST 4] Kiểm thử tiếp nhận và từ chối đơn gia nhập đạt chuẩn.');

    // ==========================================
    // 5. KIỂM THỬ PHÂN QUYỀN RBAC & QUẢN TRỊ NỘI BỘ
    // ==========================================
    // 5.1 Đệ tử thường (A) không có quyền trục xuất ai -> Mong đợi 403
    const resKickForbidden = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMemA}` },
      body: JSON.stringify({ characterId: charLeader.id }),
    });
    assert.strictEqual(resKickForbidden.status, 403, 'Đệ tử thường không được trục xuất người khác.');

    // 5.2 Chưởng Môn thăng chức Đệ tử A lên Trưởng Lão (ELDER)
    const resPromote = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLeader}` },
      body: JSON.stringify({ characterId: charMemA.id }),
    });
    const jsonPromote = await resPromote.json();
    assert.strictEqual(resPromote.status, 200);
    assert.strictEqual(jsonPromote.success, true);

    const memberARecord = await prisma.xianxiaGuildMember.findUnique({ where: { character_id: charMemA.id } });
    assert.strictEqual(memberARecord?.role, 'ELDER', 'Vai trò của A phải là ELDER.');

    // 5.3 Trưởng Lão A cập nhật Cáo thị môn phái thành công
    const resNotice = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/notice`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenMemA}` },
      body: JSON.stringify({ notice: 'Môn quy đệ nhất: Cấm sát sinh bừa bãi!' }),
    });
    assert.strictEqual(resNotice.status, 200);

    const guildWithNotice = await prisma.xianxiaGuild.findUnique({ where: { id: createdGuildId } });
    assert.strictEqual(guildWithNotice?.notice, 'Môn quy đệ nhất: Cấm sát sinh bừa bãi!');

    // 5.4 Chưởng Môn giáng chức Trưởng Lão A xuống làm Đệ tử
    const resDemote = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/demote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLeader}` },
      body: JSON.stringify({ characterId: charMemA.id }),
    });
    assert.strictEqual(resDemote.status, 200);

    const memberADemoted = await prisma.xianxiaGuildMember.findUnique({ where: { character_id: charMemA.id } });
    assert.strictEqual(memberADemoted?.role, 'MEMBER', 'A đã bị giáng chức thành MEMBER.');

    // 5.5 Chuyển giao ngôi vị Chưởng Môn (Transfer Leadership) cho A
    const resTransfer = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenLeader}` },
      body: JSON.stringify({ newLeaderCharacterId: charMemA.id }),
    });
    assert.strictEqual(resTransfer.status, 200);

    const guildTransferred = await prisma.xianxiaGuild.findUnique({ where: { id: createdGuildId } });
    assert.strictEqual(guildTransferred?.leader_id, charMemA.id, 'Chưởng môn mới phải là A.');

    const newLeaderMember = await prisma.xianxiaGuildMember.findUnique({ where: { character_id: charMemA.id } });
    assert.strictEqual(newLeaderMember?.role, 'LEADER', 'A phải có role LEADER.');

    const oldLeaderMember = await prisma.xianxiaGuildMember.findUnique({ where: { character_id: charLeader.id } });
    assert.strictEqual(oldLeaderMember?.role, 'ELDER', 'Chưởng môn cũ tự động thành ELDER.');

    console.log('✅ [GUILD TEST 5] Kiểm thử phân quyền RBAC, bãi chức, và truyền ngôi Chưởng môn đạt chuẩn.');

    // ==========================================
    // 6. KIỂM THỬ RỜI TÔNG MÔN & GIẢI TÁN AN TOÀN
    // ==========================================
    // 6.1 Chưởng Môn mới (A) thử tự rời đi khi còn thành viên -> Bị chặn
    const resLeaderLeaveFail = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenMemA}` },
    });
    assert.strictEqual(resLeaderLeaveFail.status, 403, 'Chưởng môn không được rời đi khi còn thành viên.');

    // 6.2 Thành viên cũ (charLeader) tự nguyện rời khỏi Tông Môn
    const resOldLeaderLeave = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenLeader}` },
    });
    assert.strictEqual(resOldLeaderLeave.status, 200);

    const guildAfterLeave = await prisma.xianxiaGuild.findUnique({ where: { id: createdGuildId } });
    assert.strictEqual(guildAfterLeave?.member_count, 1, 'Số lượng thành viên phải giảm còn 1.');

    // 6.3 Chưởng Môn A giải tán Tông Môn an toàn
    const resDisband = await fetch(`${baseUrl}/api/xianxia/guilds/${createdGuildId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenMemA}` },
    });
    assert.strictEqual(resDisband.status, 200);

    const guildDeleted = await prisma.xianxiaGuild.findUnique({ where: { id: createdGuildId } });
    assert.strictEqual(guildDeleted, null, 'Tông môn phải bị xóa bỏ khỏi cơ sở dữ liệu.');

    console.log('✅ [GUILD TEST 6] Kiểm thử rời Tông môn và giải tán môn phái an toàn đạt chuẩn.');

    // ==========================================
    // 7. KIỂM THỬ KÊNH CHAT TÔNG MÔN & CÔ LẬP DỮ LIỆU
    // ==========================================
    // Tạo 2 Tông môn riêng biệt: Tông môn X (User Leader) và Tông môn Y (User MemA)
    // Cấp lại tiền cho 2 nhân vật
    await prisma.xianxiaCharacter.update({ where: { id: charLeader.id }, data: { silver: 1000 } });
    await prisma.xianxiaCharacter.update({ where: { id: charMemA.id }, data: { silver: 1000, realm: 'LUYEN_KHI_3' } });

    const guildX = await xianxiaGuildService.createGuild(userLeader.id, `Tông Môn X ${testSuffix}`);
    trackedGuildIds.add(guildX.id);
    const guildY = await xianxiaGuildService.createGuild(userMemA.id, `Tông Môn Y ${testSuffix}`);
    trackedGuildIds.add(guildY.id);

    // User Leader gửi tin nhắn vào kênh GUILD của Tông môn X
    const msgX = await xianxiaChatService.sendMessage(userLeader.id, 'GUILD', 'Lời mật truyền của Tông Môn X');
    assert.strictEqual(msgX.channel, 'GUILD');
    assert.strictEqual(msgX.guildId, guildX.id);
    assert.strictEqual(msgX.content, 'Lời mật truyền của Tông Môn X');

    // User MemA gửi tin nhắn vào kênh GUILD của Tông môn Y
    const msgY = await xianxiaChatService.sendMessage(userMemA.id, 'GUILD', 'Lời mật truyền của Tông Môn Y');
    assert.strictEqual(msgY.channel, 'GUILD');
    assert.strictEqual(msgY.guildId, guildY.id);

    // Người ngoài (MemB chưa có tông môn) thử gửi tin GUILD -> Bị từ chối CHAT_NO_GUILD
    let noGuildError = false;
    try {
      await xianxiaChatService.sendMessage(userMemB.id, 'GUILD', 'Tin nhắn lậu');
    } catch (e: any) {
      noGuildError = e.message.includes('CHAT_NO_GUILD');
    }
    assert.strictEqual(noGuildError, true, 'Người chưa có Tông môn không thể truyền âm kênh GUILD.');

    // Kiểm tra cô lập dữ liệu: Tông môn X chỉ lấy được tin của X, không thấy tin của Y
    const historyX = await xianxiaChatService.getRecentMessages('GUILD', undefined, 30, guildX.id);
    assert.ok(historyX.some(m => m.content === 'Lời mật truyền của Tông Môn X'));
    assert.ok(!historyX.some(m => m.content === 'Lời mật truyền của Tông Môn Y'), 'Tông môn X không được nhìn thấy tin của Tông môn Y.');

    const historyY = await xianxiaChatService.getRecentMessages('GUILD', undefined, 30, guildY.id);
    assert.ok(historyY.some(m => m.content === 'Lời mật truyền của Tông Môn Y'));
    assert.ok(!historyY.some(m => m.content === 'Lời mật truyền của Tông Môn X'), 'Tông môn Y không được nhìn thấy tin của Tông môn X.');

    console.log('✅ [GUILD TEST 7] Kiểm thử kênh chat Tông môn và cô lập dữ liệu đạt chuẩn 100%.');

    // ==========================================
    // 8. KIỂM THỬ CONCURRENCY & CHỐNG RACE CONDITION
    // ==========================================
    // Tạo ứng viên C nộp đơn vào Tông môn X
    const usernameCand = `cand_${testSuffix}`;
    const userCand = await prisma.user.create({
      data: { username: usernameCand, email: `${usernameCand}@example.com`, password_hash: 'hash' },
    });
    trackedUserIds.add(userCand.id);
    const charCand = await prisma.xianxiaCharacter.create({
      data: { user_id: userCand.id, name: `Ứng Viên ${testSuffix}`, realm: 'LUYEN_KHI_1', level: 1 },
    });
    trackedCharacterIds.add(charCand.id);
    const appCand = await xianxiaGuildService.applyToGuild(userCand.id, guildX.id, 'Xin gia nhập');

    // Chạy 2 request acceptApplication ĐỒNG THỜI cho cùng 1 đơn bái kiến
    const [res1, res2] = await Promise.allSettled([
      xianxiaGuildService.acceptApplication(userLeader.id, guildX.id, appCand.id),
      xianxiaGuildService.acceptApplication(userLeader.id, guildX.id, appCand.id),
    ]);

    const successes = [res1, res2].filter(r => r.status === 'fulfilled');
    const failures = [res1, res2].filter(r => r.status === 'rejected');

    assert.strictEqual(successes.length, 1, 'Chỉ duy nhất 1 request duyệt đơn đồng thời thành công.');
    assert.strictEqual(failures.length, 1, 'Request thứ hai phải bị từ chối do đơn đã được xử lý.');

    // Kiểm tra member_count chính xác là 2, không bị tăng thành 3
    const finalGuildX = await prisma.xianxiaGuild.findUnique({ where: { id: guildX.id } });
    assert.strictEqual(finalGuildX?.member_count, 2, 'Pessimistic locking bảo vệ member_count chính xác tuyệt đối.');

    console.log('✅ [GUILD TEST 8] Kiểm thử Concurrency & Pessimistic Locking chống Race Condition thành công 100%.');

    // ==========================================
    // 9. KIỂM THỬ VÒNG ĐỜI ĐƠN & TÁI NỘP ĐƠN (RE-APPLY SAU HỦY / TỪ CHỐI)
    // ==========================================
    // 9.1 Ứng viên Cand2 nộp đơn vào Tông môn Y -> Hủy -> Nộp lại -> Hủy lại -> Không được lỗi P2002
    const usernameCand2 = `cand2_${testSuffix}`;
    const userCand2 = await prisma.user.create({
      data: { username: usernameCand2, email: `${usernameCand2}@example.com`, password_hash: 'hash' },
    });
    trackedUserIds.add(userCand2.id);
    const charCand2 = await prisma.xianxiaCharacter.create({
      data: { user_id: userCand2.id, name: `Ứng Viên 2 ${testSuffix}`, realm: 'LUYEN_KHI_1', level: 1 },
    });
    trackedCharacterIds.add(charCand2.id);
    const tokenCand2 = jwt.sign({ userId: userCand2.id, username: usernameCand2 }, config.jwtSecret, { expiresIn: '1h' });

    // Lần 1: Nộp đơn
    const app1 = await xianxiaGuildService.applyToGuild(userCand2.id, guildY.id, 'Lời chào 1');
    assert.strictEqual(app1.status, 'PENDING');

    // Lần 1: Hủy đơn
    const cancel1 = await xianxiaGuildService.cancelApplication(userCand2.id, guildY.id);
    assert.strictEqual(cancel1, true);

    // Lần 2: Nộp lại đơn vào cùng Tông môn Y -> Phải tái sử dụng/cập nhật đơn an toàn
    const app2 = await xianxiaGuildService.applyToGuild(userCand2.id, guildY.id, 'Lời chào 2');
    assert.strictEqual(app2.status, 'PENDING');
    assert.strictEqual(app2.message, 'Lời chào 2');

    // Lần 2: Hủy lại đơn -> Tuyệt đối không được vấp phải lỗi Unique Constraint P2002
    const cancel2 = await xianxiaGuildService.cancelApplication(userCand2.id, guildY.id);
    assert.strictEqual(cancel2, true);

    // Lần 3: Nộp lại đơn và bị Chưởng môn Y từ chối
    const app3 = await xianxiaGuildService.applyToGuild(userCand2.id, guildY.id, 'Lời chào 3');
    assert.strictEqual(app3.status, 'PENDING');
    await xianxiaGuildService.rejectApplication(userMemA.id, guildY.id, app3.id);

    // Lần 4: Sau khi bị từ chối, ứng viên nộp lại đơn thành công
    const app4 = await xianxiaGuildService.applyToGuild(userCand2.id, guildY.id, 'Lời chào 4 sau khi bị từ chối');
    assert.strictEqual(app4.status, 'PENDING');
    assert.strictEqual(app4.message, 'Lời chào 4 sau khi bị từ chối');

    console.log('✅ [GUILD TEST 9] Kiểm thử Vòng đời đơn bái kiến & Tái nộp đơn (Anti-P2002) thành công 100%.');

    // ==========================================
    // 10. KIỂM THỬ GIỚI HẠN 3 ĐƠN PENDING & CONCURRENCY
    // ==========================================
    // Tạo thêm 2 Tông môn phụ để Cand2 nộp đơn
    const userLeaderZ = await prisma.user.create({
      data: { username: `leadZ_${testSuffix}`, email: `lz${testSuffix}@test.com`, password_hash: 'x' },
    });
    trackedUserIds.add(userLeaderZ.id);
    const charLeaderZ = await prisma.xianxiaCharacter.create({
      data: { user_id: userLeaderZ.id, name: `Leader Z ${testSuffix}`, realm: 'LUYEN_KHI_3', silver: 1000 },
    });
    trackedCharacterIds.add(charLeaderZ.id);
    const guildZ = await xianxiaGuildService.createGuild(userLeaderZ.id, `Tông Môn Z ${testSuffix}`);
    trackedGuildIds.add(guildZ.id);

    const userLeaderW = await prisma.user.create({
      data: { username: `leadW_${testSuffix}`, email: `lw${testSuffix}@test.com`, password_hash: 'x' },
    });
    trackedUserIds.add(userLeaderW.id);
    const charLeaderW = await prisma.xianxiaCharacter.create({
      data: { user_id: userLeaderW.id, name: `Leader W ${testSuffix}`, realm: 'LUYEN_KHI_3', silver: 1000 },
    });
    trackedCharacterIds.add(charLeaderW.id);
    const guildW = await xianxiaGuildService.createGuild(userLeaderW.id, `Tông Môn W ${testSuffix}`);
    trackedGuildIds.add(guildW.id);

    // Cand2 hiện đã có 1 đơn ở guildY. Giờ nộp thêm vào guildZ (đơn thứ 2) và guildW (đơn thứ 3)
    await xianxiaGuildService.applyToGuild(userCand2.id, guildZ.id, 'Đơn thứ 2');
    await xianxiaGuildService.applyToGuild(userCand2.id, guildW.id, 'Đơn thứ 3');

    // Thử nộp đơn thứ 4 vào guildX -> Bắt buộc bị từ chối GUILD_APPLICATION_LIMIT
    let limitReached = false;
    try {
      await xianxiaGuildService.applyToGuild(userCand2.id, guildX.id, 'Đơn thứ 4 quá giới hạn');
    } catch (e: any) {
      limitReached = e.message.includes('GUILD_APPLICATION_LIMIT');
    }
    assert.strictEqual(limitReached, true, 'Vượt quá 3 đơn PENDING phải bị chặn.');

    console.log('✅ [GUILD TEST 10] Kiểm thử Giới hạn 3 đơn PENDING toàn hệ thống đạt chuẩn 100%.');

    // ==========================================
    // 11. KIỂM THỬ ROUTE ALIASES (/me và /my, và /applications/cancel)
    // ==========================================
    const resMy = await fetch(`${baseUrl}/api/xianxia/guilds/my`, {
      headers: { Authorization: `Bearer ${tokenLeader}` },
    });
    const jsonMy = await resMy.json();
    assert.strictEqual(resMy.status, 200);
    assert.strictEqual(jsonMy.data.hasGuild, true);
    assert.strictEqual(jsonMy.data.guild.id, guildX.id, 'Route /my phải trả về đúng Tông môn như /me.');

    // Route hủy đơn qua alias /:id/applications/cancel
    const resCancelAlias = await fetch(`${baseUrl}/api/xianxia/guilds/${guildW.id}/applications/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenCand2}` },
    });
    assert.strictEqual(resCancelAlias.status, 200, 'Route alias /:id/applications/cancel phải hoạt động.');

    console.log('✅ [GUILD TEST 11] Kiểm thử Route Aliases (/me, /my, cancel) hoạt động hoàn hảo.');

    console.log('\n===============================================================');
    console.log('🏆 100% CÁC BÀI TEST TÔNG MÔN (M4.3.2 GUILD SYSTEM) ĐÃ HOÀN TẤT XUẤT SẮC!');
    console.log('===============================================================\n');
  } finally {
    // 1. Dọn dẹp DUY NHẤT các bản ghi do chính lần chạy test này tạo (Tracked ID Registry)
    const userIds = Array.from(trackedUserIds);
    const characterIds = Array.from(trackedCharacterIds);
    const guildIds = Array.from(trackedGuildIds);

    if (userIds.length > 0 || characterIds.length > 0 || guildIds.length > 0) {
      // Thứ tự phụ thuộc khóa ngoại (Foreign Key Dependency Order):
      // a. Tin nhắn chat
      await prisma.xianxiaChatMessage.deleteMany({
        where: {
          OR: [
            ...(userIds.length > 0 ? [{ sender_user_id: { in: userIds } }] : []),
            ...(characterIds.length > 0 ? [{ sender_character_id: { in: characterIds } }] : []),
            ...(guildIds.length > 0 ? [{ guild_id: { in: guildIds } }] : []),
          ],
        },
      }).catch(() => {});

      // b. Đơn bái kiến tông môn
      await prisma.xianxiaGuildApplication.deleteMany({
        where: {
          OR: [
            ...(guildIds.length > 0 ? [{ guild_id: { in: guildIds } }] : []),
            ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
          ],
        },
      }).catch(() => {});

      // c. Thành viên tông môn
      await prisma.xianxiaGuildMember.deleteMany({
        where: {
          OR: [
            ...(guildIds.length > 0 ? [{ guild_id: { in: guildIds } }] : []),
            ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
          ],
        },
      }).catch(() => {});

      // d. Tông môn
      if (guildIds.length > 0) {
        await prisma.xianxiaGuild.deleteMany({
          where: { id: { in: guildIds } },
        }).catch(() => {});
      }

      // e. Nhân vật tu tiên
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

      // f. Tài khoản người dùng
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        }).catch(() => {});
      }
    }

    // 2. Đóng test server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

// Cho phép chạy độc lập qua CLI
if (process.argv[1]?.endsWith('xianxiaM4Guild.test.ts') || process.argv[1]?.endsWith('xianxiaM4Guild.test.js')) {
  runXianxiaM4GuildTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ GUILD TEST FAILED:', err);
      process.exit(1);
    });
}
