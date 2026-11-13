import fs from 'fs';
import path from 'path';
import {
  ItemDefinition,
  GatheringNode,
  CraftingRecipe,
  CraftingDiscipline,
  PlayerCraftingContext,
  GatheringResult,
  CraftingResult,
  DroppedItem,
} from '../../types/xianxia.js';
import { REALM_HIERARCHY } from './xianxiaWorldService.js';

export class XianxiaCraftingService {
  private items: Map<string, ItemDefinition> = new Map();
  private nodes: Map<string, GatheringNode> = new Map();
  private recipes: Map<string, CraftingRecipe> = new Map();

  constructor() {
    this.loadCraftingData();
  }

  /**
   * Tải toàn bộ dữ liệu Items, Gathering Nodes và Recipes từ JSON
   */
  public loadCraftingData(): void {
    this.loadItems();
    this.loadGatheringNodes();
    this.loadRecipes();
  }

  private findJsonPath(fileName: string): string | null {
    const candidates = [
      path.resolve(__dirname, `../../data/xianxia/${fileName}`),
      path.resolve(__dirname, `../../../src/data/xianxia/${fileName}`),
      path.resolve(process.cwd(), `src/data/xianxia/${fileName}`),
      path.resolve(process.cwd(), `dist/data/xianxia/${fileName}`),
      path.resolve(process.cwd(), `backend/src/data/xianxia/${fileName}`),
      path.resolve(process.cwd(), `backend/dist/data/xianxia/${fileName}`),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private loadItems(): void {
    try {
      const p = this.findJsonPath('items.json');
      if (!p) return;
      const parsed: ItemDefinition[] = JSON.parse(fs.readFileSync(p, 'utf-8'));
      this.items.clear();
      for (const it of parsed) {
        this.items.set(it.id, it);
      }
      console.log(`[XianxiaCraftingService] Đã nạp ${this.items.size} vật phẩm.`);
    } catch (err) {
      console.error('❌ Lỗi khi nạp items.json:', err);
    }
  }

  private loadGatheringNodes(): void {
    try {
      const p = this.findJsonPath('gatheringNodes.json');
      if (!p) return;
      const parsed: GatheringNode[] = JSON.parse(fs.readFileSync(p, 'utf-8'));
      this.nodes.clear();
      for (const n of parsed) {
        this.nodes.set(n.id, n);
      }
      console.log(`[XianxiaCraftingService] Đã nạp ${this.nodes.size} điểm thu thập.`);
    } catch (err) {
      console.error('❌ Lỗi khi nạp gatheringNodes.json:', err);
    }
  }

  private loadRecipes(): void {
    try {
      const p = this.findJsonPath('recipes.json');
      if (!p) return;
      const parsed: CraftingRecipe[] = JSON.parse(fs.readFileSync(p, 'utf-8'));
      this.recipes.clear();
      for (const r of parsed) {
        this.recipes.set(r.id, r);
      }
      console.log(`[XianxiaCraftingService] Đã nạp ${this.recipes.size} công thức chế tác.`);
    } catch (err) {
      console.error('❌ Lỗi khi nạp recipes.json:', err);
    }
  }

  // --- QUERY METHODS ---

  public getAllItems(): ItemDefinition[] {
    return Array.from(this.items.values());
  }

  public getItemById(id: string): ItemDefinition | undefined {
    return this.items.get(id);
  }

  public getAllGatheringNodes(): GatheringNode[] {
    return Array.from(this.nodes.values());
  }

  public getGatheringNodeById(id: string): GatheringNode | undefined {
    return this.nodes.get(id);
  }

  public getGatheringNodesByZone(zoneId: string): GatheringNode[] {
    return Array.from(this.nodes.values()).filter(n => n.zone_id === zoneId);
  }

  public getAllRecipes(): CraftingRecipe[] {
    return Array.from(this.recipes.values());
  }

  public getRecipeById(id: string): CraftingRecipe | undefined {
    return this.recipes.get(id);
  }

  public getRecipesByDiscipline(discipline: CraftingDiscipline): CraftingRecipe[] {
    return Array.from(this.recipes.values()).filter(r => r.discipline === discipline);
  }

  // --- BUSINESS LOGIC ---

  /**
   * Thực hiện hành vi thu thập tài nguyên tiên gia
   */
  public gatherResource(
    nodeId: string,
    player: PlayerCraftingContext,
    forcedSuccess?: boolean
  ): GatheringResult {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Điểm thu thập không tồn tại: ${nodeId}`);
    }

    // 1. Kiểm tra cảnh giới tối thiểu
    const playerRank = REALM_HIERARCHY[player.realm] ?? 0;
    const requiredRank = REALM_HIERARCHY[node.min_realm] ?? 0;
    if (playerRank < requiredRank) {
      throw new Error(`Cảnh giới không đủ để thu thập tại đây (Yêu cầu tối thiểu ${node.min_realm})`);
    }

    // 2. Kiểm tra thể lực
    if (player.fatigue < node.fatigue_cost) {
      throw new Error(`Không đủ thể lực để thu thập (Cần ${node.fatigue_cost}, hiện có ${player.fatigue})`);
    }

    // 3. Tính tỷ lệ thành công (Node rate + Khí vận bonus)
    const luckBonus = player.luck ? player.luck * 0.005 : 0;
    const finalRate = Math.min(0.99, node.success_rate + luckBonus);
    const isSuccess = forcedSuccess !== undefined ? forcedSuccess : Math.random() <= finalRate;

    const gatheredItems: DroppedItem[] = [];
    let cultivationGained = 0;
    let narrative = '';

    if (isSuccess) {
      for (const drop of node.drops) {
        if (Math.random() <= drop.chance) {
          const qty = Math.floor(Math.random() * (drop.max_qty - drop.min_qty + 1)) + drop.min_qty;
          if (qty > 0) {
            gatheredItems.push({
              item_id: drop.item_id,
              item_name: drop.item_name,
              quantity: qty,
            });
          }
        }
      }

      // Đảm bảo nếu may mắn thành công thì có ít nhất 1 vật phẩm rơi ra
      if (gatheredItems.length === 0 && node.drops.length > 0) {
        const firstDrop = node.drops[0];
        gatheredItems.push({
          item_id: firstDrop.item_id,
          item_name: firstDrop.item_name,
          quantity: firstDrop.min_qty,
        });
      }

      cultivationGained = Math.max(5, Math.floor(node.fatigue_cost * 1.5));
      narrative = `Ngươi cẩn trọng vận chuyển linh khí, thu hoạch thành công tài nguyên từ [${node.name}], tích lũy được ${cultivationGained} điểm tu vi!`;
    } else {
      narrative = `Đáng tiếc! Động tác sơ suất hoặc linh căn của dược liệu/mạch khoáng tại [${node.name}] bị tổn hại, không thu được gì.`;
    }

    return {
      node_id: node.id,
      node_name: node.name,
      success: isSuccess,
      fatigue_spent: node.fatigue_cost,
      cultivation_gained: cultivationGained,
      items_gathered: gatheredItems,
      narrative,
    };
  }

  /**
   * Thực hiện Luyện Đan hoặc Luyện Khí (Server-Authoritative Crafting)
   */
  public craftItem(
    recipeId: string,
    player: PlayerCraftingContext,
    forcedSuccess?: boolean
  ): CraftingResult {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Công thức chế tác không tồn tại: ${recipeId}`);
    }

    // 1. Kiểm tra cảnh giới
    const playerRank = REALM_HIERARCHY[player.realm] ?? 0;
    const requiredRank = REALM_HIERARCHY[recipe.min_realm] ?? 0;
    if (playerRank < requiredRank) {
      throw new Error(`Cảnh giới không đủ để tiến hành công thức này (Yêu cầu ${recipe.min_realm})`);
    }

    // 2. Kiểm tra thể lực
    if (player.fatigue < recipe.fatigue_cost) {
      throw new Error(`Không đủ thể lực để chế tác (Cần ${recipe.fatigue_cost}, hiện có ${player.fatigue})`);
    }

    // 3. Kiểm tra ngân lượng
    if (player.silver < recipe.silver_cost) {
      throw new Error(`Không đủ ngân lượng để đốt lửa lò/mua than đúc (Cần ${recipe.silver_cost} lượng bạc, hiện có ${player.silver})`);
    }

    // 4. Kiểm tra nguyên liệu trong túi đồ
    const inventoryMap = new Map<string, number>();
    for (const slot of player.inventory) {
      inventoryMap.set(slot.item_id, (inventoryMap.get(slot.item_id) ?? 0) + slot.quantity);
    }

    for (const mat of recipe.required_materials) {
      const currentQty = inventoryMap.get(mat.item_id) ?? 0;
      if (currentQty < mat.quantity) {
        throw new Error(
          `Không đủ nguyên liệu [${mat.item_name}]: Cần ${mat.quantity}, trong túi hiện có ${currentQty}`
        );
      }
    }

    // Tiêu hao nguyên liệu
    const consumedMaterials = recipe.required_materials.map(m => ({
      item_id: m.item_id,
      quantity: m.quantity,
    }));

    // 5. Tính tỷ lệ thành công (Base rate + Ngộ tính bonus)
    const compBonus = player.comprehension ? (player.comprehension - 10) * 0.015 : 0;
    const finalRate = Math.min(0.95, Math.max(0.1, recipe.base_success_rate + compBonus));
    const isSuccess = forcedSuccess !== undefined ? forcedSuccess : Math.random() <= finalRate;

    if (isSuccess) {
      const prod = recipe.result_success;
      const disciplineName = recipe.discipline === 'ALCHEMY' ? 'Luyện Đan' : 'Luyện Khí';
      return {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        discipline: recipe.discipline,
        success: true,
        fatigue_spent: recipe.fatigue_cost,
        silver_spent: recipe.silver_cost,
        materials_consumed: consumedMaterials,
        item_produced: {
          item_id: prod.item_id,
          item_name: prod.item_name,
          quantity: prod.quantity,
        },
        cultivation_gained: prod.cultivation_gained,
        exp_gained: prod.exp_gained,
        narrative: `Linh quang bừng sáng! Bạn đã hoàn thành thuật [${disciplineName}], luyện chế thành công [${prod.item_name} x${prod.quantity}]!`,
      };
    } else {
      const failInfo = recipe.result_failure;
      const produced: DroppedItem | undefined = failInfo?.item_id
        ? {
            item_id: failInfo.item_id,
            item_name: failInfo.item_name || 'Phế phẩm',
            quantity: failInfo.quantity || 1,
          }
        : undefined;

      return {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        discipline: recipe.discipline,
        success: false,
        fatigue_spent: recipe.fatigue_cost,
        silver_spent: recipe.silver_cost,
        materials_consumed: consumedMaterials,
        item_produced: produced,
        cultivation_gained: 5,
        exp_gained: 5,
        narrative: failInfo?.narrative || 'Luyện chế thất bại, nguyên liệu đã bị hư hao tiêu tán!',
      };
    }
  }
}

export const xianxiaCraftingService = new XianxiaCraftingService();
