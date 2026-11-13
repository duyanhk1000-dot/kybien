import { prisma } from '../../utils/prisma.js';
import { XianxiaCraftingService } from './xianxiaCraftingService.js';
import { REALM_HIERARCHY } from './xianxiaWorldService.js';
import { RealmTier } from '../../types/xianxia.js';

export class XianxiaInventoryService {
  private craftingService: XianxiaCraftingService;

  constructor() {
    this.craftingService = new XianxiaCraftingService();
  }

  /**
   * Trang bị vật phẩm vào slot tương ứng (weapon, armor, relic)
   * Đảm bảo tính nguyên tử:
   * 1. Kiểm tra vật phẩm có trong túi đồ
   * 2. Kiểm tra yêu cầu cảnh giới (realm requirement)
   * 3. Nếu đang có trang bị cũ ở slot đó, thu hồi về túi đồ
   * 4. Trừ 1 vật phẩm được trang bị khỏi túi đồ (hoặc xóa slot nếu hết)
   * 5. Gắn vào slot của nhân vật
   */
  public async equipItem(userId: number, itemId: string) {
    const itemDef = this.craftingService.getItemById(itemId);
    if (!itemDef || itemDef.type !== 'EQUIPMENT') {
      throw new Error('Vật phẩm này không phải là trang bị có thể mang.');
    }

    return await prisma.$transaction(async (tx) => {
      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      // 1. Kiểm tra cảnh giới yêu cầu
      const reqRealm = itemDef.equipment_stats?.realm_requirement;
      if (reqRealm) {
        const charRealmScore = REALM_HIERARCHY[char.realm as RealmTier] ?? 0;
        const reqRealmScore = REALM_HIERARCHY[reqRealm] ?? 0;
        if (charRealmScore < reqRealmScore) {
          throw new Error(`Cảnh giới chưa đủ! Cần tối thiểu ${reqRealm} để sử dụng trang bị này.`);
        }
      }

      // 2. Kiểm tra tồn tại trong túi đồ
      const invItem = await tx.xianxiaInventoryItem.findUnique({
        where: {
          character_id_item_id: {
            character_id: char.id,
            item_id: itemId,
          },
        },
      });

      if (!invItem || invItem.quantity <= 0) {
        throw new Error('Ngươi không sở hữu vật phẩm này trong túi đồ.');
      }

      // Xác định slot trang bị
      let slotField: 'equipped_weapon' | 'equipped_armor' | 'equipped_relic' = 'equipped_weapon';
      const slotHint = (itemDef.equipment_stats as any)?.slot;
      if (slotHint === 'armor' || itemId.includes('giap') || itemId.includes('y')) {
        slotField = 'equipped_armor';
      } else if (slotHint === 'relic' || itemId.includes('boi') || itemId.includes('phu') || itemId.includes('chau')) {
        slotField = 'equipped_relic';
      } else {
        slotField = 'equipped_weapon';
      }

      const oldEquippedId = char[slotField];

      // 3. Nếu có trang bị cũ, hoàn trả vào túi đồ
      if (oldEquippedId) {
        await tx.xianxiaInventoryItem.upsert({
          where: {
            character_id_item_id: {
              character_id: char.id,
              item_id: oldEquippedId,
            },
          },
          update: { quantity: { increment: 1 } },
          create: { character_id: char.id, item_id: oldEquippedId, quantity: 1 },
        });
      }

      // 4. Khấu trừ 1 vật phẩm được trang bị khỏi túi đồ
      if (invItem.quantity === 1) {
        await tx.xianxiaInventoryItem.delete({
          where: { id: invItem.id },
        });
      } else {
        await tx.xianxiaInventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { decrement: 1 } },
        });
      }

      // 5. Cập nhật slot trên nhân vật
      const updatedChar = await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: { [slotField]: itemId },
      });

      return {
        success: true,
        slot: slotField,
        equippedItemId: itemId,
        unequippedItemId: oldEquippedId,
        character: updatedChar,
      };
    });
  }

  /**
   * Tháo trang bị và đưa trở lại túi đồ
   */
  public async unequipItem(userId: number, slot: 'weapon' | 'armor' | 'relic') {
    const slotMap = {
      weapon: 'equipped_weapon' as const,
      armor: 'equipped_armor' as const,
      relic: 'equipped_relic' as const,
    };
    const field = slotMap[slot];
    if (!field) throw new Error('Slot trang bị không hợp lệ.');

    return await prisma.$transaction(async (tx) => {
      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      const currentItem = char[field];
      if (!currentItem) {
        throw new Error('Vị trí này hiện đang trống, không có trang bị để tháo.');
      }

      // Hoàn trả vào túi đồ
      await tx.xianxiaInventoryItem.upsert({
        where: {
          character_id_item_id: {
            character_id: char.id,
            item_id: currentItem,
          },
        },
        update: { quantity: { increment: 1 } },
        create: { character_id: char.id, item_id: currentItem, quantity: 1 },
      });

      // Xóa slot trên nhân vật
      const updatedChar = await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: { [field]: null },
      });

      return {
        success: true,
        slot,
        unquippedItemId: currentItem,
        character: updatedChar,
      };
    });
  }

  /**
   * Sử dụng đan dược tiêu hao (PILL)
   */
  public async useItem(userId: number, itemId: string) {
    const itemDef = this.craftingService.getItemById(itemId);
    if (!itemDef) throw new Error('Vật phẩm không tồn tại.');

    if (itemDef.type !== 'PILL') {
      throw new Error('Chỉ có thể sử dụng trực tiếp các loại đan dược tiêu hao.');
    }

    return await prisma.$transaction(async (tx) => {
      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      const invItem = await tx.xianxiaInventoryItem.findUnique({
        where: {
          character_id_item_id: {
            character_id: char.id,
            item_id: itemId,
          },
        },
      });

      if (!invItem || invItem.quantity <= 0) {
        throw new Error('Ngươi không có vật phẩm này trong túi đồ.');
      }

      // Khấu trừ 1 viên đan
      if (invItem.quantity === 1) {
        await tx.xianxiaInventoryItem.delete({ where: { id: invItem.id } });
      } else {
        await tx.xianxiaInventoryItem.update({
          where: { id: invItem.id },
          data: { quantity: { decrement: 1 } },
        });
      }

      // Áp dụng hiệu ứng
      const hpHeal = itemDef.effects?.health_restore || 0;
      const fatRestore = itemDef.effects?.fatigue_restore || 0;

      const newHealth = Math.min(char.max_health, char.health + hpHeal);
      const newFatigue = Math.min(char.max_fatigue, char.fatigue + fatRestore);

      const updatedChar = await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: {
          health: newHealth,
          fatigue: newFatigue,
        },
      });

      return {
        success: true,
        item: itemDef.name,
        healthGained: hpHeal,
        fatigueGained: fatRestore,
        character: updatedChar,
      };
    });
  }
}

export const xianxiaInventoryService = new XianxiaInventoryService();
