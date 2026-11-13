import assert from 'assert';
import { prisma } from '../utils/prisma.js';
import { runXianxiaM4GuildTests } from './xianxiaM4Guild.test.js';
import { runXianxiaM4ChatTests } from './xianxiaM4Chat.test.js';
import {
  verifyUsersProvenance,
  assertSafeEnvironment,
  isVerifiedTestEmail,
} from '../scripts/cleanupStaleTestData.js';

export async function runTestDataSafetyVerification(): Promise<void> {
  console.log('\n--- 🛡️ BẮT ĐẦU KIỂM THỬ TÍNH AN TOÀN DỮ LIỆU (SENTINEL & TRACKED ID ISOLATION) ---');

  // 1. Ghi nhận Baseline Database trước khi test
  const baselineUsers = await prisma.user.findMany({ select: { id: true, username: true } });
  const baselineUserIds = new Set(baselineUsers.map((u) => u.id));
  const baselineChars = await prisma.xianxiaCharacter.count();
  const baselineGuilds = await prisma.xianxiaGuild.count();

  console.log(`[Baseline] Users: ${baselineUsers.length}, Characters: ${baselineChars}, Guilds: ${baselineGuilds}`);

  const trackedCleanupUserIds = new Set<number>();
  const trackedCleanupCharIds = new Set<number>();

  try {
    // =========================================================================
    // 2. TẠO TÀI KHOẢN SENTINEL MANG TIỀN TỐ NHẠY CẢM (guild_*, chattest_*)
    // =========================================================================
    const sentinelSuffix = Math.floor(Math.random() * 900000 + 100000);
    const sentinelGuildUsername = `guild_sentinel_${sentinelSuffix}`;
    const sentinelChatUsername = `chattest_sentinel_${sentinelSuffix}`;

    const sentinelUser1 = await prisma.user.create({
      data: {
        username: sentinelGuildUsername,
        email: `${sentinelGuildUsername}@kybien.test`,
        password_hash: 'sentinel_secret_hash',
      },
    });
    trackedCleanupUserIds.add(sentinelUser1.id);

    const sentinelChar1 = await prisma.xianxiaCharacter.create({
      data: {
        user_id: sentinelUser1.id,
        name: `Hộ Pháp Tông Môn ${sentinelSuffix}`,
        realm: 'TRUC_CO_TRUNG_KY',
        level: 15,
        silver: 99999,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCleanupCharIds.add(sentinelChar1.id);

    const sentinelUser2 = await prisma.user.create({
      data: {
        username: sentinelChatUsername,
        email: `${sentinelChatUsername}@kybien.test`,
        password_hash: 'sentinel_secret_hash',
      },
    });
    trackedCleanupUserIds.add(sentinelUser2.id);

    const sentinelChar2 = await prisma.xianxiaCharacter.create({
      data: {
        user_id: sentinelUser2.id,
        name: `Sứ Giả Truyền Tin ${sentinelSuffix}`,
        realm: 'LUYEN_KHI_8',
        level: 8,
        silver: 8888,
        current_zone: 'zone_thanh_ha_thon',
      },
    });
    trackedCleanupCharIds.add(sentinelChar2.id);

    console.log(`✅ [Sentinel Setup] Đã tạo 2 tài khoản Sentinel:`);
    console.log(`   - User ID ${sentinelUser1.id}: "${sentinelGuildUsername}" (Char ID: ${sentinelChar1.id})`);
    console.log(`   - User ID ${sentinelUser2.id}: "${sentinelChatUsername}" (Char ID: ${sentinelChar2.id})`);

    // =========================================================================
    // 3. TẠO TÀI KHOẢN NGƯỜI CHƠI THẬT MỚI ĐĂNG KÝ (REAL NEWBIE: ELO 1200, 0 TRẬN)
    // =========================================================================
    const realNewbieUsername = `real_cothu_${sentinelSuffix}`;
    const realNewbieEmail = `${realNewbieUsername}@gmail.com`; // Email thật (không thuộc domain test)
    const realNewbieUser = await prisma.user.create({
      data: {
        username: realNewbieUsername,
        email: realNewbieEmail,
        password_hash: 'real_user_password_hash_xyz',
        elo: 1200,          // ELO mặc định ban đầu
        matches_played: 0,   // Chưa từng chơi trận nào
        matches_won: 0,      // Chưa có trận thắng nào
        level: 1,
      },
    });
    trackedCleanupUserIds.add(realNewbieUser.id);
    console.log(`✅ [Real Newbie Setup] Đã tạo tài khoản người dùng thật mới đăng ký: ID ${realNewbieUser.id} ("${realNewbieUsername}", ${realNewbieEmail}, Elo: 1200, Trận: 0)`);

    // =========================================================================
    // 4. KIỂM THỬ XÁC MINH TEST PROVENANCE & CHỐT CHẶN BẢO VỆ NGƯỜI CHƠI THẬT
    // =========================================================================
    console.log('\n--- Kiểm thử cơ chế xác minh nguồn gốc test (Test Provenance Check) ---');

    // 4.1 Tài khoản Sentinel có email @kybien.test -> Phải được xác minh là test data
    assert.strictEqual(isVerifiedTestEmail(sentinelUser1.email), true);
    const sentinelCheck = await verifyUsersProvenance(prisma, [sentinelUser1.id, sentinelUser2.id]);
    assert.strictEqual(sentinelCheck.verified, true, 'Tài khoản mang domain test phải được xác minh.');
    assert.strictEqual(sentinelCheck.unverifiedUsers.length, 0);

    // 4.2 Tài khoản người dùng thật mới đăng ký -> Tuyệt đối KHÔNG được coi là dữ liệu test!
    assert.strictEqual(isVerifiedTestEmail(realNewbieEmail), false, 'Email @gmail.com không được coi là test domain.');
    const realUserCheck = await verifyUsersProvenance(prisma, [realNewbieUser.id]);
    assert.strictEqual(realUserCheck.verified, false, 'Tài khoản người dùng thật mới tạo không được phép coi là dữ liệu test.');
    assert.strictEqual(realUserCheck.unverifiedUsers.length, 1);
    assert.ok(
      realUserCheck.unverifiedUsers[0].reason.includes('Email không thuộc domain test'),
      'Phải từ chối vì email không thuộc domain test'
    );
    console.log('✅ [REAL USER PROTECTION 1] Tài khoản thật mới tạo (ELO 1200, 0 trận, @gmail.com) được bảo vệ tuyệt đối, từ chối coi là dữ liệu test rác!');

    // =========================================================================
    // 5. KIỂM THỬ TỪ CHỐI THỰC THI TRÊN MÔI TRƯỜNG PRODUCTION
    // =========================================================================
    console.log('\n--- Kiểm thử chốt chặn môi trường (Environment Guard) ---');
    // Chạy trong môi trường dev/test -> An toàn
    assertSafeEnvironment();

    // Giả lập môi trường production -> Bắt buộc ném ngoại lệ
    const originalNodeEnv = process.env.NODE_ENV;
    let prodBlocked = false;
    try {
      process.env.NODE_ENV = 'production';
      assertSafeEnvironment();
    } catch (err: any) {
      prodBlocked = err.message.includes('PRODUCTION');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
    assert.strictEqual(prodBlocked, true, 'assertSafeEnvironment() bắt buộc phải chặn khi NODE_ENV="production".');
    console.log('✅ [ENVIRONMENT GUARD 2] Chốt chặn từ chối thực thi trên môi trường PRODUCTION hoạt động hoàn hảo 100%!');

    // =========================================================================
    // 6. CHẠY TEST SUITES TÔNG MÔN VÀ CHAT
    // =========================================================================
    console.log('\n--- Đang chạy test suite M4.3.2 Guild ---');
    await runXianxiaM4GuildTests();

    console.log('\n--- Đang chạy test suite M4.3.1 Chat ---');
    await runXianxiaM4ChatTests();

    // =========================================================================
    // 7. KIỂM TRA BẢO TOÀN CỦA SENTINEL VÀ REAL NEWBIE USER
    // =========================================================================
    const checkSentinelUser1 = await prisma.user.findUnique({ where: { id: sentinelUser1.id } });
    const checkSentinelChar1 = await prisma.xianxiaCharacter.findUnique({ where: { id: sentinelChar1.id } });
    const checkSentinelUser2 = await prisma.user.findUnique({ where: { id: sentinelUser2.id } });
    const checkSentinelChar2 = await prisma.xianxiaCharacter.findUnique({ where: { id: sentinelChar2.id } });
    const checkRealNewbie = await prisma.user.findUnique({ where: { id: realNewbieUser.id } });

    assert.ok(checkSentinelUser1, `Tài khoản sentinel "${sentinelGuildUsername}" không được bị xóa!`);
    assert.ok(checkSentinelChar1, `Nhân vật sentinel của "${sentinelGuildUsername}" không được bị xóa!`);
    assert.ok(checkSentinelUser2, `Tài khoản sentinel "${sentinelChatUsername}" không được bị xóa!`);
    assert.ok(checkSentinelChar2, `Nhân vật sentinel của "${sentinelChatUsername}" không được bị xóa!`);
    assert.ok(checkRealNewbie, `Tài khoản người dùng thật mới đăng ký "${realNewbieUsername}" không được bị xóa!`);

    console.log('\n✅ [SENTINEL VERIFICATION 3] Cả 2 tài khoản Sentinel và tài khoản người dùng thật mới tạo đều tồn tại nguyên vẹn!');

    // =========================================================================
    // 8. KIỂM TRA CÔ LẬP KHÔNG RÒ RỈ DỮ LIỆU TEST
    // =========================================================================
    const currentUsers = await prisma.user.findMany({ select: { id: true, username: true } });
    const currentChars = await prisma.xianxiaCharacter.count();
    const currentGuilds = await prisma.xianxiaGuild.count();

    const nonBaselineNonTrackedUsers = currentUsers.filter(
      (u) => !baselineUserIds.has(u.id) && !trackedCleanupUserIds.has(u.id)
    );

    assert.strictEqual(
      nonBaselineNonTrackedUsers.length,
      0,
      `Không được để rò rỉ bất kỳ user test nào sau khi test kết thúc: ${JSON.stringify(nonBaselineNonTrackedUsers)}`
    );
    assert.strictEqual(currentGuilds, baselineGuilds, 'Tất cả Tông Môn do test tạo phải được dọn sạch hoàn toàn!');

    console.log('✅ [ISOLATION VERIFICATION 4] 100% tài khoản test tạm thời đã được dọn sạch, không rò rỉ!');

    // =========================================================================
    // 9. KIỂM THỬ KHẢ NĂNG DỌN DẸP KHI GẶP LỖI (MIDWAY FAILURE SIMULATION)
    // =========================================================================
    console.log('\n--- Kiểm thử khả năng dọn dẹp tự động khi có lỗi xảy ra (Midway Failure Simulation) ---');
    const trackedFailureUserIds = new Set<number>();
    const trackedFailureCharIds = new Set<number>();

    try {
      const failUser = await prisma.user.create({
        data: {
          username: `fail_simulation_${sentinelSuffix}`,
          email: `failsim_${sentinelSuffix}@test.com`,
          password_hash: 'hash',
        },
      });
      trackedFailureUserIds.add(failUser.id);

      const failChar = await prisma.xianxiaCharacter.create({
        data: {
          user_id: failUser.id,
          name: `Fail Tu Sĩ ${sentinelSuffix}`,
          realm: 'PHAM_NHAN',
        },
      });
      trackedFailureCharIds.add(failChar.id);

      // Cố tình ném lỗi assertion để giả lập test thất bại giữa chừng
      assert.strictEqual(1, 2, 'Cố tình quăng ngoại lệ giả lập test fail');
    } catch (e: any) {
      assert.strictEqual(e.message, 'Cố tình quăng ngoại lệ giả lập test fail');
    } finally {
      const userIds = Array.from(trackedFailureUserIds);
      const characterIds = Array.from(trackedFailureCharIds);
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
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
      }
    }

    const checkFailUser = await prisma.user.findFirst({
      where: { username: `fail_simulation_${sentinelSuffix}` },
    });
    assert.strictEqual(checkFailUser, null, 'User được tạo trước khi test fail phải được dọn dẹp sạch sẽ trong finally!');
    console.log('✅ [FAILURE RESILIENCE 5] Dọn dẹp trong finally hoạt động hoàn hảo ngay cả khi test thất bại!');

  } finally {
    // 10. Dọn dẹp chính xác tài khoản Sentinel và tài khoản người dùng thật mô phỏng theo đúng ID
    const charIds = Array.from(trackedCleanupCharIds);
    const userIds = Array.from(trackedCleanupUserIds);
    if (charIds.length > 0) {
      await prisma.xianxiaCharacter.deleteMany({
        where: { id: { in: charIds } },
      }).catch(() => {});
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      }).catch(() => {});
    }
    console.log('✅ [Sentinel & Newbie Teardown] Đã dọn dẹp an toàn các tài khoản kiểm thử theo đúng ID tường minh.');

    // 11. Xác minh Database trở lại chính xác Baseline ban đầu
    const finalUsers = await prisma.user.findMany({ select: { id: true, username: true } });
    const finalChars = await prisma.xianxiaCharacter.count();
    const finalGuilds = await prisma.xianxiaGuild.count();

    assert.strictEqual(finalUsers.length, baselineUsers.length, 'Số lượng user sau test phải bằng chính xác ban đầu.');
    assert.strictEqual(finalChars, baselineChars, 'Số lượng character sau test phải bằng chính xác ban đầu.');
    assert.strictEqual(finalGuilds, baselineGuilds, 'Số lượng guild sau test phải bằng chính xác ban đầu.');
  }

  console.log('\n========================================================================================');
  console.log('🏆 TẤT CẢ CÁC BÀI KIỂM THỬ AN TOÀN DỮ LIỆU, SENTINEL & REAL USER TEST ĐẠT PASS 100%!');
  console.log('========================================================================================\n');
}

// Cho phép chạy độc lập qua CLI
if (process.argv[1]?.includes('testDataSafetyVerification')) {
  runTestDataSafetyVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ TEST DATA SAFETY VERIFICATION FAILED:', err);
      process.exit(1);
    });
}
