export interface OnlineStats {
  total: number;
  members: number;
  guests: number;
}

class OnlineTracker {
  // Map of userId -> Set of socketId (chống trùng lặp khi 1 người mở nhiều tab)
  private userSockets: Map<number, Set<string>> = new Map();
  // Set of socketId của lữ khách
  private guestSockets: Set<string> = new Set();
  // Map tra cứu nhanh: socketId -> userId (nếu đã đăng nhập)
  private socketToUser: Map<string, number> = new Map();

  /**
   * Thêm kết nối của Kỳ thủ đã xác thực (Member)
   */
  public addMember(userId: number, socketId: string): void {
    // Nếu socket này từng là khách vãng lai, chuyển đổi sang nhóm Kỳ thủ
    this.guestSockets.delete(socketId);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
    this.socketToUser.set(socketId, userId);
  }

  /**
   * Thêm kết nối của Lữ khách (Guest)
   */
  public addGuest(socketId: string): void {
    // Chỉ thêm nếu socket này chưa thuộc về kỳ thủ đã đăng nhập
    if (!this.socketToUser.has(socketId)) {
      this.guestSockets.add(socketId);
    }
  }

  /**
   * Xóa kết nối khi socket ngắt kết nối (Disconnect)
   */
  public removeSocket(socketId: string): void {
    this.guestSockets.delete(socketId);

    const userId = this.socketToUser.get(socketId);
    if (userId !== undefined) {
      this.socketToUser.delete(socketId);
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socketId);
        // Khi tất cả các tab của user này đã đóng thì xóa user khỏi danh sách online
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
  }

  /**
   * Lấy thống kê số người trực tuyến hiện tại
   */
  public getStats(): OnlineStats {
    const members = this.userSockets.size;
    const guests = this.guestSockets.size;
    return {
      total: members + guests,
      members,
      guests,
    };
  }

  /**
   * Xóa toàn bộ dữ liệu (dùng trong test)
   */
  public reset(): void {
    this.userSockets.clear();
    this.guestSockets.clear();
    this.socketToUser.clear();
  }
}

export const onlineTracker = new OnlineTracker();
