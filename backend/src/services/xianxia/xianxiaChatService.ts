import { prisma } from '../../utils/prisma.js';

export interface ChatMessage {
  id: number;
  channel: 'WORLD' | 'ZONE' | 'GUILD';
  zoneId: string | null;
  guildId?: number | null;
  senderUserId: number;
  senderCharacterId: number;
  senderName: string;
  senderRealm: string;
  content: string;
  createdAt: string; // ISO string
}

export interface CharacterChatProfile {
  characterId: number;
  userId: number;
  name: string;
  realm: string;
  currentZone: string;
  guildId?: number | null;
  guildName?: string | null;
}

export class XianxiaChatService {
  public static readonly MAX_CONTENT_LENGTH = 200;
  public static readonly MIN_CONTENT_LENGTH = 1;
  public static readonly RATE_LIMIT_COOLDOWN_MS = 2000; // 2 giây
  public static readonly DUPLICATE_CHECK_WINDOW_MS = 30000; // 30 giây
  public static readonly RING_BUFFER_CAPACITY = 50; // Lưu tối đa 50 tin trong RAM mỗi room
  public static readonly DEFAULT_HISTORY_LIMIT = 30; // Trả về tối đa 30 tin khi kết nối

  // In-Memory Ring Buffers cho tốc độ phát sóng và nạp lịch sử 0ms
  private worldBuffer: ChatMessage[] = [];
  private zoneBuffers: Map<string, ChatMessage[]> = new Map();
  private guildBuffers: Map<number, ChatMessage[]> = new Map();

  // Bộ theo dõi Rate Limit & Chống Spam Lặp theo userId
  private lastMessageTimeByUser: Map<number, number> = new Map();
  private lastMessageContentByUser: Map<number, { content: string; timestamp: number }> = new Map();

  /**
   * Khử trùng nội dung tin nhắn, loại bỏ ký tự điều khiển ẩn và chuẩn hóa khoảng trắng
   */
  public sanitizeContent(raw: string): string {
    if (!raw || typeof raw !== 'string') return '';
    // Loại bỏ ký tự điều khiển (ASCII control chars 0x00-0x1F, 0x7F) và zero-width spaces
    const noControlChars = raw.replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]/g, '');
    // Chuẩn hóa nhiều khoảng trắng liên tiếp thành 1 khoảng trắng
    return noControlChars.replace(/\s+/g, ' ').trim();
  }

  /**
   * Lấy hồ sơ nhân vật phục vụ chat từ cơ sở dữ liệu
   */
  public async getCharacterChatProfile(userId: number): Promise<CharacterChatProfile | null> {
    const character = await prisma.xianxiaCharacter.findUnique({
      where: { user_id: userId },
      select: {
        id: true,
        user_id: true,
        name: true,
        realm: true,
        current_zone: true,
        guild_membership: {
          select: {
            guild_id: true,
            guild: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!character) return null;

    return {
      characterId: character.id,
      userId: character.user_id,
      name: character.name,
      realm: character.realm,
      currentZone: character.current_zone || 'zone_thanh_ha_thon',
      guildId: character.guild_membership?.guild_id ?? null,
      guildName: character.guild_membership?.guild?.name ?? null,
    };
  }

  /**
   * Kiểm tra tính hợp lệ và gửi tin nhắn (Lưu DB + Cập nhật In-memory Ring Buffer)
   */
  public async sendMessage(
    userId: number,
    channel: 'WORLD' | 'ZONE' | 'GUILD',
    rawContent: string,
    forcedCurrentTime?: Date
  ): Promise<ChatMessage> {
    const nowMs = forcedCurrentTime ? forcedCurrentTime.getTime() : Date.now();
    const currentTime = forcedCurrentTime || new Date(nowMs);

    // 1. Kiểm tra kênh hợp lệ
    if (channel !== 'WORLD' && channel !== 'ZONE' && channel !== 'GUILD') {
      throw new Error('CHAT_INVALID_CHANNEL: Kênh truyền âm không hợp lệ. Chỉ chấp nhận WORLD, ZONE hoặc GUILD.');
    }

    // 2. Làm sạch nội dung tin nhắn
    const cleanContent = this.sanitizeContent(rawContent);

    if (cleanContent.length < XianxiaChatService.MIN_CONTENT_LENGTH) {
      throw new Error('CHAT_EMPTY_MESSAGE: Nội dung truyền âm không được để trống.');
    }

    if (cleanContent.length > XianxiaChatService.MAX_CONTENT_LENGTH) {
      throw new Error(`CHAT_TOO_LONG: Nội dung truyền âm vượt quá giới hạn (tối đa ${XianxiaChatService.MAX_CONTENT_LENGTH} ký tự).`);
    }

    // 3. Kiểm tra thông tin nhân vật từ Database (Không tin client)
    const profile = await this.getCharacterChatProfile(userId);
    if (!profile) {
      throw new Error('CHAT_CHARACTER_NOT_FOUND: Đạo hữu chưa tạo nhân vật tu tiên để truyền âm.');
    }

    // Nếu là kênh GUILD: Nhân vật bắt buộc phải thuộc một Tông môn
    if (channel === 'GUILD' && !profile.guildId) {
      throw new Error('CHAT_NO_GUILD: Đạo hữu chưa gia nhập Tông môn nào, không thể truyền âm Tông môn.');
    }

    // 4. Kiểm tra Rate Limit theo người dùng (Tối đa 1 tin / 2s)
    const lastSentTime = this.lastMessageTimeByUser.get(userId) || 0;
    if (nowMs - lastSentTime < XianxiaChatService.RATE_LIMIT_COOLDOWN_MS) {
      const waitRemainingSec = Math.ceil((XianxiaChatService.RATE_LIMIT_COOLDOWN_MS - (nowMs - lastSentTime)) / 1000);
      throw new Error(`CHAT_RATE_LIMITED: Thần thức rung chuyển, xin đợi ${waitRemainingSec}s để ổn định tâm cảnh trước khi truyền âm tiếp.`);
    }

    // 5. Kiểm tra Chống Lặp Tin (Cùng nội dung trong vòng 30s)
    const lastContentInfo = this.lastMessageContentByUser.get(userId);
    if (
      lastContentInfo &&
      nowMs - lastContentInfo.timestamp < XianxiaChatService.DUPLICATE_CHECK_WINDOW_MS &&
      lastContentInfo.content.toLowerCase() === cleanContent.toLowerCase()
    ) {
      throw new Error('CHAT_DUPLICATE_MESSAGE: Nội dung truyền âm bị trùng lặp với tin nhắn vừa gửi gần đây.');
    }

    // Cập nhật ngay lập tức các bộ theo dõi một cách ĐỒNG BỘ trước khi thực hiện I/O bất đồng bộ
    // nhằm triệt tiêu hoàn toàn nguy cơ Race Condition khi có nhiều request đồng thời
    this.lastMessageTimeByUser.set(userId, nowMs);
    this.lastMessageContentByUser.set(userId, { content: cleanContent, timestamp: nowMs });

    // Dọn dẹp các mục theo dõi quá hạn nếu Map vượt quá ngưỡng 500 phần tử (Chống rò rỉ bộ nhớ)
    if (this.lastMessageTimeByUser.size > 500) {
      this.cleanupStaleRateLimitTrackers(nowMs);
    }

    // 6. Xác định zoneId và guildId từ DB của nhân vật
    const targetZoneId = channel === 'ZONE' ? profile.currentZone : null;
    const targetGuildId = channel === 'GUILD' ? (profile.guildId ?? null) : null;

    // 7. Lưu bản ghi bền vững vào PostgreSQL Supabase
    const dbRecord = await prisma.xianxiaChatMessage.create({
      data: {
        channel,
        zone_id: targetZoneId,
        guild_id: targetGuildId,
        sender_user_id: profile.userId,
        sender_character_id: profile.characterId,
        sender_name: profile.name,
        sender_realm: profile.realm,
        content: cleanContent,
        created_at: currentTime,
      },
    });

    const message: ChatMessage = {
      id: dbRecord.id,
      channel: dbRecord.channel as 'WORLD' | 'ZONE' | 'GUILD',
      zoneId: dbRecord.zone_id,
      guildId: dbRecord.guild_id,
      senderUserId: dbRecord.sender_user_id,
      senderCharacterId: dbRecord.sender_character_id,
      senderName: dbRecord.sender_name,
      senderRealm: dbRecord.sender_realm,
      content: dbRecord.content,
      createdAt: dbRecord.created_at.toISOString(),
    };

    // 8. Cập nhật In-Memory Ring Buffer
    this.pushToBuffer(message);

    return message;
  }

  /**
   * Dọn dẹp các mục theo dõi Rate Limit và Duplicate đã hết hạn để tránh rò rỉ bộ nhớ
   */
  public cleanupStaleRateLimitTrackers(nowMs: number = Date.now()): void {
    const expireThreshold = nowMs - XianxiaChatService.DUPLICATE_CHECK_WINDOW_MS * 2;
    for (const [uid, timestamp] of this.lastMessageTimeByUser.entries()) {
      if (timestamp < expireThreshold) {
        this.lastMessageTimeByUser.delete(uid);
      }
    }
    for (const [uid, info] of this.lastMessageContentByUser.entries()) {
      if (info.timestamp < expireThreshold) {
        this.lastMessageContentByUser.delete(uid);
      }
    }
  }

  /**
   * Đẩy tin nhắn vào ring buffer bộ nhớ đệm
   */
  private pushToBuffer(msg: ChatMessage): void {
    if (msg.channel === 'WORLD') {
      this.worldBuffer.push(msg);
      if (this.worldBuffer.length > XianxiaChatService.RING_BUFFER_CAPACITY) {
        this.worldBuffer.shift();
      }
    } else if (msg.channel === 'ZONE' && msg.zoneId) {
      if (!this.zoneBuffers.has(msg.zoneId)) {
        this.zoneBuffers.set(msg.zoneId, []);
      }
      const buffer = this.zoneBuffers.get(msg.zoneId)!;
      buffer.push(msg);
      if (buffer.length > XianxiaChatService.RING_BUFFER_CAPACITY) {
        buffer.shift();
      }
    } else if (msg.channel === 'GUILD' && msg.guildId) {
      if (!this.guildBuffers.has(msg.guildId)) {
        this.guildBuffers.set(msg.guildId, []);
      }
      const buffer = this.guildBuffers.get(msg.guildId)!;
      buffer.push(msg);
      if (buffer.length > XianxiaChatService.RING_BUFFER_CAPACITY) {
        buffer.shift();
      }
    }
  }

  /**
   * Lấy danh sách tin nhắn gần nhất theo kênh, khu vực hoặc tông môn
   */
  public async getRecentMessages(
    channel: 'WORLD' | 'ZONE' | 'GUILD',
    zoneId?: string,
    limit: number = XianxiaChatService.DEFAULT_HISTORY_LIMIT,
    guildId?: number
  ): Promise<ChatMessage[]> {
    const cappedLimit = Math.max(1, Math.min(limit, 50));

    // Thử lấy từ In-Memory Buffer trước nếu có dữ liệu
    if (channel === 'WORLD') {
      if (this.worldBuffer.length > 0) {
        return this.worldBuffer.slice(-cappedLimit);
      }
    } else if (channel === 'ZONE' && zoneId) {
      const buffer = this.zoneBuffers.get(zoneId);
      if (buffer && buffer.length > 0) {
        return buffer.slice(-cappedLimit);
      }
    } else if (channel === 'GUILD' && guildId) {
      const buffer = this.guildBuffers.get(guildId);
      if (buffer && buffer.length > 0) {
        return buffer.slice(-cappedLimit);
      }
    }

    // Nếu Buffer rỗng (ví dụ server mới restart), truy vấn trực tiếp từ PostgreSQL
    const dbRecords = await prisma.xianxiaChatMessage.findMany({
      where: {
        channel,
        ...(channel === 'ZONE' ? { zone_id: zoneId || 'zone_thanh_ha_thon' } : {}),
        ...(channel === 'GUILD' ? { guild_id: guildId } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: cappedLimit,
    });

    const messages: ChatMessage[] = dbRecords.reverse().map((r) => ({
      id: r.id,
      channel: r.channel as 'WORLD' | 'ZONE' | 'GUILD',
      zoneId: r.zone_id,
      guildId: r.guild_id,
      senderUserId: r.sender_user_id,
      senderCharacterId: r.sender_character_id,
      senderName: r.sender_name,
      senderRealm: r.sender_realm,
      content: r.content,
      createdAt: r.created_at.toISOString(),
    }));

    // Nạp lại vào Buffer để các lần sau truy xuất 0ms
    for (const msg of messages) {
      this.pushToBuffer(msg);
    }

    return messages;
  }

  /**
   * Dọn dẹp tin nhắn cũ hơn retentionDays ngày để bảo vệ cơ sở dữ liệu
   */
  public async purgeOldMessages(retentionDays: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const deleteRes = await prisma.xianxiaChatMessage.deleteMany({
      where: {
        created_at: { lt: cutoffDate },
      },
    });
    return deleteRes.count;
  }

  /**
   * Xóa bộ đệm tin nhắn của Tông Môn khi Tông Môn bị giải tán
   */
  public deleteGuildBuffer(guildId: number): void {
    this.guildBuffers.delete(guildId);
  }

  /**
   * Xóa sạch cache bộ nhớ đệm (Dùng trong Unit Testing)
   */
  public clearInMemoryState(): void {
    this.worldBuffer = [];
    this.zoneBuffers.clear();
    this.guildBuffers.clear();
    this.lastMessageTimeByUser.clear();
    this.lastMessageContentByUser.clear();
  }
}

export const xianxiaChatService = new XianxiaChatService();
