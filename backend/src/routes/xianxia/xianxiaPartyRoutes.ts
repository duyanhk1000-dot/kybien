import { Router } from 'express';
import { authenticateToken } from '../../middlewares/authMiddleware.js';
import {
  createParty,
  getMyParty,
  inviteMember,
  getMyPendingInvites,
  respondToInvite,
  setReadyState,
  kickMember,
  leaveParty,
  disbandParty,
} from '../../controllers/xianxia/xianxiaPartyController.js';

const router = Router();

// Bắt buộc xác thực danh tính JWT cho toàn bộ thao tác tổ đội
router.use(authenticateToken);

// 1. Quản lý trạng thái và thành viên tổ đội
router.post('/', createParty);
router.get('/me', getMyParty);
router.post('/ready', setReadyState);
router.post('/leave', leaveParty);
router.post('/kick', kickMember);
router.post('/disband', disbandParty);

// 2. Hệ thống lời mời gia nhập tổ đội
router.post('/invite', inviteMember);
router.get('/invites', getMyPendingInvites);
router.post('/invites/:inviteId/respond', respondToInvite);

export default router;
