import { prisma } from '../../utils/prisma.js';
import { xianxiaCharacterService } from './xianxiaCharacterService.js';
import { xianxiaCraftingService } from './xianxiaCraftingService.js';
import { ItemDefinition } from '../../types/xianxia.js';

export interface ShopBuyResult {
  success: boolean;
  message: string;
  item: {
    id: string;
    name: string;
    quantity: number;
  };
  currentQuantity: number;
  silverRemaining: number;
}

export interface ShopSellResult {
  success: boolean;
  message: string;
  item: {
    id: string;
    name: string;
    quantity: number;
  };
  totalGain: number;
  silverRemaining: number;
}

export class XianxiaMerchantService {
  // Danh sách ID vật phẩm bán tại Tiệm Bách Hóa & Dược Thảo
  private defaultCatalogItemIds: string[] = [
    'item_hoi_xuan_dan',
    'item_duong_khi_dan',
    'item_truc_co_dan',
    'item_thao_moc_linh_chi',
    'item_kim_ngan_hoa',
    'item_bach_nien_sam',
    'item_thiet_khoang',
    'item_thanh_tam_boi',
    'item_thanh_phong_kiem',
    'item_te_khong_bao_giap',
  ];

  /**
   * Lấy danh mục hàng hóa của tiệm
   */
  public getShopCatalog(): ItemDefinition[] {
    const allItems = xianxiaCraftingService.getAllItems();
    return allItems.filter(
      it => this.defaultCatalogItemIds.includes(it.id) || (it.buy_price && it.buy_price > 0)
    );
  }

  /**
   * Mua vật phẩm từ tiệm bách hóa (Authoritative Transaction)
   */
  public async buyItem(
    userId: number,
    itemId: string,
    quantity: number = 1
  ): Promise<ShopBuyResult> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Số lượng mua phải là số nguyên dương lớn hơn 0.');
    }

    const itemDef = xianxiaCraftingService.getItemById(itemId);
    if (!itemDef) {
      throw new Error(`Không tìm thấy vật phẩm có ID: ${itemId}`);
    }

    const price = itemDef.buy_price;
    if (price === undefined || price <= 0) {
      throw new Error(`Vật phẩm [${itemDef.name}] không thể mua tại tiệm.`);
    }

    const totalCost = price * quantity;

    return await prisma.$transaction(async tx => {
      // Khóa bi quan hàng nhân vật để tuần tự hóa các giao dịch đồng thời
      await tx.$queryRawUnsafe(
        'SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE',
        userId
      );

      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      if (char.silver < totalCost) {
        throw new Error(
          `Không đủ Bạc để mua ${quantity}x [${itemDef.name}]! Cần ${totalCost} Bạc, hiện có ${char.silver} Bạc.`
        );
      }

      // Trừ Bạc nhân vật
      const updatedChar = await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: { silver: char.silver - totalCost },
      });

      // Upsert vào túi đồ
      const slot = await tx.xianxiaInventoryItem.upsert({
        where: {
          character_id_item_id: {
            character_id: char.id,
            item_id: itemId,
          },
        },
        update: {
          quantity: { increment: quantity },
        },
        create: {
          character_id: char.id,
          item_id: itemId,
          quantity: quantity,
        },
      });

      return {
        success: true,
        message: `Đã mua thành công ${quantity}x [${itemDef.name}] với giá ${totalCost} Bạc!`,
        item: {
          id: itemDef.id,
          name: itemDef.name,
          quantity,
        },
        currentQuantity: slot.quantity,
        silverRemaining: updatedChar.silver,
      };
    });
  }

  /**
   * Bán vật phẩm từ túi đồ vào tiệm bách hóa (Authoritative Transaction)
   */
  public async sellItem(
    userId: number,
    itemId: string,
    quantity: number = 1
  ): Promise<ShopSellResult> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Số lượng bán phải là số nguyên dương lớn hơn 0.');
    }

    const itemDef = xianxiaCraftingService.getItemById(itemId);
    if (!itemDef) {
      throw new Error(`Không tìm thấy vật phẩm có ID: ${itemId}`);
    }

    const sellPrice = itemDef.sell_price || Math.floor((itemDef.buy_price || 10) * 0.5);
    if (sellPrice <= 0) {
      throw new Error(`Vật phẩm [${itemDef.name}] không có giá trị thu mua.`);
    }

    const totalGain = sellPrice * quantity;

    return await prisma.$transaction(async tx => {
      // Khóa bi quan hàng nhân vật để tuần tự hóa các giao dịch đồng thời
      await tx.$queryRawUnsafe(
        'SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE',
        userId
      );

      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      const slot = await tx.xianxiaInventoryItem.findUnique({
        where: {
          character_id_item_id: {
            character_id: char.id,
            item_id: itemId,
          },
        },
      });

      if (!slot || slot.quantity < quantity) {
        throw new Error(
          `Không đủ số lượng [${itemDef.name}] để bán! Yêu cầu x${quantity}, trong túi hiện có x${slot?.quantity || 0}.`
        );
      }

      // Khấu trừ túi đồ
      if (slot.quantity === quantity) {
        await tx.xianxiaInventoryItem.delete({
          where: { id: slot.id },
        });
      } else {
        await tx.xianxiaInventoryItem.update({
          where: { id: slot.id },
          data: { quantity: slot.quantity - quantity },
        });
      }

      // Cộng Bạc cho nhân vật
      const updatedChar = await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: { silver: char.silver + totalGain },
      });

      return {
        success: true,
        message: `Đã bán ${quantity}x [${itemDef.name}], thu về ${totalGain} Bạc!`,
        item: {
          id: itemDef.id,
          name: itemDef.name,
          quantity,
        },
        totalGain,
        silverRemaining: updatedChar.silver,
      };
    });
  }
}

export const xianxiaMerchantService = new XianxiaMerchantService();
