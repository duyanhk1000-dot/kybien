import fs from 'fs';
import path from 'path';
import { Npc, Monster, MonsterTier, RollLootResult, DroppedItem } from '../../types/xianxia.js';

export class XianxiaBestiaryService {
  private npcs: Map<string, Npc> = new Map();
  private monsters: Map<string, Monster> = new Map();

  constructor() {
    this.loadData();
  }

  /**
   * Tải dữ liệu NPC và Yêu thú từ các file JSON
   */
  public loadData(): void {
    // 1. Tải NPC
    const npcCandidates = [
      path.resolve(__dirname, '../../data/xianxia/npcs.json'),
      path.resolve(__dirname, '../../../src/data/xianxia/npcs.json'),
      path.resolve(process.cwd(), 'src/data/xianxia/npcs.json'),
      path.resolve(process.cwd(), 'dist/data/xianxia/npcs.json'),
      path.resolve(process.cwd(), 'backend/src/data/xianxia/npcs.json'),
    ];
    const npcPath = npcCandidates.find(p => fs.existsSync(p));
    if (npcPath) {
      const rawNpcs = JSON.parse(fs.readFileSync(npcPath, 'utf-8')) as { npcs: Npc[] };
      this.npcs.clear();
      for (const n of rawNpcs.npcs) {
        this.npcs.set(n.id, n);
      }
    } else {
      console.warn('[XianxiaBestiaryService] Cảnh báo: Không tìm thấy npcs.json');
    }

    // 2. Tải Quái vật
    const monsterCandidates = [
      path.resolve(__dirname, '../../data/xianxia/monsters.json'),
      path.resolve(__dirname, '../../../src/data/xianxia/monsters.json'),
      path.resolve(process.cwd(), 'src/data/xianxia/monsters.json'),
      path.resolve(process.cwd(), 'dist/data/xianxia/monsters.json'),
      path.resolve(process.cwd(), 'backend/src/data/xianxia/monsters.json'),
    ];
    const monsterPath = monsterCandidates.find(p => fs.existsSync(p));
    if (monsterPath) {
      const rawMonsters = JSON.parse(fs.readFileSync(monsterPath, 'utf-8')) as { monsters: Monster[] };
      this.monsters.clear();
      for (const m of rawMonsters.monsters) {
        this.monsters.set(m.id, m);
      }
    } else {
      console.warn('[XianxiaBestiaryService] Cảnh báo: Không tìm thấy monsters.json');
    }
  }

  // ==========================================
  // PHÂN HỆ NPC (NON-PLAYER CHARACTERS)
  // ==========================================

  public getAllNpcs(): Npc[] {
    return Array.from(this.npcs.values());
  }

  public getNpcById(id: string): Npc | null {
    return this.npcs.get(id) || null;
  }

  public getNpcsByZone(zoneId: string): Npc[] {
    return Array.from(this.npcs.values()).filter(n => n.zone_id === zoneId);
  }

  public getNpcsByPlace(placeId: string): Npc[] {
    return Array.from(this.npcs.values()).filter(n => n.place_id === placeId);
  }

  /**
   * Lấy lời thoại ngẫu nhiên của NPC
   */
  public getRandomDialogue(npcId: string): { greeting: string; quote: string; quest_hint?: string } | null {
    const npc = this.getNpcById(npcId);
    if (!npc) return null;

    const idleList = npc.dialogues.idle;
    const randomQuote = idleList.length > 0
      ? idleList[Math.floor(Math.random() * idleList.length)]
      : '';

    return {
      greeting: npc.dialogues.greeting,
      quote: randomQuote,
      quest_hint: npc.dialogues.quest_hint,
    };
  }

  // ==========================================
  // PHÂN HỆ YÊU THÚ & RƠI ĐỒ (BESTIARY & LOOT)
  // ==========================================

  public getAllMonsters(): Monster[] {
    return Array.from(this.monsters.values());
  }

  public getMonsterById(id: string): Monster | null {
    return this.monsters.get(id) || null;
  }

  public getMonstersByZone(zoneId: string): Monster[] {
    return Array.from(this.monsters.values()).filter(m => m.zone_id === zoneId);
  }

  public getMonstersByTier(tier: MonsterTier): Monster[] {
    return Array.from(this.monsters.values()).filter(m => m.tier === tier);
  }

  /**
   * Cơ chế rơi đồ (Loot Roll) được tính toán hoàn toàn phía máy chủ (Server-authoritative)
   * Chống gian lận client tự báo đồ nhặt được
   * Có hỗ trợ truyền randomFn để phục vụ việc kiểm thử Unit Test determinism
   */
  public rollLoot(monsterId: string, customRandom?: () => number): RollLootResult | null {
    const monster = this.getMonsterById(monsterId);
    if (!monster) return null;

    const rand = customRandom || Math.random;

    // 1. Tính toán lượng Bạc rơi ngẫu nhiên
    const silverDiff = monster.silver_reward_max - monster.silver_reward_min;
    const silverGained = monster.silver_reward_min + Math.floor(rand() * (silverDiff + 1));

    // 2. Tính toán danh sách vật phẩm rơi theo bảng tỷ lệ loot_table
    const droppedItems: DroppedItem[] = [];

    for (const drop of monster.loot_table) {
      const roll = rand();
      if (roll <= drop.chance) {
        const qtyDiff = drop.max_quantity - drop.min_quantity;
        const qty = drop.min_quantity + Math.floor(rand() * (qtyDiff + 1));
        if (qty > 0) {
          droppedItems.push({
            item_id: drop.item_id,
            item_name: drop.item_name,
            quantity: qty,
          });
        }
      }
    }

    return {
      monster_id: monster.id,
      monster_name: monster.name,
      exp_gained: monster.exp_reward,
      cultivation_gained: monster.cultivation_reward,
      silver_gained: silverGained,
      dropped_items: droppedItems,
    };
  }
}

export const xianxiaBestiaryService = new XianxiaBestiaryService();
