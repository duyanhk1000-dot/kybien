import { Router, Request, Response } from 'express';
import { xianxiaCraftingService } from '../../services/xianxia/xianxiaCraftingService.js';
import { CraftingDiscipline, PlayerCraftingContext } from '../../types/xianxia.js';

export const xianxiaCraftingRouter = Router();

/**
 * GET /api/xianxia/crafting/items
 * Danh sách toàn bộ vật phẩm trong tiên môn
 */
xianxiaCraftingRouter.get('/items', (req: Request, res: Response): void => {
  try {
    const items = xianxiaCraftingService.getAllItems();
    res.status(200).json({
      success: true,
      data: items,
      total: items.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách vật phẩm',
      error: err.message,
    });
  }
});

/**
 * GET /api/xianxia/crafting/items/:id
 * Chi tiết một vật phẩm
 */
xianxiaCraftingRouter.get('/items/:id', (req: Request, res: Response): void => {
  try {
    const id = String(req.params.id);
    const item = xianxiaCraftingService.getItemById(id);
    if (!item) {
      res.status(404).json({
        success: false,
        message: `Không tìm thấy vật phẩm: ${id}`,
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết vật phẩm',
      error: err.message,
    });
  }
});

/**
 * GET /api/xianxia/crafting/nodes
 * Danh sách các điểm thu thập tài nguyên (hỗ trợ query ?zone_id=...)
 */
xianxiaCraftingRouter.get('/nodes', (req: Request, res: Response): void => {
  try {
    const zoneId = req.query.zone_id as string | undefined;
    const nodes = zoneId
      ? xianxiaCraftingService.getGatheringNodesByZone(zoneId)
      : xianxiaCraftingService.getAllGatheringNodes();

    res.status(200).json({
      success: true,
      data: nodes,
      total: nodes.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách điểm thu thập',
      error: err.message,
    });
  }
});

/**
 * GET /api/xianxia/crafting/recipes
 * Danh sách các công thức Luyện Đan & Luyện Khí (hỗ trợ query ?discipline=ALCHEMY|BLACKSMITHING)
 */
xianxiaCraftingRouter.get('/recipes', (req: Request, res: Response): void => {
  try {
    const discipline = req.query.discipline as CraftingDiscipline | undefined;
    const recipes = discipline
      ? xianxiaCraftingService.getRecipesByDiscipline(discipline)
      : xianxiaCraftingService.getAllRecipes();

    res.status(200).json({
      success: true,
      data: recipes,
      total: recipes.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách công thức',
      error: err.message,
    });
  }
});

/**
 * POST /api/xianxia/crafting/gather
 * Thu thập tài nguyên tại một điểm thu thập
 * Body: { nodeId: string; player: PlayerCraftingContext; forcedSuccess?: boolean }
 */
xianxiaCraftingRouter.post('/gather', (req: Request, res: Response): void => {
  try {
    const { nodeId, player, forcedSuccess } = req.body;

    if (!nodeId) {
      res.status(400).json({
        success: false,
        message: 'Thiếu mã điểm thu thập (nodeId)',
      });
      return;
    }

    if (!player || !player.realm) {
      res.status(400).json({
        success: false,
        message: 'Thiếu thông tin người chơi (player)',
      });
      return;
    }

    const result = xianxiaCraftingService.gatherResource(
      nodeId,
      player as PlayerCraftingContext,
      forcedSuccess
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Không thể thu thập tài nguyên',
    });
  }
});

/**
 * POST /api/xianxia/crafting/craft
 * Thực hiện Luyện Đan hoặc Luyện Khí
 * Body: { recipeId: string; player: PlayerCraftingContext; forcedSuccess?: boolean }
 */
xianxiaCraftingRouter.post('/craft', (req: Request, res: Response): void => {
  try {
    const { recipeId, player, forcedSuccess } = req.body;

    if (!recipeId) {
      res.status(400).json({
        success: false,
        message: 'Thiếu mã công thức (recipeId)',
      });
      return;
    }

    if (!player || !player.realm || !Array.isArray(player.inventory)) {
      res.status(400).json({
        success: false,
        message: 'Thiếu thông tin người chơi hoặc túi đồ (player.inventory)',
      });
      return;
    }

    const result = xianxiaCraftingService.craftItem(
      recipeId,
      player as PlayerCraftingContext,
      forcedSuccess
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Không thể chế tác',
    });
  }
});
