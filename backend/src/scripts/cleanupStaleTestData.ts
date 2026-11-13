import { prisma } from '../utils/prisma.js';
import type { PrismaClient } from '@prisma/client';

/**
 * Script an toàn dọn dẹp dữ liệu test cũ theo ID tường minh.
 * Yêu cầu người quản trị truyền tham số ID cụ thể và cờ xác nhận --confirm.
 * Tuyệt đối không xóa theo tiền tố username hay wildcard.
 * Không được chạy tự động trong test suite hay npm test.
 *
 * Cách dùng:
 *   npx ts-node src/scripts/cleanupStaleTestData.ts --user-ids=101,102,103 --confirm
 *   npx ts-node src/scripts/cleanupStaleTestData.ts --guild-ids=1,2,3 --confirm
 */

// Danh sách pattern email được chứng nhận là tài khoản test
export const ALLOWED_TEST_EMAIL_PATTERNS = [
  /@kybien\.test$/i,
  /@example\.com$/i,
  /@test\.com$/i,
  /\.test$/i,
];

/**
 * Kiểm tra môi trường thực thi: Cấm tuyệt đối chạy trên production hoặc môi trường chưa xác định.
 */
export function assertSafeEnvironment(): void {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const appEnv = (process.env.APP_ENV || '').toLowerCase().trim();
  const dbUrl = (process.env.DATABASE_URL || '').toLowerCase();

  if (nodeEnv === 'production' || appEnv === 'production' || dbUrl.includes('prod')) {
    throw new Error(
      '🚨 TỪ CHỐI THỰC THI: Phát hiện môi trường PRODUCTION! Script cleanupStaleTestData tuyệt đối không được phép chạy trên dữ liệu production.'
    );
  }

  const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test' || nodeEnv === '';
  if (!isDevOrTest) {
    throw new Error(
      `🚨 TỪ CHỐI THỰC THI: Môi trường chưa xác định (NODE_ENV="${nodeEnv}"). Chỉ cho phép chạy trên môi trường development hoặc test.`
    );
  }
}

/**
 * Xác minh địa chỉ email có nguồn gốc từ hệ thống test quy chuẩn hay không.
 */
export function isVerifiedTestEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return ALLOWED_TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(email.trim()));
}

/**
 * Phân tích và lọc danh sách ID: loại bỏ token rác, lấy số nguyên > 0 và deduplicate.
 */
export function parseIds(arg: string | undefined, prefix: string): number[] {
  if (!arg) return [];
  const rawTokens = arg.replace(prefix, '').split(',');
  const validIds: number[] = [];
  const invalidTokens: string[] = [];

  for (const token of rawTokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const num = Number(trimmed);
    if (Number.isInteger(num) && num > 0) {
      validIds.push(num);
    } else {
      invalidTokens.push(trimmed);
    }
  }

  if (invalidTokens.length > 0) {
    console.warn(`⚠️ CẢNH BÁO: Đã bỏ qua ${invalidTokens.length} token ID không hợp lệ:`, invalidTokens);
  }

  // Deduplicate ID
  return Array.from(new Set(validIds));
}

/**
 * Hàm xác minh danh sách User có thực sự là dữ liệu test đáng tin cậy hay không.
 * Tuyệt đối không dùng matches_played hay ELO làm bằng chứng duy nhất.
 */
export async function verifyUsersProvenance(
  client: PrismaClient,
  userIds: number[]
): Promise<{
  verified: boolean;
  existingUsers: Array<{ id: number; username: string; email: string; elo: number; matches_played: number }>;
  unverifiedUsers: Array<{ id: number; username: string; email: string; reason: string }>;
}> {
  if (userIds.length === 0) {
    return { verified: true, existingUsers: [], unverifiedUsers: [] };
  }

  const existingUsers = await client.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, email: true, elo: true, matches_played: true },
  });

  const realMatches = await client.match.findMany({
    where: {
      OR: [
        { player_white_id: { in: userIds } },
        { player_black_id: { in: userIds } },
      ],
    },
    select: { player_white_id: true, player_black_id: true },
  });

  const realMatchPlayerIds = new Set<number>();
  for (const m of realMatches) {
    if (m.player_white_id) realMatchPlayerIds.add(m.player_white_id);
    if (m.player_black_id) realMatchPlayerIds.add(m.player_black_id);
  }

  const unverifiedUsers: Array<{ id: number; username: string; email: string; reason: string }> = [];

  for (const u of existingUsers) {
    // 1. Kiểm tra email test
    if (!isVerifiedTestEmail(u.email)) {
      unverifiedUsers.push({
        id: u.id,
        username: u.username,
        email: u.email,
        reason: 'Email không thuộc domain test hợp lệ (@kybien.test, @example.com, @test.com, .test). Có nguy cơ là tài khoản người dùng thật!',
      });
      continue;
    }

    // 2. Kiểm tra nếu có liên kết trận cờ thật
    if (realMatchPlayerIds.has(u.id)) {
      unverifiedUsers.push({
        id: u.id,
        username: u.username,
        email: u.email,
        reason: 'Tài khoản có lịch sử đấu cờ thực tế trong hệ thống.',
      });
      continue;
    }
  }

  return {
    verified: unverifiedUsers.length === 0,
    existingUsers,
    unverifiedUsers,
  };
}

async function main() {
  // 1. Kiểm tra môi trường trước tiên
  assertSafeEnvironment();

  const args = process.argv.slice(2);
  const isConfirmed = args.includes('--confirm');
  const userIdsArg = args.find((a) => a.startsWith('--user-ids='));
  const guildIdsArg = args.find((a) => a.startsWith('--guild-ids='));
  const charIdsArg = args.find((a) => a.startsWith('--character-ids='));

  const userIds = parseIds(userIdsArg, '--user-ids=');
  const characterIds = parseIds(charIdsArg, '--character-ids=');
  const guildIds = parseIds(guildIdsArg, '--guild-ids=');

  if (userIds.length === 0 && characterIds.length === 0 && guildIds.length === 0) {
    console.error('❌ LỖI: Bạn phải chỉ định ít nhất một danh sách ID hợp lệ (> 0):');
    console.error('   --user-ids=<id1,id2,...>');
    console.error('   --character-ids=<id1,id2,...>');
    console.error('   --guild-ids=<id1,id2,...>');
    process.exit(1);
  }

  console.log('--- 🛡️ AN TOÀN DỮ LIỆU: KIỂM TRA MỤC TIÊU DỌN DẸP ---');
  console.log(`- Danh sách User IDs đã chuẩn hóa (${userIds.length}):`, userIds);
  console.log(`- Danh sách Character IDs đã chuẩn hóa (${characterIds.length}):`, characterIds);
  console.log(`- Danh sách Guild IDs đã chuẩn hóa (${guildIds.length}):`, guildIds);

  // 2. Xác minh nguồn gốc test của danh sách User (Test Provenance Check)
  const { verified: userVerified, existingUsers, unverifiedUsers } = await verifyUsersProvenance(prisma, userIds);

  const existingUserMap = new Map(existingUsers.map((u) => [u.id, u]));
  const missingUserIds = userIds.filter((id) => !existingUserMap.has(id));
  if (missingUserIds.length > 0) {
    console.log(`ℹ️ [Thông báo] ${missingUserIds.length} User ID không tồn tại trong DB (sẽ tự động bỏ qua):`, missingUserIds);
  }

  if (!userVerified) {
    console.error(`\n🚨 TỪ CHỐI THỰC THI: Phát hiện ${unverifiedUsers.length} tài khoản KHÔNG THỂ XÁC MINH LÀ DỮ LIỆU TEST:`);
    unverifiedUsers.forEach((u) => {
      console.error(`  ❌ User ID ${u.id}: "${u.username}" (${u.email}) -> ${u.reason}`);
    });
    console.error('\nNguyên tắc an toàn: Tài khoản người dùng thật (kể cả tài khoản mới đăng ký, ELO 1200 mặc định, chưa đấu trận nào) tuyệt đối không được coi là dữ liệu rác.');
    console.error('Hệ thống hủy bỏ toàn bộ thao tác dọn dẹp để bảo vệ dữ liệu.');
    process.exit(1);
  }

  // 3. Kiểm tra Characters và xác minh nguồn gốc User sở hữu
  const existingChars = characterIds.length > 0
    ? await prisma.xianxiaCharacter.findMany({ where: { id: { in: characterIds } }, select: { id: true, name: true, user_id: true } })
    : [];
  const existingCharMap = new Map(existingChars.map((c) => [c.id, c]));
  const missingCharIds = characterIds.filter((id) => !existingCharMap.has(id));
  if (missingCharIds.length > 0) {
    console.log(`ℹ️ [Thông báo] ${missingCharIds.length} Character ID không tồn tại trong DB (sẽ tự động bỏ qua):`, missingCharIds);
  }

  if (existingChars.length > 0) {
    const ownerUserIds = Array.from(new Set(existingChars.map((c) => c.user_id)));
    const { verified: ownerVerified, unverifiedUsers: unverifiedOwners } = await verifyUsersProvenance(prisma, ownerUserIds);
    if (!ownerVerified) {
      console.error(`\n🚨 TỪ CHỐI THỰC THI: Phát hiện nhân vật thuộc về tài khoản không thể xác minh là test:`);
      unverifiedOwners.forEach((u) => {
        console.error(`  ❌ Chủ nhân User ID ${u.id}: "${u.username}" (${u.email}) -> ${u.reason}`);
      });
      process.exit(1);
    }
  }

  // 4. Kiểm tra Guilds và xác minh nguồn gốc Chưởng môn sở hữu
  const existingGuilds = guildIds.length > 0
    ? await prisma.xianxiaGuild.findMany({ where: { id: { in: guildIds } }, select: { id: true, name: true, leader_id: true } })
    : [];
  const existingGuildMap = new Map(existingGuilds.map((g) => [g.id, g]));
  const missingGuildIds = guildIds.filter((id) => !existingGuildMap.has(id));
  if (missingGuildIds.length > 0) {
    console.log(`ℹ️ [Thông báo] ${missingGuildIds.length} Guild ID không tồn tại trong DB (sẽ tự động bỏ qua):`, missingGuildIds);
  }

  if (existingGuilds.length > 0) {
    const leaderCharIds = existingGuilds.map((g) => g.leader_id);
    const leaderChars = await prisma.xianxiaCharacter.findMany({
      where: { id: { in: leaderCharIds } },
      select: { id: true, user_id: true },
    });
    const leaderUserIds = Array.from(new Set(leaderChars.map((c) => c.user_id)));
    const { verified: leaderVerified, unverifiedUsers: unverifiedLeaders } = await verifyUsersProvenance(prisma, leaderUserIds);
    if (!leaderVerified) {
      console.error(`\n🚨 TỪ CHỐI THỰC THI: Phát hiện Tông Môn có Chưởng môn không thể xác minh là test:`);
      unverifiedLeaders.forEach((u) => {
        console.error(`  ❌ Chưởng môn User ID ${u.id}: "${u.username}" (${u.email}) -> ${u.reason}`);
      });
      process.exit(1);
    }
  }

  // 5. Hiển thị thông tin đối tượng sẽ bị ảnh hưởng
  console.log('\n--- 📋 TỔNG HỢP CÁC ĐỐI TƯỢNG HỢP LỆ ĐÃ XÁC MINH TEST TRONG DB ---');
  console.log(`- Tài khoản test hợp lệ tìm thấy: ${existingUsers.length}`);
  existingUsers.forEach((u) => console.log(`  * User ID ${u.id}: "${u.username}" (${u.email}, Elo: ${u.elo}, Trận: ${u.matches_played})`));
  console.log(`- Nhân vật test hợp lệ tìm thấy: ${existingChars.length}`);
  existingChars.forEach((c) => console.log(`  * Char ID ${c.id}: "${c.name}" (User ID: ${c.user_id})`));
  console.log(`- Tông môn test hợp lệ tìm thấy: ${existingGuilds.length}`);
  existingGuilds.forEach((g) => console.log(`  * Guild ID ${g.id}: "${g.name}" (Leader ID: ${g.leader_id})`));

  if (!isConfirmed) {
    console.warn('\n⚠️ CẢNH BÁO: Đang chạy ở chế độ DRY-RUN (chưa có cờ --confirm).');
    console.warn('Không có bản ghi nào bị xóa. Để thực thi xóa dữ liệu, hãy thêm cờ --confirm.');
    process.exit(0);
  }

  console.log('\n🚀 BẮT ĐẦU DỌN DẸP THEO THỨ TỰ RÀNG BUỘC KHÓA NGOẠI (FOREIGN KEY)...');

  // 1. Chat Messages
  if (userIds.length > 0 || characterIds.length > 0 || guildIds.length > 0) {
    const deletedMsgs = await prisma.xianxiaChatMessage.deleteMany({
      where: {
        OR: [
          ...(userIds.length > 0 ? [{ sender_user_id: { in: userIds } }] : []),
          ...(characterIds.length > 0 ? [{ sender_character_id: { in: characterIds } }] : []),
          ...(guildIds.length > 0 ? [{ guild_id: { in: guildIds } }] : []),
        ],
      },
    });
    console.log(`✅ Đã xóa ${deletedMsgs.count} tin nhắn chat liên quan.`);
  }

  // 2. Guild Applications
  if (guildIds.length > 0 || characterIds.length > 0) {
    const deletedApps = await prisma.xianxiaGuildApplication.deleteMany({
      where: {
        OR: [
          ...(guildIds.length > 0 ? [{ guild_id: { in: guildIds } }] : []),
          ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
        ],
      },
    });
    console.log(`✅ Đã xóa ${deletedApps.count} đơn bái kiến tông môn.`);
  }

  // 3. Guild Members
  if (guildIds.length > 0 || characterIds.length > 0) {
    const deletedMembers = await prisma.xianxiaGuildMember.deleteMany({
      where: {
        OR: [
          ...(guildIds.length > 0 ? [{ guild_id: { in: guildIds } }] : []),
          ...(characterIds.length > 0 ? [{ character_id: { in: characterIds } }] : []),
        ],
      },
    });
    console.log(`✅ Đã xóa ${deletedMembers.count} bản ghi thành viên tông môn.`);
  }

  // 4. Guilds
  if (guildIds.length > 0) {
    const deletedGuilds = await prisma.xianxiaGuild.deleteMany({
      where: { id: { in: guildIds } },
    });
    console.log(`✅ Đã xóa ${deletedGuilds.count} tông môn.`);
  }

  // 5. Characters
  if (characterIds.length > 0 || userIds.length > 0) {
    const deletedChars = await prisma.xianxiaCharacter.deleteMany({
      where: {
        OR: [
          ...(characterIds.length > 0 ? [{ id: { in: characterIds } }] : []),
          ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
        ],
      },
    });
    console.log(`✅ Đã xóa ${deletedChars.count} nhân vật tu tiên.`);
  }

  // 6. Users
  if (userIds.length > 0) {
    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`✅ Đã xóa ${deletedUsers.count} tài khoản người dùng.`);
  }

  console.log('\n🎉 HOÀN TẤT DỌN DẸP AN TOÀN THEO ID TƯỜNG MINH!');
}

if (process.argv[1]?.endsWith('cleanupStaleTestData.ts') || process.argv[1]?.endsWith('cleanupStaleTestData.js')) {
  main()
    .catch((e) => {
      console.error('❌ LỖI KHI DỌN DẸP DỮ LIỆU:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
