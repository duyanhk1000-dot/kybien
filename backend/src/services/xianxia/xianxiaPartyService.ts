import { prisma } from '../../utils/prisma.js';
import { xianxiaLeaderboardService } from './xianxiaLeaderboardService.js';
import { ensurePartyIndexes } from '../../scripts/ensurePartyIndexes.js';

export interface PartyMemberInfo {
  id: number;
  characterId: number;
  userId: number;
  name: string;
  realm: string;
  level: number;
  role: 'LEADER' | 'MEMBER';
  isReady: boolean;
  combatPower: number;
  joinedAt: string;
}

export interface PartyInviteInfo {
  id: number;
  partyId: number;
  partyName: string;
  inviterId: number;
  inviterName: string;
  inviteeId: number;
  inviteeName?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  currentMembersCount?: number;
}

export interface PartyDetail {
  id: number;
  name: string;
  status: 'FORMING' | 'IN_DUNGEON' | 'DISBANDED';
  leaderId: number;
  leaderName: string;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
  members: PartyMemberInfo[];
}

export interface PartyEventHooks {
  onMemberJoined?: (partyId: number, member: any) => void;
  onMemberLeft?: (partyId: number, characterId: number) => void;
  onMemberKicked?: (partyId: number, characterId: number) => void;
  onPartyDisbanded?: (partyId: number) => void;
  onReadyState?: (partyId: number, characterId: number, isReady: boolean) => void;
}

export class XianxiaPartyService {
  public static readonly MAX_PARTY_MEMBERS = 4;
  public static readonly INVITE_EXPIRATION_MS = 2 * 60 * 1000; // 2 phút

  private static indexesInitialized = false;
  private eventHooks?: PartyEventHooks;

  public setEventHooks(hooks: PartyEventHooks): void {
    this.eventHooks = hooks;
  }

  constructor() {
    if (!XianxiaPartyService.indexesInitialized) {
      ensurePartyIndexes().catch((err) => {
        console.warn('[PartyService] Lưu ý khởi tạo index tổ đội:', err?.message || err);
      });
      XianxiaPartyService.indexesInitialized = true;
    }
  }

  /**
   * Làm sạch và chuẩn hóa tên tổ đội
   */
  public sanitizePartyName(rawName?: string, defaultName = 'Tổ Đội Tu Tiên'): string {
    if (!rawName || typeof rawName !== 'string') return defaultName;
    const clean = rawName.replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/g, '').trim();
    const normalized = clean.replace(/\s+/g, ' ');
    if (normalized.length < 2) return defaultName;
    return normalized.slice(0, 30);
  }

  /**
   * Lấy thông tin nhân vật tu tiên từ User ID kèm kiểm tra tồn tại
   */
  public async getCharacterByUserId(userId: number, tx?: any): Promise<any> {
    const client = tx || prisma;
    const character = await client.xianxiaCharacter.findUnique({
      where: { user_id: userId },
    });
    if (!character) {
      throw new Error('PARTY_CHARACTER_NOT_FOUND: Đạo hữu chưa tạo nhân vật tu tiên.');
    }
    return character;
  }

  /**
   * 1. Tạo tổ đội mới (Authoritative Transaction + Row-Level Locking)
   */
  public async createParty(userId: number, rawName?: string): Promise<PartyDetail> {
    return await prisma.$transaction(async (tx) => {
      // 1. Lấy và khóa hàng nhân vật người tạo
      const character = await this.getCharacterByUserId(userId, tx);
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', character.id);

      // 2. Kiểm tra xem nhân vật đã thuộc tổ đội nào chưa
      const existingMembership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: character.id },
      });
      if (existingMembership) {
        throw new Error('PARTY_ALREADY_IN_PARTY: Đạo hữu hiện đã ở trong một tổ đội khác, không thể tạo tổ đội mới.');
      }

      // 3. Chuẩn hóa tên tổ đội
      const partyName = this.sanitizePartyName(rawName, `Tổ Đội của ${character.name}`);

      // 4. Tạo bản ghi XianxiaParty
      const party = await tx.xianxiaParty.create({
        data: {
          name: partyName,
          leader_id: character.id,
          status: 'FORMING',
          max_members: XianxiaPartyService.MAX_PARTY_MEMBERS,
        },
      });

      // 5. Thêm người tạo làm Đội Trưởng trong XianxiaPartyMember
      await tx.xianxiaPartyMember.create({
        data: {
          party_id: party.id,
          character_id: character.id,
          role: 'LEADER',
          is_ready: false,
        },
      });

      // 6. Trả về chi tiết tổ đội
      return await this.getPartyDetailById(party.id, tx);
    }, { maxWait: 15000, timeout: 20000 });
  }

  /**
   * 2. Lấy thông tin chi tiết tổ đội hiện tại của người dùng
   */
  public async getMyParty(userId: number): Promise<PartyDetail | null> {
    const character = await this.getCharacterByUserId(userId);
    const membership = await prisma.xianxiaPartyMember.findUnique({
      where: { character_id: character.id },
    });

    if (!membership) {
      return null;
    }

    return await this.getPartyDetailById(membership.party_id);
  }

  /**
   * Lấy chi tiết tổ đội theo ID
   */
  public async getPartyDetailById(partyId: number, tx?: any): Promise<PartyDetail> {
    const client = tx || prisma;
    const party = await client.xianxiaParty.findUnique({
      where: { id: partyId },
      include: {
        leader: true,
        members: {
          include: {
            character: true,
          },
          orderBy: { joined_at: 'asc' },
        },
      },
    });

    if (!party) {
      throw new Error('PARTY_NOT_FOUND: Không tìm thấy thông tin tổ đội.');
    }

    const members: PartyMemberInfo[] = party.members.map((m: any) => {
      const combatPower = xianxiaLeaderboardService.calcCombatPower(m.character);
      return {
        id: m.id,
        characterId: m.character_id,
        userId: m.character.user_id,
        name: m.character.name,
        realm: m.character.realm,
        level: m.character.level,
        role: m.role as 'LEADER' | 'MEMBER',
        isReady: m.is_ready,
        combatPower,
        joinedAt: m.joined_at.toISOString(),
      };
    });

    return {
      id: party.id,
      name: party.name,
      status: party.status as any,
      leaderId: party.leader_id,
      leaderName: party.leader?.name || 'Ẩn Danh',
      memberCount: members.length,
      maxMembers: party.max_members,
      createdAt: party.created_at.toISOString(),
      updatedAt: party.updated_at.toISOString(),
      members,
    };
  }

  /**
   * 3. Mời nhân vật khác vào tổ đội
   */
  public async inviteMember(userId: number, inviteeCharacterId: number): Promise<PartyInviteInfo> {
    const parsedInviteeId = parseInt(String(inviteeCharacterId), 10);
    if (isNaN(parsedInviteeId) || parsedInviteeId <= 0) {
      throw new Error('PARTY_INVALID_INVITEE_ID: Mã nhân vật được mời không hợp lệ.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Lấy thông tin người mời
      const callerChar = await this.getCharacterByUserId(userId, tx);

      if (callerChar.id === parsedInviteeId) {
        throw new Error('PARTY_CANNOT_INVITE_SELF: Đạo hữu không thể tự gửi lời mời cho chính mình.');
      }

      // 2. Lấy tổ đội của người mời và kiểm tra quyền Đội Trưởng
      const callerMembership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: callerChar.id },
        include: { party: true },
      });

      if (!callerMembership) {
        throw new Error('PARTY_NOT_IN_PARTY: Đạo hữu chưa có tổ đội, không thể gửi lời mời.');
      }

      if (callerMembership.role !== 'LEADER') {
        throw new Error('PARTY_FORBIDDEN: Chỉ Đội Trưởng mới có quyền mời thành viên mới vào tổ đội.');
      }

      const partyId = callerMembership.party_id;

      // 3. Khóa hàng tổ đội để kiểm tra số lượng thành viên hiện tại
      await tx.$queryRawUnsafe('SELECT id, max_members, status FROM xianxia_parties WHERE id = $1 FOR UPDATE', partyId);

      const party = await tx.xianxiaParty.findUnique({
        where: { id: partyId },
        include: { members: true },
      });

      if (!party || party.status === 'DISBANDED') {
        throw new Error('PARTY_DISBANDED: Tổ đội không tồn tại hoặc đã bị giải tán.');
      }

      if (party.status === 'IN_DUNGEON') {
        throw new Error('PARTY_IN_DUNGEON: Tổ đội hiện đang trong phó bản chiến đấu, không thể mời thêm người.');
      }

      if (party.members.length >= party.max_members) {
        throw new Error(`PARTY_FULL: Tổ đội đã đạt tối đa ${party.max_members} thành viên.`);
      }

      // 4. Kiểm tra nhân vật được mời có tồn tại không
      const inviteeChar = await tx.xianxiaCharacter.findUnique({
        where: { id: parsedInviteeId },
      });
      if (!inviteeChar) {
        throw new Error('PARTY_INVITEE_NOT_FOUND: Không tìm thấy nhân vật của đạo hữu được mời.');
      }

      // 5. Kiểm tra người được mời đã có tổ đội chưa
      const inviteeMembership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: parsedInviteeId },
      });
      if (inviteeMembership) {
        throw new Error('PARTY_INVITEE_ALREADY_IN_PARTY: Đạo hữu này hiện đã gia nhập một tổ đội khác.');
      }

      // 6. Kiểm tra xem đã có lời mời PENDING nào trước đó chưa
      const now = new Date();
      const existingInvite = await tx.xianxiaPartyInvite.findFirst({
        where: {
          party_id: partyId,
          invitee_id: parsedInviteeId,
          status: 'PENDING',
        },
      });

      if (existingInvite) {
        if (existingInvite.expires_at > now) {
          throw new Error('PARTY_INVITE_ALREADY_PENDING: Lời mời gia nhập đã được gửi và đang chờ đạo hữu phản hồi.');
        } else {
          // Lời mời cũ đã quá hạn -> Cập nhật thành EXPIRED để tạo lời mời mới
          await tx.xianxiaPartyInvite.update({
            where: { id: existingInvite.id },
            data: { status: 'EXPIRED' },
          });
        }
      }

      // 7. Tạo bản ghi lời mời mới với thời hạn 2 phút
      const expiresAt = new Date(now.getTime() + XianxiaPartyService.INVITE_EXPIRATION_MS);
      const newInvite = await tx.xianxiaPartyInvite.create({
        data: {
          party_id: partyId,
          inviter_id: callerChar.id,
          invitee_id: parsedInviteeId,
          status: 'PENDING',
          expires_at: expiresAt,
        },
      });

      return {
        id: newInvite.id,
        partyId: party.id,
        partyName: party.name,
        inviterId: callerChar.id,
        inviterName: callerChar.name,
        inviteeId: parsedInviteeId,
        inviteeName: inviteeChar.name,
        status: newInvite.status,
        expiresAt: newInvite.expires_at.toISOString(),
        createdAt: newInvite.created_at.toISOString(),
        currentMembersCount: party.members.length,
      };
    });
  }

  /**
   * 4. Lấy danh sách các lời mời đang chờ phản hồi của nhân vật hiện tại
   */
  public async getMyPendingInvites(userId: number): Promise<PartyInviteInfo[]> {
    const character = await this.getCharacterByUserId(userId);
    const now = new Date();

    // 1. Tự động đánh dấu EXPIRED cho các lời mời đã hết hạn
    await prisma.xianxiaPartyInvite.updateMany({
      where: {
        invitee_id: character.id,
        status: 'PENDING',
        expires_at: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });

    // 2. Lấy các lời mời PENDING còn hiệu lực
    const invites = await prisma.xianxiaPartyInvite.findMany({
      where: {
        invitee_id: character.id,
        status: 'PENDING',
        expires_at: { gt: now },
      },
      include: {
        party: {
          include: {
            leader: true,
            members: true,
          },
        },
        inviter: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return invites
      .filter((inv) => inv.party && inv.party.status !== 'DISBANDED')
      .map((inv) => ({
        id: inv.id,
        partyId: inv.party_id,
        partyName: inv.party.name,
        inviterId: inv.inviter_id,
        inviterName: inv.inviter?.name || inv.party.leader?.name || 'Đội Trưởng',
        inviteeId: inv.invitee_id,
        inviteeName: character.name,
        status: inv.status,
        expiresAt: inv.expires_at.toISOString(),
        createdAt: inv.created_at.toISOString(),
        currentMembersCount: inv.party.members?.length || 1,
      }));
  }

  /**
   * 5. Phản hồi lời mời tổ đội (ACCEPT hoặc REJECT)
   * Kiểm soát chặt chẽ Concurrency, Row-Level Locking và Invariant <= 4 thành viên
   */
  public async respondToInvite(
    userId: number,
    inviteId: number,
    action: 'ACCEPT' | 'REJECT'
  ): Promise<{ success: boolean; action: string; party?: PartyDetail }> {
    const parsedInviteId = parseInt(String(inviteId), 10);
    if (isNaN(parsedInviteId) || parsedInviteId <= 0) {
      throw new Error('PARTY_INVALID_INVITE_ID: Mã lời mời không hợp lệ.');
    }

    if (action !== 'ACCEPT' && action !== 'REJECT') {
      throw new Error('PARTY_INVALID_ACTION: Hành động không hợp lệ (chỉ chấp nhận ACCEPT hoặc REJECT).');
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Khóa và lấy thông tin nhân vật của người nhận
        const callerChar = await this.getCharacterByUserId(userId, tx);
        await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE id = $1 FOR UPDATE', callerChar.id);

        // 2. Khóa hàng lời mời trong CSDL để chống xử lý đồng thời
        await tx.$queryRawUnsafe('SELECT id, status FROM xianxia_party_invites WHERE id = $1 FOR UPDATE', parsedInviteId);

        const invite = await tx.xianxiaPartyInvite.findUnique({
          where: { id: parsedInviteId },
          include: { party: true },
        });

        if (!invite) {
          throw new Error('PARTY_INVITE_NOT_FOUND: Không tìm thấy thông tin lời mời tổ đội.');
        }

        // Xác thực quyền sở hữu lời mời
        if (invite.invitee_id !== callerChar.id) {
          throw new Error('PARTY_FORBIDDEN: Đạo hữu không có quyền xử lý lời mời của người khác.');
        }

        // Kiểm tra trạng thái lời mời
        if (invite.status !== 'PENDING') {
          throw new Error('PARTY_INVITE_ALREADY_PROCESSED: Lời mời này đã được xử lý trước đó.');
        }

        const now = new Date();
        if (invite.expires_at <= now) {
          throw new Error('PARTY_INVITE_EXPIRED: Lời mời tổ đội đã hết hạn (quá 2 phút).');
        }

        // 3. Xử lý từ chối (REJECT)
        if (action === 'REJECT') {
          await tx.xianxiaPartyInvite.update({
            where: { id: invite.id },
            data: { status: 'REJECTED' },
          });
          return { success: true, action: 'REJECT' };
        }

        // 4. Xử lý chấp nhận (ACCEPT)
        // 4.1. Kiểm tra người chấp nhận đã thuộc tổ đội nào chưa
        const existingMembership = await tx.xianxiaPartyMember.findUnique({
          where: { character_id: callerChar.id },
        });
        if (existingMembership) {
          // Hủy lời mời này vì người chơi đã có đội
          await tx.xianxiaPartyInvite.update({
            where: { id: invite.id },
            data: { status: 'CANCELLED' },
          });
          throw new Error('PARTY_ALREADY_IN_PARTY: Đạo hữu hiện đã gia nhập một tổ đội khác.');
        }

        // 4.2. Khóa hàng tổ đội để kiểm tra sỉ số và trạng thái phó bản
        await tx.$queryRawUnsafe('SELECT id, max_members, status FROM xianxia_parties WHERE id = $1 FOR UPDATE', invite.party_id);

        const party = await tx.xianxiaParty.findUnique({
          where: { id: invite.party_id },
          include: { members: true },
        });

        if (!party || party.status === 'DISBANDED') {
          await tx.xianxiaPartyInvite.update({
            where: { id: invite.id },
            data: { status: 'CANCELLED' },
          });
          throw new Error('PARTY_DISBANDED: Tổ đội này đã bị giải tán.');
        }

        if (party.status === 'IN_DUNGEON') {
          throw new Error('PARTY_IN_DUNGEON: Tổ đội hiện đang trong phó bản, không thể gia nhập lúc này.');
        }

        if (party.members.length >= party.max_members) {
          throw new Error(`PARTY_FULL: Tổ đội đã đạt tối đa ${party.max_members} thành viên.`);
        }

        // 4.3. Tạo bản ghi thành viên mới
        await tx.xianxiaPartyMember.create({
          data: {
            party_id: party.id,
            character_id: callerChar.id,
            role: 'MEMBER',
            is_ready: false,
          },
        });

        // 4.4. Cập nhật trạng thái lời mời sang ACCEPTED
        await tx.xianxiaPartyInvite.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED' },
        });

        // 4.5. Tự động hủy các lời mời PENDING khác của nhân vật này để tránh xung đột
        await tx.xianxiaPartyInvite.updateMany({
          where: {
            invitee_id: callerChar.id,
            status: 'PENDING',
          },
          data: { status: 'CANCELLED' },
        });

        // 4.6. Trả về chi tiết tổ đội sau khi gia nhập
        const updatedParty = await this.getPartyDetailById(party.id, tx);
        return { success: true, action: 'ACCEPT', party: updatedParty };
      }, { maxWait: 15000, timeout: 20000 });

      if (result.success && result.action === 'ACCEPT' && result.party && this.eventHooks?.onMemberJoined) {
        try {
          this.eventHooks.onMemberJoined(result.party.id, result.party);
        } catch (e) {}
      }

      return result;
    } catch (err: any) {
      if (err?.message?.includes('PARTY_INVITE_EXPIRED')) {
        await prisma.xianxiaPartyInvite.update({
          where: { id: parsedInviteId },
          data: { status: 'EXPIRED' },
        }).catch(() => {});
      }
      throw err;
    }
  }

  /**
   * 6. Chuyển đổi trạng thái sẵn sàng tham chiến (Ready State)
   */
  public async setReadyState(userId: number, explicitReady?: boolean): Promise<{ isReady: boolean }> {
    const res = await prisma.$transaction(async (tx) => {
      const character = await this.getCharacterByUserId(userId, tx);
      const membership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: character.id },
      });

      if (!membership) {
        throw new Error('PARTY_NOT_IN_PARTY: Đạo hữu chưa gia nhập tổ đội nào.');
      }

      const nextReady = explicitReady !== undefined ? !!explicitReady : !membership.is_ready;

      await tx.xianxiaPartyMember.update({
        where: { id: membership.id },
        data: { is_ready: nextReady },
      });

      return { isReady: nextReady, partyId: membership.party_id, characterId: character.id };
    });

    if (this.eventHooks?.onReadyState) {
      try {
        this.eventHooks.onReadyState(res.partyId, res.characterId, res.isReady);
      } catch (e) {}
    }

    return { isReady: res.isReady };
  }

  /**
   * 7. Đội trưởng trục xuất thành viên (Kick Member)
   */
  public async kickMember(userId: number, targetCharacterId: number): Promise<PartyDetail> {
    const parsedTargetId = parseInt(String(targetCharacterId), 10);
    if (isNaN(parsedTargetId) || parsedTargetId <= 0) {
      throw new Error('PARTY_INVALID_TARGET_ID: Mã nhân vật bị trục xuất không hợp lệ.');
    }

    const partyDetail = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra người gọi
      const callerChar = await this.getCharacterByUserId(userId, tx);
      const callerMembership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: callerChar.id },
      });

      if (!callerMembership) {
        throw new Error('PARTY_NOT_IN_PARTY: Đạo hữu chưa gia nhập tổ đội nào.');
      }

      if (callerMembership.role !== 'LEADER') {
        throw new Error('PARTY_FORBIDDEN: Chỉ Đội Trưởng mới có quyền trục xuất thành viên.');
      }

      if (callerChar.id === parsedTargetId) {
        throw new Error('PARTY_CANNOT_KICK_LEADER: Đội trưởng không thể tự trục xuất chính mình.');
      }

      // 2. Khóa hàng tổ đội
      await tx.$queryRawUnsafe('SELECT id, status FROM xianxia_parties WHERE id = $1 FOR UPDATE', callerMembership.party_id);

      const party = await tx.xianxiaParty.findUnique({
        where: { id: callerMembership.party_id },
      });

      if (!party || party.status === 'DISBANDED') {
        throw new Error('PARTY_DISBANDED: Tổ đội không tồn tại hoặc đã bị giải tán.');
      }

      if (party.status === 'IN_DUNGEON') {
        throw new Error('PARTY_IN_DUNGEON: Tổ đội hiện đang trong phó bản chiến đấu, không thể trục xuất thành viên.');
      }

      // 3. Kiểm tra mục tiêu có trong cùng tổ đội không
      const targetMembership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: parsedTargetId },
      });

      if (!targetMembership || targetMembership.party_id !== callerMembership.party_id) {
        throw new Error('PARTY_MEMBER_NOT_IN_PARTY: Nhân vật này không thuộc tổ đội của đạo hữu.');
      }

      // 4. Xóa bản ghi thành viên của mục tiêu
      await tx.xianxiaPartyMember.delete({
        where: { id: targetMembership.id },
      });

      return await this.getPartyDetailById(callerMembership.party_id, tx);
    });

    if (this.eventHooks?.onMemberKicked) {
      try {
        this.eventHooks.onMemberKicked(partyDetail.id, parsedTargetId);
      } catch (e) {}
    }

    return partyDetail;
  }

  /**
   * 8. Rời tổ đội (Leave Party)
   * Quy tắc xác định rõ ràng:
   * - Nếu là Member: Xóa thành viên.
   * - Nếu là Leader và còn thành viên: Chuyển quyền Đội Trưởng cho thành viên gia nhập sớm nhất (`joined_at ASC`).
   * - Nếu là Leader và không còn ai khác: Giải tán tổ đội (`DISBANDED`) và hủy các lời mời liên quan.
   */
  public async leaveParty(userId: number): Promise<{ left: boolean; disbanded: boolean; newLeaderId?: number }> {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lấy thông tin người gọi
      const callerChar = await this.getCharacterByUserId(userId, tx);
      const callerMembership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: callerChar.id },
      });

      if (!callerMembership) {
        throw new Error('PARTY_NOT_IN_PARTY: Đạo hữu hiện không thuộc tổ đội nào.');
      }

      const partyId = callerMembership.party_id;

      // 2. Khóa hàng tổ đội
      await tx.$queryRawUnsafe('SELECT id, leader_id, status FROM xianxia_parties WHERE id = $1 FOR UPDATE', partyId);

      const party = await tx.xianxiaParty.findUnique({
        where: { id: partyId },
      });

      if (!party || party.status === 'DISBANDED') {
        throw new Error('PARTY_DISBANDED: Tổ đội không tồn tại hoặc đã bị giải tán.');
      }

      if (party.status === 'IN_DUNGEON') {
        throw new Error('PARTY_IN_DUNGEON: Tổ đội hiện đang trong phó bản chiến đấu, không thể rời đội.');
      }

      // 3. Lấy toàn bộ thành viên của tổ đội sắp xếp theo thời điểm gia nhập
      const allMembers = await tx.xianxiaPartyMember.findMany({
        where: { party_id: partyId },
        orderBy: { joined_at: 'asc' },
      });

      // 4. Trường hợp là thành viên thường (MEMBER)
      if (callerMembership.role !== 'LEADER') {
        await tx.xianxiaPartyMember.delete({
          where: { id: callerMembership.id },
        });
        return { left: true, disbanded: false, partyId, characterId: callerChar.id };
      }

      // 5. Trường hợp là Đội Trưởng (LEADER)
      const remainingMembers = allMembers.filter((m) => m.character_id !== callerChar.id);

      if (remainingMembers.length === 0) {
        // Không còn ai khác -> Giải tán tổ đội
        await tx.xianxiaPartyMember.delete({
          where: { id: callerMembership.id },
        });

        await tx.xianxiaParty.update({
          where: { id: partyId },
          data: { status: 'DISBANDED' },
        });

        // Hủy toàn bộ lời mời đang chờ
        await tx.xianxiaPartyInvite.updateMany({
          where: { party_id: partyId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });

        return { left: true, disbanded: true, partyId, characterId: callerChar.id };
      } else {
        // Còn thành viên -> Chuyển quyền Đội Trưởng cho người gia nhập sớm nhất
        const successor = remainingMembers[0];

        await tx.xianxiaPartyMember.update({
          where: { id: successor.id },
          data: { role: 'LEADER' },
        });

        await tx.xianxiaParty.update({
          where: { id: partyId },
          data: { leader_id: successor.character_id },
        });

        // Xóa bản ghi thành viên của Đội Trưởng cũ
        await tx.xianxiaPartyMember.delete({
          where: { id: callerMembership.id },
        });

        return { left: true, disbanded: false, newLeaderId: successor.character_id, partyId, characterId: callerChar.id };
      }
    });

    if (this.eventHooks) {
      try {
        if (result.disbanded) {
          this.eventHooks.onPartyDisbanded?.(result.partyId);
        } else {
          this.eventHooks.onMemberLeft?.(result.partyId, result.characterId);
        }
      } catch (e) {}
    }

    return { left: result.left, disbanded: result.disbanded, newLeaderId: result.newLeaderId };
  }

  /**
   * 9. Đội trưởng giải tán tổ đội (Disband Party)
   */
  public async disbandParty(userId: number): Promise<{ disbanded: boolean }> {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra người gọi
      const callerChar = await this.getCharacterByUserId(userId, tx);
      const callerMembership = await tx.xianxiaPartyMember.findUnique({
        where: { character_id: callerChar.id },
      });

      if (!callerMembership) {
        throw new Error('PARTY_NOT_IN_PARTY: Đạo hữu chưa gia nhập tổ đội nào.');
      }

      if (callerMembership.role !== 'LEADER') {
        throw new Error('PARTY_FORBIDDEN: Chỉ Đội Trưởng mới có quyền giải tán tổ đội.');
      }

      const partyId = callerMembership.party_id;

      // 2. Khóa hàng tổ đội
      await tx.$queryRawUnsafe('SELECT id, status FROM xianxia_parties WHERE id = $1 FOR UPDATE', partyId);

      const party = await tx.xianxiaParty.findUnique({
        where: { id: partyId },
      });

      if (!party || party.status === 'DISBANDED') {
        throw new Error('PARTY_DISBANDED: Tổ đội không tồn tại hoặc đã bị giải tán.');
      }

      if (party.status === 'IN_DUNGEON') {
        throw new Error('PARTY_IN_DUNGEON: Tổ đội hiện đang trong phó bản chiến đấu, không thể giải tán.');
      }

      // 3. Cập nhật trạng thái tổ đội thành DISBANDED
      await tx.xianxiaParty.update({
        where: { id: partyId },
        data: { status: 'DISBANDED' },
      });

      // 4. Xóa toàn bộ thành viên trong tổ đội
      await tx.xianxiaPartyMember.deleteMany({
        where: { party_id: partyId },
      });

      // 5. Hủy toàn bộ lời mời PENDING còn chờ
      await tx.xianxiaPartyInvite.updateMany({
        where: { party_id: partyId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      return { disbanded: true, partyId };
    });

    if (this.eventHooks?.onPartyDisbanded) {
      try {
        this.eventHooks.onPartyDisbanded(result.partyId);
      } catch (e) {}
    }

    return { disbanded: result.disbanded };
  }
}

export const xianxiaPartyService = new XianxiaPartyService();
