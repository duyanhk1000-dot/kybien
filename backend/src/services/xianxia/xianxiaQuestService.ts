import fs from 'fs';
import path from 'path';
import {
  Quest,
  PlayerQuestProgress,
  QuestStatus,
  RealmTier,
  PlayerInventorySlot,
  QuestActionResponse,
  QuestReward,
} from '../../types/xianxia.js';
import { prisma } from '../../utils/prisma.js';
import { xianxiaCharacterService } from './xianxiaCharacterService.js';

const REALM_ORDER: RealmTier[] = [
  'PHAM_NHAN',
  'LUYEN_KHI_1',
  'LUYEN_KHI_2',
  'LUYEN_KHI_3',
  'LUYEN_KHI_4',
  'LUYEN_KHI_5',
  'LUYEN_KHI_6',
  'LUYEN_KHI_7',
  'LUYEN_KHI_8',
  'LUYEN_KHI_9',
  'TRUC_CO_SO_KY',
  'TRUC_CO_TRUNG_KY',
  'TRUC_CO_HAU_KY',
  'TRUC_CO_DINH_PHONG',
  'KIM_DAN_SO_KY',
];

export function isRealmTierSatisfied(current: RealmTier, required?: RealmTier): boolean {
  if (!required) return true;
  const currentIndex = REALM_ORDER.indexOf(current);
  const requiredIndex = REALM_ORDER.indexOf(required);
  return currentIndex >= requiredIndex;
}

export class XianxiaQuestService {
  private quests: Map<string, Quest> = new Map();
  // Lưu trữ tiến độ nhiệm vụ của từng người chơi: Map<userId, Map<questId, PlayerQuestProgress>>
  private playerProgress: Map<string, Map<string, PlayerQuestProgress>> = new Map();
  // Lưu trữ lựa chọn narrative/moral của người chơi
  private playerChoices: Map<string, Map<string, { choiceId: string; consequence: string; karma_delta?: number; silver_delta?: number; cultivation_delta?: number }>> = new Map();

  constructor() {
    this.loadData();
  }

  public loadData(): void {
    const questCandidates = [
      path.resolve(__dirname, '../../data/xianxia/quests.json'),
      path.resolve(__dirname, '../../../src/data/xianxia/quests.json'),
      path.resolve(process.cwd(), 'src/data/xianxia/quests.json'),
      path.resolve(process.cwd(), 'dist/data/xianxia/quests.json'),
      path.resolve(process.cwd(), 'backend/src/data/xianxia/quests.json'),
    ];

    const questPath = questCandidates.find(p => fs.existsSync(p));
    if (questPath) {
      try {
        const raw = JSON.parse(fs.readFileSync(questPath, 'utf-8')) as { quests: Quest[] };
        this.quests.clear();
        for (const q of raw.quests) {
          this.quests.set(q.id, q);
        }
      } catch (err) {
        console.error('[XianxiaQuestService] Lỗi khi đọc quests.json:', err);
      }
    } else {
      console.warn('[XianxiaQuestService] Cảnh báo: Không tìm thấy quests.json');
    }
  }

  public getAllQuests(): Quest[] {
    return Array.from(this.quests.values());
  }

  public getQuestById(id: string): Quest | null {
    return this.quests.get(id) || null;
  }

  private getUserMap(userId: string): Map<string, PlayerQuestProgress> {
    if (!this.playerProgress.has(userId)) {
      this.playerProgress.set(userId, new Map());
    }
    return this.playerProgress.get(userId)!;
  }

  public getPlayerQuestProgress(userId: string, questId: string): PlayerQuestProgress | null {
    return this.getUserMap(userId).get(questId) || null;
  }

  /**
   * Tính toán danh sách nhiệm vụ và trạng thái hiển thị cho người chơi
   */
  public getQuestsForPlayer(
    userId: string,
    playerContext: { realm: RealmTier; level: number; inventory?: PlayerInventorySlot[] }
  ): (Quest & { status: QuestStatus; current_objectives: { [id: string]: number } })[] {
    const userMap = this.getUserMap(userId);
    const results: (Quest & { status: QuestStatus; current_objectives: { [id: string]: number } })[] = [];

    for (const quest of this.quests.values()) {
      const existing = userMap.get(quest.id);
      let status: QuestStatus = 'AVAILABLE';
      let objectivesProgress: { [id: string]: number } = {};

      if (existing) {
        status = existing.status;
        objectivesProgress = { ...existing.objectives_progress };

        // Nếu đang IN_PROGRESS và có DELIVER_ITEM hoặc GATHER_ITEM, kiểm tra cập nhật số lượng thực tế từ túi đồ
        if (status === 'IN_PROGRESS' && playerContext.inventory) {
          let allMet = true;
          for (const obj of quest.objectives) {
            if (obj.type === 'DELIVER_ITEM' || obj.type === 'GATHER_ITEM') {
              const invItem = playerContext.inventory.find(i => i.item_id === obj.target_id);
              const count = invItem ? invItem.quantity : 0;
              objectivesProgress[obj.id] = Math.min(count, obj.required_count);
            }
            if ((objectivesProgress[obj.id] || 0) < obj.required_count) {
              allMet = false;
            }
          }
          if (allMet) {
            status = 'READY_TO_TURN_IN';
            existing.status = 'READY_TO_TURN_IN';
          }
        }
      } else {
        // Kiểm tra điều kiện mở khóa nhiệm vụ
        const realmMet = isRealmTierSatisfied(playerContext.realm, quest.requirements.min_realm);
        const levelMet = !quest.requirements.min_level || playerContext.level >= quest.requirements.min_level;
        let prereqMet = true;
        if (quest.requirements.prerequisite_quest_id) {
          const prereqProg = userMap.get(quest.requirements.prerequisite_quest_id);
          prereqMet = !!prereqProg && prereqProg.status === 'COMPLETED';
        }

        if (!realmMet || !levelMet || !prereqMet) {
          status = 'LOCKED';
        } else {
          status = 'AVAILABLE';
        }
      }

      results.push({
        ...quest,
        status,
        current_objectives: objectivesProgress,
      });
    }

    return results;
  }

  /**
   * Lọc danh sách nhiệm vụ theo danh mục (MAIN_STORY, SIDE_QUEST, v.v.)
   */
  public getQuestsByCategory(
    userId: string,
    categoryType: 'ALL' | 'MAIN_STORY' | 'SIDE_QUEST' | 'CHINH_TUYEN' | 'THINH_CAU' | 'AGENCY' | string,
    playerContext: { realm: RealmTier; level: number; inventory?: PlayerInventorySlot[] }
  ): (Quest & { status: QuestStatus; current_objectives: { [id: string]: number } })[] {
    const all = this.getQuestsForPlayer(userId, playerContext);
    if (!categoryType || categoryType === 'ALL') {
      return all;
    }
    const catUpper = categoryType.toUpperCase();
    return all.filter(q => 
      q.type?.toUpperCase() === catUpper || 
      q.category?.toUpperCase() === catUpper ||
      (catUpper === 'MAIN_STORY' && q.category === 'CHINH_TUYEN') ||
      (catUpper === 'SIDE_QUEST' && (q.category === 'THINH_CAU' || q.category === 'CAY_CUOC'))
    );
  }

  /**
   * Tiếp nhận nhiệm vụ
   */
  public acceptQuest(
    userId: string,
    questId: string,
    playerContext: { realm: RealmTier; level: number; inventory?: PlayerInventorySlot[] }
  ): QuestActionResponse {
    const quest = this.getQuestById(questId);
    if (!quest) {
      return { success: false, message: `Không tìm thấy nhiệm vụ ID ${questId}` };
    }

    const userMap = this.getUserMap(userId);
    const existing = userMap.get(questId);
    if (existing && existing.status !== 'LOCKED' && existing.status !== 'AVAILABLE') {
      return {
        success: false,
        message: `Nhiệm vụ "${quest.title}" đang được thực hiện hoặc đã hoàn thành.`,
      };
    }

    // Kiểm tra điều kiện
    if (!isRealmTierSatisfied(playerContext.realm, quest.requirements.min_realm)) {
      return {
        success: false,
        message: `Cảnh giới chưa đủ! Yêu cầu tối thiểu ${quest.requirements.min_realm}`,
      };
    }
    if (quest.requirements.min_level && playerContext.level < quest.requirements.min_level) {
      return {
        success: false,
        message: `Cấp độ chưa đủ! Yêu cầu cấp ${quest.requirements.min_level}`,
      };
    }
    if (quest.requirements.prerequisite_quest_id) {
      const prereq = userMap.get(quest.requirements.prerequisite_quest_id);
      if (!prereq || prereq.status !== 'COMPLETED') {
        const prereqQuest = this.getQuestById(quest.requirements.prerequisite_quest_id);
        return {
          success: false,
          message: `Cần hoàn thành nhiệm vụ tiền đề: "${prereqQuest ? prereqQuest.title : quest.requirements.prerequisite_quest_id}"`,
        };
      }
    }

    // Khởi tạo tiến độ ban đầu
    const objectivesProgress: { [id: string]: number } = {};
    let allMet = true;

    for (const obj of quest.objectives) {
      objectivesProgress[obj.id] = 0;
      // Nếu là DELIVER_ITEM hoặc GATHER_ITEM, kiểm tra vật phẩm có sẵn trong túi đồ
      if ((obj.type === 'DELIVER_ITEM' || obj.type === 'GATHER_ITEM') && playerContext.inventory) {
        const item = playerContext.inventory.find(i => i.item_id === obj.target_id);
        const count = item ? item.quantity : 0;
        objectivesProgress[obj.id] = Math.min(count, obj.required_count);
      }
      if (objectivesProgress[obj.id] < obj.required_count) {
        allMet = false;
      }
    }

    const initialStatus: QuestStatus = allMet ? 'READY_TO_TURN_IN' : 'IN_PROGRESS';

    const newProgress: PlayerQuestProgress = {
      quest_id: questId,
      status: initialStatus,
      objectives_progress: objectivesProgress,
      accepted_at: Date.now(),
    };

    userMap.set(questId, newProgress);

    return {
      success: true,
      message: `Đã tiếp nhận nhiệm vụ: ${quest.title}`,
      quest,
      progress: newProgress,
      narrative_lines: quest.dialogue_intro,
    };
  }

  /**
   * Tương tác hoàn thành mục tiêu nhiệm vụ (Nói chuyện, nghe tin tức, tìm người, đưa tin)
   */
  public interactObjective(
    userId: string,
    questId: string,
    actionType: 'TALK_NPC' | 'GATHER_INTEL' | 'TRACK_PERSON' | 'DELIVER_MESSAGE',
    targetId: string
  ): QuestActionResponse {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    const userMap = this.getUserMap(userId);
    const progress = userMap.get(questId);
    if (!progress || progress.status !== 'IN_PROGRESS') {
      return { success: false, message: 'Nhiệm vụ chưa được tiếp nhận hoặc đã hoàn tất.' };
    }

    let updated = false;
    let customNarrative: string[] = [];

    for (const obj of quest.objectives) {
      if (obj.type === actionType && (!obj.target_id || obj.target_id === targetId)) {
        progress.objectives_progress[obj.id] = obj.required_count;
        updated = true;

        if (actionType === 'TALK_NPC') {
          customNarrative = [
            `Ngươi tiến lại gần ${obj.target_name || 'NPC'}, lắng nghe lời chỉ dạy tâm huyết.`,
            `Từng câu chữ khai sáng tâm trí, linh đài thanh tịnh!`,
          ];
        } else if (actionType === 'GATHER_INTEL') {
          customNarrative = [
            `Ngươi chăm chú lắng nghe dị biến tại ${obj.target_name || 'khu vực'}.`,
            `Ghi nhận thành công manh mối huyền bí của Cổ Động!`,
          ];
        } else if (actionType === 'TRACK_PERSON') {
          customNarrative = [
            `Lần theo dấu vết máu và tàn tích, ngươi phát hiện thiếu niên Tán Tu đang ẩn nấp an toàn!`,
            `Đã hộ tống nạn nhân thoát khỏi vòng vây của yêu thú hung hãn.`,
          ];
        } else if (actionType === 'DELIVER_MESSAGE') {
          customNarrative = [
            `Ngươi trao tận tay phong mật thư cho ${obj.target_name || 'người nhận'}.`,
            `Người nhận gật đầu tán thưởng sự nhanh nhẹn và dũng cảm của ngươi!`,
          ];
        }
      }
    }

    if (!updated) {
      return { success: false, message: 'Không tìm thấy mục tiêu tương tác phù hợp.' };
    }

    // Kiểm tra xem tất cả mục tiêu đã hoàn tất chưa
    const allDone = quest.objectives.every(
      obj => (progress.objectives_progress[obj.id] || 0) >= obj.required_count
    );
    if (allDone) {
      progress.status = 'READY_TO_TURN_IN';
    }

    return {
      success: true,
      message: 'Hoàn thành mục tiêu!',
      quest,
      progress,
      narrative_lines: customNarrative.length > 0 ? customNarrative : quest.dialogue_in_progress,
    };
  }

  /**
   * Trả lời câu hỏi khảo nghiệm (Quiz)
   */
  public submitQuiz(
    userId: string,
    questId: string,
    objectiveId: string,
    selectedIndex: number
  ): QuestActionResponse {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    const userMap = this.getUserMap(userId);
    const progress = userMap.get(questId);
    if (!progress || progress.status !== 'IN_PROGRESS') {
      return { success: false, message: 'Nhiệm vụ chưa được tiếp nhận hoặc đã hoàn tất.' };
    }

    const obj = quest.objectives.find(o => o.id === objectiveId && o.type === 'ANSWER_QUIZ');
    if (!obj) {
      return { success: false, message: 'Không tìm thấy mục tiêu khảo nghiệm trắc nghiệm.' };
    }

    if (selectedIndex !== obj.quiz_correct_index) {
      return {
        success: false,
        message: 'Đáp án chưa chính xác! Lão Dược Sư lắc đầu: "Hãy suy nghĩ kỹ lại về dược điển tu chân."',
        narrative_lines: [
          'Trần Dược Sư thở dài: "Kiến thức đan đạo sai một ly đi một dặm, ăn nhầm độc dược sẽ nổ nát đan điền!"',
          'Hãy đọc kỹ lại câu hỏi và thử lại.',
        ],
      };
    }

    // Trả lời đúng
    progress.objectives_progress[obj.id] = 1;
    progress.quiz_completed = true;

    const allDone = quest.objectives.every(
      o => (progress.objectives_progress[o.id] || 0) >= o.required_count
    );
    if (allDone) {
      progress.status = 'READY_TO_TURN_IN';
    }

    return {
      success: true,
      message: 'Đáp án hoàn toàn chính xác!',
      quest,
      progress,
      narrative_lines: [
        'Trần Dược Sư mỉm cười vuốt râu: "Xuất sắc! Đúng là Trúc Cơ Đan!"',
        'Ngươi đã vượt qua bài khảo nghiệm dược lý một cách thuyết phục.',
      ],
    };
  }

  /**
   * Đưa ra lựa chọn Narrative/Moral Choice
   */
  public submitChoice(
    userId: string,
    questId: string,
    objectiveId: string,
    choiceOptionId: string
  ): QuestActionResponse {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    const userMap = this.getUserMap(userId);
    const progress = userMap.get(questId);
    if (!progress || progress.status !== 'IN_PROGRESS') {
      return { success: false, message: 'Nhiệm vụ chưa được tiếp nhận hoặc đã hoàn tất.' };
    }

    const obj = quest.objectives.find(o => o.id === objectiveId && o.type === 'MAKE_CHOICE');
    if (!obj || !obj.choice_options) {
      return { success: false, message: 'Không tìm thấy mục tiêu lựa chọn.' };
    }

    const option = obj.choice_options.find(c => c.id === choiceOptionId);
    if (!option) {
      return { success: false, message: 'Lựa chọn không hợp lệ.' };
    }

    // Ghi nhận lựa chọn
    progress.objectives_progress[obj.id] = 1;
    progress.choice_selected = choiceOptionId;

    if (!this.playerChoices.has(userId)) {
      this.playerChoices.set(userId, new Map());
    }
    this.playerChoices.get(userId)!.set(questId, {
      choiceId: option.id,
      consequence: option.consequence,
      karma_delta: option.karma_delta,
      silver_delta: option.silver_delta,
      cultivation_delta: option.cultivation_delta,
    });

    const allDone = quest.objectives.every(
      o => (progress.objectives_progress[o.id] || 0) >= o.required_count
    );
    if (allDone) {
      progress.status = 'READY_TO_TURN_IN';
    }

    return {
      success: true,
      message: 'Đã đưa ra quyết định Đạo Tâm!',
      quest,
      progress,
      narrative_lines: [
        `Quyết định của đạo hữu: "${option.text}"`,
        option.consequence,
      ],
    };
  }

  /**
   * Ghi nhận tiêu diệt quái vật (trigger từ trận đánh)
   */
  public recordMonsterKill(userId: string, monsterId: string, count: number = 1): { updatedQuests: string[] } {
    const userMap = this.getUserMap(userId);
    const updatedQuests: string[] = [];

    for (const [questId, prog] of userMap.entries()) {
      if (prog.status !== 'IN_PROGRESS') continue;
      const quest = this.getQuestById(questId);
      if (!quest) continue;

      let changed = false;
      for (const obj of quest.objectives) {
        if (obj.type === 'KILL_MONSTER' && obj.target_id === monsterId) {
          const current = prog.objectives_progress[obj.id] || 0;
          prog.objectives_progress[obj.id] = Math.min(current + count, obj.required_count);
          changed = true;
        }
      }

      if (changed) {
        updatedQuests.push(questId);
        const allDone = quest.objectives.every(
          o => (prog.objectives_progress[o.id] || 0) >= o.required_count
        );
        if (allDone) {
          prog.status = 'READY_TO_TURN_IN';
        }
      }
    }

    return { updatedQuests };
  }

  /**
   * Ghi nhận nhặt được vật phẩm rơi (Loot Drop)
   */
  public recordLootAcquired(userId: string, itemId: string, quantity: number = 1): { updatedQuests: string[] } {
    const userMap = this.getUserMap(userId);
    const updatedQuests: string[] = [];

    for (const [questId, prog] of userMap.entries()) {
      if (prog.status !== 'IN_PROGRESS') continue;
      const quest = this.getQuestById(questId);
      if (!quest) continue;

      let changed = false;
      for (const obj of quest.objectives) {
        if ((obj.type === 'LOOT_DROP' || obj.type === 'GATHER_ITEM') && obj.target_id === itemId) {
          const current = prog.objectives_progress[obj.id] || 0;
          prog.objectives_progress[obj.id] = Math.min(current + quantity, obj.required_count);
          changed = true;
        }
      }

      if (changed) {
        updatedQuests.push(questId);
        const allDone = quest.objectives.every(
          o => (prog.objectives_progress[o.id] || 0) >= o.required_count
        );
        if (allDone) {
          prog.status = 'READY_TO_TURN_IN';
        }
      }
    }

    return { updatedQuests };
  }

  /**
   * Hoàn thành và nộp nhiệm vụ (Claim Rewards)
   */
  public turnInQuest(
    userId: string,
    questId: string,
    playerInventory: PlayerInventorySlot[]
  ): QuestActionResponse {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    const userMap = this.getUserMap(userId);
    const progress = userMap.get(questId);
    if (!progress) {
      return { success: false, message: 'Chưa từng nhận nhiệm vụ này.' };
    }
    if (progress.status === 'COMPLETED') {
      return { success: false, message: 'Nhiệm vụ đã hoàn tất và nhận thưởng từ trước.' };
    }

    // Kiểm tra các mục tiêu
    for (const obj of quest.objectives) {
      // Nếu là DELIVER_ITEM, kiểm tra túi đồ thực tế
      if (obj.type === 'DELIVER_ITEM') {
        const item = playerInventory.find(i => i.item_id === obj.target_id);
        const currentCount = item ? item.quantity : 0;
        if (currentCount < obj.required_count) {
          return {
            success: false,
            message: `Chưa đủ vật phẩm để giao! Cần ${obj.required_count}x [${obj.target_name || obj.target_id}], hiện có ${currentCount}.`,
          };
        }
        progress.objectives_progress[obj.id] = obj.required_count;
      }

      // Nếu là GATHER_ITEM, kiểm tra túi đồ thực tế
      if (obj.type === 'GATHER_ITEM') {
        const item = playerInventory.find(i => i.item_id === obj.target_id);
        const currentCount = item ? item.quantity : 0;
        if (currentCount >= obj.required_count) {
          progress.objectives_progress[obj.id] = obj.required_count;
        }
      }

      const current = progress.objectives_progress[obj.id] || 0;
      if (current < obj.required_count) {
        return {
          success: false,
          message: `Mục tiêu "${obj.description}" chưa hoàn thành (${current}/${obj.required_count})!`,
        };
      }
    }

    // Khấu trừ vật phẩm nếu là DELIVER_ITEM
    for (const obj of quest.objectives) {
      if (obj.type === 'DELIVER_ITEM') {
        const item = playerInventory.find(i => i.item_id === obj.target_id);
        if (item) {
          item.quantity -= obj.required_count;
        }
      }
    }

    // Đánh dấu hoàn thành
    progress.status = 'COMPLETED';
    progress.completed_at = Date.now();

    // Tính toán phần thưởng thực tế (kèm hiệu ứng lựa chọn nếu có)
    const baseReward = { ...quest.rewards };
    const choiceData = this.playerChoices.get(userId)?.get(questId);
    if (choiceData) {
      if (choiceData.karma_delta) {
        baseReward.karma = (baseReward.karma || 0) + choiceData.karma_delta;
      }
      if (choiceData.silver_delta) {
        baseReward.silver = Math.max(0, baseReward.silver + choiceData.silver_delta);
      }
      if (choiceData.cultivation_delta) {
        baseReward.cultivation = baseReward.cultivation + choiceData.cultivation_delta;
      }
    }

    return {
      success: true,
      message: `Hoàn thành nhiệm vụ "${quest.title}"! Nhận thưởng thành công.`,
      quest,
      progress,
      rewards_claimed: baseReward,
      narrative_lines: quest.dialogue_turnin,
    };
  }

  // ====================================================
  // AUTHORITATIVE DATABASE PERSISTENCE METHODS (MỤC 3)
  // ====================================================

  /**
   * Lấy danh sách nhiệm vụ kèm trạng thái từ Database cho người chơi đã đăng nhập
   */
  public async getQuestsForPlayerDb(userId: number): Promise<
    (Quest & { status: QuestStatus; current_objectives: { [id: string]: number } })[]
  > {
    const char = await xianxiaCharacterService.getOrCreateCharacter(userId);
    const inventory = await prisma.xianxiaInventoryItem.findMany({
      where: { character_id: char.id },
    });
    const dbProgressList = await prisma.xianxiaQuestProgress.findMany({
      where: { character_id: char.id },
    });

    const progressMap = new Map<string, { status: string; data: any }>();
    for (const prog of dbProgressList) {
      let data: any = {};
      try {
        if (prog.progress_data) data = JSON.parse(prog.progress_data);
      } catch (e) {
        data = {};
      }
      progressMap.set(prog.quest_id, { status: prog.status, data });
    }

    const results: (Quest & { status: QuestStatus; current_objectives: { [id: string]: number } })[] = [];

    for (const quest of this.quests.values()) {
      const existing = progressMap.get(quest.id);
      let status: QuestStatus = 'AVAILABLE';
      let objectivesProgress: { [id: string]: number } = {};

      if (existing) {
        status = existing.status as QuestStatus;
        objectivesProgress = { ...(existing.data.objectives_progress || {}) };

        // Nếu đang IN_PROGRESS và có DELIVER_ITEM hoặc GATHER_ITEM, kiểm tra cập nhật số lượng thực tế từ túi đồ
        if (status === 'IN_PROGRESS') {
          let allMet = true;
          for (const obj of quest.objectives) {
            if (obj.type === 'DELIVER_ITEM' || obj.type === 'GATHER_ITEM') {
              const invItem = inventory.find(i => i.item_id === obj.target_id);
              const count = invItem ? invItem.quantity : 0;
              objectivesProgress[obj.id] = Math.min(count, obj.required_count);
            }
            if ((objectivesProgress[obj.id] || 0) < obj.required_count) {
              allMet = false;
            }
          }
          if (allMet) {
            status = 'READY_TO_TURN_IN';
          }
        }
      } else {
        // Kiểm tra điều kiện mở khóa nhiệm vụ
        const realmMet = isRealmTierSatisfied(char.realm as RealmTier, quest.requirements.min_realm);
        const levelMet = !quest.requirements.min_level || char.level >= quest.requirements.min_level;
        let prereqMet = true;
        if (quest.requirements.prerequisite_quest_id) {
          const prereqProg = progressMap.get(quest.requirements.prerequisite_quest_id);
          prereqMet = !!prereqProg && prereqProg.status === 'COMPLETED';
        }

        if (!realmMet || !levelMet || !prereqMet) {
          status = 'LOCKED';
        } else {
          status = 'AVAILABLE';
        }
      }

      results.push({
        ...quest,
        status,
        current_objectives: objectivesProgress,
      });
    }

    return results;
  }

  /**
   * Tiếp nhận nhiệm vụ lưu vào Database
   */
  public async acceptQuestDb(userId: number, questId: string): Promise<QuestActionResponse> {
    const quest = this.getQuestById(questId);
    if (!quest) {
      return { success: false, message: `Không tìm thấy nhiệm vụ ID ${questId}` };
    }

    const char = await xianxiaCharacterService.getOrCreateCharacter(userId);
    const existing = await prisma.xianxiaQuestProgress.findUnique({
      where: {
        character_id_quest_id: {
          character_id: char.id,
          quest_id: questId,
        },
      },
    });

    if (existing && existing.status !== 'LOCKED' && existing.status !== 'AVAILABLE') {
      return {
        success: false,
        message: `Nhiệm vụ "${quest.title}" đang được thực hiện hoặc đã hoàn thành.`,
      };
    }

    // Kiểm tra điều kiện Cảnh giới
    if (!isRealmTierSatisfied(char.realm as RealmTier, quest.requirements.min_realm)) {
      return {
        success: false,
        message: `Cảnh giới chưa đủ! Yêu cầu tối thiểu ${quest.requirements.min_realm}`,
      };
    }
    // Kiểm tra Cấp độ
    if (quest.requirements.min_level && char.level < quest.requirements.min_level) {
      return {
        success: false,
        message: `Cấp độ chưa đủ! Yêu cầu cấp ${quest.requirements.min_level}`,
      };
    }
    // Kiểm tra nhiệm vụ tiền đề
    if (quest.requirements.prerequisite_quest_id) {
      const prereq = await prisma.xianxiaQuestProgress.findUnique({
        where: {
          character_id_quest_id: {
            character_id: char.id,
            quest_id: quest.requirements.prerequisite_quest_id,
          },
        },
      });
      if (!prereq || prereq.status !== 'COMPLETED') {
        const prereqQuest = this.getQuestById(quest.requirements.prerequisite_quest_id);
        return {
          success: false,
          message: `Cần hoàn thành nhiệm vụ tiền đề: "${prereqQuest ? prereqQuest.title : quest.requirements.prerequisite_quest_id}"`,
        };
      }
    }

    const inventory = await prisma.xianxiaInventoryItem.findMany({
      where: { character_id: char.id },
    });

    // Khởi tạo tiến độ ban đầu
    const objectivesProgress: { [id: string]: number } = {};
    let allMet = true;

    for (const obj of quest.objectives) {
      objectivesProgress[obj.id] = 0;
      if (obj.type === 'DELIVER_ITEM' || obj.type === 'GATHER_ITEM') {
        const item = inventory.find(i => i.item_id === obj.target_id);
        const count = item ? item.quantity : 0;
        objectivesProgress[obj.id] = Math.min(count, obj.required_count);
      }
      if (objectivesProgress[obj.id] < obj.required_count) {
        allMet = false;
      }
    }

    const initialStatus: QuestStatus = allMet ? 'READY_TO_TURN_IN' : 'IN_PROGRESS';
    const progressData = {
      objectives_progress: objectivesProgress,
      accepted_at: Date.now(),
    };

    const saved = await prisma.xianxiaQuestProgress.upsert({
      where: {
        character_id_quest_id: {
          character_id: char.id,
          quest_id: questId,
        },
      },
      create: {
        character_id: char.id,
        quest_id: questId,
        status: initialStatus,
        progress_data: JSON.stringify(progressData),
      },
      update: {
        status: initialStatus,
        progress_data: JSON.stringify(progressData),
      },
    });

    return {
      success: true,
      message: `Đã tiếp nhận nhiệm vụ: ${quest.title}`,
      quest,
      progress: {
        quest_id: questId,
        status: initialStatus,
        objectives_progress: objectivesProgress,
        accepted_at: progressData.accepted_at,
      },
      narrative_lines: quest.dialogue_intro,
    };
  }

  /**
   * Tương tác mục tiêu lưu vào Database (Nói chuyện NPC, giải cứu, thu thập tin tức)
   */
  public async interactObjectiveDb(
    userId: number,
    questId: string,
    actionType: 'TALK_NPC' | 'GATHER_INTEL' | 'TRACK_PERSON' | 'DELIVER_MESSAGE',
    targetId: string
  ): Promise<QuestActionResponse> {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    const char = await xianxiaCharacterService.getOrCreateCharacter(userId);
    const record = await prisma.xianxiaQuestProgress.findUnique({
      where: {
        character_id_quest_id: {
          character_id: char.id,
          quest_id: questId,
        },
      },
    });

    if (!record || record.status !== 'IN_PROGRESS') {
      return { success: false, message: 'Nhiệm vụ chưa được tiếp nhận hoặc đã hoàn tất.' };
    }

    let pData: any = {};
    try {
      if (record.progress_data) pData = JSON.parse(record.progress_data);
    } catch (e) {
      pData = {};
    }
    pData.objectives_progress = pData.objectives_progress || {};

    let updated = false;
    let customNarrative: string[] = [];

    for (const obj of quest.objectives) {
      if (obj.type === actionType && (!obj.target_id || obj.target_id === targetId)) {
        pData.objectives_progress[obj.id] = obj.required_count;
        updated = true;

        if (actionType === 'TALK_NPC') {
          customNarrative = [
            `Ngươi tiến lại gần ${obj.target_name || 'NPC'}, lắng nghe lời chỉ dạy tâm huyết.`,
            `Từng câu chữ khai sáng tâm trí, linh đài thanh tịnh!`,
          ];
        } else if (actionType === 'GATHER_INTEL') {
          customNarrative = [
            `Ngươi chăm chú lắng nghe dị biến tại ${obj.target_name || 'khu vực'}.`,
            `Ghi nhận thành công manh mối huyền bí của Cổ Động!`,
          ];
        } else if (actionType === 'TRACK_PERSON') {
          customNarrative = [
            `Lần theo dấu vết máu và tàn tích, ngươi phát hiện thiếu niên Tán Tu đang ẩn nấp an toàn!`,
            `Đã hộ tống nạn nhân thoát khỏi vòng vây của yêu thú hung hãn.`,
          ];
        } else if (actionType === 'DELIVER_MESSAGE') {
          customNarrative = [
            `Ngươi trao tận tay phong mật thư cho ${obj.target_name || 'người nhận'}.`,
            `Người nhận gật đầu tán thưởng sự nhanh nhẹn và dũng cảm của ngươi!`,
          ];
        }
      }
    }

    if (!updated) {
      return { success: false, message: 'Không tìm thấy mục tiêu tương tác phù hợp.' };
    }

    const allDone = quest.objectives.every(
      obj => (pData.objectives_progress[obj.id] || 0) >= obj.required_count
    );
    const newStatus = allDone ? 'READY_TO_TURN_IN' : 'IN_PROGRESS';

    await prisma.xianxiaQuestProgress.update({
      where: { id: record.id },
      data: {
        status: newStatus,
        progress_data: JSON.stringify(pData),
      },
    });

    return {
      success: true,
      message: 'Hoàn thành mục tiêu!',
      quest,
      progress: {
        quest_id: questId,
        status: newStatus as QuestStatus,
        objectives_progress: pData.objectives_progress,
        accepted_at: pData.accepted_at,
      },
      narrative_lines: customNarrative.length > 0 ? customNarrative : quest.dialogue_in_progress,
    };
  }

  /**
   * Khảo nghiệm dược lý (Quiz) lưu vào Database
   */
  public async submitQuizDb(
    userId: number,
    questId: string,
    objectiveId: string,
    selectedIndex: number
  ): Promise<QuestActionResponse> {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    const char = await xianxiaCharacterService.getOrCreateCharacter(userId);
    const record = await prisma.xianxiaQuestProgress.findUnique({
      where: {
        character_id_quest_id: {
          character_id: char.id,
          quest_id: questId,
        },
      },
    });

    if (!record || record.status !== 'IN_PROGRESS') {
      return { success: false, message: 'Nhiệm vụ chưa được tiếp nhận hoặc đã hoàn tất.' };
    }

    const obj = quest.objectives.find(o => o.id === objectiveId && o.type === 'ANSWER_QUIZ');
    if (!obj) {
      return { success: false, message: 'Không tìm thấy mục tiêu khảo nghiệm trắc nghiệm.' };
    }

    if (selectedIndex !== obj.quiz_correct_index) {
      return {
        success: false,
        message: 'Đáp án chưa chính xác! Lão Dược Sư lắc đầu: "Hãy suy nghĩ kỹ lại về dược điển tu chân."',
        narrative_lines: [
          'Trần Dược Sư thở dài: "Kiến thức đan đạo sai một ly đi một dặm, ăn nhầm độc dược sẽ nổ nát đan điền!"',
          'Hãy đọc kỹ lại câu hỏi và thử lại.',
        ],
      };
    }

    let pData: any = {};
    try {
      if (record.progress_data) pData = JSON.parse(record.progress_data);
    } catch (e) {
      pData = {};
    }
    pData.objectives_progress = pData.objectives_progress || {};
    pData.objectives_progress[obj.id] = 1;
    pData.quiz_completed = true;

    const allDone = quest.objectives.every(
      o => (pData.objectives_progress[o.id] || 0) >= o.required_count
    );
    const newStatus = allDone ? 'READY_TO_TURN_IN' : 'IN_PROGRESS';

    await prisma.xianxiaQuestProgress.update({
      where: { id: record.id },
      data: {
        status: newStatus,
        progress_data: JSON.stringify(pData),
      },
    });

    return {
      success: true,
      message: 'Đáp án hoàn toàn chính xác!',
      quest,
      progress: {
        quest_id: questId,
        status: newStatus as QuestStatus,
        objectives_progress: pData.objectives_progress,
        quiz_completed: true,
        accepted_at: pData.accepted_at,
      },
      narrative_lines: [
        'Trần Dược Sư mỉm cười vuốt râu: "Xuất sắc! Đúng là Trúc Cơ Đan!"',
        'Ngươi đã vượt qua bài khảo nghiệm dược lý một cách thuyết phục.',
      ],
    };
  }

  /**
   * Lựa chọn Đạo Tâm (Narrative Choice) lưu vào Database
   */
  public async submitChoiceDb(
    userId: number,
    questId: string,
    objectiveId: string,
    choiceOptionId: string
  ): Promise<QuestActionResponse> {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    const char = await xianxiaCharacterService.getOrCreateCharacter(userId);
    const record = await prisma.xianxiaQuestProgress.findUnique({
      where: {
        character_id_quest_id: {
          character_id: char.id,
          quest_id: questId,
        },
      },
    });

    if (!record || record.status !== 'IN_PROGRESS') {
      return { success: false, message: 'Nhiệm vụ chưa được tiếp nhận hoặc đã hoàn tất.' };
    }

    const obj = quest.objectives.find(o => o.id === objectiveId && o.type === 'MAKE_CHOICE');
    if (!obj || !obj.choice_options) {
      return { success: false, message: 'Không tìm thấy mục tiêu lựa chọn.' };
    }

    const option = obj.choice_options.find(c => c.id === choiceOptionId);
    if (!option) {
      return { success: false, message: 'Lựa chọn không hợp lệ.' };
    }

    let pData: any = {};
    try {
      if (record.progress_data) pData = JSON.parse(record.progress_data);
    } catch (e) {
      pData = {};
    }
    pData.objectives_progress = pData.objectives_progress || {};
    pData.objectives_progress[obj.id] = 1;
    pData.choice_selected = choiceOptionId;
    pData.choice_data = {
      choiceId: option.id,
      consequence: option.consequence,
      karma_delta: option.karma_delta,
      silver_delta: option.silver_delta,
      cultivation_delta: option.cultivation_delta,
    };

    const allDone = quest.objectives.every(
      o => (pData.objectives_progress[o.id] || 0) >= o.required_count
    );
    const newStatus = allDone ? 'READY_TO_TURN_IN' : 'IN_PROGRESS';

    await prisma.xianxiaQuestProgress.update({
      where: { id: record.id },
      data: {
        status: newStatus,
        progress_data: JSON.stringify(pData),
      },
    });

    return {
      success: true,
      message: 'Đã đưa ra quyết định Đạo Tâm!',
      quest,
      progress: {
        quest_id: questId,
        status: newStatus as QuestStatus,
        objectives_progress: pData.objectives_progress,
        choice_selected: choiceOptionId,
        accepted_at: pData.accepted_at,
      },
      narrative_lines: [
        `Quyết định của đạo hữu: "${option.text}"`,
        option.consequence,
      ],
    };
  }

  /**
   * Nộp nhiệm vụ và nhận thưởng Authoritative lưu vào PostgreSQL trong Transaction
   */
  public async turnInQuestDb(userId: number, questId: string): Promise<QuestActionResponse> {
    const quest = this.getQuestById(questId);
    if (!quest) return { success: false, message: 'Nhiệm vụ không tồn tại.' };

    return await prisma.$transaction(async tx => {
      // Row-level locking to prevent race condition / double turn-in
      await tx.$queryRawUnsafe('SELECT id FROM xianxia_characters WHERE user_id = $1 FOR UPDATE', userId);

      const char = await tx.xianxiaCharacter.findUnique({
        where: { user_id: userId },
      });
      if (!char) throw new Error('Không tìm thấy nhân vật.');

      const record = await tx.xianxiaQuestProgress.findUnique({
        where: {
          character_id_quest_id: {
            character_id: char.id,
            quest_id: questId,
          },
        },
      });

      if (!record) {
        throw new Error('Chưa từng nhận nhiệm vụ này.');
      }
      if (record.status === 'COMPLETED') {
        throw new Error('Nhiệm vụ đã hoàn tất và nhận thưởng từ trước.');
      }

      let pData: any = {};
      try {
        if (record.progress_data) pData = JSON.parse(record.progress_data);
      } catch (e) {
        pData = {};
      }
      const objProgress = pData.objectives_progress || {};

      const inventory = await tx.xianxiaInventoryItem.findMany({
        where: { character_id: char.id },
      });

      // Kiểm tra mục tiêu và trừ vật phẩm nộp
      for (const obj of quest.objectives) {
        if (obj.type === 'DELIVER_ITEM') {
          const invItem = inventory.find(i => i.item_id === obj.target_id);
          const currentCount = invItem ? invItem.quantity : 0;
          if (!invItem || currentCount < obj.required_count) {
            throw new Error(
              `Chưa đủ vật phẩm để giao! Cần ${obj.required_count}x [${obj.target_name || obj.target_id}], hiện có ${currentCount}.`
            );
          }
          objProgress[obj.id] = obj.required_count;

          // Khấu trừ vật phẩm trong kho đồ
          if (invItem.quantity === obj.required_count) {
            await tx.xianxiaInventoryItem.delete({
              where: { id: invItem.id },
            });
          } else {
            await tx.xianxiaInventoryItem.update({
              where: { id: invItem.id },
              data: { quantity: invItem.quantity - obj.required_count },
            });
          }
        } else if (obj.type === 'GATHER_ITEM') {
          const invItem = inventory.find(i => i.item_id === obj.target_id);
          const currentCount = invItem ? invItem.quantity : 0;
          if (currentCount >= obj.required_count) {
            objProgress[obj.id] = obj.required_count;
          }
        }

        const current = objProgress[obj.id] || 0;
        if (current < obj.required_count) {
          throw new Error(`Mục tiêu "${obj.description}" chưa hoàn thành (${current}/${obj.required_count})!`);
        }
      }

      // Đánh dấu hoàn tất trong Database
      await tx.xianxiaQuestProgress.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          completed_at: new Date(),
          progress_data: JSON.stringify({
            ...pData,
            objectives_progress: objProgress,
          }),
        },
      });

      // Tính thưởng (kèm hệ quả lựa chọn đạo tâm nếu có)
      const baseReward = { ...quest.rewards };
      if (pData.choice_data) {
        if (pData.choice_data.karma_delta) {
          baseReward.karma = (baseReward.karma || 0) + pData.choice_data.karma_delta;
        }
        if (pData.choice_data.silver_delta) {
          baseReward.silver = Math.max(0, (baseReward.silver || 0) + pData.choice_data.silver_delta);
        }
        if (pData.choice_data.cultivation_delta) {
          baseReward.cultivation = (baseReward.cultivation || 0) + pData.choice_data.cultivation_delta;
        }
      }

      // Trao EXP (chuẩn Mục 1 & 2)
      if (baseReward.exp && baseReward.exp > 0) {
        xianxiaCharacterService.applyExpGain(char, baseReward.exp);
      }

      // Trao Tu Vi
      if (baseReward.cultivation && baseReward.cultivation > 0) {
        char.cultivation += baseReward.cultivation;
      }

      // Trao Bạc
      if (baseReward.silver && baseReward.silver > 0) {
        char.silver += baseReward.silver;
      }

      // Trao Đạo Đức / Nghiệp Lực
      if (baseReward.karma) {
        char.karma += baseReward.karma;
      }

      // Cập nhật thuộc tính nhân vật
      await tx.xianxiaCharacter.update({
        where: { id: char.id },
        data: {
          level: char.level,
          exp: char.exp,
          exp_required: char.exp_required,
          cultivation: char.cultivation,
          health: char.health,
          max_health: char.max_health,
          fatigue: char.fatigue,
          max_fatigue: char.max_fatigue,
          stat_points: char.stat_points,
          silver: char.silver,
          karma: char.karma,
        },
      });

      // Trao vật phẩm thưởng
      if (Array.isArray(baseReward.items)) {
        for (const it of baseReward.items) {
          const existingSlot = await tx.xianxiaInventoryItem.findUnique({
            where: {
              character_id_item_id: {
                character_id: char.id,
                item_id: it.item_id,
              },
            },
          });
          if (existingSlot) {
            await tx.xianxiaInventoryItem.update({
              where: { id: existingSlot.id },
              data: { quantity: existingSlot.quantity + it.quantity },
            });
          } else {
            await tx.xianxiaInventoryItem.create({
              data: {
                character_id: char.id,
                item_id: it.item_id,
                quantity: it.quantity,
              },
            });
          }
        }
      }

      return {
        success: true,
        message: `Hoàn thành nhiệm vụ "${quest.title}"! Nhận thưởng thành công.`,
        quest,
        progress: {
          quest_id: questId,
          status: 'COMPLETED',
          objectives_progress: objProgress,
          completed_at: Date.now(),
        },
        rewards_claimed: baseReward,
        narrative_lines: quest.dialogue_turnin,
      };
    });
  }

  /**
   * Cập nhật tiến độ diệt quái cho các nhiệm vụ đang nhận trong Database
   */
  public async recordMonsterKillDb(
    characterId: number,
    monsterId: string,
    count: number = 1,
    txInstance?: any
  ): Promise<string[]> {
    const prismaClient = txInstance || prisma;
    const inProgressQuests = await prismaClient.xianxiaQuestProgress.findMany({
      where: {
        character_id: characterId,
        status: 'IN_PROGRESS',
      },
    });

    const updatedQuestIds: string[] = [];

    for (const record of inProgressQuests) {
      const quest = this.getQuestById(record.quest_id);
      if (!quest) continue;

      let pData: any = {};
      try {
        if (record.progress_data) pData = JSON.parse(record.progress_data);
      } catch (e) {
        pData = {};
      }
      pData.objectives_progress = pData.objectives_progress || {};

      let changed = false;
      for (const obj of quest.objectives) {
        if (obj.type === 'KILL_MONSTER' && obj.target_id === monsterId) {
          const current = pData.objectives_progress[obj.id] || 0;
          pData.objectives_progress[obj.id] = Math.min(current + count, obj.required_count);
          changed = true;
        }
      }

      if (changed) {
        updatedQuestIds.push(record.quest_id);
        const allDone = quest.objectives.every(
          o => (pData.objectives_progress[o.id] || 0) >= o.required_count
        );
        const newStatus = allDone ? 'READY_TO_TURN_IN' : 'IN_PROGRESS';

        await prismaClient.xianxiaQuestProgress.update({
          where: { id: record.id },
          data: {
            status: newStatus,
            progress_data: JSON.stringify(pData),
          },
        });
      }
    }

    return updatedQuestIds;
  }

  /**
   * Cập nhật tiến độ nhặt đồ / thu thập cho các nhiệm vụ đang nhận trong Database
   */
  public async recordLootAcquiredDb(
    characterId: number,
    itemId: string,
    quantity: number = 1,
    txInstance?: any
  ): Promise<string[]> {
    const prismaClient = txInstance || prisma;
    const inProgressQuests = await prismaClient.xianxiaQuestProgress.findMany({
      where: {
        character_id: characterId,
        status: 'IN_PROGRESS',
      },
    });

    const updatedQuestIds: string[] = [];

    for (const record of inProgressQuests) {
      const quest = this.getQuestById(record.quest_id);
      if (!quest) continue;

      let pData: any = {};
      try {
        if (record.progress_data) pData = JSON.parse(record.progress_data);
      } catch (e) {
        pData = {};
      }
      pData.objectives_progress = pData.objectives_progress || {};

      let changed = false;
      for (const obj of quest.objectives) {
        if ((obj.type === 'LOOT_DROP' || obj.type === 'GATHER_ITEM') && obj.target_id === itemId) {
          const current = pData.objectives_progress[obj.id] || 0;
          pData.objectives_progress[obj.id] = Math.min(current + quantity, obj.required_count);
          changed = true;
        }
      }

      if (changed) {
        updatedQuestIds.push(record.quest_id);
        const allDone = quest.objectives.every(
          o => (pData.objectives_progress[o.id] || 0) >= o.required_count
        );
        const newStatus = allDone ? 'READY_TO_TURN_IN' : 'IN_PROGRESS';

        await prismaClient.xianxiaQuestProgress.update({
          where: { id: record.id },
          data: {
            status: newStatus,
            progress_data: JSON.stringify(pData),
          },
        });
      }
    }

    return updatedQuestIds;
  }

  /**
   * Reset tiến trình (cho kiểm thử hoặc làm mới)
   */
  public resetPlayerProgress(userId: string): void {
    this.playerProgress.delete(userId);
    this.playerChoices.delete(userId);
  }
}

export const xianxiaQuestService = new XianxiaQuestService();
