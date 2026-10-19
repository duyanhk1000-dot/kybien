import { prisma } from '../utils/prisma.js';
import fs from 'fs';
import path from 'path';

export async function seedTier2And3Puzzles() {
  console.log('🚀 [Seed Cờ Thế Tier 2 & 3] Đang nạp các thế cờ Trung cấp (Medium) và Cao cấp (Hard)...');

  const reportPath = path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_verification_report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  let inserted = 0;

  for (const item of report) {
    if (item.tier < 2) continue; // Bỏ qua tier 1 đã seed trước đó

    const tierName = item.tier === 2 ? 'MEDIUM' : 'HARD';
    const fen = item.fen.includes(' ') ? item.fen : `${item.fen} w - - 0 1`;

    const solutionTree = {
      root_fen: fen,
      branches: []
    };

    await prisma.puzzle.upsert({
      where: {
        tier_order_index: {
          tier: tierName as any,
          order_index: item.id
        }
      },
      update: {
        title: item.name,
        fen,
        solution_tree: JSON.stringify(solutionTree),
        status: 'PUBLISHED'
      },
      create: {
        tier: tierName as any,
        order_index: item.id,
        title: item.name,
        fen,
        solution_tree: JSON.stringify(solutionTree),
        status: 'PUBLISHED'
      }
    });

    inserted++;
    console.log(`✅ Nạp thành công [${tierName}] #${item.id}: ${item.name}`);
  }

  console.log(`🎉 Đã nạp thành công ${inserted} thế cờ Tier 2 & 3 vào Supabase PostgreSQL!`);
  return inserted;
}

if (process.argv[1]?.includes('seedTier2And3Puzzles')) {
  seedTier2And3Puzzles()
    .catch((e) => {
      console.error('❌ Lỗi:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
