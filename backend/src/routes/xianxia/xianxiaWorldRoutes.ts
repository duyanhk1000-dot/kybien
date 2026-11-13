import { Router, Request, Response } from 'express';
import { xianxiaWorldService } from '../../services/xianxia/xianxiaWorldService.js';
import { RealmTier } from '../../types/xianxia.js';

const router = Router();

/**
 * GET /api/xianxia/world/zones
 * Lấy danh sách tất cả các phân khu (Zones)
 */
router.get('/zones', (req: Request, res: Response) => {
  try {
    const zones = xianxiaWorldService.getAllZones();
    res.status(200).json({
      success: true,
      data: zones.map(z => ({
        id: z.id,
        name: z.name,
        type: z.type,
        description: z.description,
        min_realm: z.min_realm,
        fatigue_cost_roam: z.fatigue_cost_roam,
        travel_fatigue_base: z.travel_fatigue_base,
        connected_zones: z.connected_zones,
        banner_image: z.banner_image,
        places: z.places || [],
        place_count: z.places ? z.places.length : 0,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy danh sách phân khu.' });
  }
});

/**
 * GET /api/xianxia/world/zones/:zoneId
 * Lấy thông tin chi tiết một phân khu, bao gồm cả các Địa điểm bên trong
 */
router.get('/zones/:zoneId', (req: Request, res: Response) => {
  try {
    const zoneId = String(req.params.zoneId);
    const zone = xianxiaWorldService.getZoneById(zoneId);
    if (!zone) {
      return res.status(404).json({ success: false, error: `Không tìm thấy phân khu '${zoneId}'.` });
    }
    res.status(200).json({
      success: true,
      data: zone,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy chi tiết phân khu.' });
  }
});

/**
 * GET /api/xianxia/world/zones/:zoneId/places
 * Lấy danh sách địa điểm chức năng thuộc một phân khu
 */
router.get('/zones/:zoneId/places', (req: Request, res: Response) => {
  try {
    const zoneId = String(req.params.zoneId);
    const places = xianxiaWorldService.getPlacesByZoneId(zoneId);
    res.status(200).json({
      success: true,
      data: places,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy danh sách địa điểm.' });
  }
});

/**
 * GET /api/xianxia/world/places/:placeId
 * Lấy chi tiết một địa điểm chức năng và danh sách dịch vụ của nó
 */
router.get('/places/:placeId', (req: Request, res: Response) => {
  try {
    const placeId = String(req.params.placeId);
    const place = xianxiaWorldService.getPlaceById(placeId);
    if (!place) {
      return res.status(404).json({ success: false, error: `Không tìm thấy địa điểm '${placeId}'.` });
    }
    res.status(200).json({
      success: true,
      data: place,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy chi tiết địa điểm.' });
  }
});

/**
 * GET /api/xianxia/world/routes
 * Lấy toàn bộ mạng lưới lộ trình di chuyển liên vùng
 */
router.get('/routes', (req: Request, res: Response) => {
  try {
    const routes = xianxiaWorldService.getTravelNetwork();
    res.status(200).json({
      success: true,
      data: routes,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi lấy mạng lưới lộ trình.' });
  }
});

/**
 * POST /api/xianxia/world/travel/validate
 * Kiểm tra tính hợp lệ và chi phí trước khi thực hiện di chuyển
 */
router.post('/travel/validate', (req: Request, res: Response) => {
  try {
    const { fromZoneId, toZoneId, playerRealm } = req.body;
    if (!fromZoneId || !toZoneId || !playerRealm) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: fromZoneId, toZoneId, playerRealm.',
      });
    }

    const result = xianxiaWorldService.validateTravel(
      fromZoneId,
      toZoneId,
      playerRealm as RealmTier
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Lỗi xác thực lộ trình di chuyển.' });
  }
});

export default router;
