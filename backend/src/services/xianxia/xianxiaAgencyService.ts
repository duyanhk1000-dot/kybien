import fs from 'fs';
import path from 'path';

export type MissionKind = 'ESCORT' | 'COURIER' | 'HUNT' | 'GATHERING' | 'EVENT';
export type AgencyRankKey = 'ASSOCIATE' | 'COPPER' | 'SILVER' | 'GOLD' | 'CHIEF' | 'DIVINE';

export interface AgencyRank {
  key: AgencyRankKey;
  name: string;
  required_merit: number;
  required_missions: number;
  required_kinds: number;
  daily_stipend_silver: number;
  perks: string;
}

export interface SupplyItem {
  id: string;
  item_id: string;
  item_name: string;
  type: string;
  description: string;
  credit_cost: number;
  min_rank: AgencyRankKey;
  quantity_per_exchange: number;
}

export interface AgencyMission {
  id: string;
  template_key: string;
  name: string;
  kind: MissionKind;
  origin_zone_id: string;
  origin_place_id: string;
  destination_zone_id: string;
  destination_place_id?: string;
  destination_name?: string;
  cargo_name?: string;
  escort_risk_percent?: number;
  travel_fatigue_cost?: number;
  min_realm: string;
  min_level: number;
  min_rank: AgencyRankKey;
  summary: string;
  briefing_lines: string[];
  turnin_lines: string[];
  target?: {
    monster_id: string;
    name: string;
    required_count: number;
    current_count: number;
  };
  input?: {
    item_id: string;
    item_name: string;
    quantity: number;
  };
  event_target_id?: string;
  rewards: {
    silver: number;
    exp: number;
    cultivation: number;
    merit: number;
    credits: number;
    items?: Array<{ item_id: string; quantity: number }>;
  };
}

export interface UserAgencyProfile {
  userId: string;
  rankKey: AgencyRankKey;
  merit: number;
  credits: number;
  totalMissionsCompleted: number;
  completedByKind: Record<MissionKind, number>;
  activeMission: {
    missionId: string;
    status: 'ACTIVE' | 'READY_TO_REPORT' | 'READY_TO_DELIVER';
    acceptedAt: string;
    currentCount: number;
    ambushResolved?: boolean;
  } | null;
}

export class XianxiaAgencyService {
  private organizations: any[] = [];
  private missions: AgencyMission[] = [];
  private userProfiles: Map<string, UserAgencyProfile> = new Map();

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      const candidates = [
        path.join(__dirname, '..', '..', 'data', 'xianxia', 'agencyMissions.json'),
        path.join(process.cwd(), 'backend', 'src', 'data', 'xianxia', 'agencyMissions.json'),
        path.join(process.cwd(), 'src', 'data', 'xianxia', 'agencyMissions.json'),
      ];

      let raw = '';
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          raw = fs.readFileSync(p, 'utf8');
          break;
        }
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        this.organizations = parsed.organizations || [];
        this.missions = parsed.missions || [];
        console.log(`[XianxiaAgencyService] Đã nạp ${this.organizations.length} tổ chức tiêu cục và ${this.missions.length} nhiệm vụ thám hiểm giang hồ.`);
      }
    } catch (e: any) {
      console.warn('[XianxiaAgencyService] Lỗi khi nạp agencyMissions.json:', e?.message || e);
    }
  }

  public getOrCreateProfile(userId: string): UserAgencyProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        rankKey: 'ASSOCIATE',
        merit: 0,
        credits: 20, // Tặng khởi điểm 20 Cống Hiến
        totalMissionsCompleted: 0,
        completedByKind: {
          ESCORT: 0,
          COURIER: 0,
          HUNT: 0,
          GATHERING: 0,
          EVENT: 0,
        },
        activeMission: null,
      });
    }
    return this.userProfiles.get(userId)!;
  }

  public getRanks(): AgencyRank[] {
    return this.organizations[0]?.ranks || [];
  }

  public getRank(rankKey: AgencyRankKey): AgencyRank | undefined {
    return this.getRanks().find(r => r.key === rankKey);
  }

  public getNextRank(currentRankKey: AgencyRankKey): AgencyRank | null {
    const ranks = this.getRanks();
    const idx = ranks.findIndex(r => r.key === currentRankKey);
    if (idx !== -1 && idx < ranks.length - 1) {
      return ranks[idx + 1];
    }
    return null;
  }

  public getAgencyView(userId: string, currentZoneId: string, playerRealm: string = 'PHAM_NHAN', playerLevel: number = 1) {
    const profile = this.getOrCreateProfile(userId);
    const org = this.organizations[0] || { name: 'Thiên Cơ Tiêu Cục' };
    const currentRank = this.getRank(profile.rankKey) || {
      key: 'ASSOCIATE',
      name: 'Tập Sự Tiêu Sư',
      required_merit: 0,
      required_missions: 0,
      required_kinds: 0,
      daily_stipend_silver: 10,
      perks: '',
    };

    const nextRank = this.getNextRank(profile.rankKey);
    const distinctKindsCount = Object.values(profile.completedByKind).filter(c => c > 0).length;

    let promotionEligibility = false;
    let missingReasons: string[] = [];
    if (nextRank) {
      if (profile.merit < nextRank.required_merit) {
        missingReasons.push(`Thiếu ${nextRank.required_merit - profile.merit} Điểm Công Trạng`);
      }
      if (profile.totalMissionsCompleted < nextRank.required_missions) {
        missingReasons.push(`Cần hoàn thành thêm ${nextRank.required_missions - profile.totalMissionsCompleted} chuyến tiêu`);
      }
      if (distinctKindsCount < nextRank.required_kinds) {
        missingReasons.push(`Cần hoàn thành ít nhất ${nextRank.required_kinds} loại nhiệm vụ khác nhau`);
      }
      promotionEligibility = missingReasons.length === 0;
    }

    // Active Mission Full Info
    let activeMissionData: any = null;
    if (profile.activeMission) {
      const def = this.missions.find(m => m.id === profile.activeMission?.missionId);
      if (def) {
        activeMissionData = {
          ...def,
          status: profile.activeMission.status,
          acceptedAt: profile.activeMission.acceptedAt,
          currentCount: profile.activeMission.currentCount,
          ambushResolved: profile.activeMission.ambushResolved,
        };
      }
    }

    // Available Offers at current zone
    const rankOrder = ['ASSOCIATE', 'COPPER', 'SILVER', 'GOLD', 'CHIEF', 'DIVINE'];
    const userRankIdx = rankOrder.indexOf(profile.rankKey);

    const offers = this.missions
      .filter(m => m.origin_zone_id === currentZoneId || m.destination_zone_id === currentZoneId)
      .map(m => {
        const requiredRankIdx = rankOrder.indexOf(m.min_rank);
        const isCurrentActive = profile.activeMission?.missionId === m.id;
        const hasOtherActive = !!profile.activeMission && !isCurrentActive;

        let status = 'AVAILABLE';
        let reason = '';

        if (isCurrentActive) {
          status = 'ACCEPTED';
          reason = 'Đang thi hành';
        } else if (hasOtherActive) {
          status = 'ACTIVE_ELSEWHERE';
          reason = 'Đang có chuyến tiêu khác chưa hoàn tất';
        } else if (userRankIdx < requiredRankIdx) {
          status = 'UNAVAILABLE_RANK';
          const reqRankObj = this.getRank(m.min_rank);
          reason = `Yêu cầu cấp bậc ${reqRankObj?.name || m.min_rank}`;
        }

        return {
          ...m,
          status,
          reason,
        };
      });

    // Supply Hall with unlock check
    const supplyHall = (org.supply_hall || []).map((s: SupplyItem) => {
      const reqRankIdx = rankOrder.indexOf(s.min_rank);
      const isUnlocked = userRankIdx >= reqRankIdx;
      const canAfford = profile.credits >= s.credit_cost;
      return {
        ...s,
        isUnlocked,
        canAfford,
      };
    });

    return {
      organization: {
        key: org.key,
        name: org.name,
        subtitle: org.subtitle,
        description: org.description,
      },
      membership: {
        rankKey: profile.rankKey,
        rankName: currentRank.name,
        merit: profile.merit,
        credits: profile.credits,
        totalCompleted: profile.totalMissionsCompleted,
        completedByKind: profile.completedByKind,
        distinctKinds: distinctKindsCount,
      },
      promotion: nextRank
        ? {
            targetRankKey: nextRank.key,
            targetRankName: nextRank.name,
            targetMerit: nextRank.required_merit,
            targetMissions: nextRank.required_missions,
            targetKinds: nextRank.required_kinds,
            isEligible: promotionEligibility,
            missingReasons,
          }
        : null,
      activeMission: activeMissionData,
      offers,
      supplyHall,
    };
  }

  public acceptMission(userId: string, missionId: string, playerStats: any = {}) {
    const profile = this.getOrCreateProfile(userId);
    if (profile.activeMission) {
      throw new Error('Đang có chuyến tiêu thám hiểm chưa hoàn tất! Hãy nộp báo cáo hoặc hủy trước khi nhận mới.');
    }

    const mission = this.missions.find(m => m.id === missionId);
    if (!mission) {
      throw new Error('Không tìm thấy nhiệm vụ thám hiểm chỉ định.');
    }

    const rankOrder = ['ASSOCIATE', 'COPPER', 'SILVER', 'GOLD', 'CHIEF', 'DIVINE'];
    const userRankIdx = rankOrder.indexOf(profile.rankKey);
    const requiredRankIdx = rankOrder.indexOf(mission.min_rank);

    if (userRankIdx < requiredRankIdx) {
      const rankObj = this.getRank(mission.min_rank);
      throw new Error(`Cấp bậc không đủ! Yêu cầu đạt ${rankObj?.name || mission.min_rank}.`);
    }

    profile.activeMission = {
      missionId,
      status: 'ACTIVE',
      acceptedAt: new Date().toISOString(),
      currentCount: 0,
      ambushResolved: false,
    };

    return {
      success: true,
      message: `Đã tiếp nhận chuyến thám hiểm [${mission.name}]!`,
      mission,
      briefing_lines: mission.briefing_lines,
    };
  }

  public advanceMissionOnAction(
    userId: string,
    actionType: 'ROAM' | 'HUNT' | 'GATHER' | 'TRAVEL' | 'EVENT',
    payload: any = {}
  ): { missionUpdated: boolean; eventTriggered?: any; readyToReport?: boolean } {
    const profile = this.getOrCreateProfile(userId);
    if (!profile.activeMission) return { missionUpdated: false };

    const mission = this.missions.find(m => m.id === profile.activeMission?.missionId);
    if (!mission) return { missionUpdated: false };

    let updated = false;

    // 1. SĂN QUÁI (HUNT)
    if (actionType === 'HUNT' && mission.kind === 'HUNT' && mission.target) {
      const monsterId = payload.monsterId;
      if (monsterId === mission.target.monster_id) {
        profile.activeMission.currentCount += (payload.count || 1);
        updated = true;
        if (profile.activeMission.currentCount >= mission.target.required_count) {
          profile.activeMission.status = 'READY_TO_REPORT';
        }
      }
    }

    // 2. THU THẬP TÀI NGUYÊN (GATHER)
    if (actionType === 'GATHER' && mission.kind === 'GATHERING' && mission.input) {
      const itemId = payload.itemId;
      if (itemId === mission.input.item_id) {
        profile.activeMission.currentCount += (payload.quantity || 1);
        updated = true;
        if (profile.activeMission.currentCount >= mission.input.quantity) {
          profile.activeMission.status = 'READY_TO_REPORT';
        }
      }
    }

    // 3. DI CHUYỂN PHÂN KHU (TRAVEL)
    if (actionType === 'TRAVEL' && (mission.kind === 'ESCORT' || mission.kind === 'COURIER')) {
      const currentZoneId = payload.currentZoneId;
      if (currentZoneId === mission.destination_zone_id) {
        profile.activeMission.status = mission.kind === 'ESCORT' ? 'READY_TO_DELIVER' : 'READY_TO_REPORT';
        updated = true;
      }
    }

    // 4. KỲ NGỘ THÁM HIỂM (EVENT / ROAM)
    if (actionType === 'EVENT' && mission.kind === 'EVENT') {
      const eventId = payload.eventId;
      if (eventId === mission.event_target_id) {
        profile.activeMission.status = 'READY_TO_REPORT';
        updated = true;
      }
    }

    // 5. NGUY CƠ BỊ CƯỚP TIÊU TRONG LÚC ROAM THÁM HIỂM (ESCORT AMBUSH)
    let ambushEvent: any = null;
    if (actionType === 'ROAM' && mission.kind === 'ESCORT' && profile.activeMission.status === 'ACTIVE') {
      const risk = mission.escort_risk_percent || 20;
      const roll = Math.random() * 100;
      if (roll < risk && !profile.activeMission.ambushResolved) {
        profile.activeMission.ambushResolved = true;
        ambushEvent = {
          title: '⚠️ [CƯỚP TIÊU] Bầy Sơn Tặc Phục Kích Hàng Hóa!',
          description: `Đoàn áp tiêu [${mission.cargo_name}] đang qua thung lũng thì một toán cướp lao ra chặn đường hòng cướp tiêu! Đạo hữu dũng cảm vung kiếm đẩy lùi toán cướp, bảo vệ kiện hàng nguyên vẹn!`,
          damageTaken: 15,
          cultivationAward: 20,
        };
      }
    }

    return {
      missionUpdated: updated,
      eventTriggered: ambushEvent,
      readyToReport: profile.activeMission.status === 'READY_TO_REPORT' || profile.activeMission.status === 'READY_TO_DELIVER',
    };
  }

  public deliverOrReportMission(userId: string, missionId: string, currentZoneId: string, inventory: any[] = []) {
    const profile = this.getOrCreateProfile(userId);
    if (!profile.activeMission || profile.activeMission.missionId !== missionId) {
      throw new Error('Nhiệm vụ này không phải chuyến tiêu đang thi hành.');
    }

    const mission = this.missions.find(m => m.id === missionId);
    if (!mission) {
      throw new Error('Không tìm thấy dữ liệu nhiệm vụ thám hiểm.');
    }

    // Kiểm tra vị trí trả tiêu
    if (mission.kind === 'ESCORT' || mission.kind === 'COURIER') {
      if (currentZoneId !== mission.destination_zone_id) {
        throw new Error(`Chưa đến đích! Chuyến tiêu này cần giao tại [${mission.destination_name}].`);
      }
    } else if (mission.kind === 'HUNT') {
      if (profile.activeMission.currentCount < (mission.target?.required_count || 1)) {
        throw new Error(`Chưa săn đủ số lượng dị thú! Hiện có: ${profile.activeMission.currentCount}/${mission.target?.required_count}`);
      }
    } else if (mission.kind === 'GATHERING') {
      const reqMat = mission.input;
      if (reqMat) {
        const itemSlot = inventory.find(i => i.item_id === reqMat.item_id);
        const curCount = itemSlot ? itemSlot.quantity : 0;
        if (curCount < reqMat.quantity) {
          throw new Error(`Trong túi đồ không đủ [${reqMat.item_name}]! Cần ${reqMat.quantity}, hiện có ${curCount}.`);
        }
      }
    }

    // Thưởng
    const rewards = mission.rewards;
    profile.merit += rewards.merit;
    profile.credits += rewards.credits;
    profile.totalMissionsCompleted += 1;
    profile.completedByKind[mission.kind] = (profile.completedByKind[mission.kind] || 0) + 1;

    // Reset active mission
    profile.activeMission = null;

    return {
      success: true,
      message: `Hoàn tất xuất sắc chuyến thám hiểm [${mission.name}]!`,
      rewards,
      turnin_lines: mission.turnin_lines,
      membership: {
        rankKey: profile.rankKey,
        merit: profile.merit,
        credits: profile.credits,
        totalCompleted: profile.totalMissionsCompleted,
        completedByKind: profile.completedByKind,
      },
    };
  }

  public requestPromotion(userId: string) {
    const profile = this.getOrCreateProfile(userId);
    const nextRank = this.getNextRank(profile.rankKey);
    if (!nextRank) {
      throw new Error('Đã đạt cấp bậc Tiêu Sư tối cao, không thể thăng cấp thêm!');
    }

    const distinctKinds = Object.values(profile.completedByKind).filter(c => c > 0).length;
    if (profile.merit < nextRank.required_merit) {
      throw new Error(`Điểm Công Trạng chưa đủ! Cần ${nextRank.required_merit}, hiện có ${profile.merit}.`);
    }
    if (profile.totalMissionsCompleted < nextRank.required_missions) {
      throw new Error(`Số chuyến tiêu hoàn tất chưa đủ! Cần ${nextRank.required_missions}, hiện có ${profile.totalMissionsCompleted}.`);
    }
    if (distinctKinds < nextRank.required_kinds) {
      throw new Error(`Cần kinh qua ít nhất ${nextRank.required_kinds} loại nhiệm vụ thám hiểm khác nhau!`);
    }

    profile.rankKey = nextRank.key;
    // Thưởng ngân lượng bổng lộc thăng chức
    const stipend = nextRank.daily_stipend_silver;

    return {
      success: true,
      message: `🎉 Chúc mừng Đạo Hữu được sắc phong thành [${nextRank.name}] của Thiên Cơ Tiêu Cục!`,
      newRank: nextRank,
      stipendSilver: stipend,
      celebration_lines: [
        `Trống đồng rền vang, toàn thể tiêu đầu tề tựu chúc mừng!`,
        `Chiến tích phi phàm cùng sự tín nhiệm của bách tính đã được Thiên Cơ Các chuẩn tấu.`,
        `Từ nay Đạo Hữu chính thức nhậm chức [${nextRank.name}], mở khóa quyền hạn thám hiểm và kho quân nhu cao cấp!`
      ],
    };
  }

  public exchangeSupply(userId: string, supplyId: string) {
    const profile = this.getOrCreateProfile(userId);
    const org = this.organizations[0];
    const item = (org.supply_hall || []).find((s: SupplyItem) => s.id === supplyId);
    if (!item) {
      throw new Error('Không tìm thấy vật phẩm quy đổi trong Kho Quân Nhu.');
    }

    const rankOrder = ['ASSOCIATE', 'COPPER', 'SILVER', 'GOLD', 'CHIEF', 'DIVINE'];
    const userRankIdx = rankOrder.indexOf(profile.rankKey);
    const reqRankIdx = rankOrder.indexOf(item.min_rank);

    if (userRankIdx < reqRankIdx) {
      const reqRank = this.getRank(item.min_rank);
      throw new Error(`Cấp bậc chưa đủ để đổi vật phẩm này! Yêu cầu đạt ${reqRank?.name || item.min_rank}.`);
    }

    if (profile.credits < item.credit_cost) {
      throw new Error(`Không đủ Điểm Cống Hiến! Cần ${item.credit_cost} Cống Hiến, hiện có ${profile.credits}.`);
    }

    profile.credits -= item.credit_cost;

    return {
      success: true,
      message: `Đổi thành công [${item.item_name} x${item.quantity_per_exchange}] từ Kho Quân Nhu!`,
      item: {
        item_id: item.item_id,
        item_name: item.item_name,
        quantity: item.quantity_per_exchange,
      },
      remainingCredits: profile.credits,
    };
  }

  public cancelMission(userId: string) {
    const profile = this.getOrCreateProfile(userId);
    if (!profile.activeMission) {
      throw new Error('Hiện không có chuyến tiêu nào đang thi hành.');
    }
    const oldId = profile.activeMission.missionId;
    profile.activeMission = null;

    return {
      success: true,
      message: 'Đã hủy chuyến thám hiểm. Bảng ủy thác Tiêu Cục đã được làm mới.',
      cancelledMissionId: oldId,
    };
  }
}

export const xianxiaAgencyService = new XianxiaAgencyService();
