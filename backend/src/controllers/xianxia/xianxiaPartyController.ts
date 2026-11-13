import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/authMiddleware.js';
import { xianxiaPartyService } from '../../services/xianxia/xianxiaPartyService.js';

function parseErrorStatus(errMessage: string): number {
  if (errMessage.includes('NOT_FOUND')) return 404;
  if (errMessage.includes('FORBIDDEN') || errMessage.includes('UNAUTHORIZED')) return 403;
  if (
    errMessage.includes('INVALID') ||
    errMessage.includes('FULL') ||
    errMessage.includes('ALREADY') ||
    errMessage.includes('EXPIRED') ||
    errMessage.includes('CANNOT') ||
    errMessage.includes('DISBANDED') ||
    errMessage.includes('IN_DUNGEON')
  ) {
    return 400;
  }
  return 400;
}

/**
 * POST /api/xianxia/party
 * Tạo tổ đội mới
 */
export async function createParty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập để tạo tổ đội.' });
      return;
    }

    const { name } = req.body;
    const party = await xianxiaPartyService.createParty(userId, name);
    res.status(201).json({
      success: true,
      data: party,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi tạo tổ đội.',
    });
  }
}

/**
 * GET /api/xianxia/party/me
 * Lấy tổ đội hiện tại và danh sách thành viên
 */
export async function getMyParty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const party = await xianxiaPartyService.getMyParty(userId);
    res.status(200).json({
      success: true,
      data: party,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi lấy thông tin tổ đội.',
    });
  }
}

/**
 * POST /api/xianxia/party/invite
 * Mời nhân vật khác vào tổ đội bằng Character ID
 */
export async function inviteMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập để mời thành viên.' });
      return;
    }

    const { inviteeCharacterId, characterId } = req.body;
    const targetId = inviteeCharacterId || characterId;

    if (!targetId) {
      res.status(400).json({ success: false, error: 'Thiếu thông tin inviteeCharacterId của người được mời.' });
      return;
    }

    const invite = await xianxiaPartyService.inviteMember(userId, targetId);
    res.status(201).json({
      success: true,
      data: invite,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi gửi lời mời tổ đội.',
    });
  }
}

/**
 * GET /api/xianxia/party/invites
 * Lấy danh sách lời mời đang chờ của nhân vật hiện tại
 */
export async function getMyPendingInvites(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const invites = await xianxiaPartyService.getMyPendingInvites(userId);
    res.status(200).json({
      success: true,
      data: invites,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi lấy danh sách lời mời.',
    });
  }
}

/**
 * POST /api/xianxia/party/invites/:inviteId/respond
 * Phản hồi lời mời tổ đội (ACCEPT hoặc REJECT)
 */
export async function respondToInvite(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const inviteId = parseInt(String(req.params.inviteId), 10);
    const { action } = req.body;

    if (!inviteId || isNaN(inviteId)) {
      res.status(400).json({ success: false, error: 'Mã lời mời inviteId không hợp lệ.' });
      return;
    }

    if (!action || (action !== 'ACCEPT' && action !== 'REJECT')) {
      res.status(400).json({ success: false, error: 'Hành động phải là ACCEPT hoặc REJECT.' });
      return;
    }

    const result = await xianxiaPartyService.respondToInvite(userId, inviteId, action);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi xử lý phản hồi lời mời.',
    });
  }
}

/**
 * POST /api/xianxia/party/ready
 * Chuyển đổi trạng thái sẵn sàng tham chiến
 */
export async function setReadyState(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { isReady } = req.body;
    const result = await xianxiaPartyService.setReadyState(userId, isReady);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi chuyển trạng thái sẵn sàng.',
    });
  }
}

/**
 * POST /api/xianxia/party/kick
 * Đội trưởng trục xuất thành viên
 */
export async function kickMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const { targetCharacterId, characterId } = req.body;
    const targetId = targetCharacterId || characterId;

    if (!targetId) {
      res.status(400).json({ success: false, error: 'Thiếu thông tin targetCharacterId của thành viên bị trục xuất.' });
      return;
    }

    const party = await xianxiaPartyService.kickMember(userId, targetId);
    res.status(200).json({
      success: true,
      data: party,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi trục xuất thành viên.',
    });
  }
}

/**
 * POST /api/xianxia/party/leave
 * Rời tổ đội
 */
export async function leaveParty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const result = await xianxiaPartyService.leaveParty(userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi rời tổ đội.',
    });
  }
}

/**
 * POST /api/xianxia/party/disband
 * Đội trưởng giải tán tổ đội
 */
export async function disbandParty(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const result = await xianxiaPartyService.disbandParty(userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi giải tán tổ đội.',
    });
  }
}
