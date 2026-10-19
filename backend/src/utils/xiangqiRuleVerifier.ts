/**
 * Xiangqi Rule Verifier (Chuẩn Luật Cờ Tướng Quốc Tế)
 * Kiểm tra tính hợp lệ của nước đi, cản mã/tượng, lộ mặt tướng, chiếu tướng và chiếu bí.
 */

export type Side = 'RED' | 'BLACK';

export interface BoardPos {
  r: number; // 0..9 (0: Đáy Đen, 9: Đáy Đỏ)
  c: number; // 0..8 (0: Cột a, 8: Cột i)
}

export class XiangqiRuleVerifier {
  /**
   * Parse FEN thành ma trận 10x9
   */
  static parseFen(fen: string): (string | null)[][] {
    const board: (string | null)[][] = Array(10).fill(null).map(() => Array(9).fill(null));
    const parts = fen.trim().split(' ');
    const rows = parts[0].split('/');

    for (let r = 0; r < 10; r++) {
      if (!rows[r]) continue;
      let c = 0;
      for (const ch of rows[r]) {
        if (c >= 9) break;
        if (ch >= '1' && ch <= '9') {
          c += parseInt(ch, 10);
        } else {
          board[r][c] = ch;
          c++;
        }
      }
    }
    return board;
  }

  /**
   * Chuyển ma trận 10x9 về chuỗi FEN
   */
  static boardToFen(board: (string | null)[][], turn: Side = 'RED'): string {
    const rows: string[] = [];
    for (let r = 0; r < 10; r++) {
      let empty = 0;
      let rowStr = '';
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) {
            rowStr += empty.toString();
            empty = 0;
          }
          rowStr += p;
        }
      }
      if (empty > 0) rowStr += empty.toString();
      rows.push(rowStr);
    }
    return `${rows.join('/')} ${turn === 'RED' ? 'w' : 'b'} - - 0 1`;
  }

  static uciToPos(uci: string): { from: BoardPos; to: BoardPos } | null {
    if (!uci || uci.length !== 4) return null;
    const fromC = uci.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromR = 9 - parseInt(uci[1], 10);
    const toC = uci.charCodeAt(2) - 'a'.charCodeAt(0);
    const toR = 9 - parseInt(uci[3], 10);

    if (fromR < 0 || fromR > 9 || fromC < 0 || fromC > 8 || toR < 0 || toR > 9 || toC < 0 || toC > 8) {
      return null;
    }
    return { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
  }

  static posToUci(from: BoardPos, to: BoardPos): string {
    const f1 = String.fromCharCode('a'.charCodeAt(0) + from.c);
    const r1 = 9 - from.r;
    const f2 = String.fromCharCode('a'.charCodeAt(0) + to.c);
    const r2 = 9 - to.r;
    return `${f1}${r1}${f2}${r2}`;
  }

  static isRed(piece: string): boolean {
    return piece >= 'A' && piece <= 'Z';
  }

  static isBlack(piece: string): boolean {
    return piece >= 'a' && piece <= 'z';
  }

  static isPalace(r: number, c: number, side: Side): boolean {
    if (c < 3 || c > 5) return false;
    return side === 'RED' ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
  }

  static findKing(board: (string | null)[][], side: Side): BoardPos | null {
    const target = side === 'RED' ? 'K' : 'k';
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === target) return { r, c };
      }
    }
    return null;
  }

  /**
   * Kiểm tra luật Lộ Mặt Tướng (Flying General)
   */
  static isFlyingGeneral(board: (string | null)[][]): boolean {
    const redK = this.findKing(board, 'RED');
    const blackK = this.findKing(board, 'BLACK');
    if (!redK || !blackK) return false;
    if (redK.c !== blackK.c) return false;

    // Cùng cột: đếm số quân nằm giữa 2 tướng
    const minR = Math.min(redK.r, blackK.r);
    const maxR = Math.max(redK.r, blackK.r);
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][redK.c] !== null) return false;
    }
    return true; // Không có quân cản -> Lộ mặt tướng!
  }

  /**
   * Đếm số quân nằm giữa hai vị trí trên cùng hàng hoặc cùng cột
   */
  static countIntervening(board: (string | null)[][], r1: number, c1: number, r2: number, c2: number): number {
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let count = 0;
    let r = r1 + dr;
    let c = c1 + dc;
    while (r !== r2 || c !== c2) {
      if (board[r][c] !== null) count++;
      r += dr;
      c += dc;
    }
    return count;
  }

  /**
   * Kiểm tra nước đi cơ bản (Pseudo-legal move)
   */
  static isPseudoLegal(board: (string | null)[][], from: BoardPos, to: BoardPos, side: Side): { valid: boolean; reason?: string } {
    const piece = board[from.r][from.c];
    if (!piece) return { valid: false, reason: 'Không có quân ở ô xuất phát' };

    const pieceSide: Side = this.isRed(piece) ? 'RED' : 'BLACK';
    if (pieceSide !== side) return { valid: false, reason: 'Không phải quân của phe đi' };

    const target = board[to.r][to.c];
    if (target) {
      const targetSide: Side = this.isRed(target) ? 'RED' : 'BLACK';
      if (targetSide === side) return { valid: false, reason: 'Không thể ăn quân cùng phe' };
    }

    const dr = to.r - from.r;
    const dc = to.c - from.c;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);
    const type = piece.toLowerCase();

    switch (type) {
      case 'k': { // Tướng
        if ((absDr === 1 && absDc === 0) || (absDr === 0 && absDc === 1)) {
          if (!this.isPalace(to.r, to.c, side)) return { valid: false, reason: 'Tướng không được ra khỏi Cung' };
          return { valid: true };
        }
        return { valid: false, reason: 'Tướng chỉ đi 1 ô ngang hoặc dọc trong Cung' };
      }

      case 'a': { // Sĩ
        if (absDr === 1 && absDc === 1) {
          if (!this.isPalace(to.r, to.c, side)) return { valid: false, reason: 'Sĩ không được ra khỏi Cung' };
          return { valid: true };
        }
        return { valid: false, reason: 'Sĩ chỉ được đi chéo 1 ô trong Cung' };
      }

      case 'b': { // Tượng
        if (absDr === 2 && absDc === 2) {
          // Không được qua sông
          const isAcross = side === 'RED' ? to.r < 5 : to.r > 4;
          if (isAcross) return { valid: false, reason: 'Tượng không được qua sông' };

          // Kiểm tra mắt tượng
          const eyeR = from.r + dr / 2;
          const eyeC = from.c + dc / 2;
          if (board[eyeR][eyeC] !== null) return { valid: false, reason: 'Mắt tượng bị cản' };
          return { valid: true };
        }
        return { valid: false, reason: 'Tượng phải đi chéo đúng 2 ô' };
      }

      case 'n': { // Mã
        if (absDr * absDc === 2) {
          // Kiểm tra cản chân mã
          const legR = absDr === 2 ? from.r + dr / 2 : from.r;
          const legC = absDc === 2 ? from.c + dc / 2 : from.c;
          if (board[legR][legC] !== null) return { valid: false, reason: 'Chân mã bị cản' };
          return { valid: true };
        }
        return { valid: false, reason: 'Nước đi không phải đường đi của Mã' };
      }

      case 'r': { // Xe
        if (dr === 0 || dc === 0) {
          if (this.countIntervening(board, from.r, from.c, to.r, to.c) === 0) return { valid: true };
          return { valid: false, reason: 'Xe bị cản quân trên đường đi' };
        }
        return { valid: false, reason: 'Xe chỉ được đi thẳng ngang hoặc dọc' };
      }

      case 'c': { // Pháo
        if (dr === 0 || dc === 0) {
          const count = this.countIntervening(board, from.r, from.c, to.r, to.c);
          if (target) {
            if (count === 1) return { valid: true };
            return { valid: false, reason: 'Pháo ăn quân phải có đúng 1 quân làm ngòi' };
          } else {
            if (count === 0) return { valid: true };
            return { valid: false, reason: 'Pháo đi không ăn quân đường đi phải thông thoáng' };
          }
        }
        return { valid: false, reason: 'Pháo chỉ được đi thẳng ngang hoặc dọc' };
      }

      case 'p': { // Tốt / Binh
        const forward = side === 'RED' ? -1 : 1;
        if (dr === forward && dc === 0) return { valid: true };
        const crossedRiver = side === 'RED' ? from.r <= 4 : from.r >= 5;
        if (crossedRiver && dr === 0 && absDc === 1) return { valid: true };
        return { valid: false, reason: 'Tốt chỉ đi tiến 1 ô, qua sông mới được đi ngang' };
      }

      default:
        return { valid: false, reason: 'Loại quân cờ không xác định' };
    }
  }

  /**
   * Kiểm tra xem tướng của `side` có đang bị chiếu hay không
   */
  static isKingInCheck(board: (string | null)[][], side: Side): boolean {
    const kingPos = this.findKing(board, side);
    if (!kingPos) return true; // Mất tướng coi như bị chiếu bí

    // Kiểm tra Lộ mặt tướng
    if (this.isFlyingGeneral(board)) return true;

    const opponentSide: Side = side === 'RED' ? 'BLACK' : 'RED';

    // Quét toàn bộ quân đối phương xem có quân nào có nước đi hợp lệ bắt được Tướng không
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (!piece) continue;
        const pSide = this.isRed(piece) ? 'RED' : 'BLACK';
        if (pSide === opponentSide) {
          const check = this.isPseudoLegal(board, { r, c }, kingPos, opponentSide);
          if (check.valid) return true;
        }
      }
    }
    return false;
  }

  /**
   * Kiểm tra nước đi hợp lệ hoàn toàn (Fully Legal Move):
   * 1. Phải thỏa mãn quy tắc di chuyển quân.
   * 2. Sau khi đi, Tướng của chính mình KHÔNG ĐƯỢC bị chiếu.
   */
  static isLegalMove(board: (string | null)[][], from: BoardPos, to: BoardPos, side: Side): { valid: boolean; reason?: string } {
    const pseudo = this.isPseudoLegal(board, from, to, side);
    if (!pseudo.valid) return pseudo;

    // Giả lập nước đi trên bản sao bàn cờ
    const cloneBoard = board.map(row => [...row]);
    const piece = cloneBoard[from.r][from.c];
    cloneBoard[from.r][from.c] = null;
    cloneBoard[to.r][to.c] = piece;

    // Kiểm tra an toàn của Tướng phe mình
    if (this.isKingInCheck(cloneBoard, side)) {
      return { valid: false, reason: 'Nước đi phạm luật: Tướng phe mình bị chiếu hoặc tự lao vào chiếu' };
    }

    return { valid: true };
  }

  /**
   * Lấy toàn bộ nước đi hợp lệ (legal moves) của một phe
   */
  static getAllLegalMoves(board: (string | null)[][], side: Side): { from: BoardPos; to: BoardPos; uci: string }[] {
    const moves: { from: BoardPos; to: BoardPos; uci: string }[] = [];

    for (let r1 = 0; r1 < 10; r1++) {
      for (let c1 = 0; c1 < 9; c1++) {
        const p = board[r1][c1];
        if (!p) continue;
        const pSide = this.isRed(p) ? 'RED' : 'BLACK';
        if (pSide !== side) continue;

        const from = { r: r1, c: c1 };
        for (let r2 = 0; r2 < 10; r2++) {
          for (let c2 = 0; c2 < 9; c2++) {
            const to = { r: r2, c: c2 };
            const check = this.isLegalMove(board, from, to, side);
            if (check.valid) {
              moves.push({ from, to, uci: this.posToUci(from, to) });
            }
          }
        }
      }
    }
    return moves;
  }

  /**
   * Kiểm tra xem phe `side` có bị chiếu bí (Checkmate) hay không:
   * Đang bị chiếu VÀ có 0 nước đi hợp lệ để thoát chiếu.
   */
  static isCheckmate(board: (string | null)[][], side: Side): boolean {
    if (!this.isKingInCheck(board, side)) return false;
    const legalMoves = this.getAllLegalMoves(board, side);
    return legalMoves.length === 0;
  }

  /**
   * Thực hiện nước đi và trả về bàn cờ mới
   */
  static applyMove(board: (string | null)[][], from: BoardPos, to: BoardPos): (string | null)[][] {
    const clone = board.map(row => [...row]);
    const piece = clone[from.r][from.c];
    clone[from.r][from.c] = null;
    clone[to.r][to.c] = piece;
    return clone;
  }
}
