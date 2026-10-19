import { prisma } from '../utils/prisma.js';
import { PuzzleEngine, SolutionTree } from './puzzleEngine.js';
import { calculateLevelFromExp, getPlayerTitles } from './levelService.js';
import { XiangqiRuleVerifier } from '../utils/xiangqiRuleVerifier.js';
import { PuzzlePlayMode, PuzzleSessionType, PuzzleTier } from '@prisma/client';

export interface StartSessionInput {
  puzzleId: number;
  userId?: number;
  mode?: PuzzlePlayMode;
  sessionType?: PuzzleSessionType;
}

export interface SubmitMoveInput {
  sessionId: string;
  moveUci: string;
  userId?: number;
}

export class PuzzleService {
  /**
   * Lấy danh sách thế cờ (hỗ trợ phân trang, lọc theo tier)
   * Tuyệt đối KHÔNG trả về solution_tree!
   */
  static async getPuzzles(params: {
    tier?: PuzzleTier;
    page?: number;
    limit?: number;
    userId?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 30));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: 'PUBLISHED',
    };
    if (params.tier) {
      whereClause.tier = params.tier;
    }

    const [total, puzzles] = await Promise.all([
      prisma.puzzle.count({ where: whereClause }),
      prisma.puzzle.findMany({
        where: whereClause,
        select: {
          id: true,
          tier: true,
          order_index: true,
          title: true,
          fen: true,
          status: true,
          play_count: true,
          defeat_count: true,
          upvote_count: true,
          is_daily: true,
          description: true,
          constraints: true,
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: params.tier === 'UGC'
          ? [{ id: 'desc' as const }]
          : [
              { order_index: 'asc' as const },
              { id: 'asc' as const }
            ],
        skip,
        take: limit,
      }),
    ]);

    // Nếu người chơi đã đăng nhập, gắn kèm trạng thái đã phá giải hay chưa
    let solvedPuzzleIds = new Set<number>();
    if (params.userId) {
      const userProgress = await prisma.userPuzzleProgress.findMany({
        where: {
          user_id: params.userId,
          is_solved: true,
        },
        select: { puzzle_id: true },
      });
      userProgress.forEach((p) => solvedPuzzleIds.add(p.puzzle_id));
    }

    const data = puzzles.map((pz) => ({
      ...pz,
      is_solved: solvedPuzzleIds.has(pz.id),
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      puzzles: data,
    };
  }

  /**
   * Lấy chi tiết 1 thế cờ theo ID (không trả về đáp án)
   */
  static async getPuzzleById(puzzleId: number, userId?: number) {
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
      select: {
        id: true,
        tier: true,
        order_index: true,
        title: true,
        fen: true,
        status: true,
        play_count: true,
        defeat_count: true,
        upvote_count: true,
        is_daily: true,
        description: true,
        constraints: true,
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!puzzle) return null;

    let isSolved = false;
    if (userId) {
      const prog = await prisma.userPuzzleProgress.findFirst({
        where: { user_id: userId, puzzle_id: puzzleId, is_solved: true },
      });
      isSolved = !!prog;
    }

    return {
      ...puzzle,
      is_solved: isSolved,
    };
  }

  /**
   * Khởi tạo một phiên giải thế cờ (Session State Machine)
   */
  static async startSession(input: StartSessionInput) {
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: input.puzzleId },
    });

    if (!puzzle || puzzle.status === 'HIDDEN') {
      throw new Error('Thế cờ không tồn tại hoặc đã bị ẩn.');
    }

    const mode = input.mode || PuzzlePlayMode.TRADITIONAL;
    const sessionType = input.sessionType || PuzzleSessionType.RANKED;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    const session = await prisma.puzzleSession.create({
      data: {
        puzzle_id: puzzle.id,
        user_id: input.userId || null,
        mode,
        session_type: sessionType,
        current_fen: puzzle.fen,
        move_history: JSON.stringify([]),
        status: 'ACTIVE',
        expires_at: expiresAt,
      },
    });

    // Tăng lượt chơi của thế cờ
    await prisma.puzzle.update({
      where: { id: puzzle.id },
      data: { play_count: { increment: 1 } },
    });

    return {
      sessionId: session.id,
      puzzleId: puzzle.id,
      title: puzzle.title,
      tier: puzzle.tier,
      order_index: puzzle.order_index,
      initialFen: puzzle.fen,
      mode: session.mode,
      sessionType: session.session_type,
      status: session.status,
      timeLimitSec: 900,
    };
  }

  /**
   * Thẩm định nước đi người chơi gửi lên Server (Chống hack F12 & Race-condition)
   */
  static async submitMove(input: SubmitMoveInput) {
    const session = await prisma.puzzleSession.findUnique({
      where: { id: input.sessionId },
      include: { puzzle: true },
    });

    if (!session) {
      throw new Error('Phiên giải không tồn tại.');
    }

    if (session.status !== 'ACTIVE') {
      throw new Error(`Phiên giải này đã kết thúc với trạng thái: ${session.status}`);
    }

    if (new Date() > session.expires_at) {
      await prisma.puzzleSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Phiên chơi đã hết hạn thời gian (15 phút). Vui lòng bắt đầu lại!');
    }

    if (session.user_id && input.userId && session.user_id !== input.userId) {
      throw new Error('Bạn không có quyền thực thi trên phiên chơi của kỳ thủ khác.');
    }

    const solutionTree: SolutionTree = JSON.parse(session.puzzle.solution_tree);
    const moveHistory: string[] = JSON.parse(session.move_history || '[]');

    let constraints: any = {};
    try {
      if (session.puzzle.constraints) constraints = JSON.parse(session.puzzle.constraints);
    } catch (e) {}

    // Ràng buộc cấm quân (Forbidden pieces)
    if (constraints.forbidden_pieces && constraints.forbidden_pieces.length > 0) {
      const uciPos = XiangqiRuleVerifier.uciToPos(input.moveUci);
      if (uciPos) {
        const board = XiangqiRuleVerifier.parseFen(session.current_fen);
        const p = board[uciPos.from.r][uciPos.from.c];
        if (p && constraints.forbidden_pieces.includes(p.toUpperCase())) {
          throw new Error(`Vi phạm điều kiện thách đấu: Cấm sử dụng quân ${p.toUpperCase()}!`);
        }
      }
    }

    console.log('[PuzzleService.submitMove] session:', session.id, 'fen:', session.current_fen, 'moveUci:', input.moveUci, 'history:', session.move_history);

    // Gọi engine thẩm định nước đi (kèm FEN hiện tại để kiểm tra luật cờ)
    const evalResult = PuzzleEngine.evaluateSolutionStep(solutionTree, moveHistory, input.moveUci, session.current_fen);

    if (evalResult.status === 'INVALID_MOVE') {
      throw new Error(`Nước đi không hợp lệ: ${evalResult.defeatReason}`);
    }

    const redMoveCount = Math.floor(moveHistory.length / 2) + 1;
    if (constraints.max_moves && redMoveCount > constraints.max_moves && evalResult.status !== 'VICTORY') {
      await prisma.puzzleSession.update({
        where: { id: session.id },
        data: { status: 'DEFEATED' },
      });
      return {
        status: 'DEFEAT',
        playerMove: input.moveUci,
        defeatReason: `Hết số nước quy định! Thế cờ này yêu cầu sát cục trong ${constraints.max_moves} nước.`,
      };
    }

    // TRƯỜNG HỢP 1: NƯỚC ĐI ĐÚNG - MÁY ĐÁP TRẢ
    if (evalResult.status === 'CONTINUE' && evalResult.nextFen && evalResult.computerReply) {
      const updatedHistory = [...moveHistory, evalResult.playerMove, evalResult.computerReply];
      await prisma.puzzleSession.update({
        where: { id: session.id },
        data: {
          current_fen: evalResult.nextFen,
          move_history: JSON.stringify(updatedHistory),
        },
      });

      return {
        status: 'CONTINUE',
        playerMove: evalResult.playerMove,
        computerReply: evalResult.computerReply,
        currentFen: evalResult.nextFen,
      };
    }

    // TRƯỜNG HỢP 2: NƯỚC ĐI SÁT CỤC CHIẾN THẮNG (VICTORY)
    if (evalResult.status === 'VICTORY') {
      const updatedHistory = [...moveHistory, evalResult.playerMove];

      // Định mức EXP theo Tier
      let baseExp = 2; // EASY
      if (session.puzzle.tier === 'MEDIUM') baseExp = 5;
      if (session.puzzle.tier === 'HARD') baseExp = 10;
      if (session.puzzle.tier === 'UGC') baseExp = 5;

      let isFirstClear = false;
      let expGained = 0;
      let newTotalExp = '0';
      let newLevel = 1;
      let rankTitle = 'Tập Sự';
      let isDailyAllClear = false;
      let dailyBonusExp = 0;

      // Thực thi giao dịch nguyên tử (Idempotency Transaction)
      await prisma.$transaction(async (tx) => {
        // 1. Đóng session thành WON
        await tx.puzzleSession.update({
          where: { id: session.id },
          data: {
            status: 'WON',
            move_history: JSON.stringify(updatedHistory),
          },
        });

        // 2. Nếu là RANKED và người chơi có tài khoản, thực hiện cấp EXP lần đầu
        if (session.session_type === 'RANKED' && session.user_id) {
          const rewardKey = `FIRST_CLEAR:${session.user_id}:${session.puzzle_id}:${session.mode}`;
          const existingReward = await tx.puzzleRewardLog.findUnique({
            where: { reward_key: rewardKey },
          });

          if (!existingReward) {
            isFirstClear = true;
            expGained = baseExp;

            // Ghi nhận log giao dịch nhận thưởng (Khóa chặn cộng trùng)
            await tx.puzzleRewardLog.create({
              data: {
                user_id: session.user_id,
                puzzle_id: session.puzzle_id,
                mode: session.mode,
                reward_key: rewardKey,
                exp_amount: expGained,
              },
            });

            // Cập nhật tổng EXP của người chơi
            const user = await tx.user.findUnique({
              where: { id: session.user_id },
            });

            if (user) {
              const updatedExp = user.exp + BigInt(expGained);
              const computedLevel = calculateLevelFromExp(updatedExp, user.level);
              await tx.user.update({
                where: { id: user.id },
                data: {
                  exp: updatedExp,
                  level: computedLevel,
                },
              });
              newTotalExp = updatedExp.toString();
              newLevel = computedLevel;
              const titles = getPlayerTitles(computedLevel, user.elo);
              rankTitle = titles.fullTitle;
            }
          }

          // Ghi nhận tiến trình UserPuzzleProgress
          await tx.userPuzzleProgress.upsert({
            where: {
              user_id_puzzle_id_mode: {
                user_id: session.user_id,
                puzzle_id: session.puzzle_id,
                mode: session.mode,
              },
            },
            update: {
              is_solved: true,
              first_solved_at: isFirstClear ? new Date() : undefined,
              attempts: { increment: 1 },
            },
            create: {
              user_id: session.user_id,
              puzzle_id: session.puzzle_id,
              mode: session.mode,
              is_solved: true,
              first_solved_at: new Date(),
              attempts: 1,
            },
          });

          // 3. Nếu là thế cờ hàng ngày (Daily Puzzle), kiểm tra xem người chơi đã hoàn thành trọn vẹn cả 3 thế chưa
          if (session.puzzle.is_daily && session.puzzle.daily_date) {
            const dateStr = session.puzzle.daily_date.toISOString().split('T')[0];
            const dailyRewardKey = `DAILY_ALL_CLEAR:${session.user_id}:${dateStr}`;
            const existingDailyReward = await tx.puzzleRewardLog.findUnique({
              where: { reward_key: dailyRewardKey },
            });

            if (!existingDailyReward) {
              const dailyPuzzles = await tx.puzzle.findMany({
                where: { is_daily: true, daily_date: session.puzzle.daily_date, status: 'PUBLISHED' },
                select: { id: true },
              });

              if (dailyPuzzles.length > 0) {
                const solvedCount = await tx.userPuzzleProgress.count({
                  where: {
                    user_id: session.user_id,
                    puzzle_id: { in: dailyPuzzles.map((p) => p.id) },
                    is_solved: true,
                  },
                });

                if (solvedCount >= dailyPuzzles.length) {
                  isDailyAllClear = true;
                  dailyBonusExp = 15;

                  await tx.puzzleRewardLog.create({
                    data: {
                      user_id: session.user_id,
                      puzzle_id: session.puzzle_id,
                      mode: session.mode,
                      reward_key: dailyRewardKey,
                      exp_amount: dailyBonusExp,
                    },
                  });

                  const user = await tx.user.findUnique({ where: { id: session.user_id } });
                  if (user) {
                    const updatedExp = user.exp + BigInt(dailyBonusExp);
                    const computedLevel = calculateLevelFromExp(updatedExp, user.level);
                    await tx.user.update({
                      where: { id: user.id },
                      data: { exp: updatedExp, level: computedLevel },
                    });
                    newTotalExp = updatedExp.toString();
                    newLevel = computedLevel;
                    const titles = getPlayerTitles(computedLevel, user.elo);
                    rankTitle = titles.fullTitle;
                  }
                }
              }
            }
          }
        }
      });

      return {
        status: 'VICTORY',
        playerMove: evalResult.playerMove,
        isFirstClear,
        expGained,
        isDailyAllClear,
        dailyBonusExp,
        newTotalExp,
        newLevel,
        rankTitle,
        winComment: evalResult.winComment || 'Sát cục tuyệt diệu! Đại hiệp đã phá giải kỳ trận thành công!',
      };
    }

    // TRƯỜNG HỢP 3: NƯỚC ĐI SAI - BẠI TRẬN (DEFEAT)
    await prisma.puzzleSession.update({
      where: { id: session.id },
      data: { status: 'DEFEATED' },
    });

    // Tăng defeat_count của thế cờ
    await prisma.puzzle.update({
      where: { id: session.puzzle_id },
      data: { defeat_count: { increment: 1 } },
    });

    return {
      status: 'DEFEAT',
      playerMove: evalResult.playerMove,
      punishMove: evalResult.computerReply || null,
      defeatReason: evalResult.defeatReason || 'Nước đi không phải diệu thủ. Đối phương phản công chiếu bí. Bại trận!',
    };
  }
}
