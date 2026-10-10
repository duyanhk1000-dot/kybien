export type PieceColor = 'r' | 'b';
export type PieceType = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p' | '?';

export interface Piece {
  type: PieceType;
  color: PieceColor;
  isFaceDown: boolean;
  realType?: PieceType;
  realColor?: PieceColor;
  spells?: Record<string, boolean>;
}

export type BoardState = Array<Array<Piece | null>>;

export interface Move {
  from: { r: number; c: number };
  to: { r: number; c: number };
  rawStr?: string;
  actionType?: 'MOVE' | 'FLIP' | 'CARD';
  flipRealType?: PieceType;
  cardId?: string;
}

export const INITIAL_XIANGQI_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export class XiangqiEngine {
  public board: BoardState;
  public turn: 'RED' | 'BLACK';

  constructor(initialFen: string = INITIAL_XIANGQI_FEN, variant: string = 'n', initialPieces?: { red: any[]; black: any[] }) {
    this.board = Array(10).fill(null).map(() => Array(9).fill(null));
    this.turn = 'RED';
    this.setupBoard(variant, initialPieces);
  }

  private setupBoard(variant: string, initialPieces?: { red: any[]; black: any[] }): void {
    if (variant === 'n' || variant === 'kb') {
      const backRank: PieceType[] = ['r', 'n', 'b', 'a', 'k', 'a', 'b', 'n', 'r'];
      for (let c = 0; c < 9; c++) {
        this.board[0][c] = { type: backRank[c], color: 'b', isFaceDown: false };
        this.board[9][c] = { type: backRank[c], color: 'r', isFaceDown: false };
      }
      this.board[2][1] = { type: 'c', color: 'b', isFaceDown: false };
      this.board[2][7] = { type: 'c', color: 'b', isFaceDown: false };
      this.board[7][1] = { type: 'c', color: 'r', isFaceDown: false };
      this.board[7][7] = { type: 'c', color: 'r', isFaceDown: false };
      for (let c = 0; c < 9; c += 2) {
        this.board[3][c] = { type: 'p', color: 'b', isFaceDown: false };
        this.board[6][c] = { type: 'p', color: 'r', isFaceDown: false };
      }
    } else {
      // Face-down variant ('t' or 'g')
      this.board[0][4] = { type: 'k', color: 'b', isFaceDown: false };
      this.board[9][4] = { type: 'k', color: 'r', isFaceDown: false };

      const upPositions = [
        [0,0],[0,1],[0,2],[0,3],[0,5],[0,6],[0,7],[0,8],
        [2,1],[2,7],[3,0],[3,2],[3,4],[3,6],[3,8],
        [9,0],[9,1],[9,2],[9,3],[9,5],[9,6],[9,7],[9,8],
        [7,1],[7,7],[6,0],[6,2],[6,4],[6,6],[6,8]
      ];

      const stdType = (r: number, c: number): PieceType => {
        if (r === 0 || r === 9) return ['r','n','b','a','k','a','b','n','r'][c] as PieceType;
        if (r === 2 || r === 7) return 'c';
        return 'p';
      };

      if (initialPieces && initialPieces.red && initialPieces.black) {
        let rIdx = 0;
        let bIdx = 0;
        upPositions.forEach(([r, c]) => {
          const isRedPos = r >= 5;
          if (isRedPos) {
            const item = initialPieces.red[rIdx++];
            const realT = typeof item === 'string' ? item : item.t;
            const realC = typeof item === 'string' ? 'r' : (item.col || 'r');
            this.board[r][c] = {
              type: stdType(r, c),
              color: 'r',
              isFaceDown: true,
              realType: realT as PieceType,
              realColor: realC as PieceColor,
            };
          } else {
            const item = initialPieces.black[bIdx++];
            const realT = typeof item === 'string' ? item : item.t;
            const realC = typeof item === 'string' ? 'b' : (item.col || 'b');
            this.board[r][c] = {
              type: stdType(r, c),
              color: 'b',
              isFaceDown: true,
              realType: realT as PieceType,
              realColor: realC as PieceColor,
            };
          }
        });
      } else {
        upPositions.forEach(([r, c]) => {
          const col: PieceColor = r < 5 ? 'b' : 'r';
          this.board[r][c] = {
            type: stdType(r, c),
            color: col,
            isFaceDown: true,
          };
        });
      }
    }
  }

  public parseCoordinates(coordStr: string): { r: number; c: number } | null {
    if (!coordStr || typeof coordStr !== 'string') return null;
    const parts = coordStr.split(',').map((s) => parseInt(s.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] >= 0 && parts[0] <= 9 && parts[1] >= 0 && parts[1] <= 8) {
        return { r: parts[0], c: parts[1] };
      }
    }
    return null;
  }

  public countInterveningPieces(r1: number, c1: number, r2: number, c2: number): number {
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    let count = 0;
    let r = r1 + dr;
    let c = c1 + dc;
    while (r !== r2 || c !== c2) {
      if (this.board[r][c] !== null) {
        count++;
      }
      r += dr;
      c += dc;
    }
    return count;
  }

  public isPalace(r: number, c: number, color: PieceColor): boolean {
    if (c < 3 || c > 5) return false;
    return color === 'r' ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
  }

  public findKing(color: PieceColor): { r: number; c: number } | null {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = this.board[r][c];
        if (p && p.type === 'k' && p.color === color) {
          return { r, c };
        }
      }
    }
    return null;
  }

  public isFlyingGeneral(): boolean {
    const redKing = this.findKing('r');
    const blackKing = this.findKing('b');
    if (!redKing || !blackKing) return false;
    if (redKing.c !== blackKing.c) return false;
    const between = this.countInterveningPieces(blackKing.r, redKing.c, redKing.r, redKing.c);
    return between === 0;
  }

  public isBasicMoveValid(piece: Piece, r1: number, c1: number, r2: number, c2: number, variant: string): boolean {
    if (r2 < 0 || r2 > 9 || c2 < 0 || c2 > 8) return false;
    if (r1 === r2 && c1 === c2) return false;

    const target = this.board[r2][c2];
    if (target && target.color === piece.color) return false;

    const dr = r2 - r1;
    const dc = c2 - c1;
    const absDr = Math.abs(dr);
    const absDc = Math.abs(dc);
    const isRed = piece.color === 'r';

    switch (piece.type) {
      case 'k':
        return (absDr === 1 && absDc === 0) || (absDr === 0 && absDc === 1)
          ? this.isPalace(r2, c2, piece.color)
          : false;

      case 'a':
        if (absDr === 1 && absDc === 1) {
          if (variant === 't' || variant === 'g') {
            // Unbound advisors in face-down mode when revealed or unhidden
            return true;
          }
          return this.isPalace(r2, c2, piece.color);
        }
        return false;

      case 'b':
        if (absDr === 2 && absDc === 2) {
          if (variant !== 't' && variant !== 'g') {
            const isCrossRiver = isRed ? r2 < 5 : r2 > 4;
            if (isCrossRiver) return false;
          }
          const eyeR = r1 + dr / 2;
          const eyeC = c1 + dc / 2;
          return this.board[eyeR][eyeC] === null;
        }
        return false;

      case 'n':
        if (absDr * absDc === 2) {
          const legR = absDr === 2 ? r1 + dr / 2 : r1;
          const legC = absDc === 2 ? c1 + dc / 2 : c1;
          return this.board[legR][legC] === null;
        }
        return false;

      case 'r':
        if (dr === 0 || dc === 0) {
          return this.countInterveningPieces(r1, c1, r2, c2) === 0;
        }
        return false;

      case 'c':
        if (dr === 0 || dc === 0) {
          const between = this.countInterveningPieces(r1, c1, r2, c2);
          return target ? between === 1 : between === 0;
        }
        return false;

      case 'p': {
        const forward = isRed ? -1 : 1;
        if (dr === forward && dc === 0) return true;
        const crossedRiver = isRed ? r1 <= 4 : r1 >= 5;
        if (crossedRiver && dr === 0 && absDc === 1) return true;
        return false;
      }

      default:
        return false;
    }
  }

  public validateMove(
    moveInput: { from: string; to: string },
    turnColor: PieceColor,
    variant: string
  ): { valid: boolean; error?: string; formattedNotation?: string } {
    const rawMove = moveInput.from;

    // Handle Special Actions: CARD
    if (rawMove.startsWith('CARD:')) {
      this.turn = this.turn === 'RED' ? 'BLACK' : 'RED';
      return { valid: true, formattedNotation: rawMove };
    }

    // Handle Special Actions: FLIP
    if (rawMove.startsWith('FLIP:')) {
      const parts = rawMove.replace('FLIP:', '').split('->');
      if (parts.length === 2) {
        const coord = this.parseCoordinates(parts[0]);
        const realType = parts[1] as PieceType;
        if (coord && this.board[coord.r][coord.c]) {
          const targetPiece = this.board[coord.r][coord.c]!;
          if (targetPiece.color !== turnColor) {
            return { valid: false, error: 'Không thể lật quân cờ không thuộc phe bạn hoặc không thuộc lượt của bạn.' };
          }
          if (!targetPiece.isFaceDown) {
            return { valid: false, error: 'Quân cờ này đã được lật ngửa.' };
          }
          targetPiece.isFaceDown = false;
          targetPiece.type = targetPiece.realType || realType;
          if (targetPiece.realColor) {
            targetPiece.color = targetPiece.realColor;
          }
          this.turn = this.turn === 'RED' ? 'BLACK' : 'RED';
          return { valid: true, formattedNotation: rawMove };
        }
      }
      return { valid: false, error: 'Cú pháp lật quân không hợp lệ.' };
    }

    // Standard Move: "r1,c1" -> "r2,c2" or moveInput.from / moveInput.to
    let fromCoord = this.parseCoordinates(moveInput.from);
    let toCoord = this.parseCoordinates(moveInput.to);

    // Support hyphenated notation "r1,c1-r2,c2" in moveInput.from
    if (!fromCoord && moveInput.from.includes('-')) {
      const splitHyphen = moveInput.from.split('-');
      fromCoord = this.parseCoordinates(splitHyphen[0]);
      toCoord = this.parseCoordinates(splitHyphen[1]);
    }

    if (!fromCoord || !toCoord) {
      return { valid: false, error: 'Tọa độ nước đi không đúng định dạng.' };
    }

    const piece = this.board[fromCoord.r][fromCoord.c];
    if (!piece) {
      return { valid: false, error: 'Không có quân cờ tại vị trí xuất phát.' };
    }

    if (piece.color !== turnColor) {
      return { valid: false, error: 'Chưa đến lượt đi của bạn hoặc quân cờ không thuộc phe bạn.' };
    }

    const isValidPattern = this.isBasicMoveValid(piece, fromCoord.r, fromCoord.c, toCoord.r, toCoord.c, variant);
    if (!isValidPattern) {
      return { valid: false, error: 'Nước đi không đúng quy tắc luật cờ.' };
    }

    // Simulate move to ensure King safety (no self-check / flying general)
    const targetPiece = this.board[toCoord.r][toCoord.c];
    this.board[fromCoord.r][fromCoord.c] = null;
    this.board[toCoord.r][toCoord.c] = piece;

    const flyingGen = this.isFlyingGeneral();

    // Revert simulation
    this.board[fromCoord.r][fromCoord.c] = piece;
    this.board[toCoord.r][toCoord.c] = targetPiece;

    if (flyingGen) {
      return { valid: false, error: 'Nước đi phạm luật Lộ Mặt Tướng.' };
    }

    // Apply move to state
    this.board[fromCoord.r][fromCoord.c] = null;
    if (piece.isFaceDown) piece.isFaceDown = false;
    this.board[toCoord.r][toCoord.c] = piece;

    // Toggle turn
    this.turn = this.turn === 'RED' ? 'BLACK' : 'RED';

    const moveNotation = `${fromCoord.r},${fromCoord.c}-${toCoord.r},${toCoord.c}`;
    return { valid: true, formattedNotation: moveNotation };
  }

  public getFen(): string {
    const rows: string[] = [];
    for (let r = 0; r < 10; r++) {
      let emptyCount = 0;
      let rowStr = '';
      for (let c = 0; c < 9; c++) {
        const p = this.board[r][c];
        if (!p) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount.toString();
            emptyCount = 0;
          }
          const char = p.isFaceDown ? '?' : p.type;
          rowStr += p.color === 'r' ? char.toUpperCase() : char.toLowerCase();
        }
      }
      if (emptyCount > 0) {
        rowStr += emptyCount.toString();
      }
      rows.push(rowStr);
    }
    const turnChar = this.turn === 'RED' ? 'w' : 'b';
    return `${rows.join('/')} ${turnChar} - - 0 1`;
  }
}
