import { prisma } from '../utils/prisma.js';

export async function ensurePartyIndexes(): Promise<void> {
  console.log('[Party DB Migration] Đang kiểm tra và tạo partial unique index cho hệ thống Tổ Đội...');

  // 1. Partial Unique Index: Đảm bảo tại một thời điểm, chỉ có tối đa 1 lời mời PENDING giữa (party_id, invitee_id)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_party_invite 
    ON xianxia_party_invites (party_id, invitee_id) 
    WHERE status = 'PENDING';
  `);
  console.log('  ✔ Index unique_active_party_invite (party_id, invitee_id WHERE status = "PENDING") sẵn sàng.');

  // 2. Partial Unique Index: Đảm bảo một nhân vật chỉ làm Đội Trưởng của tối đa 1 tổ đội chưa giải tán
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_party_leader 
    ON xianxia_parties (leader_id) 
    WHERE status != 'DISBANDED';
  `);
  console.log('  ✔ Index unique_active_party_leader (leader_id WHERE status != "DISBANDED") sẵn sàng.');

  // 3. Partial Unique Index: Đảm bảo một tổ đội chỉ có tối đa 1 phiên phó bản đang hoạt động
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_party_dungeon 
    ON xianxia_dungeon_runs (party_id) 
    WHERE status IN ('WAITING', 'IN_PROGRESS');
  `);
  console.log('  ✔ Index unique_active_party_dungeon (party_id WHERE status IN ("WAITING", "IN_PROGRESS")) sẵn sàng.');
}

if (process.argv[1]?.includes('ensurePartyIndexes')) {
  ensurePartyIndexes()
    .then(() => {
      console.log('🎉 Hoàn tất thiết lập Partial Unique Indexes cho Tổ Đội!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi thiết lập Partial Unique Indexes:', err);
      process.exit(1);
    });
}
