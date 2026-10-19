import { prisma } from '../utils/prisma.js';

async function main() {
  console.log('🔍 [DB AUDIT] KIỂM TRA TRẠNG THÁI DỮ LIỆU MILESTONE 1...\n');

  const count = await prisma.puzzle.count();
  console.log('1. Tổng số thế cờ trong DB (puzzles):', count);

  const easyCount = await prisma.puzzle.count({ where: { tier: 'EASY' } });
  console.log('2. Số thế cờ Tier 1 (EASY):', easyCount);

  const publishedCount = await prisma.puzzle.count({ where: { status: 'PUBLISHED' } });
  console.log('3. Số thế cờ ở trạng thái PUBLISHED:', publishedCount);

  const sample = await prisma.puzzle.findMany({
    take: 5,
    select: {
      id: true,
      title: true,
      fen: true,
      status: true,
      tier: true,
      order_index: true,
    },
    orderBy: { id: 'asc' },
  });
  console.log('\n4. Mẫu 5 bản ghi đầu tiên trong DB:');
  console.log(JSON.stringify(sample, null, 2));

  // Kiểm tra bảng log và session
  const totalSessions = await prisma.puzzleSession.count();
  const totalLogs = await prisma.puzzleRewardLog.count();
  console.log('\n5. Thống kê Puzzle Session & Reward Log:');
  console.log('   - Tổng Puzzle Sessions:', totalSessions);
  console.log('   - Tổng Puzzle Reward Logs:', totalLogs);

  console.log('\n✅ DB Verification Finished Successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ DB Verification Failed:', err);
  process.exit(1);
});
