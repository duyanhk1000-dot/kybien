import { Router, Request, Response } from 'express';
import { xianxiaAgencyService } from '../../services/xianxia/xianxiaAgencyService.js';

export const xianxiaAgencyRouter = Router();

// 1. GET /api/xianxia/agency/view
xianxiaAgencyRouter.get('/view', (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || 'Vô Danh Tu Sĩ';
    const zoneId = (req.query.zoneId as string) || 'zone_thanh_ha_thon';
    const realm = (req.query.realm as string) || 'PHAM_NHAN';
    const level = parseInt(req.query.level as string) || 1;

    const data = xianxiaAgencyService.getAgencyView(userId, zoneId, realm, level);
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Lỗi khi tải thông tin Tiêu Cục' });
  }
});

// 2. POST /api/xianxia/agency/accept
xianxiaAgencyRouter.post('/accept', (req: Request, res: Response) => {
  try {
    const { userId, missionId, playerStats } = req.body;
    if (!missionId) {
      return res.status(400).json({ success: false, message: 'Thiếu missionId' });
    }
    const result = xianxiaAgencyService.acceptMission(userId || 'Vô Danh Tu Sĩ', missionId, playerStats);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Không thể tiếp nhận chuyến tiêu' });
  }
});

// 3. POST /api/xianxia/agency/action
xianxiaAgencyRouter.post('/action', (req: Request, res: Response) => {
  try {
    const { userId, actionType, payload } = req.body;
    const result = xianxiaAgencyService.advanceMissionOnAction(userId || 'Vô Danh Tu Sĩ', actionType, payload);
    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Lỗi khi cập nhật tiến độ thám hiểm' });
  }
});

// 4. POST /api/xianxia/agency/report
xianxiaAgencyRouter.post('/report', (req: Request, res: Response) => {
  try {
    const { userId, missionId, currentZoneId, inventory } = req.body;
    if (!missionId) {
      return res.status(400).json({ success: false, message: 'Thiếu missionId' });
    }
    const result = xianxiaAgencyService.deliverOrReportMission(
      userId || 'Vô Danh Tu Sĩ',
      missionId,
      currentZoneId || 'zone_thanh_ha_thon',
      inventory || []
    );
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Chưa đủ điều kiện hoàn thành chuyến tiêu' });
  }
});

// 5. POST /api/xianxia/agency/promote
xianxiaAgencyRouter.post('/promote', (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const result = xianxiaAgencyService.requestPromotion(userId || 'Vô Danh Tu Sĩ');
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Không thể thăng cấp Tiêu Sư' });
  }
});

// 6. POST /api/xianxia/agency/exchange
xianxiaAgencyRouter.post('/exchange', (req: Request, res: Response) => {
  try {
    const { userId, supplyId } = req.body;
    if (!supplyId) {
      return res.status(400).json({ success: false, message: 'Thiếu supplyId' });
    }
    const result = xianxiaAgencyService.exchangeSupply(userId || 'Vô Danh Tu Sĩ', supplyId);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Không thể đổi vật phẩm' });
  }
});

// 7. POST /api/xianxia/agency/cancel
xianxiaAgencyRouter.post('/cancel', (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const result = xianxiaAgencyService.cancelMission(userId || 'Vô Danh Tu Sĩ');
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || 'Không thể hủy chuyến tiêu' });
  }
});
