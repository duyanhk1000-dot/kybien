import { Router, Request, Response } from 'express';
import { xianxiaQuestService } from '../../services/xianxia/xianxiaQuestService.js';
import { RealmTier, PlayerInventorySlot } from '../../types/xianxia.js';

export const xianxiaQuestRouter = Router();

/**
 * GET /api/xianxia/quests
 * Lấy danh sách toàn bộ nhiệm vụ
 */
xianxiaQuestRouter.get('/', (req: Request, res: Response) => {
  const quests = xianxiaQuestService.getAllQuests();
  res.json({
    success: true,
    data: quests,
  });
});

/**
 * GET /api/xianxia/quests/player
 * Lấy danh sách nhiệm vụ kèm trạng thái động của người chơi
 */
xianxiaQuestRouter.get('/player', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'guest_dao_huu';
  const realm = (req.query.realm as RealmTier) || 'PHAM_NHAN';
  const level = parseInt(req.query.level as string, 10) || 1;
  const category = req.query.category as string | undefined;

  let inventory: PlayerInventorySlot[] | undefined = undefined;
  if (req.query.inventory) {
    try {
      inventory = JSON.parse(req.query.inventory as string);
    } catch {
      inventory = [];
    }
  }

  const questsWithStatus = category
    ? xianxiaQuestService.getQuestsByCategory(userId, category, { realm, level, inventory })
    : xianxiaQuestService.getQuestsForPlayer(userId, { realm, level, inventory });

  res.json({
    success: true,
    data: questsWithStatus,
  });
});

/**
 * GET /api/xianxia/quests/:questId
 * Chi tiết một nhiệm vụ cụ thể
 */
xianxiaQuestRouter.get('/:questId', (req: Request, res: Response) => {
  const questId = req.params.questId as string;
  const quest = xianxiaQuestService.getQuestById(questId);
  if (!quest) {
    return res.status(404).json({ success: false, error: 'Không tìm thấy nhiệm vụ' });
  }
  res.json({ success: true, data: quest });
});

/**
 * POST /api/xianxia/quests/:questId/accept
 * Tiếp nhận nhiệm vụ
 */
xianxiaQuestRouter.post('/:questId/accept', (req: Request, res: Response) => {
  const questId = req.params.questId as string;
  const { userId = 'guest_dao_huu', realm = 'PHAM_NHAN', level = 1, inventory = [] } = req.body;

  const result = xianxiaQuestService.acceptQuest(userId, questId, {
    realm: realm as RealmTier,
    level: Number(level),
    inventory,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

/**
 * POST /api/xianxia/quests/:questId/interact
 * Tương tác hoàn thành mục tiêu (nói chuyện, thám thính, tìm người, đưa tin)
 */
xianxiaQuestRouter.post('/:questId/interact', (req: Request, res: Response) => {
  const questId = req.params.questId as string;
  const { userId = 'guest_dao_huu', actionType, targetId } = req.body;

  if (!actionType || !targetId) {
    return res.status(400).json({ success: false, message: 'Thiếu actionType hoặc targetId' });
  }

  const result = xianxiaQuestService.interactObjective(userId, questId, actionType, targetId);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

/**
 * POST /api/xianxia/quests/:questId/quiz
 * Trả lời câu hỏi trắc nghiệm khảo nghiệm
 */
xianxiaQuestRouter.post('/:questId/quiz', (req: Request, res: Response) => {
  const questId = req.params.questId as string;
  const { userId = 'guest_dao_huu', objectiveId, selectedIndex } = req.body;

  if (typeof selectedIndex !== 'number' || !objectiveId) {
    return res.status(400).json({ success: false, message: 'Thiếu objectiveId hoặc selectedIndex' });
  }

  const result = xianxiaQuestService.submitQuiz(userId, questId, objectiveId, selectedIndex);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

/**
 * POST /api/xianxia/quests/:questId/choice
 * Đưa ra lựa chọn Narrative/Moral Choice
 */
xianxiaQuestRouter.post('/:questId/choice', (req: Request, res: Response) => {
  const questId = req.params.questId as string;
  const { userId = 'guest_dao_huu', objectiveId, choiceOptionId } = req.body;

  if (!objectiveId || !choiceOptionId) {
    return res.status(400).json({ success: false, message: 'Thiếu objectiveId hoặc choiceOptionId' });
  }

  const result = xianxiaQuestService.submitChoice(userId, questId, objectiveId, choiceOptionId);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

/**
 * POST /api/xianxia/quests/:questId/turn-in
 * Nộp nhiệm vụ và nhận thưởng
 */
xianxiaQuestRouter.post('/:questId/turn-in', (req: Request, res: Response) => {
  const questId = req.params.questId as string;
  const { userId = 'guest_dao_huu', inventory = [] } = req.body;

  const result = xianxiaQuestService.turnInQuest(userId, questId, inventory);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

/**
 * POST /api/xianxia/quests/monster-kill
 * Hook khi tiêu diệt quái vật để cập nhật nhiệm vụ
 */
xianxiaQuestRouter.post('/monster-kill', (req: Request, res: Response) => {
  const { userId = 'guest_dao_huu', monsterId, count = 1 } = req.body;
  if (!monsterId) {
    return res.status(400).json({ success: false, message: 'Thiếu monsterId' });
  }

  const result = xianxiaQuestService.recordMonsterKill(userId, monsterId, Number(count));
  res.json({ success: true, data: result });
});

/**
 * POST /api/xianxia/quests/loot-acquired
 * Hook khi nhặt được vật phẩm rơi để cập nhật nhiệm vụ
 */
xianxiaQuestRouter.post('/loot-acquired', (req: Request, res: Response) => {
  const { userId = 'guest_dao_huu', itemId, quantity = 1 } = req.body;
  if (!itemId) {
    return res.status(400).json({ success: false, message: 'Thiếu itemId' });
  }

  const result = xianxiaQuestService.recordLootAcquired(userId, itemId, Number(quantity));
  res.json({ success: true, data: result });
});

export default xianxiaQuestRouter;
