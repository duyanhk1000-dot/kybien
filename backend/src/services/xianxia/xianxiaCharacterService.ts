import { prisma } from '../../utils/prisma.js';
import { XianxiaCharacter } from '@prisma/client';
import { XianxiaCraftingService } from './xianxiaCraftingService.js';
import { REALM_HIERARCHY } from './xianxiaWorldService.js';
import { RealmTier } from '../../types/xianxia.js';

export interface EffectiveCombatStats {
  attack: number;
  defense: number;
  speed: number;
  crit_rate: number;
  dodge_rate: number;
  max_qi: number;
  base_health: number;
  max_health: number;
  base_fatigue: number;
  max_fatigue: number;
}

export class XianxiaCharacterService {
  private craftingService: XianxiaCraftingService;

  constructor() {
    this.craftingService = new XianxiaCraftingService();
  }

  /**
   * Tính lượng EXP cần để thăng cấp tiếp theo từ cấp độ hiện tại (Công thức chuẩn Mục 1)
   * EXP_Required(L) = floor(50 * L^1.45 + 50 * L)
   */
  public calcExpRequired(level: number): number {
    const lvl = Math.max(1, Math.floor(level || 1));
    return Math.floor(50 * Math.pow(lvl, 1.45) + 50 * lvl);
  }

  /**
   * Thêm EXP cho nhân vật với cơ chế:
   * 1. Hỗ trợ nhảy nhiều cấp một lần
   * 2. Bảo toàn chính xác EXP dư thừa
   * 3. Tăng chỉ số: +4 Max HP/cấp, +1 Max Fatigue mỗi 2 cấp, +1 Stat Point mỗi 10 cấp
   * 4. Hồi đầy Thể Lực khi lên cấp
   * 5. Trần Level 100: EXP nhận thêm tự động đổi sang Bạc 10:1
   */
  public applyExpGain(char: XianxiaCharacter, amount: number): {
    leveledUp: boolean;
    levelsGained: number;
    silverConverted: number;
  } {
    if (amount <= 0) {
      return { leveledUp: false, levelsGained: 0, silverConverted: 0 };
    }

    if (char.level >= 100) {
      char.level = 100;
      char.exp = char.exp_required;
      const silverBonus = Math.floor(amount / 10);
      char.silver += silverBonus;
      return { leveledUp: false, levelsGained: 0, silverConverted: silverBonus };
    }

    char.exp += amount;
    let leveledUp = false;
    let levelsGained = 0;

    while (char.level < 100 && char.exp >= char.exp_required) {
      char.exp -= char.exp_required;
      char.level += 1;
      levelsGained += 1;
      leveledUp = true;

      // 1. Tăng +4 HP tối đa mỗi cấp
      char.max_health += 4;
      char.health = char.max_health;

      // 2. Tăng +1 Thể Lực tối đa mỗi 2 cấp
      if (char.level % 2 === 0) {
        char.max_fatigue += 1;
      }
      char.fatigue = char.max_fatigue;

      // 3. Tăng +1 Điểm Tiềm Năng mỗi 10 cấp
      if (char.level % 10 === 0) {
        char.stat_points += 1;
      }

      char.exp_required = this.calcExpRequired(char.level);
    }

    // Nếu đạt đỉnh cấp 100 trong lúc nhảy cấp
    let silverConverted = 0;
    if (char.level >= 100) {
      char.level = 100;
      if (char.exp > 0) {
        silverConverted = Math.floor(char.exp / 10);
        char.silver += silverConverted;
        char.exp = char.exp_required;
      }
    }

    return { leveledUp, levelsGained, silverConverted };
  }

  /**
   * Tính toán toàn bộ chỉ số thực tế (Effective Combat Stats) kết hợp Căn Cốt, Cảnh Giới và Trang Bị
   */
  public calculateEffectiveStats(char: XianxiaCharacter): EffectiveCombatStats {
    // 1. Chỉ số cơ sở từ Căn Cốt (Physique) và Cảnh Giới
    const baseAtk = Math.max(10, Math.floor(char.physique * 1.5));
    const baseDef = Math.max(0, Math.floor(char.physique * 0.4));
    let speed = 10;
    let critRate = 0.05;
    let dodgeRate = 0.05;
    let maxQi = 50;
    let atkBonus = 0;
    let defBonus = 0;

    // 2. Đọc trang bị
    if (char.equipped_weapon) {
      const weaponDef = this.craftingService.getItemById(char.equipped_weapon);
      if (weaponDef?.equipment_stats) {
        atkBonus += weaponDef.equipment_stats.attack || 0;
        speed += weaponDef.equipment_stats.speed || 0;
        critRate += weaponDef.equipment_stats.crit_rate || 0;
      }
    }

    if (char.equipped_armor) {
      const armorDef = this.craftingService.getItemById(char.equipped_armor);
      if (armorDef?.equipment_stats) {
        defBonus += armorDef.equipment_stats.defense || 0;
        speed += armorDef.equipment_stats.speed || 0;
      }
    }

    if (char.equipped_relic) {
      const relicDef = this.craftingService.getItemById(char.equipped_relic);
      if (relicDef?.equipment_stats) {
        maxQi += (relicDef.equipment_stats as any).max_qi || 0;
      }
    }

    return {
      attack: baseAtk + atkBonus,
      defense: baseDef + defBonus,
      speed: Math.max(1, speed),
      crit_rate: Math.min(0.75, critRate),
      dodge_rate: Math.min(0.5, dodgeRate),
      max_qi: maxQi,
      base_health: char.health,
      max_health: char.max_health,
      base_fatigue: char.fatigue,
      max_fatigue: char.max_fatigue,
    };
  }

  /**
   * Lấy hoặc tạo nhân vật Tu Tiên cho User
   */
  public async getOrCreateCharacter(
    userId: number,
    initialData?: { name?: string; linh_can?: string; origin?: string }
  ): Promise<XianxiaCharacter> {
    let char = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });

    if (!char) {
      char = await prisma.xianxiaCharacter.create({
        data: {
          user_id: userId,
          name: initialData?.name || `Tu Tiên Giả #${userId}`,
          linh_can: initialData?.linh_can || 'THIEN_LINH_CAN',
          origin: initialData?.origin || 'TAN_TU',
          realm: 'PHAM_NHAN',
          level: 1,
          exp: 0,
          exp_required: 100,
          cultivation: 0,
          cultivation_required: 100,
          health: 120,
          max_health: 120,
          fatigue: 100,
          max_fatigue: 100,
          physique: 12,
          comprehension: 14,
          luck: 10,
          karma: 0,
          silver: 100,
          stat_points: 0,
          current_zone: 'zone_thanh_ha_thon',
          current_place: 'place_dong_phu_tan_tu',
        },
      });

      // Tặng kèm 2 vật phẩm khởi đầu vào túi đồ
      await prisma.xianxiaInventoryItem.createMany({
        data: [
          { character_id: char.id, item_id: 'item_hoi_xuan_dan', quantity: 2 },
          { character_id: char.id, item_id: 'item_thanh_phong_kiem', quantity: 1 },
        ],
      });
    }

    return char;
  }

  /**
   * Lấy thông tin nhân vật kèm túi đồ và chỉ số hiệu dụng
   */
  public async getCharacterDetails(userId: number) {
    const char = await this.getOrCreateCharacter(userId);
    const inventory = await prisma.xianxiaInventoryItem.findMany({
      where: { character_id: char.id },
      orderBy: { created_at: 'asc' },
    });

    const inventoryWithDetails = inventory.map(slot => {
      const def = this.craftingService.getItemById(slot.item_id);
      return {
        ...slot,
        name: def?.name || slot.item_id,
        type: def?.type || 'MISC',
        rarity: def?.rarity || 'COMMON',
        icon: def?.icon || '',
        description: def?.description || '',
        equipment_stats: def?.equipment_stats || null,
        effects: def?.effects || null,
      };
    });

    const effectiveStats = this.calculateEffectiveStats(char);

    return {
      character: char,
      inventory: inventoryWithDetails,
      effectiveStats,
    };
  }

  /**
   * Đả tọa điều tức phục hồi Thể Lực & Khí Huyết (Backend authoritative)
   * Tuyệt đối không tăng Tu Vi, có Cooldown 30s
   */
  public async meditate(userId: number) {
    const char = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!char) throw new Error('Không tìm thấy nhân vật.');

    const now = new Date();
    if (char.last_meditate) {
      const elapsedMs = now.getTime() - new Date(char.last_meditate).getTime();
      if (elapsedMs < 30000) {
        const remainingSec = Math.ceil((30000 - elapsedMs) / 1000);
        throw new Error(`Linh khí thiên địa chưa tụ, vui lòng đợi ${remainingSec}s!`);
      }
    }

    if (char.health >= char.max_health && char.fatigue >= char.max_fatigue) {
      throw new Error('Khí huyết và thể lực đang sung mãn viên mãn, không cần đả tọa!');
    }

    const isSanctuary = char.current_place === 'place_dong_phu_tan_tu';
    const cost = isSanctuary ? 0 : 5;

    if (char.silver < cost) {
      throw new Error(`Không đủ ${cost} Bạc để thuê phòng nghỉ trọ đả tọa!`);
    }

    const newHealth = Math.min(char.max_health, char.health + 25);
    const newFatigue = Math.min(char.max_fatigue, char.fatigue + 35);
    const newSilver = char.silver - cost;

    // Cập nhật nguyên tử - TUYỆT ĐỐI KHÔNG CỘNG TU VI
    const updated = await prisma.xianxiaCharacter.update({
      where: { id: char.id },
      data: {
        health: newHealth,
        fatigue: newFatigue,
        silver: newSilver,
        last_meditate: now,
      },
    });

    return {
      success: true,
      health: updated.health,
      fatigue: updated.fatigue,
      silver: updated.silver,
      message: `Ngươi khoanh chân nhập định, hồi phục 35 Thể Lực, 25 Khí Huyết${cost > 0 ? ` (tiêu hao ${cost} Bạc)` : ' (tại Động Phủ an toàn)'}.`,
    };
  }

  /**
   * Cộng điểm tiềm năng vào Căn Cốt hoặc Ngộ Tính
   */
  public async distributeStatPoints(userId: number, stat: 'physique' | 'comprehension') {
    const char = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!char) throw new Error('Không tìm thấy nhân vật.');

    if (char.stat_points <= 0) {
      throw new Error('Ngươi không còn điểm tiềm năng nào chưa phân bổ.');
    }

    const dataUpdate: any = {
      stat_points: char.stat_points - 1,
    };

    if (stat === 'physique') {
      dataUpdate.physique = char.physique + 1;
    } else if (stat === 'comprehension') {
      dataUpdate.comprehension = char.comprehension + 1;
    } else {
      throw new Error('Chỉ số cộng điểm không hợp lệ.');
    }

    const updated = await prisma.xianxiaCharacter.update({
      where: { id: char.id },
      data: dataUpdate,
    });

    return {
      success: true,
      physique: updated.physique,
      comprehension: updated.comprehension,
      stat_points: updated.stat_points,
    };
  }

  /**
   * Xung Quan Đột Phá Cảnh Giới Authoritative (Server-side Breakthrough)
   */
  public async breakthroughRealm(
    userId: number,
    supportPillId?: string,
    forcedSuccess?: boolean
  ) {
    const realmConfigs: Record<
      string,
      {
        nextRealm: string;
        title: string;
        cultivationRequired: number;
        nextCultivationRequired: number;
        minHp: number;
        minFatigue: number;
        baseRate: number;
      }
    > = {
      PHAM_NHAN: {
        nextRealm: 'LUYEN_KHI_1',
        title: 'Luyện Khí Tầng 1',
        cultivationRequired: 180,
        nextCultivationRequired: 280,
        minHp: 140,
        minFatigue: 110,
        baseRate: 90,
      },
      LUYEN_KHI_1: {
        nextRealm: 'LUYEN_KHI_2',
        title: 'Luyện Khí Tầng 2',
        cultivationRequired: 280,
        nextCultivationRequired: 400,
        minHp: 170,
        minFatigue: 120,
        baseRate: 85,
      },
      LUYEN_KHI_2: {
        nextRealm: 'LUYEN_KHI_3',
        title: 'Luyện Khí Tầng 3',
        cultivationRequired: 400,
        nextCultivationRequired: 550,
        minHp: 210,
        minFatigue: 130,
        baseRate: 80,
      },
      LUYEN_KHI_3: {
        nextRealm: 'LUYEN_KHI_4',
        title: 'Luyện Khí Tầng 4',
        cultivationRequired: 550,
        nextCultivationRequired: 750,
        minHp: 260,
        minFatigue: 140,
        baseRate: 75,
      },
      LUYEN_KHI_4: {
        nextRealm: 'LUYEN_KHI_5',
        title: 'Luyện Khí Tầng 5',
        cultivationRequired: 750,
        nextCultivationRequired: 1000,
        minHp: 320,
        minFatigue: 150,
        baseRate: 70,
      },
      LUYEN_KHI_5: {
        nextRealm: 'LUYEN_KHI_6',
        title: 'Luyện Khí Tầng 6',
        cultivationRequired: 1000,
        nextCultivationRequired: 1350,
        minHp: 390,
        minFatigue: 160,
        baseRate: 65,
      },
      LUYEN_KHI_6: {
        nextRealm: 'LUYEN_KHI_7',
        title: 'Luyện Khí Tầng 7',
        cultivationRequired: 1350,
        nextCultivationRequired: 1800,
        minHp: 470,
        minFatigue: 170,
        baseRate: 60,
      },
      LUYEN_KHI_7: {
        nextRealm: 'LUYEN_KHI_8',
        title: 'Luyện Khí Tầng 8',
        cultivationRequired: 1800,
        nextCultivationRequired: 2400,
        minHp: 560,
        minFatigue: 180,
        baseRate: 55,
      },
      LUYEN_KHI_8: {
        nextRealm: 'LUYEN_KHI_9',
        title: 'Luyện Khí Tầng 9',
        cultivationRequired: 2400,
        nextCultivationRequired: 3500,
        minHp: 660,
        minFatigue: 190,
        baseRate: 50,
      },
      LUYEN_KHI_9: {
        nextRealm: 'TRUC_CO_SO_KY',
        title: 'Trúc Cơ Sơ Kỳ',
        cultivationRequired: 3500,
        nextCultivationRequired: 5000,
        minHp: 850,
        minFatigue: 220,
        baseRate: 40,
      },
    };

    return await prisma.$transaction(async tx => {
      // Khóa bi quan hàng nhân vật để ngăn chặn xung quan đồng thời
      await tx.$queryRawUnsafe(
        'SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE',
        userId
      );

      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      const config = realmConfigs[char.realm];
      if (!config) {
        throw new Error(
          `Đạo hữu đã đạt cảnh giới tối cao trong phiên bản hiện tại (${char.realm})!`
        );
      }

      if (char.cultivation < config.cultivationRequired) {
        throw new Error(
          `Chưa đủ tu vi để xung quan (${char.cultivation}/${config.cultivationRequired})!`
        );
      }

      let bonusRate = 0;
      let hasProtection = false;
      let usedPillName: string | null = null;

      if (supportPillId) {
        const slot = await tx.xianxiaInventoryItem.findUnique({
          where: {
            character_id_item_id: {
              character_id: char.id,
              item_id: supportPillId,
            },
          },
        });

        if (!slot || slot.quantity < 1) {
          throw new Error('Đan dược hỗ trợ đột phá không có trong túi đồ!');
        }

        if (supportPillId === 'item_cuc_pham_truc_co_dan') {
          bonusRate = 55;
          hasProtection = true;
          usedPillName = 'Cực Phẩm Trúc Cơ Đan';
        } else if (supportPillId === 'item_truc_co_dan') {
          bonusRate = 35;
          hasProtection = true;
          usedPillName = 'Trúc Cơ Đan';
        } else if (supportPillId === 'item_duong_khi_dan') {
          bonusRate = 15;
          usedPillName = 'Dưỡng Khí Đan';
        }

        // Khấu trừ 1 viên đan dược
        if (slot.quantity === 1) {
          await tx.xianxiaInventoryItem.delete({
            where: { id: slot.id },
          });
        } else {
          await tx.xianxiaInventoryItem.update({
            where: { id: slot.id },
            data: { quantity: slot.quantity - 1 },
          });
        }
      }

      const totalRate = Math.min(99, config.baseRate + bonusRate);
      const isSuccess =
        forcedSuccess !== undefined
          ? forcedSuccess
          : Math.random() * 100 <= totalRate;

      let message = '';

      if (isSuccess) {
        char.realm = config.nextRealm;
        char.cultivation = Math.max(0, char.cultivation - config.cultivationRequired);
        char.cultivation_required = config.nextCultivationRequired;
        char.max_health = Math.max(char.max_health + 20, config.minHp);
        char.health = char.max_health;
        char.max_fatigue = Math.max(char.max_fatigue + 10, config.minFatigue);
        char.fatigue = char.max_fatigue;
        char.stat_points += 4;

        message = `⚡ [Xung Quan Thành Công] Thiên địa linh khí cuồn cuộn đổ vào đan điền! Ngươi đã đột phá thành công lên [${config.title}], nhận +4 Điểm Tiềm Năng!`;
      } else {
        char.cultivation = Math.floor(char.cultivation * 0.7);

        if (!hasProtection) {
          char.health = Math.max(20, char.health - 30);
          message = `💥 [Xung Quan Thất Bại] Linh khí nghịch loạn! Mất 30% tu vi và bị phản phệ tổn thương 30 Khí Huyết!`;
        } else {
          message = `🛡️ [Xung Quan Thất Bại] Đột phá không thành, mất 30% tu vi. Nhờ có [${usedPillName}] bảo hộ, ngươi hoàn toàn miễn trừ phản phệ thương tích!`;
        }
      }

      const updated = await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: {
          realm: char.realm,
          cultivation: char.cultivation,
          cultivation_required: char.cultivation_required,
          health: char.health,
          max_health: char.max_health,
          fatigue: char.fatigue,
          max_fatigue: char.max_fatigue,
          stat_points: char.stat_points,
        },
      });

      return {
        success: isSuccess,
        realm: updated.realm,
        cultivation: updated.cultivation,
        cultivation_required: updated.cultivation_required,
        health: updated.health,
        max_health: updated.max_health,
        fatigue: updated.fatigue,
        max_fatigue: updated.max_fatigue,
        stat_points: updated.stat_points,
        usedPill: usedPillName,
        message,
      };
    });
  }
}

export const xianxiaCharacterService = new XianxiaCharacterService();
