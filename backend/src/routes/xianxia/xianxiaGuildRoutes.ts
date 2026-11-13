import { Router } from 'express';
import { authenticateToken } from '../../middlewares/authMiddleware.js';
import {
  createGuild,
  getGuildsList,
  getMyGuild,
  getGuildDetail,
  getGuildMembers,
  applyToGuild,
  cancelApplication,
  getGuildApplications,
  acceptApplication,
  rejectApplication,
  leaveGuild,
  kickMember,
  promoteMember,
  demoteMember,
  transferLeadership,
  updateGuildNotice,
  disbandGuild,
} from '../../controllers/xianxia/xianxiaGuildController.js';

const router = Router();

// Tất cả các hành động liên quan đến Tông Môn đều yêu cầu xác thực JWT
router.use(authenticateToken);

// 1. Quản lý chung Tông Môn
router.post('/', createGuild);
router.get('/', getGuildsList);
router.get('/me', getMyGuild);
router.get('/my', getMyGuild);
router.get('/:id', getGuildDetail);
router.get('/:id/members', getGuildMembers);

// 2. Gia nhập & Đơn bái kiến
router.post('/:id/apply', applyToGuild);
router.post('/:id/cancel-application', cancelApplication);
router.post('/:id/applications/cancel', cancelApplication);
router.get('/:id/applications', getGuildApplications);
router.post('/:id/applications/:appId/accept', acceptApplication);
router.post('/:id/applications/:appId/reject', rejectApplication);

// 3. Quản trị thành viên & Tông môn
router.post('/:id/leave', leaveGuild);
router.post('/:id/kick', kickMember);
router.post('/:id/promote', promoteMember);
router.post('/:id/demote', demoteMember);
router.post('/:id/transfer', transferLeadership);
router.put('/:id/notice', updateGuildNotice);
router.delete('/:id', disbandGuild);

export default router;
