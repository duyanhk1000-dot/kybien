import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { calculateExpForNextLevel, getPlayerTitles, getRankTitle } from '../services/levelService.js';

const prisma = new PrismaClient();

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

    const currentLevelExp = calculateExpForNextLevel(user.level - 1 > 0 ? user.level - 1 : 1);
    const nextLevelExp = calculateExpForNextLevel(user.level);
    const winRate = user.matches_played > 0 ? parseFloat(((user.matches_won / user.matches_played) * 100).toFixed(1)) : 0;
    const titles = getPlayerTitles(user.level, user.elo);

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      elo: user.elo,
      expTitle: titles.expTitle,
      eloTitle: titles.eloTitle,
      rankTitle: titles.fullTitle,
      exp: Number(user.exp),
      level: user.level,
      currentLevelExp: Number(currentLevelExp),
      nextLevelExp: Number(nextLevelExp),
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
        winRate,
      };
    });

    res.json(leaderboard);
  } catch (error) {
    console.error('Lỗi Lấy Bảng xếp hạng:', error);
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}
