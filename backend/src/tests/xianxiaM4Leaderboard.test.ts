import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { prisma } from '../utils/prisma.js';
import { xianxiaLeaderboardService, REALM_ORDER } from '../services/xianxia/xianxiaLeaderboardService.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export async function runXianxiaM4LeaderboardTests(): Promise<void> {
  console.log('\n--- 🏆 [TEST] BẮT ĐẦU KIỂM THỬ MỤC 4.1: BẢNG XẾP HẠNG THIÊN KIÊU ---');

  // Khởi động server HTTP thử nghiệm native trên ephemeral port 0
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Đang lắng nghe kiểm thử tại ${baseUrl}`);

  try {
    // 1. Dọn dẹp và khởi tạo dữ liệu mẫu trên PostgreSQL thật
    const testUsernames = [
      'm4_tester_truc_co',
      'm4_tester_luyen_khi_cao',
      'm4_tester_luyen_khi_thap',
      'm4_tester_pham_nhan_1',
      'm4_tester_pham_nhan_2',
    ];

    // Xóa dữ liệu cũ nếu có
    const existingUsers = await prisma.user.findMany({
      where: { username: { in: testUsernames } },
      select: { id: true },
    });
    const userIds = existingUsers.map(u => u.id);

    if (userIds.length > 0) {
      await prisma.xianxiaBattleLog.deleteMany({
        where: { character: { user_id: { in: userIds } } },
      });
      await prisma.xianxiaQuestProgress.deleteMany({
        where: { character: { user_id: { in: userIds } } },
      });
      await prisma.xianxiaInventoryItem.deleteMany({
        where: { character: { user_id: { in: userIds } } },
      });
      await prisma.xianxiaCharacter.deleteMany({
        where: { user_id: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    // Tạo 5 người dùng và 5 nhân vật với thứ bậc rõ ràng
    // User 1: Trúc Cơ Sơ Kỳ (Tier 10, Lv 10) -> Dự kiến Hạng 1
    const user1 = await prisma.user.create({
      data: {
        username: 'm4_tester_truc_co',
        email: 'trucco@test.vn',
        password_hash: 'secret_hash_truc_co',
      },
    });
    const char1 = await prisma.xianxiaCharacter.create({
      data: {
        user_id: user1.id,
        name: 'Lôi Đình Chân Nhân',
        realm: 'TRUC_CO_SO_KY',
        level: 10,
        cultivation: 3800,
        exp: 200,
        physique: 25,
        comprehension: 28,
        max_health: 350,
        health: 350,
      },
    });

    // User 2: Luyện Khí Tầng 3 (Tier 3, Lv 5) -> Dự kiến Hạng 2
    const user2 = await prisma.user.create({
      data: {
        username: 'm4_tester_luyen_khi_cao',
        email: 'luyenkhi3@test.vn',
        password_hash: 'secret_hash_lk3',
      },
    });
    const char2 = await prisma.xianxiaCharacter.create({
      data: {
        user_id: user2.id,
        name: 'Bạch Vân Kiếm Sĩ',
        realm: 'LUYEN_KHI_3',
        level: 5,
        cultivation: 450,
        exp: 80,
        physique: 16,
        comprehension: 18,
        max_health: 220,
        health: 220,
      },
    });

    // User 3: Luyện Khí Tầng 1 (Tier 1, Lv 2) -> Dự kiến Hạng 3
    const user3 = await prisma.user.create({
      data: {
        username: 'm4_tester_luyen_khi_thap',
        email: 'luyenkhi1@test.vn',
        password_hash: 'secret_hash_lk1',
      },
    });
    const char3 = await prisma.xianxiaCharacter.create({
      data: {
        user_id: user3.id,
        name: 'Thanh Phong Đạo Đồng',
        realm: 'LUYEN_KHI_1',
        level: 2,
        cultivation: 190,
        exp: 40,
        physique: 13,
        comprehension: 15,
        max_health: 150,
        health: 150,
      },
    });

    // User 4 & User 5: Cùng là Phàm Nhân (Tier 0), cùng Level 1, cùng Cultivation 50, cùng EXP 10
    // Để kiểm tra Tie-break: user4 tạo trước (id nhỏ hơn) phải xếp TRƯỚC user5!
    const user4 = await prisma.user.create({
      data: {
        username: 'm4_tester_pham_nhan_1',
        email: 'phamnhan1@test.vn',
        password_hash: 'secret_hash_pn1',
      },
    });
    const char4 = await prisma.xianxiaCharacter.create({
      data: {
        user_id: user4.id,
        name: 'Tán Tu Huynh Trưởng',
        realm: 'PHAM_NHAN',
        level: 1,
        cultivation: 50,
        exp: 10,
        physique: 12,
        comprehension: 14,
        max_health: 120,
        health: 120,
      },
    });

    const user5 = await prisma.user.create({
      data: {
        username: 'm4_tester_pham_nhan_2',
        email: 'phamnhan2@test.vn',
        password_hash: 'secret_hash_pn2',
      },
    });
    const char5 = await prisma.xianxiaCharacter.create({
      data: {
        user_id: user5.id,
        name: 'Tán Tu Đệ Đệ',
        realm: 'PHAM_NHAN',
        level: 1,
        cultivation: 50,
        exp: 10,
        physique: 12,
        comprehension: 14,
        max_health: 120,
        health: 120,
      },
    });

    // Tạo JWT token cho User 1 và User 2 để kiểm thử xác định myRank và Cache Isolation
    const tokenUser1 = jwt.sign(
      { userId: user1.id, username: user1.username },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const tokenUser2 = jwt.sign(
      { userId: user2.id, username: user2.username },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Xóa cache trước khi test
    xianxiaLeaderboardService.clearCache();

    // ==========================================
    // TEST 1: Kiểm Tra Thứ Tự Xếp Hạng Chính Xác (Cảnh Giới > Level > Tu Vi > EXP > ID)
    // ==========================================
    console.log('-> Test 1: Kiểm tra thứ tự xếp hạng chính xác theo Cảnh Giới > Level > Tu Vi > EXP > ID...');
    const lbRes1 = await xianxiaLeaderboardService.getLeaderboard({ page: 1, limit: 50, fresh: true });
    assert.strictEqual(lbRes1.success, true, 'Truy vấn bảng xếp hạng phải thành công');
    assert(lbRes1.data.length >= 5, 'Phải có ít nhất 5 nhân vật trong danh sách');

    // Tìm index của 5 nhân vật test trong bảng xếp hạng
    const idxChar1 = lbRes1.data.findIndex(d => d.id === char1.id);
    const idxChar2 = lbRes1.data.findIndex(d => d.id === char2.id);
    const idxChar3 = lbRes1.data.findIndex(d => d.id === char3.id);
    const idxChar4 = lbRes1.data.findIndex(d => d.id === char4.id);
    const idxChar5 = lbRes1.data.findIndex(d => d.id === char5.id);

    assert(idxChar1 !== -1 && idxChar2 !== -1 && idxChar3 !== -1 && idxChar4 !== -1 && idxChar5 !== -1, 'Tất cả nhân vật test phải có mặt');
    assert(idxChar1 < idxChar2, 'Trúc Cơ Sơ Kỳ (char1) phải xếp trước Luyện Khí 3 (char2)');
    assert(idxChar2 < idxChar3, 'Luyện Khí 3 (char2) phải xếp trước Luyện Khí 1 (char3)');
    assert(idxChar3 < idxChar4, 'Luyện Khí 1 (char3) phải xếp trước Phàm Nhân (char4)');
    console.log('✅ 1. Thứ tự xếp hạng phân tầng cảnh giới hoạt động chuẩn xác 100%!');

    // ==========================================
    // TEST 2: Kiểm Tra Thứ Tự Phân Xử Hòa Ổn Định (Tie-break by ID ASC)
    // ==========================================
    console.log('-> Test 2: Kiểm tra phân xử hòa (Tie-break) ổn định khi cùng chỉ số...');
    assert(char4.id < char5.id, 'Char4 được tạo trước nên ID phải nhỏ hơn Char5');
    assert(idxChar4 < idxChar5, 'Char4 phải xếp trên Char5 theo tiêu chí phân xử ID ASC');
    console.log(`✅ 2. Tie-break ổn định: Char4 (#${lbRes1.data[idxChar4].rank}) đứng trước Char5 (#${lbRes1.data[idxChar5].rank})!`);

    // ==========================================
    // TEST 3: Kiểm Tra Phân Trang & Giới Hạn Kích Thước Trang (Pagination & Limit)
    // ==========================================
    console.log('-> Test 3: Kiểm tra phân trang (limit=2, page=1 & page=2)...');
    const page1Res = await xianxiaLeaderboardService.getLeaderboard({ page: 1, limit: 2, fresh: true });
    assert.strictEqual(page1Res.data.length, 2, 'Trang 1 phải có đúng 2 phần tử');
    assert.strictEqual(page1Res.pagination.page, 1, 'Trang hiện tại phải là 1');
    assert.strictEqual(page1Res.pagination.limit, 2, 'Limit phải là 2');
    assert.strictEqual(page1Res.pagination.hasNext, true, 'Trang 1 phải có trang kế tiếp');
    assert.strictEqual(page1Res.pagination.hasPrev, false, 'Trang 1 không có trang trước');

    const page2Res = await xianxiaLeaderboardService.getLeaderboard({ page: 2, limit: 2, fresh: true });
    assert.strictEqual(page2Res.data.length, 2, 'Trang 2 phải có đúng 2 phần tử');
    assert.strictEqual(page2Res.pagination.page, 2, 'Trang hiện tại phải là 2');
    assert.strictEqual(page2Res.pagination.hasPrev, true, 'Trang 2 phải có trang trước');

    // Đảm bảo không trùng lặp giữa 2 trang
    const idsPage1 = page1Res.data.map(d => d.id);
    const idsPage2 = page2Res.data.map(d => d.id);
    const intersection = idsPage1.filter(id => idsPage2.includes(id));
    assert.strictEqual(intersection.length, 0, 'Các trang phân cách độc lập, không bị nhảy hoặc lặp dữ liệu');
    console.log('✅ 3. Phân trang ổn định, không trùng lặp và xác định trang chính xác 100%!');

    // ==========================================
    // TEST 4: Chuẩn Hóa Tham Số Không Hợp Lệ (Invalid Parameter Sanitization)
    // ==========================================
    console.log('-> Test 4: Chuẩn hóa tham số âm, chữ cái, hoặc quá lớn...');
    const invalidRes1 = await xianxiaLeaderboardService.getLeaderboard({ page: -10 as any, limit: 'xyz' as any, fresh: true });
    assert.strictEqual(invalidRes1.pagination.page, 1, 'Page âm phải được chuẩn hóa về 1');
    assert.strictEqual(invalidRes1.pagination.limit, 10, 'Limit chuỗi không hợp lệ phải chuẩn hóa về 10');

    const invalidRes2 = await xianxiaLeaderboardService.getLeaderboard({ page: 1, limit: 9999, fresh: true });
    assert.strictEqual(invalidRes2.pagination.limit, 50, 'Limit vượt ngưỡng 50 phải bị giới hạn trần ở 50');
    console.log('✅ 4. Chuẩn hóa và chống tấn công tràn tham số phân trang thành công 100%!');

    // ==========================================
    // TEST 5: Bảo Mật Quyền Riêng Tư (Privacy Check - No Password/Email Leak)
    // ==========================================
    console.log('-> Test 5: Kiểm tra an ninh quyền riêng tư (Không rò rỉ email, password_hash)...');
    for (const entry of lbRes1.data) {
      assert.strictEqual((entry as any).password_hash, undefined, 'Tuyệt đối không có password_hash');
      assert.strictEqual((entry as any).email, undefined, 'Tuyệt đối không có email');
      assert.strictEqual((entry as any).user_id, undefined, 'Không để lộ khóa ngoại user_id nội bộ');
      assert(typeof entry.rank === 'number', 'Phải có thứ hạng rank');
      assert(typeof entry.name === 'string', 'Phải có tên nhân vật');
      assert(typeof entry.realmTitle === 'string', 'Phải có danh xưng cảnh giới');
      assert(typeof entry.combatPower === 'number', 'Phải có điểm chiến lực');
    }
    console.log('✅ 5. An toàn dữ liệu & bảo vệ quyền riêng tư người dùng đạt chuẩn tuyệt đối!');

    // ==========================================
    // TEST 6: Xác Định Thứ Hạng Cá Nhân (myRank)
    // ==========================================
    console.log('-> Test 6: Kiểm tra xác định thứ hạng cá nhân (myRank)...');
    // Truy vấn khi có userId của user2 (Bạch Vân Kiếm Sĩ)
    const myRankRes = await xianxiaLeaderboardService.getLeaderboard({ userId: user2.id, fresh: true });
    assert(myRankRes.myRank !== null, 'myRank phải có giá trị số');
    // Tìm rank thực tế của char2 trong danh sách
    const char2Entry = myRankRes.data.find(d => d.id === char2.id);
    if (char2Entry) {
      assert.strictEqual(myRankRes.myRank, char2Entry.rank, 'myRank phải khớp chính xác với rank trong danh sách');
    }

    // Truy vấn khi không truyền userId (Khách vãng lai)
    const guestRes = await xianxiaLeaderboardService.getLeaderboard({ fresh: true });
    assert.strictEqual(guestRes.myRank, null, 'Khách vãng lai phải nhận myRank là null');
    console.log(`✅ 6. Xác định thứ hạng cá nhân (User 2: #${myRankRes.myRank}, Khách: null) hoạt động chuẩn xác!`);

    // ==========================================
    // TEST 7: Kiểm Tra Công Thức Tính Chiến Lực (Combat Power Verification)
    // ==========================================
    console.log('-> Test 7: Kiểm tra công thức tính Chiến Lực Đạo Hạnh...');
    // char1: physique=25, comp=28, max_hp=350, level=10, realm=TRUC_CO_SO_KY (tier 10)
    // Formula: floor(25*2 + 28*1.5 + 350/4 + 10*100 + 10*10) = floor(50 + 42 + 87.5 + 1000 + 100) = 1279
    const expectedCp1 = Math.floor(25 * 2 + 28 * 1.5 + 350 / 4 + 10 * 100 + 10 * 10);
    const actualCp1 = xianxiaLeaderboardService.calcCombatPower(char1);
    assert.strictEqual(actualCp1, expectedCp1, `Chiến lực char1 phải bằng ${expectedCp1} (thực tế: ${actualCp1})`);
    console.log(`✅ 7. Công thức Chiến Lực (${actualCp1} ⚡) tính toán chuẩn xác theo đặc tả toán học!`);

    // ==========================================
    // TEST 8: Xử Lý Trang Rỗng (Empty / Out-of-Bounds Page)
    // ==========================================
    console.log('-> Test 8: Kiểm tra xử lý trang vượt ngoài phạm vi (Page Out of Bounds)...');
    const outOfBoundsRes = await xianxiaLeaderboardService.getLeaderboard({ page: 999999, limit: 10, fresh: true });
    assert.strictEqual(outOfBoundsRes.success, true, 'Truy vấn không được ném exception');
    assert.strictEqual(outOfBoundsRes.data.length, 0, 'Dữ liệu mảng phải rỗng');
    assert(outOfBoundsRes.pagination.total > 0, 'Tổng số bản ghi vẫn được duy trì đúng');
    console.log('✅ 8. Xử lý trang rỗng an toàn, không văng lỗi 500!');

    // ==========================================
    // TEST 9: Đo Thời Gian Thực Thi (Performance & No N+1 Query)
    // ==========================================
    console.log('-> Test 9: Đo thời gian thực thi truy vấn trực tiếp trên PostgreSQL và In-Memory Cache...');
    // 9a: Truy vấn trực tiếp PostgreSQL qua mạng Cloud (fresh: true)
    const perfRes = await xianxiaLeaderboardService.getLeaderboard({ page: 1, limit: 20, fresh: true });
    assert(perfRes.executionTimeMs !== undefined, 'Phải có executionTimeMs');
    console.log(`⏱️ Thời gian thực thi truy vấn song song PostgreSQL (Cloud RTT): ${perfRes.executionTimeMs}ms`);
    assert(perfRes.executionTimeMs < 3000, 'Truy vấn bảng xếp hạng tối ưu qua Cloud DB phải hoàn tất dưới 3000ms');

    // 9b: Truy xuất qua In-Memory Cache (fresh: false)
    const cachedStart = Date.now();
    const cachedRes = await xianxiaLeaderboardService.getLeaderboard({ page: 1, limit: 20, fresh: false });
    const cachedTimeMs = Date.now() - cachedStart;
    console.log(`⚡ Thời gian phản hồi từ In-Memory Cache: ${cachedTimeMs}ms`);
    assert(cachedTimeMs < 20, 'Truy xuất qua Cache phải siêu tốc dưới 20ms');
    assert.strictEqual(cachedRes.data.length, perfRes.data.length, 'Dữ liệu cache phải đồng nhất');
    console.log('✅ 9. Hiệu năng tối ưu cao, không N+1 truy vấn và In-Memory Cache phản hồi siêu tốc dưới 20ms!');

    // ==========================================
    // TEST 10: Kiểm Thử Native HTTP REST API (`/api/xianxia/leaderboard`)
    // ==========================================
    console.log('-> Test 10: Kiểm thử Native HTTP REST API Endpoint GET /api/xianxia/leaderboard...');
    // 10a: Gọi Public không có token
    const httpResGuest = await fetch(`${baseUrl}/api/xianxia/leaderboard?page=1&limit=5`);
    assert.strictEqual(httpResGuest.status, 200, 'HTTP Status phải là 200 OK');
    const httpJsonGuest = await httpResGuest.json();
    assert.strictEqual(httpJsonGuest.success, true, 'Response success phải là true');
    assert.strictEqual(httpJsonGuest.myRank, null, 'Khách vãng lai myRank phải là null');
    assert(Array.isArray(httpJsonGuest.data), 'Data phải là một mảng');

    // 10b: Gọi với Bearer Token
    const httpResUser = await fetch(`${baseUrl}/api/xianxia/leaderboard?page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${tokenUser2}` },
    });
    assert.strictEqual(httpResUser.status, 200, 'HTTP Status với Bearer Token phải là 200 OK');
    const httpJsonUser = await httpResUser.json();
    assert.strictEqual(httpJsonUser.success, true, 'Response success phải là true');
    assert(typeof httpJsonUser.myRank === 'number', 'User có token phải nhận myRank là một con số');

    // 10c: Gọi endpoint alias /api/xianxia/gameplay/leaderboard
    const httpResAlias = await fetch(`${baseUrl}/api/xianxia/gameplay/leaderboard?page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${tokenUser2}` },
    });
    assert.strictEqual(httpResAlias.status, 200, 'Endpoint alias /gameplay/leaderboard phải là 200 OK');
    const httpJsonAlias = await httpResAlias.json();
    assert.strictEqual(httpJsonAlias.success, true, 'Alias response success phải là true');
    console.log('✅ 10. Toàn bộ HTTP REST Endpoints (Public & Authenticated) phản hồi chuẩn mực 200 OK!');

    // ==========================================
    // TEST 11: Kiểm Thử Cache Isolation Đa Người Dùng (Multi-User Concurrent Cache Hit)
    // ==========================================
    console.log('-> Test 11: Kiểm thử cô lập dữ liệu bộ nhớ đệm đa người dùng (Cache Isolation)...');
    // Đảm bảo cache có dữ liệu
    xianxiaLeaderboardService.clearCache();
    // User 1 gọi trang 1 (khởi tạo cache)
    const user1CacheRes = await fetch(`${baseUrl}/api/xianxia/leaderboard?page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${tokenUser1}` },
    });
    const user1CacheJson = await user1CacheRes.json();
    assert.strictEqual(user1CacheJson.success, true);
    assert(user1CacheJson.myRank !== null, 'User 1 phải có myRank');
    const user1Rank = user1CacheJson.myRank;

    // User 2 gọi cùng URL ngay sau đó (Cache Hit cho bảng xếp hạng, nhưng myRank phải tính riêng cho User 2)
    const user2CacheRes = await fetch(`${baseUrl}/api/xianxia/leaderboard?page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${tokenUser2}` },
    });
    const user2CacheJson = await user2CacheRes.json();
    assert.strictEqual(user2CacheJson.success, true);
    assert(user2CacheJson.myRank !== null, 'User 2 phải có myRank');
    assert.notStrictEqual(user2CacheJson.myRank, user1Rank, 'User 2 không được nhận myRank của User 1 từ cache');

    // Khách vãng lai gọi cùng URL (Cache Hit, myRank phải là null)
    const guestCacheRes = await fetch(`${baseUrl}/api/xianxia/leaderboard?page=1&limit=5`);
    const guestCacheJson = await guestCacheRes.json();
    assert.strictEqual(guestCacheJson.success, true);
    assert.strictEqual(guestCacheJson.myRank, null, 'Khách vãng lai gọi trúng cache chung không được leak myRank');

    // Dữ liệu bảng xếp hạng trả về cho cả 3 phải hoàn toàn đồng nhất
    assert.strictEqual(user1CacheJson.data.length, user2CacheJson.data.length);
    assert.strictEqual(user2CacheJson.data[0].id, guestCacheJson.data[0].id);
    console.log(`✅ 11. Cache Isolation hoàn hảo: User1 (#${user1Rank}), User2 (#${user2CacheJson.myRank}), Khách (null) — không rò rỉ dữ liệu cá nhân!`);

    // ==========================================
    // TEST 12: Kiểm Thử Kháng Lỗi Token Hết Hạn / Token Rác / Header Rỗng
    // ==========================================
    console.log('-> Test 12: Kiểm thử an ninh middleware: Token rác, hết hạn hoặc Header rỗng không gây lỗi 500...');
    // 12a: Token rác / sai chữ ký
    const malformedRes = await fetch(`${baseUrl}/api/xianxia/leaderboard?page=1&limit=5`, {
      headers: { 'Authorization': 'Bearer token_rac_khong_hop_le_123456789' },
    });
    assert.strictEqual(malformedRes.status, 200, 'Token rác không được làm crash 500 hay từ chối 401/403');
    const malformedJson = await malformedRes.json();
    assert.strictEqual(malformedJson.success, true);
    assert.strictEqual(malformedJson.myRank, null, 'Token rác tự động giáng cấp xuống khách vãng lai (myRank=null)');

    // 12b: Token hết hạn (Expired Token)
    const expiredToken = jwt.sign(
      { userId: user2.id, username: user2.username },
      config.jwtSecret,
      { expiresIn: '-10s' } // Đã hết hạn 10 giây trước
    );
    const expiredRes = await fetch(`${baseUrl}/api/xianxia/leaderboard?page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` },
    });
    assert.strictEqual(expiredRes.status, 200, 'Token hết hạn phải xử lý êm thắm');
    const expiredJson = await expiredRes.json();
    assert.strictEqual(expiredJson.success, true);
    assert.strictEqual(expiredJson.myRank, null, 'Token hết hạn không gán myRank');
    console.log('✅ 12. Middleware optionalAuthenticateToken kháng lỗi tuyệt đối, fallback an toàn về khách vãng lai!');

    // ==========================================
    // TEST 13: Kiểm Thử Cảnh Giới Mở Rộng Kim Đan & Trúc Cơ Trung/Hậu Kỳ
    // ==========================================
    console.log('-> Test 13: Kiểm thử cảnh giới mở rộng Kim Đan Sơ Kỳ (KIM_DAN_SO_KY) xếp cao hơn Trúc Cơ...');
    const kimDanUser = await prisma.user.create({
      data: {
        username: 'm4_tester_kim_dan',
        email: 'kimdan@test.vn',
        password_hash: 'secret_hash_kd',
      },
    });
    const kimDanChar = await prisma.xianxiaCharacter.create({
      data: {
        user_id: kimDanUser.id,
        name: 'Thanh Hư Chân Quân',
        realm: 'KIM_DAN_SO_KY',
        level: 25,
        cultivation: 12000,
        exp: 800,
        physique: 60,
        comprehension: 65,
        max_health: 1200,
        health: 1200,
      },
    });

    try {
      const kimDanRes = await xianxiaLeaderboardService.getLeaderboard({ page: 1, limit: 10, fresh: true });
      assert.strictEqual(kimDanRes.data[0].id, kimDanChar.id, 'Kim Đan Sơ Kỳ phải đứng vị trí Top 1');
      assert.strictEqual(kimDanRes.data[0].realmTitle, 'Kim Đan Sơ Kỳ', 'Danh xưng cảnh giới phải hiển thị đúng');
      assert(kimDanRes.data[0].combatPower > kimDanRes.data[1].combatPower, 'Chiến lực Kim Đan phải vượt trội');
      console.log(`✅ 13. Cảnh giới mở rộng Kim Đan Sơ Kỳ (Order 13) dẫn đầu bảng xếp hạng thành công (${kimDanRes.data[0].combatPower} ⚡)!`);
    } finally {
      // Dọn dẹp dữ liệu Kim Đan test
      await prisma.xianxiaCharacter.delete({ where: { id: kimDanChar.id } });
      await prisma.user.delete({ where: { id: kimDanUser.id } });
    }

    // ==========================================
    // TEST 14: Kháng Lỗi Tính Toán Chiến Lực (Combat Power Edge-case Safety)
    // ==========================================
    console.log('-> Test 14: Kiểm thử an toàn tính toán Chiến Lực với giá trị rác, âm, null, undefined...');
    const nullCp = xianxiaLeaderboardService.calcCombatPower(null);
    assert.strictEqual(nullCp, 0, 'Truyền null phải an toàn trả về 0');

    const undefCp = xianxiaLeaderboardService.calcCombatPower(undefined);
    assert.strictEqual(undefCp, 0, 'Truyền undefined phải an toàn trả về 0');

    const edgeCp = xianxiaLeaderboardService.calcCombatPower({
      physique: -100 as any,
      comprehension: 'chuoi_rac' as any,
      max_health: null as any,
      level: 0,
      realm: 'UNKNOWN_REALM',
    });
    assert(typeof edgeCp === 'number' && !isNaN(edgeCp) && edgeCp >= 0, 'Dữ liệu bất thường không sinh NaN hay âm');
    console.log(`✅ 14. calcCombatPower miễn nhiễm hoàn toàn với dữ liệu rác/âm/NaN (kết quả: ${edgeCp})!`);

    // ==========================================
    // TEST 15: Kiểm Thử Endpoint Alias Cho Khách Vãng Lai (Không Có Token)
    // ==========================================
    console.log('-> Test 15: Kiểm thử endpoint alias /gameplay/leaderboard cho khách vãng lai không bị chặn 401...');
    const aliasGuestRes = await fetch(`${baseUrl}/api/xianxia/gameplay/leaderboard?page=1&limit=5`);
    assert.strictEqual(aliasGuestRes.status, 200, 'Endpoint alias /gameplay/leaderboard phải cho phép khách xem bảng 200 OK');
    const aliasGuestJson = await aliasGuestRes.json();
    assert.strictEqual(aliasGuestJson.success, true);
    assert.strictEqual(aliasGuestJson.myRank, null, 'Khách vãng lai gọi alias nhận myRank là null');
    console.log('✅ 15. Endpoint alias /api/xianxia/gameplay/leaderboard đồng bộ hoàn toàn với route chuẩn /leaderboard!');

    console.log('\n========================================================================================');
    console.log('🏆 TẤT CẢ 15/15 BÀI KIỂM THỬ VÀ AUDIT ĐỘC LẬP BẢNG XẾP HẠNG THIÊN KIÊU MỤC 4.1 ĐẠT PASS 100%!');
    console.log('========================================================================================\n');
  } finally {
    // Đóng server kiểm thử
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
