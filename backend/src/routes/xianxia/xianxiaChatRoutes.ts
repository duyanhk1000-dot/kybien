import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../../middlewares/authMiddleware.js';
import { xianxiaChatService } from '../../services/xianxia/xianxiaChatService.js';

const router = Router();

/**
 * GET /api/xianxia/chat/messages
 * Lấy danh sách tin nhắn gần nhất theo kênh và khu vực
 */
router.get('/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const rawChannel = (req.query.channel as string)?.toUpperCase();
    const channel: 'WORLD' | 'ZONE' | 'GUILD' = rawChannel === 'ZONE' ? 'ZONE' : (rawChannel === 'GUILD' ? 'GUILD' : 'WORLD');
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;

    let targetZoneId: string | undefined = undefined;
    let targetGuildId: number | undefined = undefined;

    if (channel === 'ZONE' || channel === 'GUILD') {
      const profile = await xianxiaChatService.getCharacterChatProfile(userId);
      if (!profile) {
        return res.status(404).json({ success: false, error: 'Chưa tìm thấy nhân vật tu tiên của bạn.' });
      }
      if (channel === 'ZONE') {
        targetZoneId = profile.currentZone;
      } else if (channel === 'GUILD') {
        if (!profile.guildId) {
          return res.status(400).json({ success: false, error: 'Đạo hữu chưa gia nhập Tông môn nào.' });
        }
        targetGuildId = profile.guildId;
      }
    }

    const messages = await xianxiaChatService.getRecentMessages(channel, targetZoneId, limit, targetGuildId);
    return res.status(200).json({
      success: true,
      data: {
        channel,
        zoneId: targetZoneId || null,
        guildId: targetGuildId || null,
        messages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Lỗi truy xuất tin nhắn chat.' });
  }
});

/**
 * POST /api/xianxia/chat/messages
 * Gửi tin nhắn qua REST HTTP (Dành cho kiểm thử hoặc Fallback khi WebSocket không khả dụng)
 */
router.post('/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { channel, content } = req.body;

    if (!channel || (channel !== 'WORLD' && channel !== 'ZONE' && channel !== 'GUILD')) {
      return res.status(400).json({ success: false, error: 'Kênh chat không hợp lệ (chỉ nhận WORLD, ZONE hoặc GUILD).' });
    }

    const message = await xianxiaChatService.sendMessage(userId, channel, content);
    return res.status(201).json({
      success: true,
      data: message,
    });
  } catch (err: any) {
    const msg = err?.message || 'Lỗi gửi tin nhắn.';
    if (msg.includes('CHAT_RATE_LIMITED')) {
      return res.status(429).json({ success: false, error: msg });
    }
    if (msg.includes('CHAT_EMPTY_MESSAGE') || msg.includes('CHAT_TOO_LONG') || msg.includes('CHAT_DUPLICATE_MESSAGE') || msg.includes('CHAT_INVALID_CHANNEL')) {
      return res.status(400).json({ success: false, error: msg });
    }
    if (msg.includes('CHAT_CHARACTER_NOT_FOUND')) {
      return res.status(404).json({ success: false, error: msg });
    }
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
