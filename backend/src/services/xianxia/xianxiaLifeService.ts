import { prisma } from '../../utils/prisma.js';
import { xianxiaCharacterService } from './xianxiaCharacterService.js';
import { xianxiaCraftingService } from './xianxiaCraftingService.js';
import { xianxiaQuestService } from './xianxiaQuestService.js';
import { REALM_HIERARCHY } from './xianxiaWorldService.js';
import {
  GatheringNode,
  CraftingRecipe,
  GatheringResult,
  CraftingResult,
  DroppedItem,
  RealmTier,
} from '../../types/xianxia.js';

export class XianxiaLifeService {
  /**
   * Lấy danh sách toàn bộ điểm thu thập
   */
  public getGatheringNodes(): GatheringNode[] {
    return xianxiaCraftingService.getAllGatheringNodes();
  }

  /**
   * Lấy danh sách toàn bộ công thức chế tác
   */
  public getRecipes(): CraftingRecipe[] {
    return xianxiaCraftingService.getAllRecipes();
  }

  /**
   * Thu thập tài nguyên Tiên Gia (Authoritative Server Transaction)
   */
  public async gatherResource(
    userId: number,
    nodeId: string,
    forcedSuccess?: boolean
  ): Promise<GatheringResult> {
    const node = xianxiaCraftingService.getGatheringNodeById(nodeId);
    if (!node) {
      throw new Error(`Điểm thu thập không tồn tại: ${nodeId}`);
    }

    return await prisma.$transaction(async tx => {
      // Row-level locking to prevent race condition during gathering
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE', userId);

      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      // 1. Kiểm tra cảnh giới
      const playerRank = REALM_HIERARCHY[char.realm as RealmTier] ?? 0;
      const requiredRank = REALM_HIERARCHY[node.min_realm] ?? 0;
      if (playerRank < requiredRank) {
        throw new Error(
          `Cảnh giới không đủ để thu thập tại đây (Yêu cầu tối thiểu ${node.min_realm}, hiện tại ${char.realm})`
        );
      }

      // 2. Kiểm tra thể lực
      if (char.fatigue < node.fatigue_cost) {
        throw new Error(
          `Không đủ thể lực để thu thập (Cần ${node.fatigue_cost}, hiện có ${char.fatigue})`
        );
      }

      // 3. Trừ thể lực
      char.fatigue -= node.fatigue_cost;

      // 4. Tính toán tỷ lệ thành công
      const luckBonus = char.luck ? char.luck * 0.005 : 0;
      const finalRate = Math.min(0.99, node.success_rate + luckBonus);
      const isSuccess = forcedSuccess !== undefined ? forcedSuccess : Math.random() <= finalRate;

      const gatheredItems: DroppedItem[] = [];
      let cultivationGained = 0;
      let narrative = '';

      if (isSuccess) {
        for (const drop of node.drops) {
          if (Math.random() <= drop.chance) {
            const qty =
              Math.floor(Math.random() * (drop.max_qty - drop.min_qty + 1)) + drop.min_qty;
            if (qty > 0) {
              gatheredItems.push({
                item_id: drop.item_id,
                item_name: drop.item_name,
                quantity: qty,
              });
            }
          }
        }

        // Đảm bảo thành công thì có ít nhất 1 vật phẩm
        if (gatheredItems.length === 0 && node.drops.length > 0) {
          const firstDrop = node.drops[0];
          gatheredItems.push({
            item_id: firstDrop.item_id,
            item_name: firstDrop.item_name,
            quantity: firstDrop.min_qty,
          });
        }

        cultivationGained = Math.max(5, Math.floor(node.fatigue_cost * 1.5));
        char.cultivation += cultivationGained;
        narrative = `Ngươi cẩn trọng vận chuyển linh khí, thu hoạch thành công tài nguyên từ [${node.name}], tích lũy được ${cultivationGained} điểm tu vi!`;

        // Lưu vật phẩm thu được vào kho đồ
        for (const item of gatheredItems) {
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

          // Gắn hook cập nhật nhiệm vụ thu thập trong DB
          await xianxiaQuestService.recordLootAcquiredDb(char.id, item.item_id, item.quantity, tx);
        }
      } else {
        narrative = `Đáng tiếc! Động tác sơ suất hoặc linh căn của dược liệu/mạch khoáng tại [${node.name}] bị tổn hại, không thu được gì.`;
      }

      // Cập nhật thuộc tính nhân vật
      await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: {
          fatigue: char.fatigue,
          cultivation: char.cultivation,
        },
      });

      return {
        node_id: node.id,
        node_name: node.name,
        success: isSuccess,
        fatigue_spent: node.fatigue_cost,
        cultivation_gained: cultivationGained,
        items_gathered: gatheredItems,
        narrative,
      };
    });
  }

  /**
   * Luyện chế Đan Dược hoặc Pháp Khí (Authoritative Server Transaction)
   */
  public async craftItem(
    userId: number,
    recipeId: string,
    forcedSuccess?: boolean
  ): Promise<CraftingResult> {
    const recipe = xianxiaCraftingService.getRecipeById(recipeId);
    if (!recipe) {
      throw new Error(`Công thức chế tác không tồn tại: ${recipeId}`);
    }

    return await prisma.$transaction(async tx => {
      // Row-level locking to prevent race condition during crafting
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE', userId);

      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      // 1. Kiểm tra cảnh giới
      const playerRank = REALM_HIERARCHY[char.realm as RealmTier] ?? 0;
      const requiredRank = REALM_HIERARCHY[recipe.min_realm] ?? 0;
      if (playerRank < requiredRank) {
        throw new Error(
          `Cảnh giới không đủ để tiến hành công thức này (Yêu cầu ${recipe.min_realm}, hiện tại ${char.realm})`
        );
      }

      // 2. Kiểm tra thể lực
      if (char.fatigue < recipe.fatigue_cost) {
        throw new Error(
          `Không đủ thể lực để chế tác (Cần ${recipe.fatigue_cost}, hiện có ${char.fatigue})`
        );
      }

      // 3. Kiểm tra ngân lượng
      if (char.silver < recipe.silver_cost) {
        throw new Error(
          `Không đủ ngân lượng để đốt lửa lò/mua than đúc (Cần ${recipe.silver_cost} Bạc, hiện có ${char.silver})`
        );
      }

      // 4. Kiểm tra nguyên liệu trong túi đồ
      const inventory = await tx.xianxiaInventoryItem.findMany({
        where: { character_id: char.id },
      });

      const invMap = new Map<string, { id: number; quantity: number }>();
      for (const slot of inventory) {
        invMap.set(slot.item_id, { id: slot.id, quantity: slot.quantity });
      }

      for (const mat of recipe.required_materials) {
        const slot = invMap.get(mat.item_id);
        const currentQty = slot ? slot.quantity : 0;
        if (currentQty < mat.quantity) {
          throw new Error(
            `Không đủ nguyên liệu [${mat.item_name}]: Cần ${mat.quantity}, trong túi hiện có ${currentQty}`
          );
        }
      }

      // 5. Trừ thể lực và ngân lượng
      char.fatigue -= recipe.fatigue_cost;
      char.silver -= recipe.silver_cost;

      // 6. Khấu trừ nguyên liệu từ túi đồ
      const consumedMaterials = recipe.required_materials.map(m => ({
        item_id: m.item_id,
        quantity: m.quantity,
      }));

      for (const mat of recipe.required_materials) {
        const slot = invMap.get(mat.item_id)!;
        if (slot.quantity === mat.quantity) {
          await tx.xianxiaInventoryItem.delete({
            where: { id: slot.id },
          });
        } else {
          await tx.xianxiaInventoryItem.update({
            where: { id: slot.id },
            data: { quantity: slot.quantity - mat.quantity },
          });
        }
      }

      // 7. Tính xác suất thành công
      let compBonus = char.comprehension ? (char.comprehension - 10) * 0.015 : 0;
      if (char.origin === 'THAO_DUOC_DONG' && recipe.discipline === 'ALCHEMY') {
        compBonus += 0.2;
      }
      const finalRate = Math.min(0.95, Math.max(0.1, recipe.base_success_rate + compBonus));
      const isSuccess = forcedSuccess !== undefined ? forcedSuccess : Math.random() <= finalRate;

      let resultProd: DroppedItem | undefined;
      let cultGain = 0;
      let expGain = 0;
      let narrative = '';

      if (isSuccess) {
        const prod = recipe.result_success;
        resultProd = {
          item_id: prod.item_id,
          item_name: prod.item_name,
          quantity: prod.quantity,
        };
        cultGain = prod.cultivation_gained;
        expGain = prod.exp_gained;

        // Lưu sản phẩm vào túi đồ
        await tx.xianxiaInventoryItem.upsert({
          where: {
            character_id_item_id: {
              character_id: char.id,
              item_id: prod.item_id,
            },
          },
          update: { quantity: { increment: prod.quantity } },
          create: {
            character_id: char.id,
            item_id: prod.item_id,
            quantity: prod.quantity,
          },
        });

        // Hook quest thu thập / chế tạo
        await xianxiaQuestService.recordLootAcquiredDb(char.id, prod.item_id, prod.quantity, tx);

        const disciplineName = recipe.discipline === 'ALCHEMY' ? 'Luyện Đan' : 'Luyện Khí';
        narrative = `Linh quang bừng sáng! Bạn đã hoàn thành thuật [${disciplineName}], luyện chế thành công [${prod.item_name} x${prod.quantity}]!`;
      } else {
        const failInfo = recipe.result_failure;
        const failItemId = failInfo?.item_id || 'item_phe_dan';
        const failItemName = failInfo?.item_name || 'Phế Đan';
        const failQty = failInfo?.quantity || 1;

        resultProd = {
          item_id: failItemId,
          item_name: failItemName,
          quantity: failQty,
        };
        cultGain = 5;
        expGain = 5;

        // Lưu phế phẩm vào túi đồ
        await tx.xianxiaInventoryItem.upsert({
          where: {
            character_id_item_id: {
              character_id: char.id,
              item_id: failItemId,
            },
          },
          update: { quantity: { increment: failQty } },
          create: {
            character_id: char.id,
            item_id: failItemId,
            quantity: failQty,
          },
        });

        narrative = failInfo?.narrative || 'Luyện chế thất bại, dược hỏa mất khống chế biến thành Phế Đan!';
      }

      // Tăng EXP và Tu Vi
      char.cultivation += cultGain;
      xianxiaCharacterService.applyExpGain(char, expGain);

      // Cập nhật nhân vật vào DB
      await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: {
          level: char.level,
          exp: char.exp,
          exp_required: char.exp_required,
          cultivation: char.cultivation,
          health: char.health,
          max_health: char.max_health,
          fatigue: char.fatigue,
          max_fatigue: char.max_fatigue,
          silver: char.silver,
          stat_points: char.stat_points,
        },
      });

      return {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        discipline: recipe.discipline,
        success: isSuccess,
        fatigue_spent: recipe.fatigue_cost,
        silver_spent: recipe.silver_cost,
        materials_consumed: consumedMaterials,
        item_produced: resultProd,
        cultivation_gained: cultGain,
        exp_gained: expGain,
        narrative,
      };
    });
  }
}

export const xianxiaLifeService = new XianxiaLifeService();
