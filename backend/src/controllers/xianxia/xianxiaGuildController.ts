import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/authMiddleware.js';
import { xianxiaGuildService } from '../../services/xianxia/xianxiaGuildService.js';

function parseErrorStatus(errMessage: string): number {
  if (errMessage.includes('NOT_FOUND')) return 404;
  if (errMessage.includes('FORBIDDEN') || errMessage.includes('CANNOT') || errMessage.includes('SELF_APPROVAL')) return 403;
  if (errMessage.includes('INVALID') || errMessage.includes('TAKEN') || errMessage.includes('LIMIT') || errMessage.includes('FULL') || errMessage.includes('ALREADY') || errMessage.includes('INSUFFICIENT') || errMessage.includes('TOO_LOW')) return 400;
  return 400;
}

function parseId(raw: any): number {
  return parseInt(String(raw ?? ''), 10);
}

/**
 * POST /api/xianxia/guilds
 * Khai sáng Tông Môn mới
 */
export async function createGuild(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập để lập Tông môn.' });
      return;
    }

    const { name, description } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'Danh xưng Tông môn không được để trống.' });
      return;
    }

    const guild = await xianxiaGuildService.createGuild(userId, name, description);
    res.status(201).json({
      success: true,
      data: guild,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi thành lập Tông môn.',
    });
  }
}

/**
 * GET /api/xianxia/guilds
 * Lấy danh sách Tông Môn trong thiên hạ (tìm kiếm, phân trang)
 */
export async function getGuildsList(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const sortBy = req.query.sortBy === 'members' ? 'members' : 'reputation';

    const result = await xianxiaGuildService.getGuildsList({ search, page, limit, sortBy });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi tải danh sách Tông môn.',
    });
  }
}

/**
 * GET /api/xianxia/guilds/me
 * Xem thông tin Tông Môn của chính nhân vật hiện tại
 */
export async function getMyGuild(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const myGuildData = await xianxiaGuildService.getMyGuild(userId);
    res.status(200).json({
      success: true,
      data: myGuildData,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi tải thông tin Tông môn của bạn.',
    });
  }
}

/**
 * GET /api/xianxia/guilds/:id
 * Xem chi tiết thông tin một Tông Môn
 */
export async function getGuildDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const guildId = parseId(req.params.id);
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    const detail = await xianxiaGuildService.getGuildDetail(guildId);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Tông môn không tồn tại.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: detail,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi xem chi tiết Tông môn.',
    });
  }
}

/**
 * GET /api/xianxia/guilds/:id/members
 * Xem danh sách thành viên của một Tông Môn
 */
export async function getGuildMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const guildId = parseId(req.params.id);
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    const members = await xianxiaGuildService.getGuildMembers(guildId);
    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi tải danh sách đệ tử.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/apply
 * Nộp bái thiếp xin gia nhập Tông Môn
 */
export async function applyToGuild(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    const { message } = req.body;
    const application = await xianxiaGuildService.applyToGuild(userId, guildId, message);
    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi gửi bái thiếp gia nhập.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/cancel-application
 * Hủy đơn xin gia nhập đang chờ duyệt
 */
export async function cancelApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.cancelApplication(userId, guildId);
    res.status(200).json({
      success: true,
      message: 'Đã rút lại đơn bái kiến thành công.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi rút đơn bái kiến.',
    });
  }
}

/**
 * GET /api/xianxia/guilds/:id/applications
 * Xem danh sách đơn bái kiến đang chờ duyệt (Chưởng Môn / Trưởng Lão)
 */
export async function getGuildApplications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    const applications = await xianxiaGuildService.getGuildApplications(userId, guildId);
    res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi tải danh sách đơn gia nhập.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/applications/:appId/accept
 * Duyệt tiếp nhận đệ tử gia nhập Tông Môn
 */
export async function acceptApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    const applicationId = parseId(req.params.appId);
    if (!guildId || isNaN(guildId) || !applicationId || isNaN(applicationId)) {
      res.status(400).json({ success: false, error: 'Thông số không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.acceptApplication(userId, guildId, applicationId);
    res.status(200).json({
      success: true,
      message: 'Đã thu nhận đệ tử vào Tông môn thành công.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi duyệt đơn bái kiến.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/applications/:appId/reject
 * Khước từ đơn xin gia nhập Tông Môn
 */
export async function rejectApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    const applicationId = parseId(req.params.appId);
    if (!guildId || isNaN(guildId) || !applicationId || isNaN(applicationId)) {
      res.status(400).json({ success: false, error: 'Thông số không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.rejectApplication(userId, guildId, applicationId);
    res.status(200).json({
      success: true,
      message: 'Đã từ chối đơn bái kiến.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi từ chối đơn gia nhập.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/leave
 * Rời khỏi Tông Môn
 */
export async function leaveGuild(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.leaveGuild(userId, guildId);
    res.status(200).json({
      success: true,
      message: 'Đạo hữu đã dứt áo rời khỏi Tông môn, quy hoàn tự do.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi rời khỏi Tông môn.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/kick
 * Trục xuất đệ tử khỏi Tông Môn (Chỉ Chưởng Môn)
 */
export async function kickMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    const targetCharacterId = parseId(req.body.characterId);
    if (!guildId || isNaN(guildId) || !targetCharacterId || isNaN(targetCharacterId)) {
      res.status(400).json({ success: false, error: 'Thông số không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.kickMember(userId, guildId, targetCharacterId);
    res.status(200).json({
      success: true,
      message: 'Đã trục xuất đệ tử khỏi môn phái.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi trục xuất đệ tử.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/promote
 * Thăng chức đệ tử lên Trưởng Lão (Chỉ Chưởng Môn)
 */
export async function promoteMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    const targetCharacterId = parseId(req.body.characterId);
    if (!guildId || isNaN(guildId) || !targetCharacterId || isNaN(targetCharacterId)) {
      res.status(400).json({ success: false, error: 'Thông số không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.promoteMember(userId, guildId, targetCharacterId);
    res.status(200).json({
      success: true,
      message: 'Đã sắc phong thành Trưởng lão Tông môn thành công.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi bổ nhiệm Trưởng lão.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/demote
 * Bãi chức Trưởng Lão xuống Đệ Tử (Chỉ Chưởng Môn)
 */
export async function demoteMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    const targetCharacterId = parseId(req.body.characterId);
    if (!guildId || isNaN(guildId) || !targetCharacterId || isNaN(targetCharacterId)) {
      res.status(400).json({ success: false, error: 'Thông số không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.demoteMember(userId, guildId, targetCharacterId);
    res.status(200).json({
      success: true,
      message: 'Đã giáng chức Trưởng lão xuống làm Đệ tử thông thường.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi bãi chức Trưởng lão.',
    });
  }
}

/**
 * POST /api/xianxia/guilds/:id/transfer
 * Truyền ngôi Chưởng Môn (Chỉ Chưởng Môn đương nhiệm)
 */
export async function transferLeadership(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    const newLeaderCharacterId = parseId(req.body.newLeaderCharacterId);
    if (!guildId || isNaN(guildId) || !newLeaderCharacterId || isNaN(newLeaderCharacterId)) {
      res.status(400).json({ success: false, error: 'Thông số không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.transferLeadership(userId, guildId, newLeaderCharacterId);
    res.status(200).json({
      success: true,
      message: 'Đã trao Chưởng Môn Tín Vật, truyền ngôi thành công.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi truyền ngôi Chưởng môn.',
    });
  }
}

/**
 * PUT /api/xianxia/guilds/:id/notice
 * Cập nhật cáo thị / lời răn nội bộ Tông Môn (Chưởng Môn / Trưởng Lão)
 */
export async function updateGuildNotice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    const { notice } = req.body;
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.updateGuildNotice(userId, guildId, notice || '');
    res.status(200).json({
      success: true,
      message: 'Cập nhật cáo thị Tông môn thành công.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi cập nhật cáo thị.',
    });
  }
}

/**
 * DELETE /api/xianxia/guilds/:id
 * Giải tán Tông Môn an toàn (Chỉ Chưởng Môn)
 */
export async function disbandGuild(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const guildId = parseId(req.params.id);
    if (!guildId || isNaN(guildId) || guildId <= 0) {
      res.status(400).json({ success: false, error: 'Mã Tông môn không hợp lệ.' });
      return;
    }

    await xianxiaGuildService.disbandGuild(userId, guildId);
    res.status(200).json({
      success: true,
      message: 'Tông môn đã được giải tán an toàn, danh xưng phong bế.',
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi giải tán Tông môn.',
    });
  }
}
