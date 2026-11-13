import { Router, Request, Response } from 'express';
import { xianxiaBestiaryService } from '../../services/xianxia/xianxiaBestiaryService.js';
import { MonsterTier } from '../../types/xianxia.js';

const router = Router();

// ==========================================
// NPC ENDPOINTS
// ==========================================

/**
 * GET /api/xianxia/bestiary/npcs
 * Lấy danh sách toàn bộ NPC trong thế giới
 */
router.get('/npcs', (req: Request, res: Response) => {
  try {
    const npcs = xianxiaBestiaryService.getAllNpcs();
    res.status(200).json({
      success: true,
      data: npcs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy danh sách NPC.' });
  }
});

/**
 * GET /api/xianxia/bestiary/npcs/:npcId
 * Lấy chi tiết một NPC
 */
router.get('/npcs/:npcId', (req: Request, res: Response) => {
  try {
    const npcId = String(req.params.npcId);
    const npc = xianxiaBestiaryService.getNpcById(npcId);
    if (!npc) {
      return res.status(404).json({ success: false, error: `Không tìm thấy NPC '${npcId}'.` });
    }
    res.status(200).json({
      success: true,
      data: npc,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy chi tiết NPC.' });
  }
});

/**
 * GET /api/xianxia/bestiary/npcs/:npcId/dialogue
 * Lấy câu thoại tương tác ngẫu nhiên của NPC
 */
router.get('/npcs/:npcId/dialogue', (req: Request, res: Response) => {
  try {
    const npcId = String(req.params.npcId);
    const dialogue = xianxiaBestiaryService.getRandomDialogue(npcId);
    if (!dialogue) {
      return res.status(404).json({ success: false, error: `Không tìm thấy thoại của NPC '${npcId}'.` });
    }
    res.status(200).json({
      success: true,
      data: dialogue,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy thoại NPC.' });
  }
});

/**
 * GET /api/xianxia/bestiary/npcs/by-zone/:zoneId
 * Lấy danh sách NPC sinh sống tại một phân khu cụ thể
 */
router.get('/npcs/by-zone/:zoneId', (req: Request, res: Response) => {
  try {
    const zoneId = String(req.params.zoneId);
    const npcs = xianxiaBestiaryService.getNpcsByZone(zoneId);
    res.status(200).json({
      success: true,
      data: npcs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lọc NPC theo vùng.' });
  }
});

// ==========================================
// YÊU THÚ (MONSTERS & BESTIARY) ENDPOINTS
// ==========================================

/**
 * GET /api/xianxia/bestiary/monsters
 * Lấy danh lục yêu thú (hỗ trợ lọc theo tier qua query: ?tier=TIER_1_BEAST)
 */
router.get('/monsters', (req: Request, res: Response) => {
  try {
    const { tier } = req.query;
    const monsters = tier
      ? xianxiaBestiaryService.getMonstersByTier(String(tier) as MonsterTier)
      : xianxiaBestiaryService.getAllMonsters();

    res.status(200).json({
      success: true,
      data: monsters,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy danh lục yêu thú.' });
  }
});

/**
 * GET /api/xianxia/bestiary/monsters/:monsterId
 * Lấy thông tin chi tiết một Yêu Thú (Chỉ số, Kỹ năng, Bảng rơi đồ)
 */
router.get('/monsters/:monsterId', (req: Request, res: Response) => {
  try {
    const monsterId = String(req.params.monsterId);
    const monster = xianxiaBestiaryService.getMonsterById(monsterId);
    if (!monster) {
      return res.status(404).json({ success: false, error: `Không tìm thấy yêu thú '${monsterId}'.` });
    }
    res.status(200).json({
      success: true,
      data: monster,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy chi tiết yêu thú.' });
  }
});

/**
 * GET /api/xianxia/bestiary/monsters/by-zone/:zoneId
 * Lấy danh sách yêu thú phân bố tại một phân khu
 */
router.get('/monsters/by-zone/:zoneId', (req: Request, res: Response) => {
  try {
    const zoneId = String(req.params.zoneId);
    const monsters = xianxiaBestiaryService.getMonstersByZone(zoneId);
    res.status(200).json({
      success: true,
      data: monsters,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lọc yêu thú theo vùng.' });
  }
});

/**
 * POST /api/xianxia/bestiary/monsters/:monsterId/roll-loot
 * Máy chủ tính toán rơi đồ ngẫu nhiên khi diệt quái (Server-authoritative)
 */
router.post('/monsters/:monsterId/roll-loot', (req: Request, res: Response) => {
  try {
    const monsterId = String(req.params.monsterId);
    const lootResult = xianxiaBestiaryService.rollLoot(monsterId);
    if (!lootResult) {
      return res.status(404).json({ success: false, error: `Không tìm thấy yêu thú '${monsterId}' để tính thưởng.` });
    }
    res.status(200).json({
      success: true,
      data: lootResult,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi tính toán rơi đồ.' });
  }
});

export default router;
