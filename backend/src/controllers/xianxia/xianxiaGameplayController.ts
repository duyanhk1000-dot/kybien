import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/authMiddleware.js';
import { xianxiaCharacterService } from '../../services/xianxia/xianxiaCharacterService.js';
import { xianxiaInventoryService } from '../../services/xianxia/xianxiaInventoryService.js';
import { xianxiaCombatService } from '../../services/xianxia/xianxiaCombatService.js';
import { xianxiaQuestService } from '../../services/xianxia/xianxiaQuestService.js';
import { xianxiaMerchantService } from '../../services/xianxia/xianxiaMerchantService.js';
import { xianxiaLifeService } from '../../services/xianxia/xianxiaLifeService.js';

export async function getCharacter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập để truy cập nhân vật.' });
      return;
    }

    const data = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tải nhân vật.' });
  }
}

export async function createOrUpdateCharacter(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { name, linh_can, origin } = req.body;
    const char = await xianxiaCharacterService.getOrCreateCharacter(userId, { name, linh_can, origin });
    const data = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tạo nhân vật.' });
  }
}

export async function meditate(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const result = await xianxiaCharacterService.meditate(userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi đả tọa.' });
  }
}

export async function distributeStatPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { stat } = req.body;
    const result = await xianxiaCharacterService.distributeStatPoints(userId, stat);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi cộng điểm tiềm năng.' });
  }
}

export async function equipItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { item_id } = req.body;
    if (!item_id) {
      res.status(400).json({ error: 'Thiếu item_id cần trang bị.' });
      return;
    }

    const result = await xianxiaInventoryService.equipItem(userId, item_id);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi trang bị vật phẩm.' });
  }
}

export async function unequipItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { slot } = req.body;
    if (!slot) {
      res.status(400).json({ error: 'Thiếu slot cần tháo trang bị.' });
      return;
    }

    const result = await xianxiaInventoryService.unequipItem(userId, slot);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tháo trang bị.' });
  }
}

export async function useItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { item_id } = req.body;
    if (!item_id) {
      res.status(400).json({ error: 'Thiếu item_id cần dùng.' });
      return;
    }

    const result = await xianxiaInventoryService.useItem(userId, item_id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi sử dụng đan dược.' });
  }
}

export async function battle(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập để khiêu chiến.' });
      return;
    }

    const { monster_id, idempotency_key } = req.body;
    if (!monster_id) {
      res.status(400).json({ error: 'Thiếu monster_id khiêu chiến.' });
      return;
    }

    const result = await xianxiaCombatService.simulateAndResolveBattle(userId, monster_id, idempotency_key);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tiến hành trận chiến.' });
  }
}

export async function getBattleHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập để xem lịch sử.' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const logs = await xianxiaCombatService.getCharacterBattleLogs(userId, limit);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tải lịch sử trận đấu.' });
  }
}

// ==========================================
// MỤC 3: ĐỘT PHÁ CẢNH GIỚI (BREAKTHROUGH)
// ==========================================
export async function breakthrough(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { support_pill_id } = req.body;
    const result = await xianxiaCharacterService.breakthroughRealm(userId, support_pill_id);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi đột phá cảnh giới.' });
  }
}

// ==========================================
// MỤC 3: TIẾN TRÌNH NHIỆM VỤ (QUEST PROGRESSION)
// ==========================================
export async function getQuests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const quests = await xianxiaQuestService.getQuestsForPlayerDb(userId);
    res.json({ success: true, data: quests });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tải danh sách nhiệm vụ.' });
  }
}

export async function acceptQuest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { quest_id } = req.body;
    if (!quest_id) {
      res.status(400).json({ error: 'Thiếu quest_id tiếp nhận.' });
      return;
    }

    const result = await xianxiaQuestService.acceptQuestDb(userId, quest_id);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi nhận nhiệm vụ.' });
  }
}

export async function turnInQuest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { quest_id } = req.body;
    if (!quest_id) {
      res.status(400).json({ error: 'Thiếu quest_id hoàn thành.' });
      return;
    }

    const result = await xianxiaQuestService.turnInQuestDb(userId, quest_id);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: result.success, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi nộp nhiệm vụ.' });
  }
}

export async function interactQuestObjective(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { quest_id, action_type, target_id } = req.body;
    if (!quest_id || !action_type || !target_id) {
      res.status(400).json({ error: 'Thiếu tham số tương tác nhiệm vụ.' });
      return;
    }

    const result = await xianxiaQuestService.interactObjectiveDb(userId, quest_id, action_type, target_id);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tương tác nhiệm vụ.' });
  }
}

export async function submitQuestQuiz(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { quest_id, objective_id, selected_index } = req.body;
    if (!quest_id || !objective_id || selected_index === undefined) {
      res.status(400).json({ error: 'Thiếu tham số câu hỏi trắc nghiệm.' });
      return;
    }

    const result = await xianxiaQuestService.submitQuizDb(userId, quest_id, objective_id, selected_index);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi nộp câu trả lời.' });
  }
}

export async function submitQuestChoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { quest_id, objective_id, choice_option_id } = req.body;
    if (!quest_id || !objective_id || !choice_option_id) {
      res.status(400).json({ error: 'Thiếu tham số lựa chọn đạo tâm.' });
      return;
    }

    const result = await xianxiaQuestService.submitChoiceDb(userId, quest_id, objective_id, choice_option_id);
    res.json({ success: result.success, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi đưa ra lựa chọn.' });
  }
}

// ==========================================
// MỤC 3: TIỆM BÁCH HÓA & KINH TẾ (SHOP/MERCHANT)
// ==========================================
export function getShopCatalog(_req: AuthenticatedRequest, res: Response): void {
  try {
    const catalog = xianxiaMerchantService.getShopCatalog();
    res.json({ success: true, data: catalog });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tải danh mục tiệm.' });
  }
}

export async function buyShopItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { item_id, quantity = 1 } = req.body;
    if (!item_id) {
      res.status(400).json({ error: 'Thiếu item_id cần mua.' });
      return;
    }

    const result = await xianxiaMerchantService.buyItem(userId, item_id, quantity);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi mua vật phẩm.' });
  }
}

export async function sellShopItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { item_id, quantity = 1 } = req.body;
    if (!item_id) {
      res.status(400).json({ error: 'Thiếu item_id cần bán.' });
      return;
    }

    const result = await xianxiaMerchantService.sellItem(userId, item_id, quantity);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi bán vật phẩm.' });
  }
}

// ==========================================
// MỤC 3: KỸ NGHỆ SINH HOẠT (LIFE SKILLS)
// ==========================================
export function getLifeRecipes(_req: AuthenticatedRequest, res: Response): void {
  try {
    const recipes = xianxiaLifeService.getRecipes();
    res.json({ success: true, data: recipes });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tải công thức.' });
  }
}

export function getLifeGatheringNodes(_req: AuthenticatedRequest, res: Response): void {
  try {
    const nodes = xianxiaLifeService.getGatheringNodes();
    res.json({ success: true, data: nodes });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi tải điểm thu thập.' });
  }
}

export async function gatherResource(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { node_id } = req.body;
    if (!node_id) {
      res.status(400).json({ error: 'Thiếu node_id thu thập.' });
      return;
    }

    const result = await xianxiaLifeService.gatherResource(userId, node_id);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi thu thập tài nguyên.' });
  }
}

export async function craftItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { recipe_id } = req.body;
    if (!recipe_id) {
      res.status(400).json({ error: 'Thiếu recipe_id chế tác.' });
      return;
    }

    const result = await xianxiaLifeService.craftItem(userId, recipe_id);
    const charDetails = await xianxiaCharacterService.getCharacterDetails(userId);
    res.json({ success: true, data: { ...result, characterDetails: charDetails } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Lỗi khi chế tác.' });
  }
}

