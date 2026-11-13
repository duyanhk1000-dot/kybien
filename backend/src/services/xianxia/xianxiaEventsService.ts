import fs from 'fs';
import path from 'path';
import {
  XianxiaEvent,
  EventChoice,
  PlayerExplorationStats,
  ResolveChoiceResult,
  RealmTier,
} from '../../types/xianxia.js';
import { REALM_HIERARCHY } from './xianxiaWorldService.js';

export class XianxiaEventsService {
  private events: Map<string, XianxiaEvent> = new Map();

  constructor() {
    this.loadEventsData();
  }

  /**
   * Tải dữ liệu Sự kiện Kỳ ngộ từ file JSON
   */
  public loadEventsData(): void {
    try {
      const candidates = [
        path.resolve(__dirname, '../../data/xianxia/events.json'),
        path.resolve(__dirname, '../../../src/data/xianxia/events.json'),
        path.resolve(process.cwd(), 'src/data/xianxia/events.json'),
        path.resolve(process.cwd(), 'dist/data/xianxia/events.json'),
        path.resolve(process.cwd(), 'backend/src/data/xianxia/events.json'),
        path.resolve(process.cwd(), 'backend/dist/data/xianxia/events.json'),
      ];

      let rawData = '';
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          rawData = fs.readFileSync(p, 'utf-8');
          break;
        }
      }

      if (!rawData) {
        console.warn('⚠️ [XianxiaEventsService] Không tìm thấy events.json, khởi tạo danh sách rỗng.');
        return;
      }

      const parsed: XianxiaEvent[] = JSON.parse(rawData);
      this.events.clear();
      for (const ev of parsed) {
        this.events.set(ev.id, ev);
      }
      console.log(`[XianxiaEventsService] Đã nạp thành công ${this.events.size} sự kiện kỳ ngộ.`);
    } catch (err) {
      console.error('❌ [XianxiaEventsService] Lỗi khi nạp dữ liệu events.json:', err);
    }
  }

  /**
   * Lấy toàn bộ sự kiện kỳ ngộ
   */
  public getAllEvents(): XianxiaEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Tìm sự kiện theo ID
   */
  public getEventById(id: string): XianxiaEvent | undefined {
    return this.events.get(id);
  }

  /**
   * Lấy danh sách sự kiện có thể diễn ra tại một phân khu
   * (Bao gồm các sự kiện riêng của phân khu và các sự kiện toàn cục 'ALL')
   */
  public getEventsByZone(zoneId: string): XianxiaEvent[] {
    return Array.from(this.events.values()).filter(
      ev => ev.zone_id === zoneId || ev.zone_id === 'ALL'
    );
  }

  /**
   * Kiểm tra điều kiện một người chơi có thể chọn một lựa chọn trong sự kiện hay không
   */
  public checkChoiceAvailability(
    choice: EventChoice,
    stats: PlayerExplorationStats
  ): { canChoose: boolean; reason?: string } {
    const req = choice.requirements;
    if (!req) {
      return { canChoose: true };
    }

    // 1. Kiểm tra cảnh giới tối thiểu
    if (req.min_realm) {
      const playerRank = REALM_HIERARCHY[stats.realm] ?? 0;
      const requiredRank = REALM_HIERARCHY[req.min_realm] ?? 0;
      if (playerRank < requiredRank) {
        return {
          canChoose: false,
          reason: `Cảnh giới chưa đủ (Yêu cầu tối thiểu ${req.min_realm})`,
        };
      }
    }

    // 2. Kiểm tra chi phí thể lực
    if (req.cost_fatigue && stats.fatigue < req.cost_fatigue) {
      return {
        canChoose: false,
        reason: `Không đủ thể lực (Cần ${req.cost_fatigue}, hiện có ${stats.fatigue})`,
      };
    }

    // 3. Kiểm tra chi phí ngân lượng
    if (req.cost_silver && stats.silver < req.cost_silver) {
      return {
        canChoose: false,
        reason: `Không đủ ngân lượng (Cần ${req.cost_silver} lượng bạc, hiện có ${stats.silver})`,
      };
    }

    // 4. Kiểm tra điều kiện Căn cốt tối thiểu
    if (req.min_physique && stats.physique < req.min_physique) {
      return {
        canChoose: false,
        reason: `Căn cốt không đủ (Yêu cầu ${req.min_physique}, hiện có ${stats.physique})`,
      };
    }

    // 5. Kiểm tra điều kiện Ngộ tính tối thiểu
    if (req.min_comprehension && stats.comprehension < req.min_comprehension) {
      return {
        canChoose: false,
        reason: `Ngộ tính không đủ (Yêu cầu ${req.min_comprehension}, hiện có ${stats.comprehension})`,
      };
    }

    // 6. Kiểm tra điều kiện Khí vận tối thiểu
    if (req.min_luck && stats.luck < req.min_luck) {
      return {
        canChoose: false,
        reason: `Khí vận không đủ (Yêu cầu ${req.min_luck}, hiện có ${stats.luck})`,
      };
    }

    // 7. Kiểm tra Đạo tâm / Thiện ác
    if (req.min_karma !== undefined && stats.karma < req.min_karma) {
      return {
        canChoose: false,
        reason: `Đạo tâm quá thấp (Cần tối thiểu ${req.min_karma})`,
      };
    }
    if (req.max_karma !== undefined && stats.karma > req.max_karma) {
      return {
        canChoose: false,
        reason: `Tâm tính quá chính đạo (Chỉ mở cho Ma đạo, yêu cầu tối đa ${req.max_karma})`,
      };
    }

    // 8. Kiểm tra vật phẩm bắt buộc
    if (req.required_item) {
      const hasItem = stats.inventory_items?.includes(req.required_item);
      if (!hasItem) {
        return {
          canChoose: false,
          reason: `Thiếu vật phẩm yêu cầu trong túi đồ: ${req.required_item}`,
        };
      }
    }

    return { canChoose: true };
  }

  /**
   * Kích hoạt Thám hiểm ngẫu nhiên tại phân khu
   * Chọn một sự kiện phù hợp bằng thuật toán xác suất có trọng số (Weighted Probability)
   */
  public triggerExploration(
    zoneId: string,
    playerStats: PlayerExplorationStats,
    forcedEventId?: string
  ): {
    event: XianxiaEvent;
    available_choices: {
      choice_id: string;
      text: string;
      description: string;
      can_choose: boolean;
      unmet_reason?: string;
    }[];
  } {
    const candidateEvents = this.getEventsByZone(zoneId);
    if (candidateEvents.length === 0) {
      throw new Error(`Không tìm thấy sự kiện nào cho phân khu: ${zoneId}`);
    }

    let selectedEvent: XianxiaEvent;

    if (forcedEventId) {
      const found = candidateEvents.find(e => e.id === forcedEventId);
      if (!found) {
        throw new Error(`Sự kiện ${forcedEventId} không tồn tại trong phân khu ${zoneId}`);
      }
      selectedEvent = found;
    } else {
      // Tính tổng trọng số
      const totalWeight = candidateEvents.reduce((sum, e) => sum + e.weight, 0);
      let randomVal = Math.random() * totalWeight;

      selectedEvent = candidateEvents[0];
      for (const ev of candidateEvents) {
        if (randomVal < ev.weight) {
          selectedEvent = ev;
          break;
        }
        randomVal -= ev.weight;
      }
    }

    // Lập danh sách các lựa chọn kèm trạng thái khả dụng cho người chơi
    const available_choices = selectedEvent.choices.map(choice => {
      const check = this.checkChoiceAvailability(choice, playerStats);
      return {
        choice_id: choice.id,
        text: choice.text,
        description: choice.description,
        can_choose: check.canChoose,
        unmet_reason: check.reason,
      };
    });

    return {
      event: selectedEvent,
      available_choices,
    };
  }

  /**
   * Giải quyết lựa chọn của người chơi (Server-authoritative Resolution)
   * Đảm bảo tính toán công bằng, chống giả mạo chỉ số hoặc kết quả từ client.
   */
  public resolveChoice(
    eventId: string,
    choiceId: string,
    playerStats: PlayerExplorationStats
  ): ResolveChoiceResult {
    const event = this.events.get(eventId);
    if (!event) {
      throw new Error(`Sự kiện không tồn tại: ${eventId}`);
    }

    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) {
      throw new Error(`Lựa chọn ${choiceId} không thuộc sự kiện ${eventId}`);
    }

    // Kiểm tra điều kiện bắt buộc
    const availability = this.checkChoiceAvailability(choice, playerStats);
    if (!availability.canChoose) {
      throw new Error(`Không đủ điều kiện để chọn phương án này: ${availability.reason}`);
    }

    let success = true;
    let statCheckDetail:
      | {
          stat: string;
          player_value: number;
          threshold: number;
          passed: boolean;
        }
      | undefined = undefined;

    // Nếu có bài kiểm tra chỉ số (Stat Check)
    if (choice.stat_check) {
      const statKey = choice.stat_check.stat;
      const playerValue = playerStats[statKey] ?? 0;
      const threshold = choice.stat_check.threshold;
      const passed = playerValue >= threshold;

      statCheckDetail = {
        stat: statKey,
        player_value: playerValue,
        threshold,
        passed,
      };

      success = passed;
    }

    // Xác định kết quả và hiệu ứng
    const outcome = success || !choice.outcome_failure ? choice.outcome_success : choice.outcome_failure;

    // Chi phí bắt buộc của lựa chọn
    const reqCostSilver = choice.requirements?.cost_silver ?? 0;
    const reqCostFatigue = choice.requirements?.cost_fatigue ?? 0;

    // Tổng hợp biến động tài nguyên
    const expGained = outcome.exp_reward ?? 0;
    const cultivationGained = outcome.cultivation_reward ?? 0;
    const silverChange = (outcome.silver_reward ?? 0) - reqCostSilver;
    const healthChange = outcome.health_change ?? 0;
    const fatigueChange = (outcome.fatigue_change ?? 0) - reqCostFatigue;
    const karmaChange = outcome.karma_change ?? 0;
    const itemsGained = outcome.dropped_items ?? [];

    return {
      event_id: event.id,
      choice_id: choice.id,
      success,
      narrative: outcome.narrative,
      stat_check: statCheckDetail,
      effects: {
        exp_gained: expGained,
        cultivation_gained: cultivationGained,
        silver_change: silverChange,
        health_change: healthChange,
        fatigue_change: fatigueChange,
        karma_change: karmaChange,
        items_gained: itemsGained,
      },
    };
  }
}

export const xianxiaEventsService = new XianxiaEventsService();
