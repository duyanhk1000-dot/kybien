/**
 * Đặc tả kiểu dữ liệu cho Hệ thống Thế giới Tu Tiên (Xianxia World Hierarchy & Places)
 * Dự án: Tiên Lộ: Vạn Giới Tranh Phong (Hệ Thống Độc Lập)
 */

export type RealmTier = 
  | 'PHAM_NHAN'     // Phàm Nhân
  | 'LUYEN_KHI_1'   // Luyện Khí Tầng 1
  | 'LUYEN_KHI_2'   // Luyện Khí Tầng 2
  | 'LUYEN_KHI_3'   // Luyện Khí Tầng 3
  | 'LUYEN_KHI_4'   // Luyện Khí Tầng 4
  | 'LUYEN_KHI_5'   // Luyện Khí Tầng 5
  | 'LUYEN_KHI_6'   // Luyện Khí Tầng 6
  | 'LUYEN_KHI_7'   // Luyện Khí Tầng 7
  | 'LUYEN_KHI_8'   // Luyện Khí Tầng 8
  | 'LUYEN_KHI_9'   // Luyện Khí Tầng 9
  | 'TRUC_CO_SO_KY' // Trúc Cơ Sơ Kỳ
  | 'TRUC_CO_TRUNG_KY' // Trúc Cơ Trung Kỳ
  | 'TRUC_CO_HAU_KY'   // Trúc Cơ Hậu Kỳ
  | 'TRUC_CO_DINH_PHONG' // Trúc Cơ Đỉnh Phong
  | 'KIM_DAN_SO_KY';    // Kim Đan Sơ Kỳ (Chân Nhân)

export type ZoneType = 'TOWN' | 'WILDERNESS' | 'DANGER_ZONE' | 'SECT_EXTERIOR';

export type PlaceKind = 
  | 'CULTIVATION_CAVE' // Động Phủ Tu Luyện
  | 'APOTHECARY'        // Hiệu Thuốc / Đan Phường
  | 'FORGE'             // Lò Rèn / Luyện Khí Viện
  | 'MISSION_BOARD'     // Bảng Nhiệm Vụ Thôn / Tông Môn
  | 'STORAGE'           // Kho Phường Tiên Gia
  | 'REST_SPRING'       // Suối Linh Tuyền Hồi Sức
  | 'RUINS'             // Di Tích / Miếu Hoang
  | 'MYSTIC_CAVE';      // Cổ Động Bí Cảnh

export interface PlaceService {
  key: string;
  name: string;
  description: string;
}

export interface Place {
  id: string;
  zone_id: string;
  name: string;
  kind: PlaceKind;
  description: string;
  services: PlaceService[];
  bg_banner?: string;
}

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  description: string;
  min_realm: RealmTier;
  fatigue_cost_roam: number;
  travel_fatigue_base: number;
  connected_zones: string[];
  banner_image: string;
  places: Place[];
}

export interface TravelValidationResult {
  valid: boolean;
  reason?: string;
  fatigueCost: number;
  fromZone?: Zone;
  toZone?: Zone;
}

// ==========================================
// ĐẶC TẢ HỆ THỐNG NPC & DÂN CƯ (BƯỚC 3)
// ==========================================

export type NpcRole = 
  | 'VILLAGE_HEAD'  // Trưởng thôn / Lãnh đạo
  | 'APOTHECARY'    // Dược sư
  | 'BLACKSMITH'    // Thợ rèn
  | 'WANDERER'      // Lữ nhân / Hiệp khách giang hồ
  | 'HERMIT'        // Ẩn sĩ cao nhân
  | 'MERCHANT'      // Thương nhân
  | 'SECT_ELDER';   // Trưởng lão môn phái / Tiên tông cao tầng

export interface NpcDialogue {
  greeting: string;
  idle: string[];
  quest_hint?: string;
}

export interface Npc {
  id: string;
  name: string;
  title: string;
  zone_id: string;
  place_id: string;
  role: NpcRole;
  description: string;
  avatar_image: string;
  dialogues: NpcDialogue;
  related_services: string[];
}

// ==========================================
// ĐẶC TẢ DANH LỤC YÊU THÚ & RƠI ĐỒ (BESTIARY)
// ==========================================

export type MonsterTier = 'TIER_1_BEAST' | 'TIER_2_ELITE' | 'TIER_3_BOSS';

export interface MonsterSkill {
  id: string;
  name: string;
  description: string;
  damage_multiplier: number;
  effect?: 'BLEED' | 'STUN' | 'ENRAGE' | 'POISON';
  effect_chance?: number;
}

export interface LootDrop {
  item_id: string;
  item_name: string;
  chance: number;       // 0.0 -> 1.0 (ví dụ 0.4 = 40%)
  min_quantity: number;
  max_quantity: number;
}

export interface Monster {
  id: string;
  name: string;
  title: string;
  tier: MonsterTier;
  zone_id: string;
  realm_requirement: RealmTier;
  max_health: number;
  attack: number;
  defense: number;
  speed: number;         // Thân pháp / Initiative
  crit_rate: number;     // Tỷ lệ bạo kích (0.0 -> 1.0)
  dodge_rate: number;    // Tỷ lệ né đòn (0.0 -> 1.0)
  exp_reward: number;
  cultivation_reward: number;
  silver_reward_min: number;
  silver_reward_max: number;
  avatar_image: string;
  skills: MonsterSkill[];
  loot_table: LootDrop[];
}

export interface DroppedItem {
  item_id: string;
  item_name: string;
  quantity: number;
}

export interface RollLootResult {
  monster_id: string;
  monster_name: string;
  exp_gained: number;
  cultivation_gained: number;
  silver_gained: number;
  dropped_items: DroppedItem[];
}

// ==========================================
// ĐẶC TẢ MA TRẬN KỲ NGỘ & THÁM HIỂM (BƯỚC 4)
// ==========================================

export type XianxiaEventType = 
  | 'FORTUNE'         // Kỳ ngộ phúc duyên (linh dược, động phủ, cơ duyên)
  | 'MISFORTUNE'       // Hiểm cảnh tai kiếp (yêu thú phục kích, cạm bẫy, tà tu)
  | 'MORAL_DILEMMA'   // Tâm ma / Thử thách thiện ác nhân quả
  | 'MYSTERY';        // Bí cảnh cổ xưa / Trận đồ tàn tích

export type EventRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';

export interface PlayerExplorationStats {
  realm: RealmTier;
  health: number;
  max_health: number;
  fatigue: number;
  max_fatigue: number;
  physique: number;       // Thể chất / Căn cốt
  comprehension: number;  // Ngộ tính
  luck: number;           // Cơ duyên / Khí vận
  karma: number;          // Đạo tâm / Thiện ác (-100 đến +100)
  silver: number;         // Ngân lượng mang theo
  inventory_items?: string[]; // Danh sách ID vật phẩm người chơi sở hữu
}

export interface EventRequirement {
  min_realm?: RealmTier;
  min_physique?: number;
  min_comprehension?: number;
  min_luck?: number;
  min_karma?: number;
  max_karma?: number;
  cost_fatigue?: number;
  cost_silver?: number;
  required_item?: string;
}

export interface EventOutcomeDetail {
  narrative: string;
  exp_reward?: number;
  cultivation_reward?: number;
  silver_reward?: number;
  dropped_items?: DroppedItem[];
  health_change?: number;    // Âm là mất máu, dương là hồi phục
  fatigue_change?: number;   // Âm là tốn thể lực
  karma_change?: number;     // Thay đổi đạo tâm / thiện ác
}

export interface EventChoice {
  id: string;
  text: string;
  description: string;
  requirements?: EventRequirement;
  stat_check?: {
    stat: 'comprehension' | 'physique' | 'luck';
    threshold: number;
  };
  outcome_success: EventOutcomeDetail;
  outcome_failure?: EventOutcomeDetail;
}

export interface XianxiaEvent {
  id: string;
  title: string;
  zone_id: string;          // ID phân khu hoặc 'ALL'
  type: XianxiaEventType;
  rarity: EventRarity;
  weight: number;           // Trọng số xác suất xuất hiện (1 - 100)
  description: string;
  banner_image?: string;
  choices: EventChoice[];
}

export interface ResolveChoiceResult {
  event_id: string;
  choice_id: string;
  success: boolean;
  narrative: string;
  stat_check?: {
    stat: string;
    player_value: number;
    threshold: number;
    passed: boolean;
  };
  effects: {
    exp_gained: number;
    cultivation_gained: number;
    silver_change: number;
    health_change: number;
    fatigue_change: number;
    karma_change: number;
    items_gained: DroppedItem[];
  };
}

// ==========================================
// ĐẶC TẢ THU THẬP & CHẾ TÁC TIÊN MÔN (BƯỚC 5)
// ==========================================

export type ItemType = 
  | 'HERB'        // Thảo dược, Linh thảo
  | 'ORE'         // Khoáng thạch, Kim loại linh tinh
  | 'MATERIAL'    // Linh tài yêu thú (Lang bì, Nanh sói, Yêu đan)
  | 'PILL'        // Đan dược thành phẩm
  | 'EQUIPMENT'   // Binh khí, Pháp bảo, Hộ giáp
  | 'MISC';       // Phế đan, xỉ khoáng, vật phẩm linh tinh

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  rarity: EventRarity;
  description: string;
  icon: string;
  stackable: boolean;
  buy_price?: number;
  sell_price: number;
  effects?: {
    health_restore?: number;
    fatigue_restore?: number;
    cultivation_boost?: number;
    exp_boost?: number;
  };
  equipment_stats?: {
    attack?: number;
    defense?: number;
    speed?: number;
    crit_rate?: number;
    realm_requirement?: RealmTier;
  };
}

export type GatheringNodeType = 'HERB_PATCH' | 'ORE_VEIN' | 'SPIRIT_SPRING';

export interface GatheringNode {
  id: string;
  name: string;
  zone_id: string;
  place_id?: string;
  type: GatheringNodeType;
  min_realm: RealmTier;
  fatigue_cost: number;
  success_rate: number; // 0.0 -> 1.0 (ví dụ 0.85 = 85%)
  description: string;
  drops: {
    item_id: string;
    item_name: string;
    chance: number;
    min_qty: number;
    max_qty: number;
  }[];
}

export interface PlayerInventorySlot {
  item_id: string;
  quantity: number;
}

export interface PlayerCraftingContext {
  realm: RealmTier;
  fatigue: number;
  silver: number;
  comprehension?: number;
  luck?: number;
  inventory: PlayerInventorySlot[];
}

export interface GatheringResult {
  node_id: string;
  node_name: string;
  success: boolean;
  fatigue_spent: number;
  cultivation_gained: number;
  items_gathered: DroppedItem[];
  narrative: string;
}

export type CraftingDiscipline = 'ALCHEMY' | 'BLACKSMITHING';

export interface CraftingRecipe {
  id: string;
  name: string;
  discipline: CraftingDiscipline;
  min_realm: RealmTier;
  fatigue_cost: number;
  silver_cost: number;
  base_success_rate: number; // 0.0 -> 1.0
  description: string;
  required_materials: {
    item_id: string;
    item_name: string;
    quantity: number;
  }[];
  result_success: {
    item_id: string;
    item_name: string;
    quantity: number;
    cultivation_gained: number;
    exp_gained: number;
  };
  result_failure?: {
    item_id?: string;
    item_name?: string;
    quantity?: number;
    narrative: string;
  };
}

export interface CraftingResult {
  recipe_id: string;
  recipe_name: string;
  discipline: CraftingDiscipline;
  success: boolean;
  fatigue_spent: number;
  silver_spent: number;
  materials_consumed: { item_id: string; quantity: number }[];
  item_produced?: DroppedItem;
  cultivation_gained: number;
  exp_gained: number;
  narrative: string;
}// ==========================================
// ĐẶC TẢ HỆ THỐNG NHIỆM VỤ TU TIÊN (QUEST SYSTEM)
// ==========================================

export type QuestType = 'MAIN_STORY' | 'SIDE_QUEST' | 'SIDE_GRIND' | 'BOUNTY' | 'ESCORT';

export type QuestObjectiveType =
  | 'KILL_MONSTER'      // Trảm yêu
  | 'TALK_NPC'          // Gặp NPC đàm đạo dẫn dắt thế giới
  | 'DELIVER_ITEM'      // Giao đồ cho NPC
  | 'GATHER_ITEM'       // Tìm đồ / thu thập linh thảo
  | 'LOOT_DROP'         // Đánh quái rơi vật phẩm hiếm
  | 'GATHER_INTEL'      // Nghe ngóng tin tức / dị tượng
  | 'DELIVER_MESSAGE'   // Đưa tin / chuyển thư mật
  | 'TRACK_PERSON'      // Truy tìm người mất tích
  | 'ANSWER_QUIZ'       // Trả lời câu hỏi khảo nghiệm
  | 'MAKE_CHOICE';      // Đưa ra quyết định đạo tâm

export type QuestStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'READY_TO_TURN_IN' | 'COMPLETED';

export interface QuestQuizOption {
  id: string;
  text: string;
}

export interface QuestChoiceOption {
  id: string;
  text: string;
  consequence: string;
  karma_delta?: number;
  silver_delta?: number;
  cultivation_delta?: number;
}

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  target_id?: string; // ID của quái, npc, vật phẩm hoặc địa điểm
  target_name?: string;
  required_count: number;
  current_count?: number;
  quiz_question?: string;
  quiz_options?: QuestQuizOption[];
  quiz_correct_index?: number;
  choice_prompt?: string;
  choice_options?: QuestChoiceOption[];
}

export interface QuestReward {
  exp: number;
  cultivation: number;
  silver: number;
  items?: DroppedItem[];
  karma?: number;
  title?: string;
  unlock_note?: string;
}

export interface QuestRequirements {
  min_realm?: RealmTier;
  min_level?: number;
  prerequisite_quest_id?: string;
}

export interface Quest {
  id: string;
  title: string;
  type: QuestType;
  category: 'CHINH_TUYEN' | 'THINH_CAU' | 'CAY_CUOC' | 'DUYEN_PHAN';
  giver_npc_id: string;
  giver_npc_name: string;
  turnin_npc_id: string;
  turnin_npc_name: string;
  summary: string;
  dialogue_intro: string[];
  dialogue_in_progress: string[];
  dialogue_turnin: string[];
  requirements: QuestRequirements;
  objectives: QuestObjective[];
  rewards: QuestReward;
}

export interface PlayerQuestProgress {
  quest_id: string;
  status: QuestStatus;
  objectives_progress: { [objective_id: string]: number };
  quiz_completed?: boolean;
  choice_selected?: string;
  accepted_at?: number;
  completed_at?: number;
}

export interface QuestActionResponse {
  success: boolean;
  message: string;
  quest?: Quest;
  progress?: PlayerQuestProgress;
  rewards_claimed?: QuestReward;
  narrative_lines?: string[];
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  name: string;
  realm: string;
  realmTitle: string;
  level: number;
  cultivation: number;
  combatPower: number;
  maxHealth: number;
  physique: number;
  comprehension: number;
  createdAt: string;
}

export interface LeaderboardPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardEntry[];
  pagination: LeaderboardPagination;
  myRank: number | null;
  serverTime: string;
  executionTimeMs?: number;
}

// ==========================================
// ĐẶC TẢ ĐẤU TRƯỜNG THIÊN KIÊU (M4.2 ASYNC PVP)
// ==========================================

export interface DefenderSnapshot {
  characterId: number;
  name: string;
  realm: string;
  realmTitle: string;
  level: number;
  combatPower: number;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  critRate: number;
  dodgeRate: number;
  maxQi: number;
  equippedWeapon: string | null;
  equippedArmor: string | null;
  equippedRelic: string | null;
  snapshotTime: string;
  rulesVersion: string;
}

export interface PvpOpponent {
  id: number;
  name: string;
  realm: string;
  realmTitle: string;
  level: number;
  reputation: number;
  combatPower: number;
  maxHealth: number;
  pvpWins: number;
  pvpLosses: number;
  pvpDraws: number;
}

export interface PvpPlaybackTurn {
  turn: number;
  actor: 'ATTACKER' | 'DEFENDER';
  action: string;
  damage: number;
  isCrit: boolean;
  isDodge: boolean;
  attackerHp: number;
  defenderHp: number;
  attackerQi: number;
  defenderQi: number;
  log: string;
}

export interface PvpChallengeResult {
  matchId: string;
  idempotent: boolean;
  result: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'DRAW_ADVANTAGE' | 'DRAW_TIMEOUT';
  turnsCount: number;
  reputationChange: number;
  attackerReputationAfter: number;
  silverReward: number;
  dailyMatchesWithOpponent: number;
  cappedRewardReason?: string;
  defender: {
    id: number;
    name: string;
    realmTitle: string;
    level: number;
    combatPower: number;
  };
  attackerStateAfterBattle: {
    health: number;
    maxHealth: number;
    fatigue: number;
    maxFatigue: number;
    silver: number;
    reputation: number;
    pvpWins: number;
    pvpLosses: number;
    pvpDraws: number;
  };
  combatLogs: string[];
  playbackTurns: PvpPlaybackTurn[];
}

export interface PvpHistoryItem {
  id: string;
  role: 'ATTACKER' | 'DEFENDER';
  opponentName: string;
  opponentRealmTitle: string;
  opponentLevel: number;
  result: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'DRAW_ADVANTAGE' | 'DRAW_TIMEOUT';
  isVictory: boolean;
  reputationChange: number;
  silverReward: number;
  turnsCount: number;
  createdAt: string;
}

export interface PvpLeaderboardEntry {
  rank: number;
  characterId: number;
  name: string;
  realm: string;
  realmTitle: string;
  level: number;
  reputation: number;
  combatPower: number;
  pvpWins: number;
  pvpLosses: number;
  pvpDraws: number;
}

