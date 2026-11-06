import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.js';
import { config } from '../config/index.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Truy cập bị từ chối, thiếu JWT token.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    return;
  }

  req.user = payload;
  next();
}

export function optionalAuthenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

/**
 * requireAdmin — chỉ cho tài khoản quản trị đi tiếp.
 * PHẢI đứng sau authenticateToken trong chuỗi middleware (cần req.user).
 * Quyền admin dựa vào env ADMIN_EMAILS (danh sách email, phân tách dấu phẩy,
 * so sánh không phân biệt hoa/thường) vì DB hiện chưa có cột role.
 * - Chưa đăng nhập (không có req.user) → 401.
 * - ADMIN_EMAILS chưa set → 403, endpoint đang bị khóa.
 * - Đã đăng nhập nhưng email không nằm trong ADMIN_EMAILS → 403.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản quản trị để dùng tính năng này.' });
    return;
  }

  const adminEmails = config.adminEmails;
  if (adminEmails.length === 0) {
    res.status(403).json({ error: 'Tính năng này đang bị khóa vì chưa cấu hình danh sách quản trị (ADMIN_EMAILS).' });
    return;
  }

  const email = (req.user.email || '').trim().toLowerCase();
  if (!email || !adminEmails.includes(email)) {
    res.status(403).json({ error: 'Tài khoản của bạn không có quyền quản trị.' });
    return;
  }

  next();
}

