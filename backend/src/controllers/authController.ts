import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { calculateExpForNextLevel, getPlayerTitles, getRankTitle, getLevelProgress } from '../services/levelService.js';
import { config } from '../config/index.js';

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(config.googleClientId);

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ username, email và password.' });
      return;
    }

    if (username.length < 3 || password.length < 6) {
      res.status(400).json({ error: 'Username cần ít nhất 3 ký tự, Password ít nhất 6 ký tự.' });
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      res.status(409).json({ error: 'Username hoặc Email đã được đăng ký.' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password_hash,
      },
    });

    const token = generateToken({
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
    });

    const titles = getPlayerTitles(newUser.level, newUser.elo);

    res.status(201).json({
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        elo: newUser.elo,
        expTitle: titles.expTitle,
        eloTitle: titles.eloTitle,
        rankTitle: titles.fullTitle,
        exp: Number(newUser.exp),
        level: newUser.level,
        nextLevelExp: Number(calculateExpForNextLevel(newUser.level)),
      },
    });
  } catch (error) {
    console.error('Lỗi Đăng ký:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ trong quá trình đăng ký.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      res.status(400).json({ error: 'Vui lòng nhập Username/Email và Password.' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác.' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const titles = getPlayerTitles(user.level, user.elo);

    res.json({
      message: 'Đăng nhập thành công!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        elo: user.elo,
        expTitle: titles.expTitle,
        eloTitle: titles.eloTitle,
        rankTitle: titles.fullTitle,
        exp: Number(user.exp),
        level: user.level,
        nextLevelExp: Number(calculateExpForNextLevel(user.level)),
      },
    });
  } catch (error) {
    console.error('Lỗi Đăng nhập:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ trong quá trình đăng nhập.' });
  }
}

export async function getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Chưa xác thực.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        elo: true,
        exp: true,
        level: true,
        matches_played: true,
        matches_won: true,
        created_at: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy người dùng.' });
      return;
    }

    const progress = getLevelProgress(user.exp, user.level);
    const winRate = user.matches_played > 0 ? parseFloat(((user.matches_won / user.matches_played) * 100).toFixed(1)) : 0;
    const titles = getPlayerTitles(progress.level, user.elo);

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      elo: user.elo,
      expTitle: titles.expTitle,
      eloTitle: titles.eloTitle,
      rankTitle: titles.fullTitle,
      exp: Number(user.exp),
      currentExp: progress.currentExp,
      level: progress.level,
      currentLevelExp: Number(calculateExpForNextLevel(progress.level - 1 > 0 ? progress.level - 1 : 1)),
      nextLevelExp: progress.nextLevelExp,
      matchesPlayed: user.matches_played,
      matchesWon: user.matches_won,
      winRate,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Lỗi Lấy thông tin cá nhân:', error);
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const topUsers = await prisma.user.findMany({
      orderBy: [
        { elo: 'desc' },
        { matches_won: 'desc' },
        { id: 'asc' },
      ],
      take: 10,
      select: {
        id: true,
        username: true,
        elo: true,
        exp: true,
        level: true,
        matches_played: true,
        matches_won: true,
      },
    });

    const leaderboard = topUsers.map((user) => {
      const winRate = user.matches_played > 0 ? parseFloat(((user.matches_won / user.matches_played) * 100).toFixed(1)) : 0;
      const titles = getPlayerTitles(user.level, user.elo);
      return {
        id: user.id,
        username: user.username,
        elo: user.elo,
        exp: Number(user.exp),
        level: user.level,
        expTitle: titles.expTitle,
        eloTitle: titles.eloTitle,
        rankTitle: titles.fullTitle,
        matchesPlayed: user.matches_played,
        matchesWon: user.matches_won,
        matches_played: user.matches_played,
        matches_won: user.matches_won,
        winRate,
      };
    });

    res.json(leaderboard);
  } catch (error) {
    console.error('Lỗi Lấy Bảng xếp hạng:', error);
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

export async function loginWithGoogle(req: Request, res: Response): Promise<void> {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ error: 'Thiếu mã xác thực Google (credential).' });
      return;
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.warn('Lỗi xác thực Google ID Token:', verifyErr);
      res.status(401).json({ error: 'Mã xác thực Google không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Không thể xác thực danh tính Google từ token.' });
      return;
    }

    const email = payload.email.toLowerCase().trim();
    const name = (payload.name || payload.given_name || '').trim();
    const picture = payload.picture || null;

    let user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      // Tạo username an toàn từ name hoặc email
      let baseUsername = (name || email.split('@')[0])
        .replace(/[^a-zA-Z0-9_À-ỹ ]/g, '')
        .trim()
        .substring(0, 24);
      if (baseUsername.length < 3) {
        baseUsername = 'KyThu_' + Math.floor(1000 + Math.random() * 9000);
      }

      let username = baseUsername;
      const existingUsername = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUsername) {
        username = `${baseUsername.substring(0, 18)}_${Math.floor(100 + Math.random() * 900)}`;
      }

      // Tạo mật khẩu ngẫu nhiên bảo mật cao cho tài khoản Google OAuth
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const password_hash = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          username,
          email,
          password_hash,
          elo: 1200,
          exp: BigInt(0),
          level: 1,
        },
      });

      // Khởi tạo kinh tế Cờ Huyền Sử nếu có
      try {
        await prisma.chsEconomy.create({
          data: {
            user_id: user.id,
            hung_bao: 0,
          },
        });
      } catch (e) {}

      try {
        await prisma.chsDeck.create({
          data: {
            user_id: user.id,
            used_points: 0,
          },
        });
      } catch (e) {}
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    const titles = getPlayerTitles(user.level, user.elo);

    res.json({
      message: 'Đăng nhập Google thành công!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: picture,
        elo: user.elo,
        expTitle: titles.expTitle,
        eloTitle: titles.eloTitle,
        rankTitle: titles.fullTitle,
        exp: Number(user.exp),
        level: user.level,
        nextLevelExp: Number(calculateExpForNextLevel(user.level)),
      },
    });
  } catch (error) {
    console.error('Lỗi loginWithGoogle:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi máy chủ trong quá trình đăng nhập Google.' });
  }
}
