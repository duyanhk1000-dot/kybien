import { prisma } from '../utils/prisma.js';

async function main() {
  console.log('--- Đang rà soát và sửa dữ liệu cờ UGC trong DB ---');

  const ugcPuzzles = await prisma.puzzle.findMany({
    where: { tier: 'UGC' },
  });

  console.log(`Tìm thấy ${ugcPuzzles.length} thế cờ UGC.`);

  for (const pz of ugcPuzzles) {
    let title = pz.title;
    let description = pz.description;

    // Sửa các ký tự lỗi font nếu có dấu ? do PowerShell
    if (title.includes('?')) {
      title = 'Khởi Khai Giang Hồ Trận';
    }
    if (description && description.includes('?')) {
      description = 'Thử nghiệm thế cờ đầu tiên trên giang hồ';
    }

    let tree: any = {};
    try {
      tree = JSON.parse(pz.solution_tree || '{}');
    } catch (e) {}

    // Sửa branches nếu thiếu 'move' hoặc đang dùng 'player_move'
    if (tree.branches && Array.isArray(tree.branches)) {
      tree.branches = tree.branches.map((b: any) => {
        const move = b.move || b.player_move || 'f3d3';
        return {
          move,
          is_correct: true,
          is_win: true,
          win_comment: b.win_comment || 'Sát cục tuyệt diệu! Phá trận giang hồ thành công!',
          replies: b.replies || [],
        };
      });
    }

    let constraintsObj: any = {};
    try {
      constraintsObj = JSON.parse(pz.constraints || '{}');
    } catch (e) {}

    // Với puzzle 107, bỏ giới hạn 1 nước để người chơi có thể giải theo nhiều biến 1 hoặc 2 nước
    if (pz.id === 107) {
      constraintsObj.max_moves = 0;
    }

    await prisma.puzzle.update({
      where: { id: pz.id },
      data: {
        title,
        description,
        constraints: JSON.stringify(constraintsObj),
        solution_tree: JSON.stringify(tree),
      },
    });

    console.log(`✓ Đã cập nhật Puzzle #${pz.id}: Title="${title}", Desc="${description}"`);
  }

  console.log('--- Hoàn tất sửa dữ liệu UGC! ---');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
