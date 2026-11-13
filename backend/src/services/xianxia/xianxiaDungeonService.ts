import { prisma } from '../../utils/prisma.js';
import { xianxiaCharacterService } from './xianxiaCharacterService.js';
import { XianxiaBestiaryService } from './xianxiaBestiaryService.js';
import { xianxiaQuestService } from './xianxiaQuestService.js';
import { DroppedItem, RealmTier } from '../../types/xianxia.js';
import { REALM_HIERARCHY } from './xianxiaWorldService.js';

export interface DungeonMonsterState {
  instanceId: string;
  monsterId: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  critRate: number;
  dodgeRate: number;
  isAlive: boolean;
}

export interface DungeonPlayerState {
  characterId: number;
  name: string;
  realm: string;
  level: number;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  atk: number;
  def: number;
  speed: number;
  critRate: number;
  dodgeRate: number;
  damageDealt: number;
  damageTaken: number;
  isAlive: boolean;
}

export interface DungeonCombatState {
  currentWave: number;
  totalWaves: number;
  monsters: DungeonMonsterState[];
  players: DungeonPlayerState[];
}

export interface DungeonRunDetail {
  id: string;
  dungeonId: string;
  dungeonName: string;
  partyId: number;
  leaderCharacterId: number;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  currentWave: number;
  totalWaves: number;
  turnsCount: number;
  version: number;
  combatState: DungeonCombatState | null;
  combatLog: string[];
  expiresAt: string;
  startedAt: string;
  completedAt?: string | null;
}

export interface DungeonRewardResult {
  claimed: boolean;
  idempotent: boolean;
  exp: number;
  cultivation: number;
  silver: number;
  items: DroppedItem[];
}

export class XianxiaDungeonService {
  private bestiaryService: XianxiaBestiaryService;

  public static readonly DUNGEON_TIMEOUT_MS = 15 * 60 * 1000; // 15 phút
  public static readonly REQUIRED_FATIGUE = 15;
  public static readonly REQUIRED_REALM_ORDER = 1; // Luyện Khí Tầng 1

  // Cấu hình phó bản MVP: U Minh Cổ Động
  public static readonly DUNGEON_CONFIG = {
    id: 'dungeon_u_minh_co_dong',
    name: 'U Minh Cổ Động',
    description: 'Cổ động sâu trong U Minh Trúc Lâm, nơi tụ tập của bầy ma lang dưới trướng U Minh Lang Vương.',
    minRealm: 'LUYEN_KHI_1',
    minLevel: 1,
    fatigueCost: 15,
    maxMembers: 4,
    totalWaves: 3,
    waves: [
      { wave: 1, monsters: ['monster_thao_moc_tinh', 'monster_thao_moc_tinh'] },
      { wave: 2, monsters: ['monster_u_minh_lang', 'monster_tho_lang'] },
      { wave: 3, monsters: ['boss_u_minh_lang_vuong'] },
    ],
    baseRewards: {
      exp: 300,
      cultivation: 120,
      silverMin: 80,
      silverMax: 150,
      fixedLoot: [
        { item_id: 'item_yeu_dan_so_cap', item_name: 'Yêu Đan Nhất Giai (U Minh)', chance: 1.0, quantity: 1 },
      ],
      randomLoot: [
        { item_id: 'item_linh_thach_vun', item_name: 'Linh Thạch Vụn', chance: 0.8, min: 2, max: 5 },
        { item_id: 'item_thanh_phong_kiem_phoi', item_name: 'Bản Vẽ [Thanh Phong Kiếm]', chance: 0.4, min: 1, max: 1 },
      ],
    },
  };

  private eventHooks?: {
    onDungeonStarted?: (partyId: number, runId: string) => void;
  };

  public setEventHooks(hooks: { onDungeonStarted?: (partyId: number, runId: string) => void }): void {
    this.eventHooks = hooks;
  }

  constructor() {
    this.bestiaryService = new XianxiaBestiaryService();
  }

  /**
   * Sinh Scoped Idempotency Key an toàn chống va chạm
   */
  public getScopedIdempotencyKey(prefix: string, scopeId: number | string, rawKey?: string): string | null {
    if (!rawKey || typeof rawKey !== 'string') return null;
    const cleanKey = rawKey.trim();
    if (!cleanKey) return null;
    if (cleanKey.length > 64) {
      throw new Error('Mã Idempotency key quá dài (tối đa 64 ký tự).');
    }
    return `${prefix}:${scopeId}:${cleanKey}`;
  }

  /**
   * 1. Lấy danh sách cấu hình các phó bản khả dụng
   */
  public getDungeonList(): any[] {
    const cfg = XianxiaDungeonService.DUNGEON_CONFIG;
    return [
      {
        id: cfg.id,
        name: cfg.name,
        description: cfg.description,
        minRealm: cfg.minRealm,
        minLevel: cfg.minLevel,
        fatigueCost: cfg.fatigueCost,
        totalWaves: cfg.totalWaves,
        maxMembers: cfg.maxMembers,
      },
    ];
  }

  /**
   * Khởi tạo danh sách quái vật cho 1 Wave từ dữ liệu monsters.json
   */
  private spawnWaveMonsters(waveNumber: number): DungeonMonsterState[] {
    const cfg = XianxiaDungeonService.DUNGEON_CONFIG;
    const waveDef = cfg.waves.find((w) => w.wave === waveNumber);
    if (!waveDef) return [];

    const monsters: DungeonMonsterState[] = [];
    waveDef.monsters.forEach((monId, idx) => {
      const monData = this.bestiaryService.getMonsterById(monId);
      if (monData) {
        monsters.push({
          instanceId: `w${waveNumber}_m${idx + 1}_${monData.id}`,
          monsterId: monData.id,
          name: waveDef.monsters.length > 1 ? `${monData.name} #${idx + 1}` : monData.name,
          hp: monData.max_health,
          maxHp: monData.max_health,
          atk: monData.attack,
          def: monData.defense,
          speed: monData.speed,
          critRate: monData.crit_rate,
          dodgeRate: monData.dodge_rate,
          isAlive: true,
        });
      }
    });

    return monsters;
  }

  /**
   * 2. Vào phó bản (Enter Dungeon)
   * Yêu cầu:
   * - Người gọi phải là Đội Trưởng
   * - Tổ đội trạng thái FORMING
   * - 100% thành viên Sẵn Sàng (is_ready = true)
   * - 100% thành viên đủ thể lực >= 15
   * - 100% thành viên đạt cảnh giới >= Luyện Khí 1
   * - Khấu trừ 15 thể lực của mỗi người trong transaction với khóa ORDER BY id ASC FOR UPDATE
   * - Tạo instance XianxiaDungeonRun + XianxiaDungeonMember
   */
  public async enterDungeon(
    userId: number,
    dungeonId: string,
    rawIdempotencyKey?: string
  ): Promise<DungeonRunDetail> {
    if (dungeonId !== XianxiaDungeonService.DUNGEON_CONFIG.id) {
      throw new Error(`DUNGEON_NOT_FOUND: Không tìm thấy phó bản mang mã [${dungeonId}].`);
    }

    // 1. Kiểm tra nhân vật của người gọi
    const callerChar = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!callerChar) {
      throw new Error('DUNGEON_CHARACTER_NOT_FOUND: Đạo hữu chưa tạo nhân vật tu tiên.');
    }

    // 2. Kiểm tra tổ đội của người gọi
    const membership = await prisma.xianxiaPartyMember.findUnique({
      where: { character_id: callerChar.id },
      include: {
        party: {
          include: {
            members: {
              include: { character: true },
              orderBy: { character_id: 'asc' },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new Error('DUNGEON_NOT_IN_PARTY: Đạo hữu chưa gia nhập tổ đội, không thể tiến vào phó bản.');
    }

    if (membership.role !== 'LEADER') {
      throw new Error('DUNGEON_NOT_LEADER: Chỉ Đội Trưởng mới có quyền khởi phát tiến nhập phó bản.');
    }

    const party = membership.party;
    const scopedKey = this.getScopedIdempotencyKey('dungeon:enter:p', party.id, rawIdempotencyKey);

    // 3. Kiểm tra Idempotency trước transaction (Optimistic Fast-Path)
    if (scopedKey) {
      const existingRun = await prisma.xianxiaDungeonRun.findUnique({
        where: { idempotency_key: scopedKey },
      });
      if (existingRun) {
        return this.formatDungeonRun(existingRun);
      }
    }

    // 4. Kiểm tra xem tổ đội đã có phó bản nào đang active chưa
    const activeRun = await prisma.xianxiaDungeonRun.findFirst({
      where: {
        party_id: party.id,
        status: { in: ['WAITING', 'IN_PROGRESS'] },
      },
    });
    if (activeRun) {
      // Kiểm tra xem đã hết hạn 15 phút chưa
      if (activeRun.expires_at <= new Date()) {
        await prisma.xianxiaDungeonRun.update({
          where: { id: activeRun.id },
          data: { status: 'EXPIRED' },
        });
      } else {
        throw new Error('DUNGEON_PARTY_ALREADY_IN_DUNGEON: Tổ đội hiện đang trong một phiên phó bản chưa kết thúc.');
      }
    }

    // 5. Kiểm tra điều kiện từng thành viên trước khi vào transaction
    const members = party.members;
    if (members.length === 0) {
      throw new Error('DUNGEON_PARTY_EMPTY: Tổ đội không có thành viên.');
    }

    for (const m of members) {
      if (!m.is_ready && m.role !== 'LEADER') {
        throw new Error(`DUNGEON_MEMBER_NOT_READY: Thành viên [${m.character.name}] chưa bật trạng thái Sẵn Sàng.`);
      }

      const realmOrder = REALM_HIERARCHY[m.character.realm as RealmTier] ?? 0;
      if (realmOrder < XianxiaDungeonService.REQUIRED_REALM_ORDER) {
        throw new Error(`DUNGEON_REALM_TOO_LOW: Thành viên [${m.character.name}] chưa đạt cảnh giới Luyện Khí Tầng 1.`);
      }

      if (m.character.fatigue < XianxiaDungeonService.REQUIRED_FATIGUE) {
        throw new Error(`DUNGEON_INSUFFICIENT_FATIGUE: Thành viên [${m.character.name}] không đủ thể lực (Cần tối thiểu 15 Thể Lực).`);
      }
    }

    // 6. Thực thi Transaction nguyên tử với Khóa hàng chống Deadlock và Trừ thể lực an toàn
    const result = await prisma.$transaction(async (tx) => {
      // 6.1 Khóa hàng tổ đội
      await tx.$queryRawUnsafe('SELECT id, status FROM xianxia_parties WHERE id = $1 FOR UPDATE', party.id);

      const freshParty = await tx.xianxiaParty.findUnique({
        where: { id: party.id },
      });
      if (!freshParty || freshParty.status === 'DISBANDED') {
        throw new Error('DUNGEON_PARTY_DISBANDED: Tổ đội đã bị giải tán.');
      }
      if (freshParty.status === 'IN_DUNGEON') {
        throw new Error('DUNGEON_PARTY_ALREADY_IN_DUNGEON: Tổ đội hiện đang trong một phiên phó bản chưa kết thúc.');
      }

      const activeRunTx = await tx.xianxiaDungeonRun.findFirst({
        where: {
          party_id: party.id,
          status: { in: ['WAITING', 'IN_PROGRESS'] },
        },
      });
      if (activeRunTx) {
        if (activeRunTx.expires_at <= new Date()) {
          await tx.xianxiaDungeonRun.update({
            where: { id: activeRunTx.id },
            data: { status: 'EXPIRED' },
          });
        } else {
          throw new Error('DUNGEON_PARTY_ALREADY_IN_DUNGEON: Tổ đội hiện đang trong một phiên phó bản chưa kết thúc.');
        }
      }

      // 6.2 Khóa các nhân vật thành viên theo thứ tự ID tăng dần (Deadlock-Free Lock Ordering)
      const sortedCharIds = members.map((m) => m.character_id).sort((a, b) => a - b);
      for (const charId of sortedCharIds) {
        await tx.$queryRawUnsafe('SELECT id, fatigue FROM xianxia_characters WHERE id = $1 FOR UPDATE', charId);
      }

      // 6.3 Kiểm tra lại thể lực và khấu trừ 15 thể lực
      for (const m of members) {
        const freshChar = await tx.xianxiaCharacter.findUnique({ where: { id: m.character_id } });
        if (!freshChar || freshChar.fatigue < XianxiaDungeonService.REQUIRED_FATIGUE) {
          throw new Error(`DUNGEON_INSUFFICIENT_FATIGUE: Thành viên [${freshChar?.name || m.character.name}] không đủ thể lực.`);
        }

        await tx.xianxiaCharacter.update({
          where: { id: m.character_id },
          data: { fatigue: { decrement: XianxiaDungeonService.REQUIRED_FATIGUE } },
        });
      }

      // 6.4 Cập nhật trạng thái tổ đội sang IN_DUNGEON
      await tx.xianxiaParty.update({
        where: { id: party.id },
        data: { status: 'IN_DUNGEON' },
      });

      // 6.5 Chuẩn bị snapshot Player và Wave 1 Monsters
      const wave1Monsters = this.spawnWaveMonsters(1);
      const playerStates: DungeonPlayerState[] = [];

      for (const m of members) {
        const charData = await tx.xianxiaCharacter.findUnique({ where: { id: m.character_id } });
        if (charData) {
          const stats = xianxiaCharacterService.calculateEffectiveStats(charData);
          playerStates.push({
            characterId: charData.id,
            name: charData.name,
            realm: charData.realm,
            level: charData.level,
            hp: charData.health,
            maxHp: stats.max_health,
            qi: 25,
            maxQi: stats.max_qi,
            atk: stats.attack,
            def: stats.defense,
            speed: stats.speed,
            critRate: stats.crit_rate,
            dodgeRate: stats.dodge_rate,
            damageDealt: 0,
            damageTaken: 0,
            isAlive: charData.health > 0,
          });
        }
      }

      const initialCombatState: DungeonCombatState = {
        currentWave: 1,
        totalWaves: XianxiaDungeonService.DUNGEON_CONFIG.totalWaves,
        monsters: wave1Monsters,
        players: playerStates,
      };

      const initialCombatLogs = [
        `⚔️ [Tiến Nhập Cổ Động] Tổ đội dưới sự dẫn dắt của [${callerChar.name}] đã bước vào [${XianxiaDungeonService.DUNGEON_CONFIG.name}]!`,
        `🌊 Đợt 1 bắt đầu: ${wave1Monsters.map((m) => m.name).join(', ')} xuất hiện phong tỏa lối đi!`,
      ];

      const now = new Date();
      const expiresAt = new Date(now.getTime() + XianxiaDungeonService.DUNGEON_TIMEOUT_MS);

      // 6.6 Tạo bản ghi XianxiaDungeonRun
      const dungeonRun = await tx.xianxiaDungeonRun.create({
        data: {
          dungeon_id: XianxiaDungeonService.DUNGEON_CONFIG.id,
          party_id: party.id,
          leader_character_id: callerChar.id,
          status: 'IN_PROGRESS',
          current_wave: 1,
          total_waves: XianxiaDungeonService.DUNGEON_CONFIG.totalWaves,
          turns_count: 0,
          version: 1,
          combat_state: JSON.stringify(initialCombatState),
          combat_log: JSON.stringify(initialCombatLogs),
          idempotency_key: scopedKey || null,
          started_at: now,
          expires_at: expiresAt,
        },
      });

      // 6.7 Tạo bản ghi XianxiaDungeonMember
      for (const p of playerStates) {
        await tx.xianxiaDungeonMember.create({
          data: {
            dungeon_run_id: dungeonRun.id,
            character_id: p.characterId,
            initial_hp: p.hp,
            current_hp: p.hp,
            max_hp: p.maxHp,
            current_qi: p.qi,
            damage_dealt: 0,
            damage_taken: 0,
            is_alive: p.isAlive,
            is_connected: true,
          },
        });
      }

      return this.formatDungeonRun(dungeonRun, initialCombatState, initialCombatLogs);
    }, { maxWait: 15000, timeout: 20000 });

    if (result && this.eventHooks?.onDungeonStarted) {
      try {
        this.eventHooks.onDungeonStarted(result.partyId, result.id);
      } catch (e) {}
    }

    return result;
  }

  /**
   * 3. Lấy thông tin chi tiết phiên phó bản
   */
  public async getDungeonRunById(runId: string, userId?: number): Promise<DungeonRunDetail> {
    const run = await prisma.xianxiaDungeonRun.findUnique({
      where: { id: runId },
    });
    if (!run) {
      throw new Error('DUNGEON_RUN_NOT_FOUND: Không tìm thấy phiên phó bản.');
    }

    // Kiểm tra quyền truy cập nếu truyền userId
    if (userId !== undefined) {
      const callerChar = await prisma.xianxiaCharacter.findUnique({ where: { user_id: userId } });
      if (!callerChar) {
        throw new Error('DUNGEON_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');
      }

      const memberRecord = await prisma.xianxiaDungeonMember.findUnique({
        where: {
          dungeon_run_id_character_id: {
            dungeon_run_id: run.id,
            character_id: callerChar.id,
          },
        },
      });
      if (!memberRecord) {
        throw new Error('DUNGEON_FORBIDDEN: Đạo hữu không thuộc phiên phó bản này.');
      }
    }

    // Tự động cập nhật nếu đã quá hạn 15 phút
    if (run.status === 'IN_PROGRESS' && run.expires_at <= new Date()) {
      await prisma.xianxiaDungeonRun.update({
        where: { id: run.id },
        data: { status: 'EXPIRED' },
      });
      await prisma.xianxiaParty.update({
        where: { id: run.party_id },
        data: { status: 'FORMING' },
      });
      run.status = 'EXPIRED';
    }

    return this.formatDungeonRun(run);
  }

  /**
   * 4. Thực thi 1 Hiệp Đấu Phía Server (Authoritative Combat Step)
   * Sử dụng Optimistic Versioning (run.version) + Row Locking để chống Race Condition
   */
  public async executeCombatStep(
    userId: number,
    runId: string,
    expectedVersion?: number
  ): Promise<DungeonRunDetail> {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Khóa hàng phiên phó bản
        await tx.$queryRawUnsafe('SELECT id, status, version, expires_at, party_id FROM xianxia_dungeon_runs WHERE id = $1::uuid FOR UPDATE', runId);

        const run = await tx.xianxiaDungeonRun.findUnique({
          where: { id: runId },
        });
        if (!run) {
          throw new Error('DUNGEON_RUN_NOT_FOUND: Không tìm thấy phiên phó bản.');
        }

        // 2. Kiểm tra tính hợp lệ của người gọi (phải thuộc phiên phó bản)
        const callerChar = await tx.xianxiaCharacter.findUnique({ where: { user_id: userId } });
        if (!callerChar) throw new Error('DUNGEON_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

        const memberRecord = await tx.xianxiaDungeonMember.findUnique({
          where: {
            dungeon_run_id_character_id: {
              dungeon_run_id: run.id,
              character_id: callerChar.id,
            },
          },
        });
        if (!memberRecord) {
          throw new Error('DUNGEON_FORBIDDEN: Đạo hữu không thuộc phiên phó bản này.');
        }

        // 3. Kiểm tra Optimistic Versioning
        if (expectedVersion !== undefined && run.version !== expectedVersion) {
          throw new Error(`DUNGEON_VERSION_MISMATCH: Trạng thái lượt đấu đã được cập nhật bởi thành viên khác (Phiên bản máy chủ: ${run.version}). Vui lòng đồng bộ lại.`);
        }

        // 4. Kiểm tra trạng thái phiên
        if (run.status === 'COMPLETED') {
          throw new Error('DUNGEON_NOT_IN_PROGRESS: Phó bản đã hoàn thành trảm yêu, không thể tiếp tục công kích.');
        }
        if (run.status === 'FAILED') {
          throw new Error('DUNGEON_NOT_IN_PROGRESS: Toàn đội đã tử trận, phó bản thất bại.');
        }
        if (run.status === 'EXPIRED' || run.expires_at <= new Date()) {
          const expiredErr: any = new Error('DUNGEON_ALREADY_EXPIRED: Phiên phó bản đã hết thời hạn 15 phút.');
          expiredErr.runId = run.id;
          expiredErr.partyId = run.party_id;
          expiredErr.needsExpirePersist = run.status !== 'EXPIRED';
          throw expiredErr;
        }

      // 5. Nạp combat_state và combat_log
      const state: DungeonCombatState = run.combat_state ? JSON.parse(run.combat_state) : { currentWave: 1, totalWaves: 3, monsters: [], players: [] };
      const logs: string[] = run.combat_log ? JSON.parse(run.combat_log) : [];
      const turnNum = run.turns_count + 1;

      logs.push(`--- [Hiệp ${turnNum}] ---`);

      // 6. Lập danh sách tất cả các thực thể còn sống để sắp xếp lượt theo Speed
      interface Actor {
        type: 'PLAYER' | 'MONSTER';
        id: string;
        speed: number;
        data: any;
      }

      const activeActors: Actor[] = [];
      state.players.filter((p) => p.isAlive).forEach((p) => {
        activeActors.push({ type: 'PLAYER', id: String(p.characterId), speed: p.speed, data: p });
      });
      state.monsters.filter((m) => m.isAlive).forEach((m) => {
        activeActors.push({ type: 'MONSTER', id: m.instanceId, speed: m.speed, data: m });
      });

      // Sắp xếp Thân pháp (Speed) giảm dần (Người chơi ưu tiên nếu bằng Speed)
      activeActors.sort((a, b) => {
        if (b.speed !== a.speed) return b.speed - a.speed;
        return a.type === 'PLAYER' ? -1 : 1;
      });

      // 7. Thực thi hành động của từng Actor trong lượt
      for (const actor of activeActors) {
        if (actor.type === 'PLAYER') {
          const player: DungeonPlayerState = actor.data;
          if (!player.isAlive) continue;

          // Tìm quái vật còn sống mục tiêu (ưu tiên quái ít HP nhất)
          const livingMonsters = state.monsters.filter((m) => m.isAlive);
          if (livingMonsters.length === 0) break;

          livingMonsters.sort((a, b) => a.hp - b.hp);
          const targetMonster = livingMonsters[0];

          // Tính sát thương của người chơi
          let dmg = 0;
          let isCrit = false;
          let actionName = 'Trảm Kích';

          if (player.qi >= 15) {
            actionName = 'Thần Thông Lôi Hỏa';
            player.qi -= 15;
            const baseDmg = Math.floor(player.atk * 1.6);
            dmg = Math.max(8, baseDmg - Math.floor(targetMonster.def * 0.4));
          } else {
            actionName = 'Trảm Kích';
            player.qi = Math.min(player.maxQi, player.qi + 8);
            dmg = Math.max(3, player.atk - Math.floor(targetMonster.def * 0.7));
          }

          if (Math.random() < player.critRate) {
            isCrit = true;
            dmg = Math.floor(dmg * 1.6);
          }

          const variance = 0.9 + Math.random() * 0.2;
          dmg = Math.max(2, Math.floor(dmg * variance));

          targetMonster.hp = Math.max(0, targetMonster.hp - dmg);
          if (targetMonster.hp === 0) {
            targetMonster.isAlive = false;
          }

          player.damageDealt += dmg;
          logs.push(`🗡️ [${player.name}] xuất chiêu [${actionName}] trảm vào [${targetMonster.name}], gây ${dmg} sát thương ${isCrit ? '💥 (BẠO KÍCH!)' : ''}. (${targetMonster.name} còn ${targetMonster.hp}/${targetMonster.maxHp} HP)`);

          if (!targetMonster.isAlive) {
            logs.push(`☠️ [${targetMonster.name}] đã bị hạ gục!`);
          }
        } else {
          // MONSTER ACTOR
          const monster: DungeonMonsterState = actor.data;
          if (!monster.isAlive) continue;

          // Tìm mục tiêu là người chơi còn sống (ngẫu nhiên hoặc người HP thấp nhất)
          const livingPlayers = state.players.filter((p) => p.isAlive);
          if (livingPlayers.length === 0) break;

          const targetPlayer = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];

          // Kiểm tra người chơi né đòn
          if (Math.random() < targetPlayer.dodgeRate) {
            logs.push(`💨 [${monster.name}] vồ tới [${targetPlayer.name}] nhưng đạo hữu đã lướt người né tránh thành công!`);
            continue;
          }

          let mDmg = Math.max(2, monster.atk - Math.floor(targetPlayer.def * 0.6));
          let mCrit = false;
          if (Math.random() < monster.critRate) {
            mCrit = true;
            mDmg = Math.floor(mDmg * 1.5);
          }

          const variance = 0.9 + Math.random() * 0.2;
          mDmg = Math.max(2, Math.floor(mDmg * variance));

          targetPlayer.hp = Math.max(0, targetPlayer.hp - mDmg);
          if (targetPlayer.hp === 0) {
            targetPlayer.isAlive = false;
          }

          targetPlayer.damageTaken += mDmg;
          logs.push(`🩸 [${monster.name}] hung hãn tấn công [${targetPlayer.name}], gây ${mDmg} sát thương ${mCrit ? '💥 (BẠO KÍCH!)' : ''}. (${targetPlayer.name} còn ${targetPlayer.hp}/${targetPlayer.maxHp} HP)`);

          if (!targetPlayer.isAlive) {
            logs.push(`💀 [${targetPlayer.name}] đã trọng thương ngã gục!`);
          }
        }
      }

      // 8. Kiểm tra điều kiện Chuyển Wave hoặc Thắng/Thua
      let nextStatus = run.status;
      const allMonstersDead = state.monsters.every((m) => !m.isAlive);
      const allPlayersDead = state.players.every((p) => !p.isAlive);

      if (allMonstersDead) {
        if (state.currentWave < state.totalWaves) {
          // Chuyển sang Wave tiếp theo
          state.currentWave += 1;
          const nextWaveMonsters = this.spawnWaveMonsters(state.currentWave);
          state.monsters = nextWaveMonsters;
          logs.push(`\n🌊 [CHUYỂN ĐỢT] Quét sạch đợt quái! Cổ động rung chuyển, đợt thứ ${state.currentWave} xuất hiện: ${nextWaveMonsters.map((m) => m.name).join(', ')}!`);
        } else {
          // Đã tiêu diệt trùm cuối ở Wave 3 -> VƯỢT ẢI THÀNH CÔNG!
          nextStatus = 'COMPLETED';
          logs.push(`\n🏆 [ĐẠI THẮNG] [${XianxiaDungeonService.DUNGEON_CONFIG.name}] đã bị chinh phục! Yêu thú tan tác, toàn đội mở quyền nhận thưởng quý báu!`);

          // Giải phóng tổ đội về trạng thái FORMING
          await tx.xianxiaParty.update({
            where: { id: run.party_id },
            data: { status: 'FORMING' },
          });
        }
      } else if (allPlayersDead) {
        // Toàn đội tử trận -> THẤT BẠI
        nextStatus = 'FAILED';
        logs.push(`\n💀 [THẤT BẠI] Toàn bộ thành viên tổ đội đã tử trận! Phó bản thất bại, linh thức bị đánh bật khỏi cổ động.`);

        // Giải phóng tổ đội về trạng thái FORMING
        await tx.xianxiaParty.update({
          where: { id: run.party_id },
          data: { status: 'FORMING' },
        });
      }

      // 9. Cập nhật XianxiaDungeonMember và HP nhân vật trong CSDL
      for (const p of state.players) {
        await tx.xianxiaDungeonMember.update({
          where: {
            dungeon_run_id_character_id: {
              dungeon_run_id: run.id,
              character_id: p.characterId,
            },
          },
          data: {
            current_hp: p.hp,
            current_qi: p.qi,
            damage_dealt: p.damageDealt,
            damage_taken: p.damageTaken,
            is_alive: p.isAlive,
          },
        });

        // Đồng bộ HP về bảng XianxiaCharacter (nếu tử trận thì HP tối thiểu là 20 khi hồi sinh)
        const finalCharHp = nextStatus === 'FAILED' ? 20 : p.hp;
        await tx.xianxiaCharacter.update({
          where: { id: p.characterId },
          data: { health: finalCharHp },
        });
      }

      // 10. Cập nhật XianxiaDungeonRun
      const updatedRun = await tx.xianxiaDungeonRun.update({
        where: { id: run.id },
        data: {
          status: nextStatus,
          current_wave: state.currentWave,
          turns_count: turnNum,
          version: run.version + 1,
          combat_state: JSON.stringify(state),
          combat_log: JSON.stringify(logs),
          completed_at: nextStatus === 'COMPLETED' || nextStatus === 'FAILED' ? new Date() : null,
        },
      });

      return this.formatDungeonRun(updatedRun, state, logs);
    }, { maxWait: 15000, timeout: 20000 });
  } catch (err: any) {
    if (err?.needsExpirePersist && err?.runId && err?.partyId) {
      await prisma.$transaction([
        prisma.xianxiaDungeonRun.update({
          where: { id: err.runId },
          data: { status: 'EXPIRED' },
        }),
        prisma.xianxiaParty.update({
          where: { id: err.partyId },
          data: { status: 'FORMING' },
        }),
      ]).catch(() => {});
    }
    throw err;
  }
}

  /**
   * 5. Nhận phần thưởng vượt ải (Claim Reward)
   * Yêu cầu:
   * - Trạng thái COMPLETED
   * - Idempotency Key bảo vệ lặp request
   * - Ràng buộc kép @@unique([dungeon_run_id, character_id]) trong CSDL
   * - Retry trả về bản ghi cũ mà không cộng thêm tài nguyên
   */
  public async claimReward(
    userId: number,
    runId: string,
    rawIdempotencyKey?: string
  ): Promise<DungeonRewardResult> {
    const callerChar = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!callerChar) throw new Error('DUNGEON_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

    // Tạo Scoped Key
    const scopedKey = this.getScopedIdempotencyKey('dungeon:reward:r', `${runId}:c${callerChar.id}`, rawIdempotencyKey || 'default');

    // 1. Kiểm tra xem đã nhận thưởng chưa (Optimistic Cache Read)
    const existingClaim = await prisma.xianxiaDungeonRewardClaim.findUnique({
      where: {
        dungeon_run_id_character_id: {
          dungeon_run_id: runId,
          character_id: callerChar.id,
        },
      },
    });

    if (existingClaim) {
      const parsedItems: DroppedItem[] = existingClaim.items_reward ? JSON.parse(existingClaim.items_reward) : [];
      return {
        claimed: true,
        idempotent: true,
        exp: existingClaim.exp_reward,
        cultivation: existingClaim.cultivation_reward,
        silver: existingClaim.silver_reward,
        items: parsedItems,
      };
    }

    // 2. Thực thi cấp thưởng trong Transaction
    try {
      return await prisma.$transaction(async (tx) => {
        // 2.1 Khóa và kiểm tra phiên phó bản
        await tx.$queryRawUnsafe('SELECT id, status, expires_at, party_id FROM xianxia_dungeon_runs WHERE id = $1::uuid FOR UPDATE', runId);

        const run = await tx.xianxiaDungeonRun.findUnique({
          where: { id: runId },
        });
        if (!run) throw new Error('DUNGEON_RUN_NOT_FOUND: Không tìm thấy phiên phó bản.');

        if (run.status !== 'COMPLETED') {
          if (run.status === 'IN_PROGRESS' && run.expires_at <= new Date()) {
            const expiredErr: any = new Error('DUNGEON_NOT_COMPLETED: Phó bản chưa hoàn thành hoặc đã thất bại, không thể nhận thưởng.');
            expiredErr.runId = run.id;
            expiredErr.partyId = run.party_id;
            expiredErr.needsExpirePersist = true;
            throw expiredErr;
          }
          throw new Error('DUNGEON_NOT_COMPLETED: Phó bản chưa hoàn thành hoặc đã thất bại, không thể nhận thưởng.');
        }

      // 2.2 Kiểm tra người nhận có thuộc danh sách thành viên không
      const dungeonMember = await tx.xianxiaDungeonMember.findUnique({
        where: {
          dungeon_run_id_character_id: {
            dungeon_run_id: run.id,
            character_id: callerChar.id,
          },
        },
      });
      if (!dungeonMember) {
        throw new Error('DUNGEON_FORBIDDEN: Đạo hữu không tham gia phiên phó bản này.');
      }

      // 2.3 Khóa hàng nhân vật để cộng tài nguyên
      await tx.$queryRawUnsafe('SELECT id, silver, exp, cultivation FROM xianxia_characters WHERE id = $1 FOR UPDATE', callerChar.id);

      // Double-check bên trong transaction
      const doubleCheckClaim = await tx.xianxiaDungeonRewardClaim.findUnique({
        where: {
          dungeon_run_id_character_id: {
            dungeon_run_id: run.id,
            character_id: callerChar.id,
          },
        },
      });
      if (doubleCheckClaim) {
        const parsedItems: DroppedItem[] = doubleCheckClaim.items_reward ? JSON.parse(doubleCheckClaim.items_reward) : [];
        return {
          claimed: true,
          idempotent: true,
          exp: doubleCheckClaim.exp_reward,
          cultivation: doubleCheckClaim.cultivation_reward,
          silver: doubleCheckClaim.silver_reward,
          items: parsedItems,
        };
      }

      // 2.4 Tính toán phần thưởng theo cấu hình
      const rewardsCfg = XianxiaDungeonService.DUNGEON_CONFIG.baseRewards;
      const expReward = rewardsCfg.exp;
      const cultReward = callerChar.linh_can === 'THIEN_LINH_CAN'
        ? Math.floor(rewardsCfg.cultivation * 1.3)
        : rewardsCfg.cultivation;
      const silverReward = rewardsCfg.silverMin + Math.floor(Math.random() * (rewardsCfg.silverMax - rewardsCfg.silverMin + 1));

      const droppedItems: DroppedItem[] = [];

      // Rơi vật phẩm cố định
      for (const fix of rewardsCfg.fixedLoot) {
        if (Math.random() <= fix.chance) {
          droppedItems.push({
            item_id: fix.item_id,
            item_name: fix.item_name,
            quantity: fix.quantity,
          });
        }
      }

      // Rơi vật phẩm ngẫu nhiên
      for (const rand of rewardsCfg.randomLoot) {
        if (Math.random() <= rand.chance) {
          const qty = rand.min + Math.floor(Math.random() * (rand.max - rand.min + 1));
          if (qty > 0) {
            droppedItems.push({
              item_id: rand.item_id,
              item_name: rand.item_name,
              quantity: qty,
            });
          }
        }
      }

      // 2.5 Áp dụng EXP, Tu Vi, Bạc vào nhân vật
      const charInDb = await tx.xianxiaCharacter.findUnique({ where: { id: callerChar.id } });
      if (charInDb) {
        xianxiaCharacterService.applyExpGain(charInDb, expReward);
        charInDb.cultivation += cultReward;
        charInDb.silver += silverReward;

        await tx.xianxiaCharacter.update({
          where: { id: charInDb.id },
          data: {
            level: charInDb.level,
            exp: charInDb.exp,
            exp_required: charInDb.exp_required,
            cultivation: charInDb.cultivation,
            silver: charInDb.silver,
          },
        });
      }

      // 2.6 Lưu vật phẩm vào túi đồ
      for (const item of droppedItems) {
        await tx.xianxiaInventoryItem.upsert({
          where: {
            character_id_item_id: {
              character_id: callerChar.id,
              item_id: item.item_id,
            },
          },
          update: { quantity: { increment: item.quantity } },
          create: {
            character_id: callerChar.id,
            item_id: item.item_id,
            quantity: item.quantity,
          },
        });
      }

      // 2.7 Cập nhật tiến độ nhiệm vụ
      await xianxiaQuestService.recordMonsterKillDb(callerChar.id, 'boss_u_minh_lang_vuong', 1, tx).catch(() => {});

      // 2.8 Lưu bản ghi nhận thưởng với ràng buộc kép
      await tx.xianxiaDungeonRewardClaim.create({
        data: {
          dungeon_run_id: run.id,
          character_id: callerChar.id,
          idempotency_key: scopedKey || `dungeon:claim:${run.id}:${callerChar.id}`,
          exp_reward: expReward,
          cultivation_reward: cultReward,
          silver_reward: silverReward,
          items_reward: JSON.stringify(droppedItems),
        },
      });

      return {
        claimed: true,
        idempotent: false,
        exp: expReward,
        cultivation: cultReward,
        silver: silverReward,
        items: droppedItems,
      };
    }, { maxWait: 15000, timeout: 20000 });
  } catch (err: any) {
    if (err?.needsExpirePersist && err?.runId && err?.partyId) {
      await prisma.$transaction([
        prisma.xianxiaDungeonRun.update({
          where: { id: err.runId },
          data: { status: 'EXPIRED' },
        }),
        prisma.xianxiaParty.update({
          where: { id: err.partyId },
          data: { status: 'FORMING' },
        }),
      ]).catch(() => {});
    }
    throw err;
  }
}

  /**
   * 6. Đồng bộ và kết nối lại khi mất mạng (Reconnect)
   */
  public async reconnect(userId: number, runId: string): Promise<DungeonRunDetail> {
    const callerChar = await prisma.xianxiaCharacter.findUnique({ where: { user_id: userId } });
    if (!callerChar) throw new Error('DUNGEON_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

    const run = await prisma.xianxiaDungeonRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new Error('DUNGEON_RUN_NOT_FOUND: Không tìm thấy phiên phó bản.');

    // Kiểm tra quyền
    const member = await prisma.xianxiaDungeonMember.findUnique({
      where: {
        dungeon_run_id_character_id: {
          dungeon_run_id: run.id,
          character_id: callerChar.id,
        },
      },
    });
    if (!member) {
      throw new Error('DUNGEON_FORBIDDEN: Đạo hữu không thuộc phiên phó bản này.');
    }

    // Kiểm tra hết hạn
    if (run.status === 'IN_PROGRESS' && run.expires_at <= new Date()) {
      await prisma.xianxiaDungeonRun.update({
        where: { id: run.id },
        data: { status: 'EXPIRED' },
      });
      await prisma.xianxiaParty.update({
        where: { id: run.party_id },
        data: { status: 'FORMING' },
      });
      run.status = 'EXPIRED';
      throw new Error('DUNGEON_EXPIRED: Phiên phó bản đã hết hạn 15 phút.');
    }

    // Cập nhật trạng thái kết nối
    await prisma.xianxiaDungeonMember.update({
      where: { id: member.id },
      data: { is_connected: true, last_seen_at: new Date() },
    });

    return this.formatDungeonRun(run);
  }

  /**
   * Định dạng dữ liệu trả về cho client
   */
  private formatDungeonRun(
    run: any,
    cachedState?: DungeonCombatState,
    cachedLogs?: string[]
  ): DungeonRunDetail {
    const state: DungeonCombatState | null = cachedState || (run.combat_state ? JSON.parse(run.combat_state) : null);
    const logs: string[] = cachedLogs || (run.combat_log ? JSON.parse(run.combat_log) : []);

    return {
      id: run.id,
      dungeonId: run.dungeon_id,
      dungeonName: XianxiaDungeonService.DUNGEON_CONFIG.name,
      partyId: run.party_id,
      leaderCharacterId: run.leader_character_id,
      status: run.status,
      currentWave: run.current_wave,
      totalWaves: run.total_waves,
      turnsCount: run.turns_count,
      version: run.version,
      combatState: state,
      combatLog: logs,
      expiresAt: run.expires_at.toISOString(),
      startedAt: run.started_at.toISOString(),
      completedAt: run.completed_at ? run.completed_at.toISOString() : null,
    };
  }
}

export const xianxiaDungeonService = new XianxiaDungeonService();
