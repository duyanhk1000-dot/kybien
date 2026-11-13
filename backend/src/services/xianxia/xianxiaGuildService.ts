import { prisma } from '../../utils/prisma.js';
import { REALM_HIERARCHY } from './xianxiaWorldService.js';
import { RealmTier } from '../../types/xianxia.js';
import { xianxiaChatService } from './xianxiaChatService.js';
import { notifyGuildDisbanded, notifyMemberKicked } from '../../socket/xianxiaChatSocket.js';

export interface GuildMemberInfo {
  characterId: number;
  userId: number;
  name: string;
  realm: string;
  level: number;
  role: 'LEADER' | 'ELDER' | 'MEMBER';
  joinedAt: string;
}

export interface GuildSummary {
  id: number;
  name: string;
  description: string | null;
  notice: string | null;
  leaderId: number;
  leaderName: string;
  leaderRealm: string;
  level: number;
  reputation: number;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
}

export class XianxiaGuildService {
  public static readonly MIN_GUILD_NAME_LENGTH = 3;
  public static readonly MAX_GUILD_NAME_LENGTH = 30;
  public static readonly CREATE_GUILD_SILVER_COST = 500;
  public static readonly MIN_CREATE_REALM_TIER = 3; // Luyện Khí Tầng 3
  public static readonly DEFAULT_MAX_MEMBERS = 20;
  public static readonly MAX_PENDING_APPLICATIONS_PER_USER = 3;

  /**
   * Chuẩn hóa và làm sạch tên Tông Môn
   */
  public sanitizeGuildName(rawName: string): string {
    if (!rawName || typeof rawName !== 'string') return '';
    const clean = rawName.replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/g, '').trim();
    return clean.replace(/\s+/g, ' ');
  }

  /**
   * Tạo Tông Môn mới (Atomicity + Pessimistic Lock)
   */
  public async createGuild(userId: number, rawName: string, rawDesc?: string): Promise<GuildSummary> {
    const cleanName = this.sanitizeGuildName(rawName);
    const cleanDesc = rawDesc ? rawDesc.trim().slice(0, 255) : null;

    if (cleanName.length < XianxiaGuildService.MIN_GUILD_NAME_LENGTH || cleanName.length > XianxiaGuildService.MAX_GUILD_NAME_LENGTH) {
      throw new Error(`GUILD_INVALID_NAME: Tên Tông môn phải từ ${XianxiaGuildService.MIN_GUILD_NAME_LENGTH} đến ${XianxiaGuildService.MAX_GUILD_NAME_LENGTH} ký tự.`);
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Khóa và lấy thông tin nhân vật
        const character = await tx.xianxiaCharacter.findUnique({
          where: { user_id: userId },
        });
        if (!character) {
          throw new Error('GUILD_CHARACTER_NOT_FOUND: Đạo hữu chưa tạo nhân vật tu tiên.');
        }

        // Khóa hàng nhân vật FOR UPDATE
        await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', character.id);

        // 2. Kiểm tra nhân vật đã thuộc Tông môn nào chưa
        const existingMembership = await tx.xianxiaGuildMember.findUnique({
          where: { character_id: character.id },
        });
        if (existingMembership) {
          throw new Error('GUILD_ALREADY_IN_GUILD: Đạo hữu đã là thành viên của một Tông môn khác, không thể lập Tông môn mới.');
        }

        // 3. Kiểm tra điều kiện cảnh giới (tối thiểu Luyện Khí 3)
        const realmTier = REALM_HIERARCHY[character.realm as RealmTier] ?? 0;
        if (realmTier < XianxiaGuildService.MIN_CREATE_REALM_TIER) {
          throw new Error('GUILD_REALM_TOO_LOW: Cảnh giới tu vi chưa đủ. Yêu cầu tối thiểu đạt Luyện Khí Tầng 3 để lập Tông môn.');
        }

        // 4. Kiểm tra tài nguyên Bạc (tối thiểu 500 Bạc)
        if (character.silver < XianxiaGuildService.CREATE_GUILD_SILVER_COST) {
          throw new Error(`GUILD_INSUFFICIENT_SILVER: Ngân lượng không đủ. Thành lập Tông môn cần ${XianxiaGuildService.CREATE_GUILD_SILVER_COST} Bạc.`);
        }

        // 5. Kiểm tra tên Tông môn trùng lặp
        const nameTaken = await tx.xianxiaGuild.findUnique({
          where: { name: cleanName },
        });
        if (nameTaken) {
          throw new Error('GUILD_NAME_TAKEN: Danh xưng Tông môn này đã được khai sáng trong thiên hạ. Xin chọn tên khác.');
        }

        // 6. Khấu trừ 500 Bạc
        await tx.xianxiaCharacter.update({
          where: { id: character.id },
          data: { silver: character.silver - XianxiaGuildService.CREATE_GUILD_SILVER_COST },
        });

        // 7. Tạo bản ghi Tông Môn
        const guild = await tx.xianxiaGuild.create({
          data: {
            name: cleanName,
            description: cleanDesc,
            notice: `Chào mừng các vị đạo hữu gia nhập ${cleanName}!`,
            leader_id: character.id,
            member_count: 1,
            max_members: XianxiaGuildService.DEFAULT_MAX_MEMBERS,
          },
        });

        // 8. Tạo thành viên Chưởng Môn (LEADER)
        await tx.xianxiaGuildMember.create({
          data: {
            guild_id: guild.id,
            character_id: character.id,
            role: 'LEADER',
          },
        });

        // 9. Hủy toàn bộ các đơn xin gia nhập đang PENDING của nhân vật này
        await tx.xianxiaGuildApplication.updateMany({
          where: {
            character_id: character.id,
            status: 'PENDING',
          },
          data: { status: 'CANCELLED' },
        });

        return {
          id: guild.id,
          name: guild.name,
          description: guild.description,
          notice: guild.notice,
          leaderId: character.id,
          leaderName: character.name,
          leaderRealm: character.realm,
          level: guild.level,
          reputation: guild.reputation,
          memberCount: guild.member_count,
          maxMembers: guild.max_members,
          createdAt: guild.created_at.toISOString(),
        };
      }, {
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (err: any) {
      if (err?.code === 'P2002' || err?.message?.includes('xianxia_guilds_name_key') || err?.message?.includes('name')) {
        throw new Error('GUILD_NAME_TAKEN: Danh xưng Tông môn này đã được khai sáng trong thiên hạ. Xin chọn tên khác.');
      }
      throw err;
    }
  }

  /**
   * Lấy danh sách Tông Môn (phân trang, tìm kiếm, sắp xếp)
   */
  public async getGuildsList(query: {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'reputation' | 'members';
  }): Promise<{ guilds: GuildSummary[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(query.limit || 10, 50));
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (query.search && typeof query.search === 'string') {
      const searchClean = query.search.trim();
      if (searchClean) {
        whereClause.name = { contains: searchClean, mode: 'insensitive' };
      }
    }

    const orderByClause: any =
      query.sortBy === 'members'
        ? [{ member_count: 'desc' }, { id: 'asc' }]
        : [{ reputation: 'desc' }, { member_count: 'desc' }, { id: 'asc' }];

    const [total, records] = await Promise.all([
      prisma.xianxiaGuild.count({ where: whereClause }),
      prisma.xianxiaGuild.findMany({
        where: whereClause,
        include: {
          leader: {
            select: { id: true, name: true, realm: true },
          },
        },
        orderBy: orderByClause,
        skip,
        take: limit,
      }),
    ]);

    const guilds: GuildSummary[] = records.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      notice: g.notice,
      leaderId: g.leader_id,
      leaderName: g.leader.name,
      leaderRealm: g.leader.realm,
      level: g.level,
      reputation: g.reputation,
      memberCount: g.member_count,
      maxMembers: g.max_members,
      createdAt: g.created_at.toISOString(),
    }));

    return { guilds, total, page, limit };
  }

  /**
   * Lấy thông tin Tông Môn của nhân vật người chơi hiện tại
   */
  public async getMyGuild(userId: number): Promise<{
    hasGuild: boolean;
    guild: GuildSummary | null;
    myRole: 'LEADER' | 'ELDER' | 'MEMBER' | null;
    members?: GuildMemberInfo[];
    pendingApplicationsCount?: number;
  }> {
    const character = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    if (!character) {
      return { hasGuild: false, guild: null, myRole: null };
    }

    const membership = await prisma.xianxiaGuildMember.findUnique({
      where: { character_id: character.id },
      include: {
        guild: {
          include: {
            leader: { select: { id: true, name: true, realm: true } },
            members: {
              include: {
                character: {
                  select: { id: true, user_id: true, name: true, realm: true, level: true },
                },
              },
              orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
            },
          },
        },
      },
    });

    if (!membership) {
      return { hasGuild: false, guild: null, myRole: null };
    }

    const g = membership.guild;
    const isOfficer = membership.role === 'LEADER' || membership.role === 'ELDER';
    let pendingCount = 0;
    if (isOfficer) {
      pendingCount = await prisma.xianxiaGuildApplication.count({
        where: { guild_id: g.id, status: 'PENDING' },
      });
    }

    const members: GuildMemberInfo[] = g.members.map((m) => ({
      characterId: m.character.id,
      userId: m.character.user_id,
      name: m.character.name,
      realm: m.character.realm,
      level: m.character.level,
      role: m.role as any,
      joinedAt: m.joined_at.toISOString(),
    }));

    return {
      hasGuild: true,
      myRole: membership.role as any,
      pendingApplicationsCount: pendingCount,
      guild: {
        id: g.id,
        name: g.name,
        description: g.description,
        notice: g.notice,
        leaderId: g.leader_id,
        leaderName: g.leader.name,
        leaderRealm: g.leader.realm,
        level: g.level,
        reputation: g.reputation,
        memberCount: g.member_count,
        maxMembers: g.max_members,
        createdAt: g.created_at.toISOString(),
      },
      members,
    };
  }

  /**
   * Xem chi tiết công khai một Tông Môn
   */
  public async getGuildDetail(guildId: number): Promise<GuildSummary | null> {
    const g = await prisma.xianxiaGuild.findUnique({
      where: { id: guildId },
      include: {
        leader: { select: { id: true, name: true, realm: true } },
      },
    });
    if (!g) return null;

    return {
      id: g.id,
      name: g.name,
      description: g.description,
      notice: g.notice,
      leaderId: g.leader_id,
      leaderName: g.leader.name,
      leaderRealm: g.leader.realm,
      level: g.level,
      reputation: g.reputation,
      memberCount: g.member_count,
      maxMembers: g.max_members,
      createdAt: g.created_at.toISOString(),
    };
  }

  /**
   * Lấy danh sách thành viên của một Tông Môn
   */
  public async getGuildMembers(guildId: number): Promise<GuildMemberInfo[]> {
    const records = await prisma.xianxiaGuildMember.findMany({
      where: { guild_id: guildId },
      include: {
        character: {
          select: { id: true, user_id: true, name: true, realm: true, level: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joined_at: 'asc' }],
    });

    return records.map((m) => ({
      characterId: m.character.id,
      userId: m.character.user_id,
      name: m.character.name,
      realm: m.character.realm,
      level: m.character.level,
      role: m.role as any,
      joinedAt: m.joined_at.toISOString(),
    }));
  }

  /**
   * Gửi đơn xin gia nhập Tông Môn (Atomic + Pessimistic Lock)
   */
  public async applyToGuild(userId: number, guildId: number, rawMessage?: string): Promise<any> {
    const cleanMsg = rawMessage ? rawMessage.trim().slice(0, 200) : null;

    return await prisma.$transaction(async (tx) => {
      const character = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!character) {
        throw new Error('GUILD_CHARACTER_NOT_FOUND: Đạo hữu chưa tạo nhân vật tu tiên.');
      }

      // Khóa hàng nhân vật FOR UPDATE để serialize các request gửi đơn đồng thời của cùng 1 nhân vật
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', character.id);

      // 1. Kiểm tra đã có Tông môn chưa
      const inGuild = await tx.xianxiaGuildMember.findUnique({
        where: { character_id: character.id },
      });
      if (inGuild) {
        throw new Error('GUILD_ALREADY_IN_GUILD: Đạo hữu đã thuộc Tông môn khác, không thể gửi đơn.');
      }

      // 2. Kiểm tra giới hạn 3 đơn PENDING
      const pendingCount = await tx.xianxiaGuildApplication.count({
        where: { character_id: character.id, status: 'PENDING' },
      });
      if (pendingCount >= XianxiaGuildService.MAX_PENDING_APPLICATIONS_PER_USER) {
        throw new Error(`GUILD_APPLICATION_LIMIT: Đạo hữu đã gửi tối đa ${XianxiaGuildService.MAX_PENDING_APPLICATIONS_PER_USER} đơn gia nhập đang chờ duyệt.`);
      }

      // 3. Kiểm tra Tông môn tồn tại và chưa đầy
      const guild = await tx.xianxiaGuild.findUnique({
        where: { id: guildId },
      });
      if (!guild) {
        throw new Error('GUILD_NOT_FOUND: Tông môn không tồn tại.');
      }
      if (guild.member_count >= guild.max_members) {
        throw new Error('GUILD_FULL: Tông môn này đã đầy đệ tử (đạt trần số lượng thành viên).');
      }

      // 4. Kiểm tra đơn hiện có với Tông môn này
      const existingApp = await tx.xianxiaGuildApplication.findFirst({
        where: { guild_id: guildId, character_id: character.id },
        orderBy: { created_at: 'desc' },
      });

      if (existingApp) {
        if (existingApp.status === 'PENDING') {
          throw new Error('GUILD_APPLICATION_DUPLICATE: Đạo hữu đã nộp bái thiếp gia nhập Tông môn này rồi, xin kiên nhẫn chờ hồi âm.');
        }
        // Nếu đơn trước đã bị CANCELLED hoặc REJECTED, tái sử dụng/cập nhật lại bản ghi này thành PENDING
        return await tx.xianxiaGuildApplication.update({
          where: { id: existingApp.id },
          data: {
            status: 'PENDING',
            message: cleanMsg,
            updated_at: new Date(),
          },
        });
      }

      // 5. Nếu chưa từng nộp đơn vào Tông môn này, tạo bản ghi mới
      return await tx.xianxiaGuildApplication.create({
        data: {
          guild_id: guildId,
          character_id: character.id,
          status: 'PENDING',
          message: cleanMsg,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }

  /**
   * Hủy đơn xin gia nhập đang chờ duyệt (Atomic + Pessimistic Lock)
   */
  public async cancelApplication(userId: number, guildId: number): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      const character = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!character) return false;

      // Khóa hàng nhân vật
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', character.id);

      const app = await tx.xianxiaGuildApplication.findFirst({
        where: { guild_id: guildId, character_id: character.id, status: 'PENDING' },
      });
      if (!app) {
        throw new Error('GUILD_APPLICATION_NOT_FOUND: Không tìm thấy đơn xin gia nhập đang chờ duyệt.');
      }

      await tx.xianxiaGuildApplication.update({
        where: { id: app.id },
        data: { status: 'CANCELLED' },
      });
      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }

  /**
   * Lấy danh sách đơn xin gia nhập của Tông Môn (Chỉ LEADER hoặc ELDER)
   */
  public async getGuildApplications(userId: number, guildId: number): Promise<any[]> {
    const character = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!character) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

    // Kiểm tra quyền
    const membership = await prisma.xianxiaGuildMember.findUnique({
      where: { character_id: character.id },
    });
    if (!membership || membership.guild_id !== guildId || (membership.role !== 'LEADER' && membership.role !== 'ELDER')) {
      throw new Error('GUILD_FORBIDDEN: Đạo hữu không có quyền hạn phê duyệt đệ tử gia nhập Tông môn.');
    }

    const apps = await prisma.xianxiaGuildApplication.findMany({
      where: { guild_id: guildId, status: 'PENDING' },
      include: {
        character: {
          select: { id: true, name: true, realm: true, level: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return apps.map((a) => ({
      id: a.id,
      characterId: a.character.id,
      name: a.character.name,
      realm: a.character.realm,
      level: a.character.level,
      message: a.message,
      createdAt: a.created_at.toISOString(),
    }));
  }

  /**
   * Duyệt đơn gia nhập Tông Môn (Pessimistic Lock chống Concurrency)
   */
  public async acceptApplication(userId: number, guildId: number, applicationId: number): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra quyền của người duyệt
      const approverChar = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!approverChar) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

      const approverMember = await tx.xianxiaGuildMember.findUnique({
        where: { character_id: approverChar.id },
      });
      if (!approverMember || approverMember.guild_id !== guildId || (approverMember.role !== 'LEADER' && approverMember.role !== 'ELDER')) {
        throw new Error('GUILD_FORBIDDEN: Đạo hữu không có quyền phê duyệt đệ tử.');
      }

      // 2. Khóa hàng Tông Môn FOR UPDATE để kiểm tra số lượng
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_guilds WHERE id = $1 FOR UPDATE', guildId);
      const guild = await tx.xianxiaGuild.findUnique({ where: { id: guildId } });
      if (!guild) throw new Error('GUILD_NOT_FOUND: Tông môn không tồn tại.');
      if (guild.member_count >= guild.max_members) {
        throw new Error('GUILD_FULL: Tông môn đã đầy người, không thể tiếp nhận thêm đệ tử.');
      }

      // 3. Khóa và kiểm tra đơn gia nhập
      const app = await tx.xianxiaGuildApplication.findUnique({
        where: { id: applicationId },
      });
      if (!app || app.guild_id !== guildId || app.status !== 'PENDING') {
        throw new Error('GUILD_APPLICATION_INVALID: Đơn bái kiến không tồn tại hoặc đã được xử lý.');
      }

      // Không thể tự duyệt đơn của chính mình
      if (app.character_id === approverChar.id) {
        throw new Error('GUILD_SELF_APPROVAL_FORBIDDEN: Không thể tự phê duyệt đơn của chính mình.');
      }

      // 4. Khóa hàng ứng viên FOR UPDATE để kiểm tra độc lập
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', app.character_id);

      // Kiểm tra ứng viên đã gia nhập Tông môn khác trong lúc chờ chưa
      const candidateInGuild = await tx.xianxiaGuildMember.findUnique({
        where: { character_id: app.character_id },
      });
      if (candidateInGuild) {
        await tx.xianxiaGuildApplication.update({
          where: { id: app.id },
          data: { status: 'CANCELLED' },
        });
        throw new Error('GUILD_CANDIDATE_ALREADY_JOINED: Đạo hữu này đã gia nhập Tông môn khác trước đó.');
      }

      // 5. Tiếp nhận thành viên mới
      await tx.xianxiaGuildMember.create({
        data: {
          guild_id: guildId,
          character_id: app.character_id,
          role: 'MEMBER',
        },
      });

      // 6. Tăng số lượng thành viên của Tông Môn
      await tx.xianxiaGuild.update({
        where: { id: guildId },
        data: { member_count: guild.member_count + 1 },
      });

      // 7. Cập nhật trạng thái đơn thành ACCEPTED
      await tx.xianxiaGuildApplication.update({
        where: { id: app.id },
        data: { status: 'ACCEPTED' },
      });

      // 8. Hủy toàn bộ các đơn xin gia nhập khác của ứng viên
      await tx.xianxiaGuildApplication.updateMany({
        where: {
          character_id: app.character_id,
          status: 'PENDING',
        },
        data: { status: 'CANCELLED' },
      });

      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }

  /**
   * Từ chối đơn xin gia nhập
   */
  public async rejectApplication(userId: number, guildId: number, applicationId: number): Promise<boolean> {
    const character = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!character) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

    const membership = await prisma.xianxiaGuildMember.findUnique({
      where: { character_id: character.id },
    });
    if (!membership || membership.guild_id !== guildId || (membership.role !== 'LEADER' && membership.role !== 'ELDER')) {
      throw new Error('GUILD_FORBIDDEN: Đạo hữu không có quyền từ chối đơn gia nhập.');
    }

    const app = await prisma.xianxiaGuildApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app || app.guild_id !== guildId || app.status !== 'PENDING') {
      throw new Error('GUILD_APPLICATION_INVALID: Đơn bái kiến không tồn tại hoặc đã được xử lý.');
    }

    await prisma.xianxiaGuildApplication.update({
      where: { id: app.id },
      data: { status: 'REJECTED' },
    });
    return true;
  }

  /**
   * Tự nguyện rời khỏi Tông Môn (Chưởng môn phải truyền ngôi trước hoặc là người duy nhất giải tán)
   */
  public async leaveGuild(userId: number, guildId: number): Promise<boolean> {
    let isDisbanded = false;
    const result = await prisma.$transaction(async (tx) => {
      const character = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!character) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

      // Khóa Tông Môn FOR UPDATE
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_guilds WHERE id = $1 FOR UPDATE', guildId);
      const guild = await tx.xianxiaGuild.findUnique({ where: { id: guildId } });
      if (!guild) throw new Error('GUILD_NOT_FOUND: Tông môn không tồn tại.');

      const membership = await tx.xianxiaGuildMember.findUnique({
        where: { character_id: character.id },
      });
      if (!membership || membership.guild_id !== guildId) {
        throw new Error('GUILD_NOT_MEMBER: Đạo hữu không thuộc Tông môn này.');
      }

      // Xử lý trường hợp Chưởng Môn rời đi
      if (membership.role === 'LEADER') {
        if (guild.member_count > 1) {
          throw new Error('GUILD_LEADER_CANNOT_LEAVE: Chưởng môn không thể tự ý rời bỏ khi Tông môn còn đệ tử. Xin truyền ngôi trước.');
        }
        // Là thành viên duy nhất: Giải tán Tông môn an toàn
        await tx.xianxiaGuildApplication.deleteMany({ where: { guild_id: guildId } });
        await tx.xianxiaGuildMember.deleteMany({ where: { guild_id: guildId } });
        await tx.xianxiaGuild.delete({ where: { id: guildId } });
        isDisbanded = true;
        return true;
      }

      // Đệ tử hoặc Trưởng lão rời đi
      await tx.xianxiaGuildMember.delete({ where: { id: membership.id } });
      await tx.xianxiaGuild.update({
        where: { id: guildId },
        data: { member_count: Math.max(0, guild.member_count - 1) },
      });

      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    if (isDisbanded) {
      xianxiaChatService.deleteGuildBuffer(guildId);
      notifyGuildDisbanded(guildId);
    }
    return result;
  }

  /**
   * Trục xuất thành viên khỏi Tông Môn (Chỉ LEADER - Pessimistic Lock + Realtime Socket Eviction)
   */
  public async kickMember(userId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
    const success = await prisma.$transaction(async (tx) => {
      // 1. Khóa hàng Tông Môn FOR UPDATE để đồng bộ số lượng thành viên
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_guilds WHERE id = $1 FOR UPDATE', guildId);
      const guild = await tx.xianxiaGuild.findUnique({ where: { id: guildId } });
      if (!guild) throw new Error('GUILD_NOT_FOUND: Tông môn không tồn tại.');

      const leaderChar = await tx.xianxiaCharacter.findUnique({ where: { user_id: userId } });
      if (!leaderChar) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

      const leaderMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: leaderChar.id } });
      if (!leaderMem || leaderMem.guild_id !== guildId || leaderMem.role !== 'LEADER') {
        throw new Error('GUILD_FORBIDDEN: Chỉ Chưởng môn mới có quyền trục xuất đệ tử.');
      }

      if (leaderChar.id === targetCharacterId) {
        throw new Error('GUILD_CANNOT_KICK_SELF: Chưởng môn không thể tự trục xuất chính mình.');
      }

      // Khóa nhân vật mục tiêu FOR UPDATE
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', targetCharacterId);

      const targetMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: targetCharacterId } });
      if (!targetMem || targetMem.guild_id !== guildId) {
        throw new Error('GUILD_TARGET_NOT_MEMBER: Đạo hữu này không thuộc Tông môn của bạn.');
      }

      await tx.xianxiaGuildMember.delete({ where: { id: targetMem.id } });

      await tx.xianxiaGuild.update({
        where: { id: guildId },
        data: { member_count: Math.max(1, guild.member_count - 1) },
      });

      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    if (success) {
      notifyMemberKicked(guildId, targetCharacterId);
    }
    return success;
  }

  /**
   * Thăng chức lên Trưởng Lão (Chỉ LEADER - Transaction + Pessimistic Lock)
   */
  public async promoteMember(userId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_guilds WHERE id = $1 FOR UPDATE', guildId);
      const leaderChar = await tx.xianxiaCharacter.findUnique({ where: { user_id: userId } });
      if (!leaderChar) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

      const leaderMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: leaderChar.id } });
      if (!leaderMem || leaderMem.guild_id !== guildId || leaderMem.role !== 'LEADER') {
        throw new Error('GUILD_FORBIDDEN: Chỉ Chưởng môn mới có quyền bổ nhiệm Trưởng lão.');
      }

      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', targetCharacterId);
      const targetMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: targetCharacterId } });
      if (!targetMem || targetMem.guild_id !== guildId) {
        throw new Error('GUILD_TARGET_NOT_MEMBER: Đạo hữu này không thuộc Tông môn của bạn.');
      }

      if (targetMem.role === 'LEADER' || targetMem.role === 'ELDER') {
        throw new Error('GUILD_ALREADY_OFFICER: Đạo hữu này đã có chức vị tương đương hoặc cao hơn.');
      }

      await tx.xianxiaGuildMember.update({
        where: { id: targetMem.id },
        data: { role: 'ELDER' },
      });
      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }

  /**
   * Bãi chức Trưởng Lão xuống Đệ Tử (Chỉ LEADER - Transaction + Pessimistic Lock)
   */
  public async demoteMember(userId: number, guildId: number, targetCharacterId: number): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_guilds WHERE id = $1 FOR UPDATE', guildId);
      const leaderChar = await tx.xianxiaCharacter.findUnique({ where: { user_id: userId } });
      if (!leaderChar) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

      const leaderMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: leaderChar.id } });
      if (!leaderMem || leaderMem.guild_id !== guildId || leaderMem.role !== 'LEADER') {
        throw new Error('GUILD_FORBIDDEN: Chỉ Chưởng môn mới có quyền bãi chức Trưởng lão.');
      }

      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', targetCharacterId);
      const targetMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: targetCharacterId } });
      if (!targetMem || targetMem.guild_id !== guildId) {
        throw new Error('GUILD_TARGET_NOT_MEMBER: Đạo hữu này không thuộc Tông môn của bạn.');
      }

      if (targetMem.role !== 'ELDER') {
        throw new Error('GUILD_NOT_ELDER: Đạo hữu này không phải Trưởng lão để bãi chức.');
      }

      await tx.xianxiaGuildMember.update({
        where: { id: targetMem.id },
        data: { role: 'MEMBER' },
      });
      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }

  /**
   * Truyền ngôi Chưởng Môn (Transfer Leadership - Deadlock-Free Pessimistic Lock)
   */
  public async transferLeadership(userId: number, guildId: number, newLeaderCharacterId: number): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      const currentLeaderChar = await tx.xianxiaCharacter.findUnique({ where: { user_id: userId } });
      if (!currentLeaderChar) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

      if (currentLeaderChar.id === newLeaderCharacterId) {
        throw new Error('GUILD_ALREADY_LEADER: Đạo hữu vốn đã là Chưởng môn.');
      }

      // Khóa Tông Môn FOR UPDATE
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_guilds WHERE id = $1 FOR UPDATE', guildId);
      const guild = await tx.xianxiaGuild.findUnique({ where: { id: guildId } });
      if (!guild) throw new Error('GUILD_NOT_FOUND: Tông môn không tồn tại.');

      const currentLeaderMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: currentLeaderChar.id } });
      if (!currentLeaderMem || currentLeaderMem.guild_id !== guildId || currentLeaderMem.role !== 'LEADER') {
        throw new Error('GUILD_FORBIDDEN: Chỉ Chưởng môn đương nhiệm mới có quyền truyền ngôi.');
      }

      // Khóa 2 nhân vật theo thứ tự ID tăng dần chống Deadlock
      const firstId = Math.min(currentLeaderChar.id, newLeaderCharacterId);
      const secondId = Math.max(currentLeaderChar.id, newLeaderCharacterId);
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id IN ($1, $2) ORDER BY id FOR UPDATE', firstId, secondId);

      const newLeaderMem = await tx.xianxiaGuildMember.findUnique({ where: { character_id: newLeaderCharacterId } });
      if (!newLeaderMem || newLeaderMem.guild_id !== guildId) {
        throw new Error('GUILD_TARGET_NOT_MEMBER: Người kế vị không thuộc Tông môn của bạn.');
      }

      // 1. Hạ Chưởng môn cũ xuống Trưởng lão
      await tx.xianxiaGuildMember.update({
        where: { id: currentLeaderMem.id },
        data: { role: 'ELDER' },
      });

      // 2. Nâng người mới lên Chưởng môn
      await tx.xianxiaGuildMember.update({
        where: { id: newLeaderMem.id },
        data: { role: 'LEADER' },
      });

      // 3. Cập nhật leader_id của Tông môn
      await tx.xianxiaGuild.update({
        where: { id: guildId },
        data: { leader_id: newLeaderCharacterId },
      });

      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });
  }

  /**
   * Cập nhật cáo thị / lời răn nội bộ (Chỉ LEADER hoặc ELDER)
   */
  public async updateGuildNotice(userId: number, guildId: number, rawNotice: string): Promise<boolean> {
    const character = await prisma.xianxiaCharacter.findUnique({ where: { user_id: userId } });
    if (!character) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

    const membership = await prisma.xianxiaGuildMember.findUnique({ where: { character_id: character.id } });
    if (!membership || membership.guild_id !== guildId || (membership.role !== 'LEADER' && membership.role !== 'ELDER')) {
      throw new Error('GUILD_FORBIDDEN: Chỉ Chưởng môn hoặc Trưởng lão mới có quyền sửa đổi cáo thị.');
    }

    const cleanNotice = rawNotice ? rawNotice.trim().slice(0, 500) : null;
    await prisma.xianxiaGuild.update({
      where: { id: guildId },
      data: { notice: cleanNotice },
    });
    return true;
  }

  /**
   * Giải tán Tông Môn an toàn (Chỉ LEADER - Transaction + Realtime Flush)
   */
  public async disbandGuild(userId: number, guildId: number): Promise<boolean> {
    const success = await prisma.$transaction(async (tx) => {
      const character = await tx.xianxiaCharacter.findUnique({ where: { user_id: userId } });
      if (!character) throw new Error('GUILD_CHARACTER_NOT_FOUND: Không tìm thấy nhân vật.');

      // Khóa Tông môn FOR UPDATE
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_guilds WHERE id = $1 FOR UPDATE', guildId);
      const guild = await tx.xianxiaGuild.findUnique({ where: { id: guildId } });
      if (!guild) throw new Error('GUILD_NOT_FOUND: Tông môn không tồn tại.');

      const membership = await tx.xianxiaGuildMember.findUnique({ where: { character_id: character.id } });
      if (!membership || membership.guild_id !== guildId || membership.role !== 'LEADER') {
        throw new Error('GUILD_FORBIDDEN: Chỉ Chưởng môn mới có quyền giải tán Tông môn.');
      }

      // Xóa tất cả các đơn gia nhập của Tông Môn
      await tx.xianxiaGuildApplication.deleteMany({ where: { guild_id: guildId } });

      // Xóa tất cả thành viên của Tông Môn
      await tx.xianxiaGuildMember.deleteMany({ where: { guild_id: guildId } });

      // Xóa Tông Môn
      await tx.xianxiaGuild.delete({ where: { id: guildId } });

      return true;
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    if (success) {
      xianxiaChatService.deleteGuildBuffer(guildId);
      notifyGuildDisbanded(guildId);
    }
    return success;
  }
}

export const xianxiaGuildService = new XianxiaGuildService();
