import { prisma } from '../utils/prisma.js';
import { SolutionTree } from '../services/puzzleEngine.js';
import { buildVerifiedSolutionTree } from '../utils/verifiedTreeBuilder.js';
import fs from 'fs';
import path from 'path';

// Danh sách tên kiếm hiệp cho 30 thế cờ hạt nhân đầu tiên
const PUZZLE_TITLES: Record<number, string> = {
  1: 'Mã Đơn Khống Tướng',
  2: 'Pháo Giác Mượn Sĩ',
  3: 'Thí Xe Đoạt Sĩ',
  4: 'Điệp Mã Chiếu Rút',
  5: 'Song Mã Ẩm Tuyền',
  6: 'Song Xe Kẹp Nách',
  7: 'Song Pháo Trùng Thọc Đáy',
  8: 'Điệp Pháo Kê Đòn',
  9: 'Song Binh Nhập Cung',
  10: 'Xa Mã Tương Công',
  11: 'Bạch Mã Khiêu Khê',
  12: 'Hỏa Diệm Pháo Đài',
  13: 'Đơn Xa Đoạt Mệnh',
  14: 'Kim Thiền Thoát Xác',
  15: 'Hổ Huyệt Vây Hãm',
  16: 'Tiểu Xa Mã Phá Địch',
  17: 'Khổng Minh Tá Tiễn',
  18: 'Bát Quái Kỳ Trận',
  19: 'Chinh Đông Khúc Ca',
  20: 'Chinh Tây Huyết Chiến',
  21: 'Pháo Đả Diệp Lang Quan',
  22: 'Dã Mã Thao Điền',
  23: 'Thất Tinh Tụ Hội',
  24: 'Đơn Xa Cứu Chủ',
  25: 'Thiên La Địa Võng',
  26: 'Hàn Băng Thần Chưởng',
  27: 'Tả Hữu Khai Cung',
  28: 'Diệp Hạ Tàng Hoa',
  29: 'Lôi Đình Vạn Quân',
  30: 'Cửu Long Tranh Châu'
};

export async function seedMilestone1Puzzles() {
  console.log('🚀 [Seed Cờ Thế MVP] Bắt đầu nạp 30 thế cờ hạt nhân (Tier 1) đã xác minh 100%...');

  const jsonPath = path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_tier1_easy.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Không tìm thấy file dữ liệu: ${jsonPath}`);
  }

  const treesPath = path.join(process.cwd(), 'all_verified_trees.json');
  if (!fs.existsSync(treesPath)) {
    throw new Error(`Không tìm thấy file cây lời giải: ${treesPath}`);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const treesData = JSON.parse(fs.readFileSync(treesPath, 'utf8'));

  let inserted = 0;

  for (let i = 1; i <= 30; i++) {
    const rawFen = rawData[i.toString()];
    if (!rawFen) continue;

    const fen = rawFen.includes(' ') ? rawFen : `${rawFen} w - - 0 1`;
    const title = PUZZLE_TITLES[i] || `Kỳ Trận Sơ Cấp #${i}`;
    const treeInfo = treesData[i.toString()];

    let solutionTree: SolutionTree;
    let status: 'PUBLISHED' | 'HIDDEN' = 'PUBLISHED';

    if (treeInfo && treeInfo.status !== 'BLOCKED') {
      solutionTree = buildVerifiedSolutionTree(i, fen, treeInfo);
      status = 'PUBLISHED';
    } else {
      // Trường hợp không có lời giải xác minh -> Đánh dấu ẩn / blocked
      status = 'HIDDEN';
      solutionTree = {
        root_fen: fen,
        branches: []
      };
    }

    await prisma.puzzle.upsert({
      where: {
        tier_order_index: {
          tier: 'EASY',
          order_index: i
        }
      },
      update: {
        title,
        fen,
        solution_tree: JSON.stringify(solutionTree),
        status
      },
      create: {
        tier: 'EASY',
        order_index: i,
        title,
        fen,
        solution_tree: JSON.stringify(solutionTree),
        status
      }
    });

    inserted++;
  }

  console.log(`✅ [Seed Cờ Thế MVP] Đã nạp thành công ${inserted}/30 thế cờ vào cơ sở dữ liệu Supabase!`);
  return inserted;
}

// Nếu gọi trực tiếp từ command line
if (process.argv[1]?.includes('seedPuzzles')) {
  seedMilestone1Puzzles()
    .catch((e) => {
      console.error('❌ Lỗi nạp cờ thế:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
