import { prisma } from '../../utils/prisma.js';
import { XianxiaBestiaryService } from './xianxiaBestiaryService.js';
import { xianxiaCharacterService } from './xianxiaCharacterService.js';
import { xianxiaQuestService } from './xianxiaQuestService.js';
import { DroppedItem, Monster } from '../../types/xianxia.js';

export interface CombatPlaybackTurn {
  turn: number;
  actor: 'PLAYER' | 'MONSTER';
  action: string;
  damage: number;
  isCrit: boolean;
  playerHp: number;
  monsterHp: number;
  playerQi: number;
  log: string;
}

export interface BattleResolutionResult {
  battleId: string;
  idempotent: boolean;
  result: 'WIN' | 'LOSE' | 'STALEMATE_ADVANTAGE' | 'STALEMATE_RETREAT';
  turnsCount: number;
  damageDealt: number;
  monster: {
    id: string;
    name: string;
    maxHealth: number;
  };
  rewards: {
    exp: number;
    cultivation: number;
    silver: number;
    items: DroppedItem[];
    levelsGained: number;
    silverConvertedFromMaxLevel: number;
  };
  playerStateAfterBattle: {
    level: number;
    exp: number;
    expRequired: number;
    health: number;
    maxHealth: number;
    fatigue: number;
    maxFatigue: number;
    silver: number;
    cultivation: number;
    placeId: string;
  };
  combatLogs: string[];
  playbackTurns: CombatPlaybackTurn[];
}

export class XianxiaCombatService {
  private bestiaryService: XianxiaBestiaryService;

  constructor() {
    this.bestiaryService = new XianxiaBestiaryService();
  }

  /**
   * Khởi động và giải quyết toàn bộ trận đấu tự động trên máy chủ (Authoritative Combat Engine)
   */
  public async simulateAndResolveBattle(
    userId: number,
    monsterId: string,
    idempotencyKey?: string
  ): Promise<BattleResolutionResult> {
    // 1. Kiểm tra Idempotency để chặn lặp request (Retry / Concurrency duplicate)
    if (idempotencyKey) {
      const existingLog = await prisma.xianxiaBattleLog.findUnique({
        where: { idempotency_key: idempotencyKey },
        include: { character: true },
      });

      if (existingLog) {
        const parsedItems: DroppedItem[] = existingLog.items_gained ? JSON.parse(existingLog.items_gained) : [];
        const parsedLogs: string[] = existingLog.combat_log ? JSON.parse(existingLog.combat_log) : [];
        const char = existingLog.character;

        return {
          battleId: existingLog.id,
          idempotent: true,
          result: existingLog.result as any,
          turnsCount: existingLog.turns_count,
          damageDealt: existingLog.damage_dealt,
          monster: {
            id: existingLog.monster_id,
            name: existingLog.monster_name,
            maxHealth: 100,
          },
          rewards: {
            exp: existingLog.exp_gained,
            cultivation: existingLog.cultivation_gained,
            silver: existingLog.silver_gained,
            items: parsedItems,
            levelsGained: 0,
            silverConvertedFromMaxLevel: 0,
          },
          playerStateAfterBattle: {
            level: char.level,
            exp: char.exp,
            expRequired: char.exp_required,
            health: char.health,
            maxHealth: char.max_health,
            fatigue: char.fatigue,
            maxFatigue: char.max_fatigue,
            silver: char.silver,
            cultivation: char.cultivation,
            placeId: char.current_place,
          },
          combatLogs: parsedLogs,
          playbackTurns: [],
        };
      }
    }

    // 2. Lấy quái vật hợp lệ
    const monster = this.bestiaryService.getMonsterById(monsterId);
    if (!monster) {
      throw new Error(`Yêu thú mang mã [${monsterId}] không tồn tại.`);
    }

    // 3. Thực thi giải quyết trận đấu trong Transaction an toàn
    try {
      return await prisma.$transaction(async (tx) => {
        // Row-level locking to prevent concurrent battle executions and race conditions
        await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE', userId);

        const char = await tx.xianxiaCharacter.findUnique({
          where: { user_id: userId },
        });
        if (!char) throw new Error('Không tìm thấy nhân vật.');

        if (char.fatigue < 10) {
          throw new Error('Thể lực quá thấp để giao chiến (cần tối thiểu 10 thể lực).');
        }

        // Khấu trừ 10 thể lực nhập trận
        char.fatigue -= 10;

      // Tính toán chỉ số thực tế
      const stats = xianxiaCharacterService.calculateEffectiveStats(char);

      let playerHp = char.health;
      let monsterHp = monster.max_health;
      let playerQi = 25; // Chân khí khởi đầu trận
      let totalDamageDealt = 0;
      let turnsCount = 0;
      const maxTurns = 30;

      const combatLogs: string[] = [];
      const playbackTurns: CombatPlaybackTurn[] = [];

      combatLogs.push(`⚔️ Ngươi rút binh khí đối diện [${monster.name}], trận chiến bắt đầu!`);

      let battleResult: 'WIN' | 'LOSE' | 'STALEMATE_ADVANTAGE' | 'STALEMATE_RETREAT' = 'STALEMATE_RETREAT';

      // 4. Vòng lặp kịch chiến 30 hiệp
      for (let turn = 1; turn <= maxTurns; turn++) {
        turnsCount = turn;
        const playerFirst = stats.speed >= monster.speed;

        // Hành động của Người chơi
        const runPlayerAct = () => {
          if (monsterHp <= 0) return;

          let damage = 0;
          let isCrit = false;
          let actionName = 'Trảm Kích';

          // Tự động thi triển Thần Thông khi đủ Qi
          if (playerQi >= 15) {
            actionName = 'Thần Thông Lôi Hỏa';
            playerQi -= 15;
            const baseDmg = Math.floor(stats.attack * 1.6);
            damage = Math.max(8, baseDmg - Math.floor(monster.defense * 0.4));
          } else {
            actionName = 'Trảm Kích';
            playerQi = Math.min(stats.max_qi, playerQi + 8);
            damage = Math.max(3, stats.attack - Math.floor(monster.defense * 0.7));
          }

          // Kiểm tra bạo kích
          if (Math.random() < stats.crit_rate) {
            isCrit = true;
            damage = Math.floor(damage * 1.6);
          }

          // Biến thiên nhẹ 10%
          const variance = 0.9 + Math.random() * 0.2;
          damage = Math.max(2, Math.floor(damage * variance));

          monsterHp = Math.max(0, monsterHp - damage);
          totalDamageDealt += damage;

          const logMsg = `Hiệp ${turn}: Ngươi thi triển [${actionName}], gây ${damage} sát thương ${isCrit ? '💥 (BẠO KÍCH!)' : ''}. [${monster.name}] còn ${monsterHp}/${monster.max_health} HP.`;
          combatLogs.push(logMsg);

          playbackTurns.push({
            turn,
            actor: 'PLAYER',
            action: actionName,
            damage,
            isCrit,
            playerHp,
            monsterHp,
            playerQi,
            log: logMsg,
          });
        };

        // Hành động của Quái vật
        const runMonsterAct = () => {
          if (playerHp <= 0 || monsterHp <= 0) return;

          // Kiểm tra né đòn
          if (Math.random() < stats.dodge_rate) {
            const dodgeMsg = `Hiệp ${turn}: [${monster.name}] vung trảo vồ tới nhưng ngươi đã nhanh nhẹn lách người né tránh! 💨`;
            combatLogs.push(dodgeMsg);
            playbackTurns.push({
              turn,
              actor: 'MONSTER',
              action: 'Né đòn',
              damage: 0,
              isCrit: false,
              playerHp,
              monsterHp,
              playerQi,
              log: dodgeMsg,
            });
            return;
          }

          let mDmg = Math.max(2, monster.attack - Math.floor(stats.defense * 0.6));
          let mCrit = false;
          if (Math.random() < monster.crit_rate) {
            mCrit = true;
            mDmg = Math.floor(mDmg * 1.5);
          }

          const variance = 0.9 + Math.random() * 0.2;
          mDmg = Math.max(2, Math.floor(mDmg * variance));

          playerHp = Math.max(0, playerHp - mDmg);

          const monLog = `Hiệp ${turn}: [${monster.name}] tung đòn mãnh liệt, gây ${mDmg} sát thương ${mCrit ? '🩸 (BẠO KÍCH!)' : ''}. Ngươi còn ${playerHp}/${stats.max_health} HP.`;
          combatLogs.push(monLog);

          playbackTurns.push({
            turn,
            actor: 'MONSTER',
            action: 'Mãnh thú tập kích',
            damage: mDmg,
            isCrit: mCrit,
            playerHp,
            monsterHp,
            playerQi,
            log: monLog,
          });
        };

        // Thứ tự xuất chiêu theo Thân Pháp
        if (playerFirst) {
          runPlayerAct();
          if (monsterHp <= 0) {
            battleResult = 'WIN';
            break;
          }
          runMonsterAct();
          if (playerHp <= 0) {
            battleResult = 'LOSE';
            break;
          }
        } else {
          runMonsterAct();
          if (playerHp <= 0) {
            battleResult = 'LOSE';
            break;
          }
          runPlayerAct();
          if (monsterHp <= 0) {
            battleResult = 'WIN';
            break;
          }
        }
      }

      // Xử lý sau khi hết 30 hiệp
      if (monsterHp > 0 && playerHp > 0) {
        const playerHpRatio = playerHp / stats.max_health;
        const monsterHpRatio = monsterHp / monster.max_health;
        const damageRatio = totalDamageDealt / monster.max_health;

        if (playerHpRatio > monsterHpRatio && damageRatio >= 0.4) {
          battleResult = 'STALEMATE_ADVANTAGE';
          combatLogs.push(`🛑 Hết 30 hiệp! Ngươi chiếm ưu thế toàn diện và gây trên 40% sát thương, yêu thú tháo chạy.`);
        } else {
          battleResult = 'STALEMATE_RETREAT';
          combatLogs.push(`🛑 Hết 30 hiệp! Không thể công phá hộ giáp yêu thú, ngươi khinh công an toàn rút lui.`);
        }
      }

      // 5. Tính toán phần thưởng & Hình phạt
      let expGained = 0;
      let cultGained = 0;
      let silverGained = 0;
      const droppedItems: DroppedItem[] = [];

      let levelsGained = 0;
      let silverConverted = 0;

      if (battleResult === 'WIN') {
        combatLogs.push(`🏆 Ngươi đã đánh bại [${monster.name}]!`);
        expGained = monster.exp_reward;
        cultGained = char.linh_can === 'THIEN_LINH_CAN'
          ? Math.floor(monster.cultivation_reward * 1.3)
          : monster.cultivation_reward;

        const sMin = monster.silver_reward_min || 0;
        const sMax = monster.silver_reward_max || sMin;
        silverGained = sMin + Math.floor(Math.random() * (sMax - sMin + 1));

        // Rơi đồ
        if (monster.loot_table) {
          for (const drop of monster.loot_table) {
            const chance = (drop as any).chance !== undefined ? (drop as any).chance : (drop as any).drop_rate;
            if (Math.random() <= (chance || 0)) {
              const qty = Math.floor(drop.min_quantity + Math.random() * (drop.max_quantity - drop.min_quantity + 1));
              if (qty > 0) {
                droppedItems.push({
                  item_id: drop.item_id,
                  item_name: drop.item_name,
                  quantity: qty,
                });
              }
            }
          }
        }

        // Tăng EXP nhân vật
        const expRes = xianxiaCharacterService.applyExpGain(char, expGained);
        levelsGained = expRes.levelsGained;
        silverConverted = expRes.silverConverted;

        // Cộng Tu Vi & Bạc
        char.cultivation += cultGained;
        char.silver += silverGained;
        char.health = playerHp;

        // Lưu vật phẩm rơi vào túi đồ
        for (const item of droppedItems) {
          await tx.xianxiaInventoryItem.upsert({
            where: {
              character_id_item_id: {
                character_id: char.id,
                item_id: item.item_id,
              },
            },
            update: { quantity: { increment: item.quantity } },
            create: {
              character_id: char.id,
              item_id: item.item_id,
              quantity: item.quantity,
            },
          });
        }

        // Cập nhật tiến độ nhiệm vụ diệt quái và nhặt đồ trong DB (Mục 3)
        await xianxiaQuestService.recordMonsterKillDb(char.id, monster.id, 1, tx);
        for (const item of droppedItems) {
          await xianxiaQuestService.recordLootAcquiredDb(char.id, item.item_id, item.quantity, tx);
        }
      } else if (battleResult === 'STALEMATE_ADVANTAGE') {
        // Nhận 50% EXP & Tu Vi
        expGained = Math.floor(monster.exp_reward * 0.5);
        cultGained = Math.floor((monster.cultivation_reward * 0.5) * (char.linh_can === 'THIEN_LINH_CAN' ? 1.3 : 1));

        const expRes = xianxiaCharacterService.applyExpGain(char, expGained);
        levelsGained = expRes.levelsGained;
        silverConverted = expRes.silverConverted;

        char.cultivation += cultGained;
        char.health = playerHp;
      } else if (battleResult === 'STALEMATE_RETREAT') {
        // Rút lui an toàn, giữ nguyên HP
        char.health = playerHp;
      } else if (battleResult === 'LOSE') {
        // Hình phạt chuẩn xác: HP về 20, trừ thêm 5 thể lực (tổng 15), về Động Phủ
        char.health = 20;
        char.fatigue = Math.max(0, char.fatigue - 5);
        char.current_place = 'place_dong_phu_tan_tu';
        combatLogs.push(`💀 Ngươi trọng thương ngã gục, được sơn dân khiêng về Động Phủ Tán Tu tịnh dưỡng.`);
      }

      // Cập nhật nhân vật vào cơ sở dữ liệu
      const updatedChar = await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: {
          level: char.level,
          exp: char.exp,
          exp_required: char.exp_required,
          health: char.health,
          max_health: char.max_health,
          fatigue: char.fatigue,
          max_fatigue: char.max_fatigue,
          silver: char.silver,
          cultivation: char.cultivation,
          stat_points: char.stat_points,
          current_place: char.current_place,
        },
      });

      // Lưu nhật ký chiến đấu vào bảng xianxia_battle_logs
      const battleLogRecord = await tx.xianxiaBattleLog.create({
        data: {
          character_id: char.id,
          idempotency_key: idempotencyKey || null,
          monster_id: monster.id,
          monster_name: monster.name,
          result: battleResult,
          turns_count: turnsCount,
          exp_gained: expGained,
          cultivation_gained: cultGained,
          silver_gained: silverGained,
          damage_dealt: totalDamageDealt,
          items_gained: droppedItems.length > 0 ? JSON.stringify(droppedItems) : null,
          combat_log: JSON.stringify(combatLogs),
        },
      });

      return {
        battleId: battleLogRecord.id,
        idempotent: false,
        result: battleResult,
        turnsCount,
        damageDealt: totalDamageDealt,
        monster: {
          id: monster.id,
          name: monster.name,
          maxHealth: monster.max_health,
        },
        rewards: {
          exp: expGained,
          cultivation: cultGained,
          silver: silverGained,
          items: droppedItems,
          levelsGained,
          silverConvertedFromMaxLevel: silverConverted,
        },
        playerStateAfterBattle: {
          level: updatedChar.level,
          exp: updatedChar.exp,
          expRequired: updatedChar.exp_required,
          health: updatedChar.health,
          maxHealth: updatedChar.max_health,
          fatigue: updatedChar.fatigue,
          maxFatigue: updatedChar.max_fatigue,
          silver: updatedChar.silver,
          cultivation: updatedChar.cultivation,
          placeId: updatedChar.current_place,
        },
        combatLogs,
        playbackTurns,
      };
    });
    } catch (err: any) {
      if (idempotencyKey && (err.code === 'P2002' || err.message?.includes('Unique constraint'))) {
        const existingLog = await prisma.xianxiaBattleLog.findUnique({
          where: { idempotency_key: idempotencyKey },
          include: { character: true },
        });

        if (existingLog) {
          const parsedItems: DroppedItem[] = existingLog.items_gained ? JSON.parse(existingLog.items_gained) : [];
          const parsedLogs: string[] = existingLog.combat_log ? JSON.parse(existingLog.combat_log) : [];
          const char = existingLog.character;

          return {
            battleId: existingLog.id,
            idempotent: true,
            result: existingLog.result as any,
            turnsCount: existingLog.turns_count,
            damageDealt: existingLog.damage_dealt,
            monster: {
              id: existingLog.monster_id,
              name: existingLog.monster_name,
              maxHealth: 100,
            },
            rewards: {
              exp: existingLog.exp_gained,
              cultivation: existingLog.cultivation_gained,
              silver: existingLog.silver_gained,
              items: parsedItems,
              levelsGained: 0,
              silverConvertedFromMaxLevel: 0,
            },
            playerStateAfterBattle: {
              level: char.level,
              exp: char.exp,
              expRequired: char.exp_required,
              health: char.health,
              maxHealth: char.max_health,
              fatigue: char.fatigue,
              maxFatigue: char.max_fatigue,
              silver: char.silver,
              cultivation: char.cultivation,
              placeId: char.current_place,
            },
            combatLogs: parsedLogs,
            playbackTurns: [],
          };
        }
      }
      throw err;
    }
  }

  /**
   * Lấy lịch sử chiến đấu của riêng người chơi (Battle Logs)
   */
  public async getCharacterBattleLogs(userId: number, limit: number = 20) {
    const char = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!char) throw new Error('Không tìm thấy nhân vật.');

    const logs = await prisma.xianxiaBattleLog.findMany({
      where: { character_id: char.id },
      orderBy: { created_at: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });

    return logs.map(l => ({
      id: l.id,
      monsterId: l.monster_id,
      monsterName: l.monster_name,
      result: l.result,
      turnsCount: l.turns_count,
      expGained: l.exp_gained,
      cultivationGained: l.cultivation_gained,
      silverGained: l.silver_gained,
      damageDealt: l.damage_dealt,
      itemsGained: l.items_gained ? JSON.parse(l.items_gained) : [],
      combatLogs: l.combat_log ? JSON.parse(l.combat_log) : [],
      createdAt: l.created_at,
    }));
  }
}

export const xianxiaCombatService = new XianxiaCombatService();
