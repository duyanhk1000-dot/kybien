import { Router, Request, Response } from 'express';
import { coHuyenSuService } from '../services/coHuyenSuService.js';

const router = Router();

// Middleware lấy userId từ req.user (hoặc mock ID nếu chơi dưới dạng khách / test)
function getUserId(req: Request): number {
  if ((req as any).user && (req as any).user.id) {
    return (req as any).user.id;
  }
  const queryId = req.query.userId || req.body.userId || req.headers['x-user-id'];
  if (queryId && !isNaN(Number(queryId))) {
    return Number(queryId);
  }
  return 1; // Default guest test account
}

// 1. Lấy dữ liệu tổng quan: Ví Hưng Bảo, Mảnh Tướng, Thẻ Tướng, Deck, 8 ô Shop hôm nay
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const data = await coHuyenSuService.getUserOverview(userId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Mua mảnh tướng trong Chiêu Hiền Các (1 -> 3 mảnh/ngày)
router.post('/shop/buy', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { slotIndex, amount } = req.body;
    if (!slotIndex || typeof slotIndex !== 'number') {
      return res.status(400).json({ success: false, error: 'Thiếu slotIndex hợp lệ' });
    }
    const data = await coHuyenSuService.buyShard(userId, slotIndex, amount || 1);
    res.json({ success: true, message: 'Mua mảnh tướng thành công!', data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Ghép Mảnh ➔ Thẻ Tướng 1 Sao (★1)
router.post('/cards/fuse', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { heroId } = req.body;
    if (!heroId) {
      return res.status(400).json({ success: false, error: 'Thiếu mã tướng heroId' });
    }
    const data = await coHuyenSuService.fuseShardsToCard(userId, heroId);
    res.json({ success: true, message: 'Ghép Thẻ Tướng 1 Sao thành công!', data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Hợp 3 Thẻ Sao Thấp ➔ 1 Thẻ Sao Cao (★1 ➔ ★2 hoặc ★2 ➔ ★3)
router.post('/cards/merge', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { heroId, star } = req.body;
    if (!heroId || !star) {
      return res.status(400).json({ success: false, error: 'Thiếu heroId hoặc cấp sao star' });
    }
    const data = await coHuyenSuService.mergeCards(userId, heroId, Number(star));
    res.json({ success: true, message: `Thăng cấp Thẻ Tướng lên ${Number(star) + 1} Sao thành công!`, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Lưu cấu hình Hành Trang / Quân Lương (Tối đa 10 điểm)
router.post('/deck/save', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { selectedCards } = req.body;
    if (!Array.isArray(selectedCards)) {
      return res.status(400).json({ success: false, error: 'Danh sách thẻ không hợp lệ' });
    }
    const result = await coHuyenSuService.updateDeck(userId, selectedCards);
    res.json({ success: true, message: 'Đã lưu Hành Trang xuất trận!', data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
