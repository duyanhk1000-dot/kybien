import { prisma } from '../../utils/prisma.js';
import {
  DefenderSnapshot,
  PvpOpponent,
  PvpPlaybackTurn,
  PvpChallengeResult,
  PvpHistoryItem,
  PvpLeaderboardEntry,
} from '../../types/xianxia.js';
import {
  xianxiaCharacterService,
  EffectiveCombatStats,
} from './xianxiaCharacterService.js';
import {
  xianxiaLeaderboardService,
  REALM_TITLES,
} from './xianxiaLeaderboardService.js';

/**
 * Tính thời điểm bắt đầu ngày (00:00:00) theo múi giờ Việt Nam (UTC+7 / ICT)
 */
export function getStartOfDayInVietnam(date: Date = new Date()): Date {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = vnTime.getUTCFullYear();
  const month = vnTime.getUTCMonth();
  const day = vnTime.getUTCDate();
  return new Date(Date.UTC(year, month, day) - 7 * 60 * 60 * 1000);
}

export class XianxiaPvpService {
  /**
   * Lấy danh sách đối thủ phù hợp trên lôi đài để khiêu chiến
   */
  public async getOpponents(userId: number, limit = 8): Promise<PvpOpponent[]> {
    const playerChar = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!playerChar) {
      throw new Error('Vui lòng tạo nhân vật Tiên Lộ trước khi tham gia Đấu Trường.');
    }

    // 1. Tìm các nhân vật khác trong hệ thống (loại trừ chính mình)
    const rawOpponents = await prisma.xianxiaCharacter.findMany({
      where: {
        id: { not: playerChar.id },
      },
      orderBy: [
        { reputation: 'desc' },
        { level: 'desc' },
        { id: 'asc' },
      ],
      take: Math.min(50, limit * 3), // Lấy dôi ra để lọc đa dạng
    });

    if (rawOpponents.length === 0) {
      return [];
    }

    // 2. Chuyển đổi sang PvpOpponent kèm tính Chiến Lực
    const opponents: PvpOpponent[] = rawOpponents.map((char) => {
      const realmTitle = REALM_TITLES[char.realm] || char.realm;
      const combatPower = xianxiaLeaderboardService.calcCombatPower(char);

      return {
        id: char.id,
        name: char.name,
        realm: char.realm,
        realmTitle,
        level: char.level,
        reputation: char.reputation,
        combatPower,
        maxHealth: char.max_health,
        pvpWins: char.pvp_wins,
        pvpLosses: char.pvp_losses,
        pvpDraws: char.pvp_draws,
      };
    });

    // 3. Ưu tiên các đối thủ có cấp độ hoặc cảnh giới tương đương
    opponents.sort((a, b) => {
      const diffA = Math.abs(a.level - playerChar.level);
      const diffB = Math.abs(b.level - playerChar.level);
      return diffA - diffB;
    });

    return opponents.slice(0, limit);
  }

  /**
   * Mô phỏng chiến đấu PvP 30 hiệp chuẩn mực phía máy chủ (Server-Authoritative Combat)
   */
  public simulatePvpCombat(
    attackerName: string,
    attackerStats: EffectiveCombatStats,
    defender: DefenderSnapshot
  ): {
    result: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'DRAW_ADVANTAGE' | 'DRAW_TIMEOUT';
    turnsCount: number;
    combatLogs: string[];
    playbackTurns: PvpPlaybackTurn[];
  } {
    let attackerHp = attackerStats.max_health;
    let defenderHp = defender.maxHealth;
    let attackerQi = 25;
    let defenderQi = 25;
    let turnsCount = 0;
    const maxTurns = 30;

    const combatLogs: string[] = [];
    const playbackTurns: PvpPlaybackTurn[] = [];

    combatLogs.push(
      `⚡ [Lôi Đài Khai Mạc] ${attackerName} tiến lên đài khiêu chiến ${defender.name}! Tiếng chuông lệnh vang dội.`
    );

    let result: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'DRAW_ADVANTAGE' | 'DRAW_TIMEOUT' =
      'DRAW_TIMEOUT';

    for (let turn = 1; turn <= maxTurns; turn++) {
      turnsCount = turn;
      const attackerFirst = attackerStats.speed >= defender.speed;

      // 1. Hành động của Attacker
      const runAttackerAction = () => {
        if (defenderHp <= 0) return;

        // Kiểm tra Defender né đòn
        if (Math.random() < defender.dodgeRate) {
          const dodgeMsg = `Hiệp ${turn}: ${attackerName} xuất chiêu nhưng ${defender.name} nhanh nhẹn lách người né tránh! 💨`;
          combatLogs.push(dodgeMsg);
          playbackTurns.push({
            turn,
            actor: 'ATTACKER',
            action: 'Né đòn',
            damage: 0,
            isCrit: false,
            isDodge: true,
            attackerHp,
            defenderHp,
            attackerQi,
            defenderQi,
            log: dodgeMsg,
          });
          return;
        }

        let damage = 0;
        let isCrit = false;
        let actionName = 'Trảm Kích';

        if (attackerQi >= 15) {
          actionName = 'Thần Thông Lôi Hỏa';
          attackerQi -= 15;
          const baseDmg = Math.floor(attackerStats.attack * 1.6);
          damage = Math.max(8, baseDmg - Math.floor(defender.defense * 0.4));
        } else {
          actionName = 'Trảm Kích';
          attackerQi = Math.min(attackerStats.max_qi, attackerQi + 8);
          damage = Math.max(3, attackerStats.attack - Math.floor(defender.defense * 0.7));
        }

        if (Math.random() < attackerStats.crit_rate) {
          isCrit = true;
          damage = Math.floor(damage * 1.5);
        }

        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(2, Math.floor(damage * variance));

        defenderHp = Math.max(0, defenderHp - damage);

        const logMsg = `Hiệp ${turn}: ${attackerName} thi triển [${actionName}], gây ${damage} sát thương ${
          isCrit ? '💥 (BẠO KÍCH!)' : ''
        }. ${defender.name} còn ${defenderHp}/${defender.maxHealth} HP.`;
        combatLogs.push(logMsg);

        playbackTurns.push({
          turn,
          actor: 'ATTACKER',
          action: actionName,
          damage,
          isCrit,
          isDodge: false,
          attackerHp,
          defenderHp,
          attackerQi,
          defenderQi,
          log: logMsg,
        });
      };

      // 2. Hành động của Defender
      const runDefenderAction = () => {
        if (attackerHp <= 0 || defenderHp <= 0) return;

        // Kiểm tra Attacker né đòn
        if (Math.random() < attackerStats.dodge_rate) {
          const dodgeMsg = `Hiệp ${turn}: ${defender.name} phản kích hung hiểm nhưng ${attackerName} khéo léo né đòn! 💨`;
          combatLogs.push(dodgeMsg);
          playbackTurns.push({
            turn,
            actor: 'DEFENDER',
            action: 'Né đòn',
            damage: 0,
            isCrit: false,
            isDodge: true,
            attackerHp,
            defenderHp,
            attackerQi,
            defenderQi,
            log: dodgeMsg,
          });
          return;
        }

        let damage = 0;
        let isCrit = false;
        let actionName = 'Trảm Kích';

        if (defenderQi >= 15) {
          actionName = 'Thần Thông Lôi Hỏa';
          defenderQi -= 15;
          const baseDmg = Math.floor(defender.attack * 1.6);
          damage = Math.max(8, baseDmg - Math.floor(attackerStats.defense * 0.4));
        } else {
          actionName = 'Trảm Kích';
          defenderQi = Math.min(defender.maxQi, defenderQi + 8);
          damage = Math.max(3, defender.attack - Math.floor(attackerStats.defense * 0.7));
        }

        if (Math.random() < defender.critRate) {
          isCrit = true;
          damage = Math.floor(damage * 1.5);
        }

        const variance = 0.9 + Math.random() * 0.2;
        damage = Math.max(2, Math.floor(damage * variance));

        attackerHp = Math.max(0, attackerHp - damage);

        const logMsg = `Hiệp ${turn}: ${defender.name} phản kích bằng [${actionName}], gây ${damage} sát thương ${
          isCrit ? '🩸 (BẠO KÍCH!)' : ''
        }. ${attackerName} còn ${attackerHp}/${attackerStats.max_health} HP.`;
        combatLogs.push(logMsg);

        playbackTurns.push({
          turn,
          actor: 'DEFENDER',
          action: actionName,
          damage,
          isCrit,
          isDodge: false,
          attackerHp,
          defenderHp,
          attackerQi,
          defenderQi,
          log: logMsg,
        });
      };

      // Xuất chiêu theo thứ tự Thân Pháp
      if (attackerFirst) {
        runAttackerAction();
        if (defenderHp <= 0) {
          result = 'ATTACKER_WIN';
          combatLogs.push(`🏆 [Đại Thắng] ${defender.name} kiệt sức chịu thua! ${attackerName} giành chiến thắng thuyết phục.`);
          break;
        }
        runDefenderAction();
        if (attackerHp <= 0) {
          result = 'DEFENDER_WIN';
          combatLogs.push(`💀 [Chiến Bại] ${attackerName} bất địch ngã xuống, ${defender.name} bảo vệ thành công vị trí lôi đài.`);
          break;
        }
      } else {
        runDefenderAction();
        if (attackerHp <= 0) {
          result = 'DEFENDER_WIN';
          combatLogs.push(`💀 [Chiến Bại] ${attackerName} bất địch ngã xuống, ${defender.name} bảo vệ thành công vị trí lôi đài.`);
          break;
        }
        runAttackerAction();
        if (defenderHp <= 0) {
          result = 'ATTACKER_WIN';
          combatLogs.push(`🏆 [Đại Thắng] ${defender.name} kiệt sức chịu thua! ${attackerName} giành chiến thắng thuyết phục.`);
          break;
        }
      }
    }

    // Xử lý sau 30 hiệp
    if (attackerHp > 0 && defenderHp > 0) {
      const attMax = attackerStats.max_health > 0 ? attackerStats.max_health : 1;
      const defMax = defender.maxHealth > 0 ? defender.maxHealth : 1;
      const attRatio = attackerHp / attMax;
      const defRatio = defenderHp / defMax;

      if (attRatio > defRatio) {
        result = 'DRAW_ADVANTAGE';
        combatLogs.push(
          `🛑 Hết 30 hiệp! Cả hai bên đều bất phân thắng bại, nhưng ${attackerName} (%HP: ${Math.round(
            attRatio * 100
          )}%) chiếm ưu thế hơn ${defender.name} (%HP: ${Math.round(defRatio * 100)}%). Trọng tài tuyên phán Thượng Phong!`
        );
      } else {
        result = 'DRAW_TIMEOUT';
        combatLogs.push(
          `🛑 Hết 30 hiệp! Hộ giáp và phòng tuyến của ${defender.name} quá kiên cố, trận đấu kết thúc Hòa!`
        );
      }
    }

    return {
      result,
      turnsCount,
      combatLogs,
      playbackTurns,
    };
  }

  /**
   * Tạo scoped idempotency key theo từng người dùng để chống đụng độ chéo giữa người chơi
   */
  public getScopedIdempotencyKey(userId: number, rawKey?: string): string | null {
    if (!rawKey || typeof rawKey !== 'string') return null;
    const cleanKey = rawKey.trim();
    if (!cleanKey) return null;
    if (cleanKey.length > 64) {
      throw new Error('Mã Idempotency key quá dài (tối đa 64 ký tự).');
    }
    return `pvp:u${userId}:${cleanKey}`;
  }

  /**
   * Định dạng kết quả replay trận đấu từ bản ghi đã lưu trữ
   */
  private formatExistingMatchResult(
    existingMatch: any,
    customDailyMatches = 1
  ): PvpChallengeResult {
    const snapshot: DefenderSnapshot = JSON.parse(existingMatch.defender_snapshot);
    const combatLogs: string[] = JSON.parse(existingMatch.combat_log);
    const playbackTurns: PvpPlaybackTurn[] = JSON.parse(existingMatch.playback_turns);

    return {
      matchId: existingMatch.id,
      idempotent: true,
      result: existingMatch.result as any,
      turnsCount: existingMatch.turns_count,
      reputationChange: existingMatch.reputation_change,
      attackerReputationAfter: existingMatch.attacker_reputation_after,
      silverReward: existingMatch.silver_reward,
      dailyMatchesWithOpponent: customDailyMatches,
      defender: {
        id: snapshot.characterId,
        name: snapshot.name,
        realmTitle: snapshot.realmTitle,
        level: snapshot.level,
        combatPower: snapshot.combatPower,
      },
      attackerStateAfterBattle: {
        health: existingMatch.attacker.health,
        maxHealth: existingMatch.attacker.max_health,
        fatigue: existingMatch.attacker.fatigue,
        maxFatigue: existingMatch.attacker.max_fatigue,
        silver: existingMatch.attacker.silver,
        reputation: existingMatch.attacker.reputation,
        pvpWins: existingMatch.attacker.pvp_wins,
        pvpLosses: existingMatch.attacker.pvp_losses,
        pvpDraws: existingMatch.attacker.pvp_draws,
      },
      combatLogs,
      playbackTurns,
    };
  }

  /**
   * Tạo trận đấu PvP và giải quyết nguyên tử trên Database (Authoritative Asynchronous PvP)
   */
  public async challengeOpponent(
    userId: number,
    defenderId: number,
    idempotencyKey?: string,
    currentTime: Date = new Date()
  ): Promise<PvpChallengeResult> {
    const scopedKey = this.getScopedIdempotencyKey(userId, idempotencyKey);

    // 1. Kiểm tra Idempotency trước transaction (Optimistic fast-path)
    if (scopedKey) {
      const existingMatch = await prisma.xianxiaPvpMatch.findUnique({
        where: { idempotency_key: scopedKey },
        include: {
          attacker: true,
          defender: true,
        },
      });

      if (existingMatch) {
        // Kiểm tra Payload mismatch: defenderId và attacker user_id phải khớp hoàn toàn
        if (existingMatch.attacker.user_id !== userId || existingMatch.defender_id !== defenderId) {
          throw new Error(
            'Idempotency key đã được sử dụng cho một yêu cầu khiêu chiến khác với thông số khác (Payload mismatch).'
          );
        }
        return this.formatExistingMatchResult(existingMatch);
      }
    }

    // 2. Chạy giao dịch nguyên tử trong Prisma Transaction với Deadlock-Free Pessimistic Lock & Double-Checked Locking
    try {
      return await prisma.$transaction(async (tx) => {
        const attacker = await tx.xianxiaCharacter.findUnique({
          where: { user_id: userId },
        });
        if (!attacker) {
          throw new Error('Không tìm thấy nhân vật người thách đấu.');
        }

        if (attacker.id === defenderId) {
          throw new Error('Đạo hữu không thể tự khiêu chiến chính mình trên lôi đài!');
        }

        // Khóa hàng bi quan trên cả hai nhân vật (Attacker & Defender) theo thứ tự ID tăng dần
        // nhằm triệt tiêu hoàn toàn nguy cơ Deadlock khi 2 người chơi cùng lúc khiêu chiến lẫn nhau,
        // đồng thời đồng bộ hóa hoàn toàn giới hạn 3 trận nhận thưởng giữa cặp người chơi.
        const firstId = Math.min(attacker.id, defenderId);
        const secondId = Math.max(attacker.id, defenderId);
        await tx.$queryRawUnsafe(
          'SELECT id FROM xianxia_characters WHERE id IN ($1, $2) ORDER BY id FOR UPDATE',
          firstId,
          secondId
        );

        // Double-checked locking sau khi đã nhận row lock FOR UPDATE
        if (scopedKey) {
          const lockedExisting = await tx.xianxiaPvpMatch.findUnique({
            where: { idempotency_key: scopedKey },
            include: {
              attacker: true,
              defender: true,
            },
          });
          if (lockedExisting) {
            if (lockedExisting.attacker.user_id !== userId || lockedExisting.defender_id !== defenderId) {
              throw new Error(
                'Idempotency key đã được sử dụng cho một yêu cầu khiêu chiến khác với thông số khác (Payload mismatch).'
              );
            }
            return this.formatExistingMatchResult(lockedExisting);
          }
        }

        const freshAttacker = await tx.xianxiaCharacter.findUnique({
          where: { id: attacker.id },
        });
        if (!freshAttacker) {
          throw new Error('Không tìm thấy nhân vật người thách đấu.');
        }

        if (freshAttacker.fatigue < 10) {
          throw new Error('Thể lực không đủ (cần tối thiểu 10 Thể Lực để tham chiến lôi đài).');
        }

        const defender = await tx.xianxiaCharacter.findUnique({
          where: { id: defenderId },
        });
        if (!defender) {
          throw new Error('Đối thủ được chọn không tồn tại hoặc đã rời khỏi giới diện.');
        }

        // Kiểm tra giới hạn 3 trận ĐỦ ĐIỀU KIỆN NHẬN THƯỞNG trong ngày (Anti-Farming Exploit)
        // Quy tắc: tối đa 3 trận nhận thưởng/ngày cho mỗi CẶP người chơi, không phụ thuộc bên nào là attacker.
        // Mốc ngày được tính bắt đầu từ 00:00:00 theo múi giờ Việt Nam (UTC+7).
        const startOfDay = getStartOfDayInVietnam(currentTime);
        const eligibleMatchesToday = await tx.xianxiaPvpMatch.count({
          where: {
            is_reward_eligible: true,
            created_at: { gte: startOfDay },
            OR: [
              { attacker_id: freshAttacker.id, defender_id: defender.id },
              { attacker_id: defender.id, defender_id: freshAttacker.id },
            ],
          },
        });

        const isRewardCapped = eligibleMatchesToday >= 3;

        // Tạo Snapshot bất biến của Defender
        const defenderStats = xianxiaCharacterService.calculateEffectiveStats(defender);
        const defenderCp = xianxiaLeaderboardService.calcCombatPower(defender);
        const defenderRealmTitle = REALM_TITLES[defender.realm] || defender.realm;

        const snapshot: DefenderSnapshot = {
          characterId: defender.id,
          name: defender.name,
          realm: defender.realm,
          realmTitle: defenderRealmTitle,
          level: defender.level,
          combatPower: defenderCp,
          maxHealth: defenderStats.max_health,
          attack: defenderStats.attack,
          defense: defenderStats.defense,
          speed: defenderStats.speed,
          critRate: defenderStats.crit_rate,
          dodgeRate: defenderStats.dodge_rate,
          maxQi: defenderStats.max_qi,
          equippedWeapon: defender.equipped_weapon,
          equippedArmor: defender.equipped_armor,
          equippedRelic: defender.equipped_relic,
          snapshotTime: currentTime.toISOString(),
          rulesVersion: 'v1.0',
        };

        // Chỉ số hiệu dụng của Attacker
        const attackerStats = xianxiaCharacterService.calculateEffectiveStats(freshAttacker);

        // Chạy mô phỏng chiến đấu
        const sim = this.simulatePvpCombat(freshAttacker.name, attackerStats, snapshot);

        // Tính biến động Điểm Danh Vọng & Bạc
        let repChange = 0;
        let silverReward = 0;
        let isRewardEligibleThisMatch = false;
        let cappedReason: string | undefined = undefined;

        if (isRewardCapped) {
          isRewardEligibleThisMatch = false;
          cappedReason =
            'Cặp đấu này đã đạt trần 3 trận nhận thưởng trong ngày (tính từ 00:00:00 ICT). Trận đấu kết thúc ở chế độ tỉ thí giao lưu (không thay đổi Danh Vọng & Bạc).';
          repChange = 0;
          silverReward = 0;
        } else {
          isRewardEligibleThisMatch = true;
          if (sim.result === 'ATTACKER_WIN') {
            // Delta = max(10, min(35, 20 + floor((defRep - attRep) / 20)))
            const diff = Math.floor((defender.reputation - freshAttacker.reputation) / 20);
            repChange = Math.max(10, Math.min(35, 20 + diff));
            silverReward = 50;
          } else if (sim.result === 'DEFENDER_WIN') {
            if (freshAttacker.reputation > 100) {
              repChange = -10;
            } else {
              repChange = 0; // Bảo hộ tân thủ
            }
          } else if (sim.result === 'DRAW_ADVANTAGE') {
            repChange = 5;
            silverReward = 20;
          } else {
            repChange = 0;
          }
        }

        // Khấu trừ 10 Thể Lực của Attacker và cập nhật chỉ số
        freshAttacker.fatigue = Math.max(0, freshAttacker.fatigue - 10);
        freshAttacker.reputation = Math.max(0, freshAttacker.reputation + repChange);
        freshAttacker.silver += silverReward;

        if (sim.result === 'ATTACKER_WIN') {
          freshAttacker.pvp_wins += 1;
        } else if (sim.result === 'DEFENDER_WIN') {
          freshAttacker.pvp_losses += 1;
        } else {
          freshAttacker.pvp_draws += 1;
        }

        // Cập nhật attacker vào Database
        await tx.xianxiaCharacter.update({
          where: { id: freshAttacker.id },
          data: {
            fatigue: freshAttacker.fatigue,
            reputation: freshAttacker.reputation,
            silver: freshAttacker.silver,
            pvp_wins: freshAttacker.pvp_wins,
            pvp_losses: freshAttacker.pvp_losses,
            pvp_draws: freshAttacker.pvp_draws,
          },
        });

        // Lưu bản ghi lịch sử trận đấu XianxiaPvpMatch
        const match = await tx.xianxiaPvpMatch.create({
          data: {
            idempotency_key: scopedKey,
            attacker_id: freshAttacker.id,
            defender_id: defender.id,
            defender_snapshot: JSON.stringify(snapshot),
            result: sim.result,
            turns_count: sim.turnsCount,
            reputation_change: repChange,
            attacker_reputation_after: freshAttacker.reputation,
            silver_reward: silverReward,
            is_reward_eligible: isRewardEligibleThisMatch,
            combat_log: JSON.stringify(sim.combatLogs),
            playback_turns: JSON.stringify(sim.playbackTurns),
            created_at: currentTime,
          },
        });

        return {
          matchId: match.id,
          idempotent: false,
          result: sim.result,
          turnsCount: sim.turnsCount,
          reputationChange: repChange,
          attackerReputationAfter: freshAttacker.reputation,
          silverReward,
          dailyMatchesWithOpponent: eligibleMatchesToday + 1,
          cappedRewardReason: cappedReason,
          defender: {
            id: defender.id,
            name: defender.name,
            realmTitle: defenderRealmTitle,
            level: defender.level,
            combatPower: defenderCp,
          },
          attackerStateAfterBattle: {
            health: freshAttacker.health,
            maxHealth: freshAttacker.max_health,
            fatigue: freshAttacker.fatigue,
            maxFatigue: freshAttacker.max_fatigue,
            silver: freshAttacker.silver,
            reputation: freshAttacker.reputation,
            pvpWins: freshAttacker.pvp_wins,
            pvpLosses: freshAttacker.pvp_losses,
            pvpDraws: freshAttacker.pvp_draws,
          },
          combatLogs: sim.combatLogs,
          playbackTurns: sim.playbackTurns,
        };
      }, {
        maxWait: 15000,
        timeout: 30000,
      });
    } catch (error: any) {
      const target = error?.meta?.target;
      const isIdempotencyTarget =
        Array.isArray(target) ? target.includes('idempotency_key') :
        typeof target === 'string' ? target.includes('idempotency_key') : false;

      // Bắt lỗi P2002 nếu có race condition vượt qua ngoài lock ĐÚNG TRÊN CỘT idempotency_key
      if (error?.code === 'P2002' && isIdempotencyTarget && scopedKey) {
        const racedMatch = await prisma.xianxiaPvpMatch.findUnique({
          where: { idempotency_key: scopedKey },
          include: { attacker: true, defender: true },
        });
        if (racedMatch) {
          if (racedMatch.attacker.user_id !== userId || racedMatch.defender_id !== defenderId) {
            throw new Error(
              'Idempotency key đã được sử dụng cho một yêu cầu khiêu chiến khác với thông số khác (Payload mismatch).'
            );
          }
          return this.formatExistingMatchResult(racedMatch);
        }
      }
      throw error;
    }
  }

  /**
   * Lấy lịch sử 15 trận đấu PvP gần nhất của người chơi
   */
  public async getPvpHistory(userId: number, limit = 15): Promise<PvpHistoryItem[]> {
    const char = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!char) return [];

    const matches = await prisma.xianxiaPvpMatch.findMany({
      where: {
        OR: [{ attacker_id: char.id }, { defender_id: char.id }],
      },
      orderBy: { created_at: 'desc' },
      take: Math.min(50, limit),
      include: {
        attacker: true,
        defender: true,
      },
    });

    return matches.map((m) => {
      const isAttacker = m.attacker_id === char.id;
      const role = isAttacker ? 'ATTACKER' : 'DEFENDER';

      let opponentName = '';
      let opponentRealmTitle = '';
      let opponentLevel = 1;

      if (isAttacker) {
        try {
          const snap: DefenderSnapshot = JSON.parse(m.defender_snapshot);
          opponentName = snap.name;
          opponentRealmTitle = snap.realmTitle;
          opponentLevel = snap.level;
        } catch {
          opponentName = m.defender?.name || `Đối Thủ #${m.defender_id}`;
          opponentRealmTitle = REALM_TITLES[m.defender?.realm || ''] || 'Tu Tiên Giả';
          opponentLevel = m.defender?.level || 1;
        }
      } else {
        opponentName = m.attacker?.name || `Tu Tiên Giả #${m.attacker_id}`;
        opponentRealmTitle = REALM_TITLES[m.attacker?.realm || ''] || 'Tu Tiên Giả';
        opponentLevel = m.attacker?.level || 1;
      }

      const isVictory =
        (isAttacker && (m.result === 'ATTACKER_WIN' || m.result === 'DRAW_ADVANTAGE')) ||
        (!isAttacker && m.result === 'DEFENDER_WIN');

      return {
        id: m.id,
        role,
        opponentName,
        opponentRealmTitle,
        opponentLevel,
        result: m.result as any,
        isVictory,
        reputationChange: isAttacker ? m.reputation_change : 0,
        silverReward: isAttacker ? m.silver_reward : 0,
        turnsCount: m.turns_count,
        createdAt: m.created_at.toISOString(),
      };
    });
  }

  /**
   * Xem chi tiết 1 trận đấu cụ thể (gồm combat_log và playback_turns)
   */
  public async getPvpMatch(userId: number, matchId: string) {
    const char = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!char) throw new Error('Không tìm thấy nhân vật.');

    const match = await prisma.xianxiaPvpMatch.findUnique({
      where: { id: matchId },
      include: {
        attacker: true,
        defender: true,
      },
    });

    if (!match) throw new Error('Trận đấu lôi đài không tồn tại.');

    // Chỉ người trong cuộc (attacker hoặc defender) mới được xem chi tiết
    if (match.attacker_id !== char.id && match.defender_id !== char.id) {
      throw new Error('Đạo hữu không có thẩm quyền truy xuất chiến báo của trận đấu này.');
    }

    return {
      matchId: match.id,
      attackerId: match.attacker_id,
      attackerName: match.attacker?.name,
      defenderId: match.defender_id,
      defenderName: match.defender?.name,
      result: match.result,
      turnsCount: match.turns_count,
      reputationChange: match.reputation_change,
      silverReward: match.silver_reward,
      defenderSnapshot: JSON.parse(match.defender_snapshot),
      combatLogs: JSON.parse(match.combat_log),
      playbackTurns: JSON.parse(match.playback_turns),
      createdAt: match.created_at.toISOString(),
    };
  }

  /**
   * Bảng Xếp Hạng Điểm Danh Vọng Đấu Trường (PVP Arena Leaderboard)
   */
  public async getPvpLeaderboard(limit = 20, userId?: number): Promise<{
    entries: PvpLeaderboardEntry[];
    myRank: number | null;
  }> {
    const rows = await prisma.xianxiaCharacter.findMany({
      orderBy: [
        { reputation: 'desc' },
        { pvp_wins: 'desc' },
        { level: 'desc' },
        { id: 'asc' },
      ],
      take: Math.min(50, limit),
    });

    const entries: PvpLeaderboardEntry[] = rows.map((r, idx) => ({
      rank: idx + 1,
      characterId: r.id,
      name: r.name,
      realm: r.realm,
      realmTitle: REALM_TITLES[r.realm] || r.realm,
      level: r.level,
      reputation: r.reputation,
      combatPower: xianxiaLeaderboardService.calcCombatPower(r),
      pvpWins: r.pvp_wins,
      pvpLosses: r.pvp_losses,
      pvpDraws: r.pvp_draws,
    }));

    let myRank: number | null = null;
    if (userId) {
      const myChar = await prisma.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });

      if (myChar) {
        // Tìm thứ hạng cá nhân bằng count những người có reputation cao hơn
        const higherCount = await prisma.xianxiaCharacter.count({
          where: {
            OR: [
              { reputation: { gt: myChar.reputation } },
              {
                reputation: myChar.reputation,
                pvp_wins: { gt: myChar.pvp_wins },
              },
              {
                reputation: myChar.reputation,
                pvp_wins: myChar.pvp_wins,
                level: { gt: myChar.level },
              },
              {
                reputation: myChar.reputation,
                pvp_wins: myChar.pvp_wins,
                level: myChar.level,
                id: { lt: myChar.id },
              },
            ],
          },
        });
        myRank = higherCount + 1;
      }
    }

    return { entries, myRank };
  }
}

export const xianxiaPvpService = new XianxiaPvpService();
