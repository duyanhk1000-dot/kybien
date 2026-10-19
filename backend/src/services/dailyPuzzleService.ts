import { prisma } from '../utils/prisma.js';
import { DailyBloggerService, DailyPuzzleItem, DailyBlogResult } from './dailyBloggerService.js';
import { PuzzleTier } from '@prisma/client';

export interface DailySummary {
  date: string;
  puzzles: Array<{
    id: number;
    tier: PuzzleTier;
    order_index: number | null;
    title: string;
    fen: string;
    exp_reward: number;
    is_solved: boolean;
    description?: string | null;
    constraints?: string | null;
    creator?: { id: number; username: string } | null;
  }>;
  progress: {
    solved_count: number;
    total_count: number;
    all_solved: boolean;
    daily_bonus_exp: number;
    daily_bonus_claimed: boolean;
  };
}

export class DailyPuzzleService {
  /**
   * Lấy chuỗi ngày chuẩn YYYY-MM-DD theo giờ Việt Nam
   */
  static getTodayDateStr(): string {
    const now = new Date();
    // Chuyển đổi sang múi giờ Việt Nam (UTC+7)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  }

  /**
   * Lấy 3 thế cờ hàng ngày (Dễ - Vừa - Khó) cho một ngày cụ thể
   * Nếu ngày đó chưa được gán 3 thế, hệ thống sẽ tự động gán từ kho thế cờ đã xuất bản.
   */
  static async getDailyPuzzles(dateStr?: string, userId?: number): Promise<DailySummary> {
    const targetDateStr = dateStr || this.getTodayDateStr();
    const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);

    // 1. Tìm các thế cờ đã gán is_daily = true cho ngày này
    let dailyPuzzles = await prisma.puzzle.findMany({
      where: {
        is_daily: true,
        daily_date: targetDate,
        status: 'PUBLISHED',
      },
      select: {
        id: true,
        tier: true,
        order_index: true,
        title: true,
        fen: true,
        description: true,
        constraints: true,
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const hasEasy = dailyPuzzles.some(p => p.tier === 'EASY');
    const hasMed = dailyPuzzles.some(p => p.tier === 'MEDIUM');
    const hasHard = dailyPuzzles.some(p => p.tier === 'HARD');

    // 2. Nếu thiếu tier nào thì tự động chọn và gán cho ngày này
    const neededTiers: PuzzleTier[] = [];
    if (!hasEasy) neededTiers.push('EASY');
    if (!hasMed) neededTiers.push('MEDIUM');
    if (!hasHard) neededTiers.push('HARD');

    if (neededTiers.length > 0) {
      // Dùng date hash để chọn xoay vòng luân phiên thế cờ
      const dateNum = targetDateStr.split('-').reduce((acc, part) => acc * 31 + parseInt(part, 10), 0);

      for (const tier of neededTiers) {
        const pool = await prisma.puzzle.findMany({
          where: { tier, status: 'PUBLISHED' },
          select: {
            id: true,
            tier: true,
            order_index: true,
            title: true,
            fen: true,
            description: true,
            constraints: true,
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        });

        if (pool.length > 0) {
          const selectedIndex = Math.abs(dateNum) % pool.length;
          const picked = pool[selectedIndex];

          await prisma.puzzle.update({
            where: { id: picked.id },
            data: {
              is_daily: true,
              daily_date: targetDate,
            },
          });

          dailyPuzzles.push(picked);
        }
      }
    }

    // Sắp xếp thứ tự chuẩn: EASY -> MEDIUM -> HARD
    const tierOrder: Record<string, number> = { EASY: 1, MEDIUM: 2, HARD: 3, UGC: 4 };
    dailyPuzzles.sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99));

    // 3. Kiểm tra tiến trình của người chơi nếu đã đăng nhập
    let solvedIds = new Set<number>();
    let bonusClaimed = false;

    if (userId) {
      const pzIds = dailyPuzzles.map(p => p.id);
      const progresses = await prisma.userPuzzleProgress.findMany({
        where: {
          user_id: userId,
          puzzle_id: { in: pzIds },
          is_solved: true,
        },
        select: { puzzle_id: true },
      });
      progresses.forEach(p => solvedIds.add(p.puzzle_id));

      const bonusLog = await prisma.puzzleRewardLog.findUnique({
        where: { reward_key: `DAILY_ALL_CLEAR:${userId}:${targetDateStr}` },
      });
      if (bonusLog) bonusClaimed = true;
    }

    const tierExp: Record<string, number> = { EASY: 2, MEDIUM: 5, HARD: 10, UGC: 5 };

    const formattedPuzzles = dailyPuzzles.map(p => ({
      id: p.id,
      tier: p.tier,
      order_index: p.order_index,
      title: p.title,
      fen: p.fen,
      description: p.description,
      constraints: p.constraints,
      creator: p.creator,
      exp_reward: tierExp[p.tier] || 2,
      is_solved: solvedIds.has(p.id),
    }));

    const solvedCount = formattedPuzzles.filter(p => p.is_solved).length;
    const allSolved = formattedPuzzles.length > 0 && solvedCount === formattedPuzzles.length;

    return {
      date: targetDateStr,
      puzzles: formattedPuzzles,
      progress: {
        solved_count: solvedCount,
        total_count: formattedPuzzles.length,
        all_solved: allSolved,
        daily_bonus_exp: 15,
        daily_bonus_claimed: bonusClaimed,
      },
    };
  }

  /**
   * Kích hoạt đăng 3 thế cờ hàng ngày kèm bài viết Blog
   */
  static async publishDailyPuzzlesAndBlog(dateStr?: string): Promise<{
    date: string;
    puzzles: DailySummary['puzzles'];
    blog: DailyBlogResult;
  }> {
    const summary = await this.getDailyPuzzles(dateStr);

    const puzzleItems: DailyPuzzleItem[] = summary.puzzles.map(p => ({
      id: p.id,
      tier: p.tier as any,
      title: p.title,
      fen: p.fen,
      expReward: p.exp_reward,
    }));

    const blogResult = await DailyBloggerService.publishToBlogger(summary.date, puzzleItems);

    return {
      date: summary.date,
      puzzles: summary.puzzles,
      blog: blogResult,
    };
  }
}
