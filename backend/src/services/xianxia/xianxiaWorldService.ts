import fs from 'fs';
import path from 'path';
import { Zone, Place, RealmTier, TravelValidationResult } from '../../types/xianxia.js';

// Bảng cấp bậc cảnh giới để so sánh điều kiện vào phân khu
export const REALM_HIERARCHY: Record<RealmTier, number> = {
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

export class XianxiaWorldService {
  private zones: Map<string, Zone> = new Map();
  private places: Map<string, Place> = new Map();

  constructor() {
    this.loadWorldData();
  }

  /**
   * Tải dữ liệu các Vùng và Địa điểm từ JSON vào bộ nhớ đệm
   */
  public loadWorldData(): void {
    try {
      // Tìm file worldData.json trong thư mục data/xianxia
      const candidates = [
        path.resolve(__dirname, '../../data/xianxia/worldData.json'),
        path.resolve(__dirname, '../../../src/data/xianxia/worldData.json'),
        path.resolve(process.cwd(), 'src/data/xianxia/worldData.json'),
        path.resolve(process.cwd(), 'dist/data/xianxia/worldData.json'),
        path.resolve(process.cwd(), 'backend/src/data/xianxia/worldData.json'),
      ];

      const dataPath = candidates.find(p => fs.existsSync(p));
      if (!dataPath) {
        throw new Error(`Không tìm thấy file dữ liệu thế giới worldData.json tại các đường dẫn thử nghiệm.`);
      }

      const raw = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(raw) as { zones: Zone[] };

      this.zones.clear();
      this.places.clear();

      for (const zone of parsed.zones) {
        this.zones.set(zone.id, zone);
        for (const place of zone.places) {
          this.places.set(place.id, place);
        }
      }
    } catch (err: any) {
      console.error('[XianxiaWorldService] Lỗi khi tải dữ liệu thế giới:', err?.message || err);
      throw err;
    }
  }

  /**
   * Lấy danh sách toàn bộ các Vùng trong thế giới
   */
  public getAllZones(): Zone[] {
    return Array.from(this.zones.values());
  }

  /**
   * Lấy chi tiết thông tin một Vùng theo ID
   */
  public getZoneById(zoneId: string): Zone | null {
    return this.zones.get(zoneId) || null;
  }

  /**
   * Lấy danh sách tất cả Địa điểm nằm trong một Vùng
   */
  public getPlacesByZoneId(zoneId: string): Place[] {
    const zone = this.getZoneById(zoneId);
    return zone ? zone.places : [];
  }

  /**
   * Lấy chi tiết một Địa điểm chức năng theo ID
   */
  public getPlaceById(placeId: string): Place | null {
    return this.places.get(placeId) || null;
  }

  /**
   * So sánh hai cảnh giới tu tiên
   * Trả về số dương nếu r1 > r2, 0 nếu bằng nhau, số âm nếu r1 < r2
   */
  public compareRealms(r1: RealmTier, r2: RealmTier): number {
    const level1 = REALM_HIERARCHY[r1] ?? -1;
    const level2 = REALM_HIERARCHY[r2] ?? -1;
    return level1 - level2;
  }

  /**
   * Kiểm tra xem nhân vật có đủ cảnh giới để tiến nhập Vùng đất không
   */
  public canEnterZone(playerRealm: RealmTier, zone: Zone): boolean {
    return this.compareRealms(playerRealm, zone.min_realm) >= 0;
  }

  /**
   * Xác thực và tính toán chi phí khi di chuyển liên vùng (Travel)
   */
  public validateTravel(
    fromZoneId: string,
    toZoneId: string,
    playerRealm: RealmTier
  ): TravelValidationResult {
    const fromZone = this.getZoneById(fromZoneId);
    if (!fromZone) {
      return { valid: false, reason: `Vùng xuất phát '${fromZoneId}' không tồn tại.`, fatigueCost: 0 };
    }

    const toZone = this.getZoneById(toZoneId);
    if (!toZone) {
      return { valid: false, reason: `Vùng đích '${toZoneId}' không tồn tại.`, fatigueCost: 0 };
    }

    if (fromZoneId === toZoneId) {
      return { valid: false, reason: 'Bạn đang ở ngay phân khu này.', fatigueCost: 0 };
    }

    // Kiểm tra hai vùng có nối liền với nhau không
    if (!fromZone.connected_zones.includes(toZoneId)) {
      return {
        valid: false,
        reason: `Không có lộ trình trực tiếp từ '${fromZone.name}' đến '${toZone.name}'.`,
        fatigueCost: 0,
        fromZone,
        toZone,
      };
    }

    // Kiểm tra điều kiện Cảnh giới tối thiểu của vùng đích
    if (!this.canEnterZone(playerRealm, toZone)) {
      return {
        valid: false,
        reason: `Cảnh giới của bạn chưa đủ để vào '${toZone.name}'. Yêu cầu tối thiểu: ${toZone.min_realm}.`,
        fatigueCost: 0,
        fromZone,
        toZone,
      };
    }

    // Tính toán tiêu hao thể lực (Fatigue Cost)
    const fatigueCost = toZone.travel_fatigue_base;

    return {
      valid: true,
      fatigueCost,
      fromZone,
      toZone,
    };
  }

  /**
   * Lấy bản đồ mạng lưới giao thông liên vùng (Travel Graph)
   */
  public getTravelNetwork(): Array<{ from: string; to: string; cost: number; minRealm: RealmTier }> {
    const routes: Array<{ from: string; to: string; cost: number; minRealm: RealmTier }> = [];
    for (const zone of this.getAllZones()) {
      for (const targetId of zone.connected_zones) {
        const targetZone = this.getZoneById(targetId);
        if (targetZone) {
          routes.push({
            from: zone.id,
            to: targetZone.id,
            cost: targetZone.travel_fatigue_base,
            minRealm: targetZone.min_realm,
          });
        }
      }
    }
    return routes;
  }
}

// Khởi tạo Singleton instance
export const xianxiaWorldService = new XianxiaWorldService();
