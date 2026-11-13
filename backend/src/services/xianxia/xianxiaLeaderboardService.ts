import { prisma } from '../../utils/prisma.js';
import {
  LeaderboardEntry,
  LeaderboardPagination,
  LeaderboardResponse,
} from '../../types/xianxia.js';

export const REALM_ORDER: Record<string, number> = {
  PHAM_NHAN: 0,
  LUYEN_KHI_1: 1,
  LUYEN_KHI_2: 2,
  LUYEN_KHI_3: 3,
  LUYEN_KHI_4: 4,
  LUYEN_KHI_5: 5,
  LUYEN_KHI_6: 6,
  LUYEN_KHI_7: 7,
  LUYEN_KHI_8: 8,
  LUYEN_KHI_9: 9,
  TRUC_CO_SO_KY: 10,
  TRUC_CO_TRUNG_KY: 11,
  TRUC_CO_HAU_KY: 12,
  TRUC_CO_DINH_PHONG: 13,
  KIM_DAN_SO_KY: 14,
};

export const REALM_TITLES: Record<string, string> = {
  PHAM_NHAN: 'Phàm Nhân',
  LUYEN_KHI_1: 'Luyện Khí Tầng 1',
  LUYEN_KHI_2: 'Luyện Khí Tầng 2',
  LUYEN_KHI_3: 'Luyện Khí Tầng 3',
  LUYEN_KHI_4: 'Luyện Khí Tầng 4',
  LUYEN_KHI_5: 'Luyện Khí Tầng 5',
  LUYEN_KHI_6: 'Luyện Khí Tầng 6',
  LUYEN_KHI_7: 'Luyện Khí Tầng 7',
  LUYEN_KHI_8: 'Luyện Khí Tầng 8',
  LUYEN_KHI_9: 'Luyện Khí Tầng 9',
  TRUC_CO_SO_KY: 'Trúc Cơ Sơ Kỳ',
  TRUC_CO_TRUNG_KY: 'Trúc Cơ Trung Kỳ',
  TRUC_CO_HAU_KY: 'Trúc Cơ Hậu Kỳ',
  TRUC_CO_DINH_PHONG: 'Trúc Cơ Đỉnh Phong',
  KIM_DAN_SO_KY: 'Kim Đan Sơ Kỳ',
};

interface CacheItem {
  timestamp: number;
  data: {
    entries: LeaderboardEntry[];
    pagination: LeaderboardPagination;
  };
}

export class XianxiaLeaderboardService {
  private cache: Map<string, CacheItem> = new Map();
  private readonly CACHE_TTL_MS = 10_000; // 10 giây cache
  private readonly MAX_CACHE_ENTRIES = 100; // Ngưỡng an toàn bảo vệ bộ nhớ RAM

  /**
   * Dọn dẹp các mục bộ nhớ đệm đã quá hạn hoặc quá giới hạn dung lượng (FIFO)
   */
  private evictCacheIfNecessary(now: number): void {
    if (this.cache.size >= this.MAX_CACHE_ENTRIES) {
      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp >= this.CACHE_TTL_MS) {
          this.cache.delete(key);
        }
      }
      while (this.cache.size >= this.MAX_CACHE_ENTRIES) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        } else {
          break;
        }
      }
    }
  }

  /**
   * Tính toán Chiến Lực Đạo Hạnh (Combat Power) từ các thuộc tính cốt lõi
   * Đảm bảo an toàn tuyệt đối với giá trị null/undefined/âm/NaN
   * Công thức: Floor(Physique * 2 + Comprehension * 1.5 + MaxHealth / 4 + RealmOrder * 100 + Level * 10)
   */
  public calcCombatPower(char?: {
    physique?: number | null;
    comprehension?: number | null;
    max_health?: number | null;
    level?: number | null;
    realm?: string | null;
  } | null): number {
    if (!char) return 0;
    const realm = char.realm || 'PHAM_NHAN';
    const realmOrder = REALM_ORDER[realm] ?? 0;
    const physique = Math.max(0, Number(char.physique) || 0);
    const comprehension = Math.max(0, Number(char.comprehension) || 0);
    const maxHealth = Math.max(0, Number(char.max_health) || 0);
    const level = Math.max(1, Number(char.level) || 1);

    const cp = Math.floor(
      physique * 2 +
      comprehension * 1.5 +
      maxHealth / 4 +
      realmOrder * 100 +
      level * 10
    );
    return Math.max(0, cp);
  }

  /**
   * Xóa toàn bộ bộ nhớ đệm bảng xếp hạng (hỗ trợ kiểm thử và khi có sự kiện đặc biệt)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Lấy danh sách bảng xếp hạng có phân trang (Authoritative PostgreSQL Query)
   */
  public async getLeaderboard(params: {
    page?: number | string;
    limit?: number | string;
    userId?: number;
    fresh?: boolean;
  }): Promise<LeaderboardResponse> {
    const startTime = Date.now();

    // 1. Chuẩn hóa tham số phân trang
    let page = parseInt(String(params.page ?? 1), 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(String(params.limit ?? 10), 10);
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50; // Giới hạn tối đa 50 phần tử / trang

    const offset = (page - 1) * limit;
    const cacheKey = `page:${page}:limit:${limit}`;
    const now = Date.now();

    let cachedResult = this.cache.get(cacheKey);
    let entries: LeaderboardEntry[];
    let pagination: LeaderboardPagination;

    if (!params.fresh && cachedResult && now - cachedResult.timestamp < this.CACHE_TTL_MS) {
      entries = cachedResult.data.entries;
      pagination = cachedResult.data.pagination;
    } else {
      // 2. Chạy song song đếm tổng số và lấy danh sách trang trên connection pool để tối ưu độ trễ mạng
      const countPromise = prisma.$queryRaw<Array<{ total: number | bigint }>>`
        SELECT COUNT(*)::int as total FROM xianxia_characters;
      `;

      const rowsPromise = prisma.$queryRaw<
        Array<{
          id: number;
          user_id: number;
          name: string;
          realm: string;
          level: number;
          cultivation: number;
          exp: number;
          health: number;
          max_health: number;
          physique: number;
          comprehension: number;
          luck: number;
          created_at: Date;
        }>
      >`
        SELECT 
          id,
          user_id,
          name,
          realm,
          level,
          cultivation,
          exp,
          health,
          max_health,
          physique,
          comprehension,
          luck,
          created_at
        FROM xianxia_characters
        ORDER BY 
          CASE realm
            WHEN 'KIM_DAN_SO_KY' THEN 14
            WHEN 'TRUC_CO_DINH_PHONG' THEN 13
            WHEN 'TRUC_CO_HAU_KY' THEN 12
            WHEN 'TRUC_CO_TRUNG_KY' THEN 11
            WHEN 'TRUC_CO_SO_KY' THEN 10
            WHEN 'LUYEN_KHI_9' THEN 9
            WHEN 'LUYEN_KHI_8' THEN 8
            WHEN 'LUYEN_KHI_7' THEN 7
            WHEN 'LUYEN_KHI_6' THEN 6
            WHEN 'LUYEN_KHI_5' THEN 5
            WHEN 'LUYEN_KHI_4' THEN 4
            WHEN 'LUYEN_KHI_3' THEN 3
            WHEN 'LUYEN_KHI_2' THEN 2
            WHEN 'LUYEN_KHI_1' THEN 1
            ELSE 0
          END DESC,
          level DESC,
          cultivation DESC,
          exp DESC,
          id ASC
        LIMIT ${limit} OFFSET ${offset};
      `;

      const [countRes, rows] = await Promise.all([countPromise, rowsPromise]);
      const total = Number(countRes[0]?.total ?? 0);
      const totalPages = Math.ceil(total / limit) || 1;

      entries = rows.map((row, idx) => {
        const rank = offset + idx + 1;
        const realmTitle = REALM_TITLES[row.realm] || row.realm;
        const combatPower = this.calcCombatPower(row);

        return {
          rank,
          id: row.id,
          name: row.name,
          realm: row.realm,
          realmTitle,
          level: row.level,
          cultivation: row.cultivation,
          combatPower,
          maxHealth: row.max_health,
          physique: row.physique,
          comprehension: row.comprehension,
          createdAt: row.created_at.toISOString(),
        };
      });

      pagination = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      // Dọn dẹp cache quá hạn hoặc quá tải trước khi lưu mới
      this.evictCacheIfNecessary(now);
      this.cache.set(cacheKey, {
        timestamp: now,
        data: { entries, pagination },
      });
    }

    // 4. Nếu có userId, tính toán thứ hạng cá nhân (myRank)
    let myRank: number | null = null;
    if (params.userId) {
      const rankRes: Array<{ rank: number | bigint }> = await prisma.$queryRaw`
        WITH RankedCharacters AS (
          SELECT 
            id,
            user_id,
            ROW_NUMBER() OVER (
              ORDER BY 
                CASE realm
                  WHEN 'KIM_DAN_SO_KY' THEN 14
                  WHEN 'TRUC_CO_DINH_PHONG' THEN 13
                  WHEN 'TRUC_CO_HAU_KY' THEN 12
                  WHEN 'TRUC_CO_TRUNG_KY' THEN 11
                  WHEN 'TRUC_CO_SO_KY' THEN 10
                  WHEN 'LUYEN_KHI_9' THEN 9
                  WHEN 'LUYEN_KHI_8' THEN 8
                  WHEN 'LUYEN_KHI_7' THEN 7
                  WHEN 'LUYEN_KHI_6' THEN 6
                  WHEN 'LUYEN_KHI_5' THEN 5
                  WHEN 'LUYEN_KHI_4' THEN 4
                  WHEN 'LUYEN_KHI_3' THEN 3
                  WHEN 'LUYEN_KHI_2' THEN 2
                  WHEN 'LUYEN_KHI_1' THEN 1
                  ELSE 0
                END DESC,
                level DESC,
                cultivation DESC,
                exp DESC,
                id ASC
            ) as rank
          FROM xianxia_characters
        )
        SELECT rank::int FROM RankedCharacters WHERE user_id = ${params.userId} LIMIT 1;
      `;

      if (rankRes.length > 0 && rankRes[0].rank != null) {
        myRank = Number(rankRes[0].rank);
      }
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      success: true,
      data: entries,
      pagination,
      myRank,
      serverTime: new Date().toISOString(),
      executionTimeMs,
    };
  }
}

export const xianxiaLeaderboardService = new XianxiaLeaderboardService();
