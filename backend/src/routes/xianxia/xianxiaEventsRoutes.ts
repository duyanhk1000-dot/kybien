import { Router, Request, Response } from 'express';
import { xianxiaEventsService } from '../../services/xianxia/xianxiaEventsService.js';
import { PlayerExplorationStats } from '../../types/xianxia.js';

export const xianxiaEventsRouter = Router();

/**
 * GET /api/xianxia/events
 * Lấy toàn bộ danh sách sự kiện kỳ ngộ
 */
xianxiaEventsRouter.get('/', (req: Request, res: Response): void => {
  try {
    const events = xianxiaEventsService.getAllEvents();
    res.status(200).json({
      success: true,
      data: events,
      total: events.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách sự kiện kỳ ngộ',
      error: err.message,
    });
  }
});

/**
 * GET /api/xianxia/events/zone/:zoneId
 * Lấy các sự kiện có thể kích hoạt tại phân khu
 */
xianxiaEventsRouter.get('/zone/:zoneId', (req: Request, res: Response): void => {
  try {
    const zoneId = String(req.params.zoneId);
    const events = xianxiaEventsService.getEventsByZone(zoneId);
    res.status(200).json({
      success: true,
      zone_id: zoneId,
      data: events,
      total: events.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy sự kiện theo phân khu',
      error: err.message,
    });
  }
});

/**
 * GET /api/xianxia/events/:id
 * Lấy chi tiết một sự kiện theo ID
 */
xianxiaEventsRouter.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = String(req.params.id);
    const event = xianxiaEventsService.getEventById(id);
    if (!event) {
      res.status(404).json({
        success: false,
        message: `Không tìm thấy sự kiện với ID: ${id}`,
      });
      return;
    }
    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết sự kiện',
      error: err.message,
    });
  }
});

/**
 * POST /api/xianxia/events/explore
 * Kích hoạt thám hiểm ngẫu nhiên tại phân khu
 * Body: { zoneId: string; playerStats: PlayerExplorationStats; forcedEventId?: string }
 */
xianxiaEventsRouter.post('/explore', (req: Request, res: Response): void => {
  try {
    const { zoneId, playerStats, forcedEventId } = req.body;

    if (!zoneId) {
      res.status(400).json({
        success: false,
        message: 'Thiếu thông tin phân khu (zoneId)',
      });
      return;
    }

    if (!playerStats || !playerStats.realm) {
      res.status(400).json({
        success: false,
        message: 'Thiếu thông số người chơi (playerStats)',
      });
      return;
    }

    const result = xianxiaEventsService.triggerExploration(
      zoneId,
      playerStats as PlayerExplorationStats,
      forcedEventId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Lỗi khi kích hoạt thám hiểm',
    });
  }
});

/**
 * POST /api/xianxia/events/resolve
 * Giải quyết lựa chọn của người chơi trong sự kiện (Server-Authoritative)
 * Body: { eventId: string; choiceId: string; playerStats: PlayerExplorationStats }
 */
xianxiaEventsRouter.post('/resolve', (req: Request, res: Response): void => {
  try {
    const { eventId, choiceId, playerStats } = req.body;

    if (!eventId || !choiceId) {
      res.status(400).json({
        success: false,
        message: 'Thiếu mã sự kiện (eventId) hoặc mã lựa chọn (choiceId)',
      });
      return;
    }

    if (!playerStats || !playerStats.realm) {
      res.status(400).json({
        success: false,
        message: 'Thiếu thông số người chơi (playerStats)',
      });
      return;
    }

    const result = xianxiaEventsService.resolveChoice(
      eventId,
      choiceId,
      playerStats as PlayerExplorationStats
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message || 'Không thể giải quyết lựa chọn sự kiện',
    });
  }
});
