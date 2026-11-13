import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../../middlewares/authMiddleware.js';
import {
  getCharacter,
  createOrUpdateCharacter,
  meditate,
  distributeStatPoints,
  breakthrough,
  equipItem,
  unequipItem,
  useItem,
  battle,
  getBattleHistory,
  getQuests,
  acceptQuest,
  turnInQuest,
  interactQuestObjective,
  submitQuestQuiz,
  submitQuestChoice,
  getShopCatalog,
  buyShopItem,
  sellShopItem,
  getLifeRecipes,
  getLifeGatheringNodes,
  gatherResource,
  craftItem,
} from '../../controllers/xianxia/xianxiaGameplayController.js';
import { getLeaderboard } from '../../controllers/xianxia/xianxiaLeaderboardController.js';
import {
  getOpponents,
  challenge,
  getHistory as getPvpHistory,
  getMatchDetail,
  getPvpLeaderboard,
} from '../../controllers/xianxia/xianxiaPvpController.js';

const router = Router();

// Phân hệ Bảng Xếp Hạng Thiên Kiêu (Leaderboard - M4.1) hỗ trợ cả khách vãng lai và user đã đăng nhập
router.get('/leaderboard', optionalAuthenticateToken, getLeaderboard);

// Tất cả các route gameplay cá nhân tiếp theo đều được bảo vệ và xác thực qua JWT của hệ thống
router.use(authenticateToken);

// 1. Phân hệ Nhân vật & Chỉ số
router.get('/character', getCharacter);
router.get('/character/me', getCharacter);
router.post('/character/create', createOrUpdateCharacter);
router.post('/character/meditate', meditate);
router.post('/character/stat-points', distributeStatPoints);
router.post('/character/breakthrough', breakthrough);

// 2. Phân hệ Túi đồ & Trang bị
router.post('/inventory/equip', equipItem);
router.post('/inventory/unequip', unequipItem);
router.post('/inventory/use', useItem);

// 3. Phân hệ Chiến đấu & Battle Log
router.post('/combat/battle', battle);
router.get('/combat/history', getBattleHistory);

// 4. Phân hệ Nhiệm Vụ (Authoritative Quests - Mục 3)
router.get('/quests', getQuests);
router.post('/quest/accept', acceptQuest);
router.post('/quest/turnin', turnInQuest);
router.post('/quest/interact', interactQuestObjective);
router.post('/quest/quiz', submitQuestQuiz);
router.post('/quest/choice', submitQuestChoice);

// 5. Phân hệ Tiệm Bách Hóa (Shop/Merchant - Mục 3)
router.get('/shop/catalog', getShopCatalog);
router.post('/shop/buy', buyShopItem);
router.post('/shop/sell', sellShopItem);

// 6. Phân hệ Kỹ Nghệ Sinh Hoạt (Life Skills - Mục 3)
router.get('/life/recipes', getLifeRecipes);
router.get('/life/gathering-nodes', getLifeGatheringNodes);
router.post('/life/gather', gatherResource);
router.post('/life/craft', craftItem);

// 7. Phân hệ Đấu Trường Thiên Kiêu (Asynchronous PvP - Mục 4.2)
router.get('/pvp/opponents', getOpponents);
router.post('/pvp/challenge', challenge);
router.get('/pvp/history', getPvpHistory);
router.get('/pvp/match/:id', getMatchDetail);
router.get('/pvp/leaderboard', getPvpLeaderboard);

export default router;
