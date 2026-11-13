/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — DỊCH VỤ TOÀN DÂN TRẢM MA (WORLD BOSS REALTIME)
 * Kiến trúc: Server-Authoritative, Atomic HP Decrement, Ranked Rewards & Idempotency Kép
 */

import { prisma } from '../../utils/prisma.js';

export interface WorldBossLeaderboardEntry {
  rank: number;
  characterId: number;
  characterName: string;
  realm: string;
  level: number;
  damageDealt: number;
  attackCount: number;
}

export interface AttackWorldBossResult {
  damageDealt: number;
  isCritical: boolean;
  currentHp: number;
  maxHp: number;
  status: string;
  isKiller: boolean;
  totalDamageDealt: number;
  totalAttackCount: number;
}

export interface ClaimWorldBossRewardResult {
  claimed: boolean;
  idempotent?: boolean;
  rank: number;
  isKiller: boolean;
  silverReward: number;
  expReward: number;
  cultivationReward: number;
  itemsReward: Array<{ id: string; name: string; quantity: number }>;
}

export class XianxiaWorldBossService {
  private inMemoryCooldowns: Map<number, number> = new Map();

  /**
   * Tính toán sát thương Server-Authoritative dựa trên chỉ số nhân vật
   * Tuyệt đối không nhận sát thương từ client
   */
  private calculateAuthoritativeDamage(character: {
    realm: string;
    level: number;
    physique: number;
    comprehension: number;
    luck: number;
  }): { damage: number; isCritical: boolean } {
    let realmMultiplier = 1.0;
    if (character.realm.startsWith('LUYEN_KHI')) {
      const stage = parseInt(character.realm.replace('LUYEN_KHI_', ''), 10) || 1;
      realmMultiplier = 1.0 + stage * 0.15;
    } else if (character.realm.startsWith('TRUC_CO')) {
      realmMultiplier = 2.8;
    } else if (character.realm.startsWith('KIM_DAN')) {
      realmMultiplier = 5.0;
    }

    const basePower = character.level * 18 + character.physique * 10 + character.comprehension * 6;
    const variance = 0.9 + Math.random() * 0.25; // Dao động 90% - 115%

    // Tỷ lệ chí mạng dựa trên Khí Vận (Luck)
    const critChance = Math.min(0.5, 0.05 + character.luck * 0.015);
    const isCritical = Math.random() < critChance;
    const critMultiplier = isCritical ? 1.85 : 1.0;

    const rawDamage = Math.floor(basePower * realmMultiplier * variance * critMultiplier);
    // Sanity ceiling: tối đa 100,000 sát thương mỗi đòn đánh để ngăn chặn tràn số hoặc lỗi multiplier
    const damage = Math.min(100000, Math.max(10, rawDamage));
    return { damage, isCritical };
  }

  /**
   * Lấy thông tin phiên Boss Thế Giới hiện tại (Active / Upcoming / Defeated)
   */
  async getCurrentBoss(characterId?: number) {
    const now = new Date();

    // 1. Tìm boss ACTIVE chưa hết hạn
    let boss = await prisma.xianxiaWorldBoss.findFirst({
      where: {
        status: 'ACTIVE',
      },
      include: {
        killer: {
          select: { id: true, name: true, realm: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Tự động chuyển ESCAPED nếu quá hạn 30 phút mà chưa bị trảm
    if (boss && boss.status === 'ACTIVE' && now > boss.ends_at) {
      boss = await prisma.xianxiaWorldBoss.update({
        where: { id: boss.id },
        data: { status: 'ESCAPED' },
        include: {
          killer: {
            select: { id: true, name: true, realm: true },
          },
        },
      });
    }

    // 2. Nếu không có ACTIVE, lấy phiên mới nhất (DEFEATED hoặc ESCAPED)
    if (!boss) {
      boss = await prisma.xianxiaWorldBoss.findFirst({
        orderBy: { created_at: 'desc' },
        include: {
          killer: {
            select: { id: true, name: true, realm: true },
          },
        },
      });
    }

    // Nếu có characterId, lấy thêm tiến độ cá nhân của người chơi
    let myDamage = null;
    let myClaim = null;
    if (boss && characterId) {
      myDamage = await prisma.xianxiaWorldBossDamage.findUnique({
        where: {
          boss_instance_id_character_id: {
            boss_instance_id: boss.id,
            character_id: characterId,
          },
        },
      });

      myClaim = await prisma.xianxiaWorldBossRewardClaim.findUnique({
        where: {
          boss_instance_id_character_id: {
            boss_instance_id: boss.id,
            character_id: characterId,
          },
        },
      });
    }

    return {
      boss,
      personalProgress: myDamage
        ? {
            damageDealt: myDamage.damage_dealt,
            attackCount: myDamage.attack_count,
            hasClaimedReward: !!myClaim,
          }
        : null,
    };
  }

  /**
   * Triệu hoán / Tạo phiên Boss Thế Giới mới
   */
  async spawnWorldBoss(options?: {
    bossId?: string;
    name?: string;
    level?: number;
    maxHp?: number;
    durationMinutes?: number;
  }) {
    // Kiểm tra xem có boss ACTIVE nào đang diễn ra không
    const existingActive = await prisma.xianxiaWorldBoss.findFirst({
      where: { status: 'ACTIVE' },
    });

    if (existingActive) {
      if (new Date() < existingActive.ends_at) {
        return existingActive;
      }
      // Đã quá hạn thì kết thúc
      await prisma.xianxiaWorldBoss.update({
        where: { id: existingActive.id },
        data: { status: 'ESCAPED' },
      });
    }

    const maxHp = options?.maxHp ?? 10_000_000;
    const durationMinutes = options?.durationMinutes ?? 30;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

    const newBoss = await prisma.xianxiaWorldBoss.create({
      data: {
        boss_id: options?.bossId ?? 'boss_xich_diem_ma_long',
        name: options?.name ?? 'Xích Diễm Ma Long',
        level: options?.level ?? 50,
        max_hp: maxHp,
        current_hp: maxHp,
        status: 'ACTIVE',
        started_at: startedAt,
        ends_at: endsAt,
      },
    });

    return newBoss;
  }

  /**
   * Tấn công Boss Thế Giới (Server-Authoritative, Rate Limited, Atomic Concurrency)
   */
  async attackWorldBoss(userId: number, bossInstanceId: string): Promise<AttackWorldBossResult> {
    const character = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!character) {
      const err: any = new Error('Không tìm thấy thông tin nhân vật tu tiên.');
      err.code = 'CHARACTER_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    // 1. Kiểm tra Cooldown tấn công (Tối thiểu 400ms giữa các lần xuất chiêu)
    const nowMs = Date.now();
    const lastAttack = this.inMemoryCooldowns.get(character.id) || 0;
    if (nowMs - lastAttack < 400) {
      const err: any = new Error('Chiêu thức đang hồi (400ms), vui lòng không bấm liên tục.');
      err.code = 'WORLDBOSS_ATTACK_COOLDOWN';
      err.status = 429;
      throw err;
    }
    this.inMemoryCooldowns.set(character.id, nowMs);

    // Định kỳ dọn dẹp các tracker quá hạn (> 60s) khi kích thước Map vượt ngưỡng 2,000 để chống rò rỉ bộ nhớ
    if (this.inMemoryCooldowns.size > 2000) {
      const purgeThreshold = nowMs - 60000;
      for (const [cId, ts] of this.inMemoryCooldowns.entries()) {
        if (ts < purgeThreshold) {
          this.inMemoryCooldowns.delete(cId);
        }
      }
    }

    // 2. Tính toán sát thương máy chủ (Bỏ qua sát thương từ client)
    const { damage: calculatedDmg, isCritical } = this.calculateAuthoritativeDamage(character);

    // 3. Thực thi Transaction nguyên tử
    const result = await prisma.$transaction(async (tx) => {
      const boss = await tx.xianxiaWorldBoss.findUnique({
        where: { id: bossInstanceId },
      });

      if (!boss) {
        const err: any = new Error('Không tìm thấy phiên Boss Thế Giới.');
        err.code = 'WORLDBOSS_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      if (boss.status !== 'ACTIVE') {
        const err: any = new Error(`Boss Thế Giới không còn ở trạng thái tham chiến (${boss.status}).`);
        err.code = 'WORLDBOSS_NOT_ACTIVE';
        err.status = 400;
        throw err;
      }

      const nowDate = new Date();
      if (nowDate > boss.ends_at) {
        await tx.xianxiaWorldBoss.update({
          where: { id: boss.id },
          data: { status: 'ESCAPED' },
        });
        const err: any = new Error('Thời gian thảo phạt Boss Thế Giới đã kết thúc.');
        err.code = 'WORLDBOSS_EXPIRED';
        err.status = 400;
        throw err;
      }

      // Xác định lượng sát thương thực tế trừ vào boss
      const actualDamage = Math.min(boss.current_hp, calculatedDmg);
      const nextHp = Math.max(0, boss.current_hp - actualDamage);
      const isKiller = nextHp === 0 && boss.current_hp > 0;

      // Cập nhật boss
      const updatedBoss = await tx.xianxiaWorldBoss.update({
        where: { id: boss.id },
        data: {
          current_hp: nextHp,
          status: isKiller ? 'DEFEATED' : boss.status,
          defeated_at: isKiller ? nowDate : boss.defeated_at,
          killer_character_id: isKiller ? character.id : boss.killer_character_id,
          version: { increment: 1 },
        },
      });

      // Cập nhật sát thương tích lũy của người chơi (Upsert)
      const damageRecord = await tx.xianxiaWorldBossDamage.upsert({
        where: {
          boss_instance_id_character_id: {
            boss_instance_id: boss.id,
            character_id: character.id,
          },
        },
        create: {
          boss_instance_id: boss.id,
          character_id: character.id,
          damage_dealt: actualDamage,
          attack_count: 1,
          last_attack_at: nowDate,
        },
        update: {
          damage_dealt: { increment: actualDamage },
          attack_count: { increment: 1 },
          last_attack_at: nowDate,
        },
      });

      return {
        damageDealt: actualDamage,
        isCritical,
        currentHp: updatedBoss.current_hp,
        maxHp: updatedBoss.max_hp,
        status: updatedBoss.status,
        isKiller,
        totalDamageDealt: damageRecord.damage_dealt,
        totalAttackCount: damageRecord.attack_count,
      };
    });

    return result;
  }

  /**
   * Bảng Xếp Hạng Top Sát Thương Thời Gian Thực
   */
  async getLeaderboard(bossInstanceId: string, limit = 10): Promise<WorldBossLeaderboardEntry[]> {
    const records = await prisma.xianxiaWorldBossDamage.findMany({
      where: { boss_instance_id: bossInstanceId },
      include: {
        character: {
          select: { id: true, name: true, realm: true, level: true },
        },
      },
      orderBy: { damage_dealt: 'desc' },
      take: limit,
    });

    return records.map((r, idx) => ({
      rank: idx + 1,
      characterId: r.character_id,
      characterName: r.character.name,
      realm: r.character.realm,
      level: r.character.level,
      damageDealt: r.damage_dealt,
      attackCount: r.attack_count,
    }));
  }

  /**
   * Nhận Thưởng Thảo Phạt Ma Hoàng (Bảo Vệ Kép Idempotency)
   */
  async claimReward(userId: number, bossInstanceId: string, clientKey?: string): Promise<ClaimWorldBossRewardResult> {
    const character = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!character) {
      const err: any = new Error('Không tìm thấy nhân vật.');
      err.code = 'CHARACTER_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const boss = await prisma.xianxiaWorldBoss.findUnique({
      where: { id: bossInstanceId },
    });
    if (!boss) {
      const err: any = new Error('Không tìm thấy phiên Boss Thế Giới.');
      err.code = 'WORLDBOSS_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (boss.status !== 'DEFEATED' && boss.status !== 'ESCAPED') {
      const err: any = new Error('Sự kiện Ma Hoàng Xuất Thế vẫn đang diễn ra, chưa thể nhận thưởng.');
      err.code = 'WORLDBOSS_STILL_ACTIVE';
      err.status = 400;
      throw err;
    }

    const scopedKey = `worldboss:reward:b${bossInstanceId}:c${character.id}:${clientKey || 'default'}`;

    // 1. Kiểm tra đã nhận trước đó chưa (Idempotent response)
    const existingClaim = await prisma.xianxiaWorldBossRewardClaim.findUnique({
      where: {
        boss_instance_id_character_id: {
          boss_instance_id: bossInstanceId,
          character_id: character.id,
        },
      },
    });

    if (existingClaim) {
      let items: any = [];
      try {
        items = existingClaim.items_reward ? JSON.parse(existingClaim.items_reward) : [];
      } catch (e) {}

      return {
        claimed: true,
        idempotent: true,
        rank: existingClaim.rank || 999,
        isKiller: existingClaim.is_killer,
        silverReward: existingClaim.silver_reward,
        expReward: existingClaim.exp_reward,
        cultivationReward: existingClaim.cultivation_reward,
        itemsReward: items,
      };
    }

    // 2. Kiểm tra đóng góp sát thương
    const damageRecord = await prisma.xianxiaWorldBossDamage.findUnique({
      where: {
        boss_instance_id_character_id: {
          boss_instance_id: bossInstanceId,
          character_id: character.id,
        },
      },
    });

    if (!damageRecord || damageRecord.damage_dealt <= 0) {
      const err: any = new Error('Đạo hữu chưa tham gia tấn công Ma Hoàng, không có chiến công để nhận thưởng.');
      err.code = 'WORLDBOSS_NO_CONTRIBUTION';
      err.status = 400;
      throw err;
    }

    // 3. Tính toán thứ hạng sát thương
    const higherCount = await prisma.xianxiaWorldBossDamage.count({
      where: {
        boss_instance_id: bossInstanceId,
        damage_dealt: { gt: damageRecord.damage_dealt },
      },
    });
    const rank = higherCount + 1;
    const isKiller = boss.killer_character_id === character.id;

    // 4. Phân bổ phần thưởng theo thứ hạng
    let silverReward = 500;
    let expReward = 500;
    let cultivationReward = 400;
    let itemsReward: Array<{ id: string; name: string; quantity: number }> = [
      { id: 'item_duong_khi_dan', name: 'Dưỡng Khí Đan', quantity: 2 },
    ];

    if (rank === 1) {
      silverReward = 5000;
      expReward = 3000;
      cultivationReward = 2500;
      itemsReward = [
        { id: 'item_than_binh_thiet', name: 'Thần Binh Thiết', quantity: 2 },
        { id: 'item_yeu_dan_cuc_pham', name: 'Yêu Đan Cực Phẩm', quantity: 1 },
      ];
    } else if (rank <= 3) {
      silverReward = 3000;
      expReward = 2000;
      cultivationReward = 1600;
      itemsReward = [
        { id: 'item_bach_luyen_tinh_thiet', name: 'Bách Luyện Tinh Thiết', quantity: 3 },
        { id: 'item_yeu_dan_thuong_pham', name: 'Yêu Đan Thượng Phẩm', quantity: 1 },
      ];
    } else if (rank <= 10) {
      silverReward = 1500;
      expReward = 1200;
      cultivationReward = 1000;
      itemsReward = [
        { id: 'item_bach_luyen_tinh_thiet', name: 'Bách Luyện Tinh Thiết', quantity: 1 },
        { id: 'item_yeu_dan_so_cap', name: 'Yêu Đan Sơ Cấp', quantity: 2 },
      ];
    }

    if (isKiller) {
      silverReward += 2000;
      expReward += 1000;
      itemsReward.push({ id: 'item_nanh_soi_ngan_nam', name: 'Nanh Ma Long Ngàn Năm', quantity: 1 });
    }

    // 5. Ghi nhận nhận thưởng nguyên tử trong CSDL
    await prisma.$transaction(async (tx) => {
      await tx.xianxiaWorldBossRewardClaim.create({
        data: {
          boss_instance_id: bossInstanceId,
          character_id: character.id,
          rank,
          is_killer: isKiller,
          silver_reward: silverReward,
          exp_reward: expReward,
          cultivation_reward: cultivationReward,
          items_reward: JSON.stringify(itemsReward),
          idempotency_key: scopedKey,
        },
      });

      await tx.xianxiaCharacter.update({
        where: { id: character.id },
        data: {
          silver: { increment: silverReward },
          exp: { increment: expReward },
          cultivation: { increment: cultivationReward },
        },
      });
    });

    return {
      claimed: true,
      rank,
      isKiller,
      silverReward,
      expReward,
      cultivationReward,
      itemsReward,
    };
  }
}

export const xianxiaWorldBossService = new XianxiaWorldBossService();
