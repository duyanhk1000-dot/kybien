/**
 * Kỳ Biến Chess - Cờ Thế & Sát Cục Engine Client (kybien-puzzle.js)
 * Phiên bản: 1.0.0 (Milestone 1 MVP)
 * Tích hợp: HTML5 Canvas, UCCI Coordinate Engine, Web Audio Synthesizer,
 * Session State Machine, và kết nối Backend Kỳ Biến API.
 */

(function () {
  'use strict';

  // Tự động nhận diện URL Backend (Localhost vs Render)
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
  const SERVER_URL = (window.location.protocol.startsWith('http') && isLocal)
    ? window.location.origin
    : (isLocal ? 'http://localhost:3000' : 'https://kybien-backend.onrender.com');

  // Mapping Hán tự quân cờ Xiangqi
  const PIECE_NAMES = {
    K: '帥', A: '仕', B: '相', N: '傌', R: '俥', C: '炮', P: '兵',
    k: '將', a: '士', b: '象', n: '馬', r: '車', c: '砲', p: '卒'
  };

  const PIECE_TITLES = {
    K: 'Soái', A: 'Sĩ', B: 'Tượng', N: 'Mã', R: 'Xe', C: 'Pháo', P: 'Binh',
    k: 'Tướng', a: 'Sĩ', b: 'Tượng', n: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt'
  };

  // State quản lý toàn cục cho Cờ Thế
  const state = {
    puzzles: [],
    dailyPuzzles: [],
    isDailyMode: false,
    currentIndex: 0,
    currentPuzzle: null,
    currentSession: null,
    board: Array(10).fill(null).map(() => Array(9).fill(null)),
    selectedSquare: null,
    lastMove: null,
    punishMove: null,
    isThinking: false,
    audioEnabled: true,
    moveLogs: [],
    mode: 'TRADITIONAL',
    tier: 'EASY',
    user: null,
  };

  // =========================================================================
  // 1. WEB AUDIO API SYNTHESIZER (Âm thanh gỗ & nhạc hiệu kiếm hiệp)
  // =========================================================================
  const SoundFX = {
    audioCtx: null,

    initCtx: function () {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    },

    playSelect: function () {
      if (!state.audioEnabled) return;
      this.initCtx();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    },

    playMove: function () {
      if (!state.audioEnabled) return;
      this.initCtx();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(now + 0.12);
    },

    playCapture: function () {
      if (!state.audioEnabled) return;
      this.initCtx();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(260, now);
      osc1.frequency.exponentialRampToValueAtTime(70, now + 0.18);

      osc2.type = 'square';
      osc2.frequency.setValueAtTime(130, now);
      osc2.frequency.exponentialRampToValueAtTime(40, now + 0.18);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    },

    playVictory: function () {
      if (!state.audioEnabled) return;
      this.initCtx();
      if (!this.audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Wuxia Fanfare)
      const now = this.audioCtx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.25, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.35);
      });
    },

    playDefeat: function () {
      if (!state.audioEnabled) return;
      this.initCtx();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.45);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(now + 0.45);
    },
  };

  // =========================================================================
  // 2. COORDINATE & FEN CONVERTERS (UCCI Standard)
  // =========================================================================
  function fileToIndex(fileChar) {
    return fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
  }

  function indexToFile(index) {
    return String.fromCharCode('a'.charCodeAt(0) + index);
  }

  function gridToUci(fromR, fromC, toR, toC) {
    const fromFile = indexToFile(fromC);
    const fromRank = 9 - fromR;
    const toFile = indexToFile(toC);
    const toRank = 9 - toR;
    return `${fromFile}${fromRank}${toFile}${toRank}`;
  }

  function uciToGrid(uci) {
    if (!uci || uci.length !== 4) return null;
    const fromC = fileToIndex(uci[0]);
    const fromR = 9 - parseInt(uci[1], 10);
    const toC = fileToIndex(uci[2]);
    const toR = 9 - parseInt(uci[3], 10);
    return { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
  }

  function parseFen(fen) {
    const board = Array(10).fill(null).map(() => Array(9).fill(null));
    if (!fen) return board;

    const rows = fen.trim().split(' ')[0].split('/');
    for (let r = 0; r < 10; r++) {
      if (!rows[r]) continue;
      let c = 0;
      for (const char of rows[r]) {
        if (c >= 9) break;
        if (char >= '1' && char <= '9') {
          c += parseInt(char, 10);
        } else {
          board[r][c] = char;
          c++;
        }
      }
    }
    return board;
  }

  function boardToFen(board, activeSide = 'w') {
    const rowStrs = [];
    for (let r = 0; r < 10; r++) {
      let emptyCount = 0;
      let rowStr = '';
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (!p) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount;
            emptyCount = 0;
          }
          rowStr += p;
        }
      }
      if (emptyCount > 0) {
        rowStr += emptyCount;
      }
      rowStrs.push(rowStr);
    }
    return `${rowStrs.join('/')} ${activeSide} - - 0 1`;
  }

  // =========================================================================
  // 3. API SERVICE LAYER
  // =========================================================================
  function getAuthToken() {
    return localStorage.getItem('kybien_jwt_token') || localStorage.getItem('token') || '';
  }

  async function apiFetch(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${SERVER_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Lỗi HTTP ${res.status}`);
    }
    return data;
  }

  // =========================================================================
  // 4. CANVAS RENDERER (Bàn cờ gỗ truyền thống, siêu nét trên Retina/Mobile)
  // =========================================================================
  let canvas, ctx;
  const BOARD_W = 500;
  const BOARD_H = 550;
  const OX = 45;
  const OY = 45;
  const CS = 51;
  const PIECE_RAD = 21;

  function initCanvas() {
    canvas = document.getElementById('puzzle-board-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Bắt sự kiện Click / Tap trên bàn cờ
    canvas.addEventListener('click', handleBoardClick);
    canvas.addEventListener('touchstart', handleBoardTouch, { passive: false });
  }

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    const containerWidth = parent ? Math.min(parent.clientWidth - 20, 520) : BOARD_W;
    const scale = Math.max(0.6, containerWidth / BOARD_W);

    canvas.style.width = `${BOARD_W * scale}px`;
    canvas.style.height = `${BOARD_H * scale}px`;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = BOARD_W * dpr;
    canvas.height = BOARD_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderBoard();
  }

  function renderBoard() {
    if (!ctx || !canvas) return;

    // 1. Nền gỗ ấm kiếm hiệp
    ctx.fillStyle = '#edd6b3';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    // Vân gỗ nhẹ
    ctx.strokeStyle = '#e0c59e';
    ctx.lineWidth = 1;
    for (let i = 0; i < BOARD_H; i += 6) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(BOARD_W, i);
      ctx.stroke();
    }

    // 2. Khung viền ngoài
    ctx.strokeStyle = '#4a2f13';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, BOARD_W - 20, BOARD_H - 20);

    ctx.strokeStyle = '#7c5225';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, BOARD_W - 32, BOARD_H - 32);

    // 3. Kẻ lưới bàn cờ (Grid lines)
    ctx.strokeStyle = '#5a3d22';
    ctx.lineWidth = 1.8;

    // 10 hàng ngang
    for (let r = 0; r < 10; r++) {
      ctx.beginPath();
      ctx.moveTo(OX, OY + r * CS);
      ctx.lineTo(OX + 8 * CS, OY + r * CS);
      ctx.stroke();
    }

    // 9 cột dọc (cắt ngang sông)
    for (let c = 0; c < 9; c++) {
      ctx.beginPath();
      ctx.moveTo(OX + c * CS, OY);
      ctx.lineTo(OX + c * CS, OY + 4 * CS);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(OX + c * CS, OY + 5 * CS);
      ctx.lineTo(OX + c * CS, OY + 9 * CS);
      ctx.stroke();
    }

    // Viền bờ sông
    ctx.beginPath();
    ctx.moveTo(OX, OY + 4 * CS); ctx.lineTo(OX, OY + 5 * CS);
    ctx.moveTo(OX + 8 * CS, OY + 4 * CS); ctx.lineTo(OX + 8 * CS, OY + 5 * CS);
    ctx.stroke();

    // Chữ Sở Hà Hán Giới (楚 河 - 漢 界)
    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚  河', OX + 2 * CS, OY + 4.5 * CS);
    ctx.fillText('漢  界', OX + 6 * CS, OY + 4.5 * CS);

    // Cung Tướng (Palaces diagonals)
    ctx.beginPath();
    ctx.moveTo(OX + 3 * CS, OY); ctx.lineTo(OX + 5 * CS, OY + 2 * CS);
    ctx.moveTo(OX + 5 * CS, OY); ctx.lineTo(OX + 3 * CS, OY + 2 * CS);
    ctx.moveTo(OX + 3 * CS, OY + 7 * CS); ctx.lineTo(OX + 5 * CS, OY + 9 * CS);
    ctx.moveTo(OX + 5 * CS, OY + 7 * CS); ctx.lineTo(OX + 3 * CS, OY + 9 * CS);
    ctx.stroke();

    // Dấu thập pháo và tốt (Cross marks)
    drawCross(2, 1); drawCross(2, 7);
    drawCross(7, 1); drawCross(7, 7);
    for (let c = 0; c < 9; c += 2) {
      drawCross(3, c);
      drawCross(6, c);
    }

    // 4. Highlight nước đi vừa qua (Last Move)
    if (state.lastMove) {
      ctx.fillStyle = 'rgba(241, 196, 15, 0.45)';
      ctx.fillRect(OX + state.lastMove.from.c * CS - 21, OY + state.lastMove.from.r * CS - 21, 42, 42);
      ctx.fillStyle = 'rgba(46, 204, 113, 0.55)';
      ctx.fillRect(OX + state.lastMove.to.c * CS - 21, OY + state.lastMove.to.r * CS - 21, 42, 42);
    }

    // 5. Highlight nước trừng phạt nếu thua (Punish Move)
    if (state.punishMove) {
      ctx.fillStyle = 'rgba(231, 76, 60, 0.55)';
      ctx.fillRect(OX + state.punishMove.to.c * CS - 22, OY + state.punishMove.to.r * CS - 22, 44, 44);
    }

    // 6. Highlight quân cờ đang chọn (Selected Square)
    if (state.selectedSquare) {
      const { r, c } = state.selectedSquare;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f39c12';
      ctx.strokeRect(OX + c * CS - 23, OY + r * CS - 23, 46, 46);

      // Chấm chỉ điểm nước đi hợp lệ có thể tới
      ctx.fillStyle = 'rgba(243, 156, 18, 0.35)';
      ctx.beginPath();
      ctx.arc(OX + c * CS, OY + r * CS, PIECE_RAD + 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Vẽ toàn bộ quân cờ trên bàn
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        drawPiece(r, c, p);
      }
    }
  }

  function drawCross(r, c) {
    const x = OX + c * CS;
    const y = OY + r * CS;
    const s = 4;
    const d = 5;

    ctx.strokeStyle = '#5a3d22';
    ctx.lineWidth = 1.4;

    // 4 góc của dấu thập
    const corners = [
      c > 0 ? [-1, -1] : null,
      c < 8 ? [1, -1] : null,
      c > 0 ? [-1, 1] : null,
      c < 8 ? [1, 1] : null,
    ];

    corners.forEach((cn) => {
      if (!cn) return;
      const [dx, dy] = cn;
      ctx.beginPath();
      ctx.moveTo(x + dx * d, y + dy * (d + s));
      ctx.lineTo(x + dx * d, y + dy * d);
      ctx.lineTo(x + dx * (d + s), y + dy * d);
      ctx.stroke();
    });
  }

  function drawPiece(r, c, pieceChar) {
    const x = OX + c * CS;
    const y = OY + r * CS;
    const isRed = pieceChar >= 'A' && pieceChar <= 'Z';

    // Đổ bóng quân cờ
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    // Mặt quân cờ hình tròn màu ngà
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RAD, 0, Math.PI * 2);
    ctx.fillStyle = isRed ? '#fffbf3' : '#f5efe6';
    ctx.fill();

    // Tắt đổ bóng cho các nét vẽ bên trong
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Vành ngoài đậm
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = isRed ? '#c0392b' : '#2c3e50';
    ctx.stroke();

    // Vành chỉ trong
    ctx.beginPath();
    ctx.arc(x, y, PIECE_RAD - 3.5, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = isRed ? '#e74c3c' : '#7f8c8d';
    ctx.stroke();

    // Chữ Hán quân cờ
    const text = PIECE_NAMES[pieceChar] || pieceChar;
    ctx.fillStyle = isRed ? '#c0392b' : '#222222';
    ctx.font = 'bold 21px "Noto Serif TC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  }

  // =========================================================================
  // 5. INPUT & EVENT HANDLERS (Click / Touch)
  // =========================================================================
  function getSquareFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / (rect.width * (window.devicePixelRatio || 1)));
    const y = (clientY - rect.top) * (canvas.height / (rect.height * (window.devicePixelRatio || 1)));

    const c = Math.round((x - OX) / CS);
    const r = Math.round((y - OY) / CS);

    if (r >= 0 && r < 10 && c >= 0 && c < 9) {
      // Khoảng cách tới điểm giao lộ
      const dist = Math.hypot(x - (OX + c * CS), y - (OY + r * CS));
      if (dist <= CS * 0.58) {
        return { r, c };
      }
    }
    return null;
  }

  function handleBoardTouch(e) {
    e.preventDefault();
    handleBoardClick(e);
  }

  async function handleBoardClick(e) {
    if (state.isThinking) return;
    const square = getSquareFromEvent(e);
    if (!square) return;

    const { r, c } = square;
    const piece = state.board[r][c];
    const isRed = piece && piece >= 'A' && piece <= 'Z';

    // 1. Nếu chưa chọn quân: chỉ được phép bấm chọn quân Đỏ của mình
    if (!state.selectedSquare) {
      if (isRed) {
        state.selectedSquare = { r, c };
        SoundFX.playSelect();
        renderBoard();
      }
      return;
    }

    // 2. Đã có quân Đỏ đang chọn:
    const fromR = state.selectedSquare.r;
    const fromC = state.selectedSquare.c;

    // Bấm lại đúng ô đang chọn -> Hủy chọn
    if (fromR === r && fromC === c) {
      state.selectedSquare = null;
      renderBoard();
      return;
    }

    // Bấm sang một quân Đỏ khác của mình -> Đổi chọn
    if (isRed) {
      state.selectedSquare = { r, c };
      SoundFX.playSelect();
      renderBoard();
      return;
    }

    // 3. Thực hiện nước đi: Gửi tọa độ UCCI lên Server thẩm định
    const moveUci = gridToUci(fromR, fromC, r, c);
    state.selectedSquare = null;

    await executePlayerMove(fromR, fromC, r, c, moveUci);
  }

  async function executePlayerMove(fromR, fromC, toR, toC, moveUci) {
    if (!state.currentSession) return;

    state.isThinking = true;
    updateStatus('⚔️ Đang vận khí xuất chiêu...');

    const movingPiece = state.board[fromR][fromC];
    const targetPiece = state.board[toR][toC];

    // Lưu lại trạng thái bàn cờ để khôi phục ngay lập tức nếu nước đi bị từ chối
    const prevBoard = state.board.map(r => [...r]);
    const prevLastMove = state.lastMove;

    // Cập nhật bàn cờ tạm thời cho người chơi
    state.board[fromR][fromC] = null;
    state.board[toR][toC] = movingPiece;
    state.lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
    state.punishMove = null;

    if (targetPiece) {
      SoundFX.playCapture();
    } else {
      SoundFX.playMove();
    }
    renderBoard();

    // Ghi log nước đi của người chơi
    const pTitle = PIECE_TITLES[movingPiece] || movingPiece;
    const capStr = targetPiece ? ` ăn ${PIECE_TITLES[targetPiece] || targetPiece}` : '';
    addLog(`🔴 Kỳ thủ: ${pTitle} (${indexToFile(fromC)}${9 - fromR} ➔ ${indexToFile(toC)}${9 - toR})${capStr}`);

    try {
      const resp = await apiFetch(`/api/puzzles/session/${state.currentSession.sessionId}/move`, {
        method: 'POST',
        body: JSON.stringify({ moveUci }),
      });

      const result = resp.data;

      // =====================================================================
      // TRƯỜNG HỢP 1: CONTINUE (Nước đúng - Máy đáp trả)
      // =====================================================================
      if (result.status === 'CONTINUE') {
        updateStatus('⚫ Đối phương đang ứng biến đáp trả...');

        setTimeout(() => {
          if (result.computerReply) {
            const compMove = uciToGrid(result.computerReply);
            if (compMove) {
              const compFrom = compMove.from;
              const compTo = compMove.to;
              const compPiece = state.board[compFrom.r][compFrom.c];
              const compVictim = state.board[compTo.r][compTo.c];

              state.board[compFrom.r][compFrom.c] = null;
              state.board[compTo.r][compTo.c] = compPiece;
              state.lastMove = compMove;

              if (compVictim) {
                SoundFX.playCapture();
              } else {
                SoundFX.playMove();
              }

              const cpTitle = PIECE_TITLES[compPiece] || compPiece;
              const cCap = compVictim ? ` ăn ${PIECE_TITLES[compVictim] || compVictim}` : '';
              addLog(`⚫ Đối phương: ${cpTitle} (${result.computerReply.slice(0, 2)} ➔ ${result.computerReply.slice(2)})${cCap}`);
            }
          }

          // Cập nhật FEN chuẩn từ server
          if (result.currentFen) {
            state.board = parseFen(result.currentFen);
          }

          renderBoard();
          state.isThinking = false;
          updateStatus('🔴 Đến lượt Đại hiệp xuất chiêu tiếp!');
        }, 350);
        return;
      }

      // =====================================================================
      // TRƯỜNG HỢP 2: VICTORY (Sát cục đại thắng)
      // =====================================================================
      if (result.status === 'VICTORY') {
        state.isThinking = false;
        SoundFX.playVictory();
        updateStatus('🎉 Sát cục đại thắng! Phá giải kỳ trận thành công!');

        // Đánh dấu thế cờ đã phá giải
        if (state.currentPuzzle) {
          state.currentPuzzle.is_solved = true;
          const pz = state.puzzles.find((p) => p.id === state.currentPuzzle.id);
          if (pz) pz.is_solved = true;
          const dpz = state.dailyPuzzles.find((p) => p.id === state.currentPuzzle.id);
          if (dpz) dpz.is_solved = true;
          renderPuzzleList();
          renderDailyPuzzleList();

          const solvedCount = state.dailyPuzzles.filter((p) => p.is_solved).length;
          const progText = document.getElementById('daily-progress-text');
          if (progText) progText.textContent = `${solvedCount}/${state.dailyPuzzles.length}`;
        }

        showVictoryModal(result);
        return;
      }

      // =====================================================================
      // TRƯỜNG HỢP 3: DEFEAT (Bại trận do nước đi sai)
      // =====================================================================
      if (result.status === 'DEFEAT') {
        state.isThinking = false;

        // Nếu máy có nước phạt phản sát, thực hiện hoạt ảnh nước phạt trực quan
        const punishUci = result.punishMove || result.computerReply;
        if (punishUci) {
          const punishGrid = uciToGrid(punishUci);
          if (punishGrid) {
            state.punishMove = punishGrid;
            const pPiece = state.board[punishGrid.from.r][punishGrid.from.c];
            const pVictim = state.board[punishGrid.to.r][punishGrid.to.c];
            state.board[punishGrid.from.r][punishGrid.from.c] = null;
            state.board[punishGrid.to.r][punishGrid.to.c] = pPiece;
            state.lastMove = punishGrid;

            if (pVictim) {
              SoundFX.playCapture();
            } else {
              SoundFX.playMove();
            }

            const cpTitle = PIECE_TITLES[pPiece] || pPiece;
            const cCap = pVictim ? ` ăn ${PIECE_TITLES[pVictim] || pVictim}` : '';
            addLog(`⚫ Đối phương phản sát: ${cpTitle} (${punishUci.slice(0, 2)} ➔ ${punishUci.slice(2)})${cCap}`);
            renderBoard();
          }
        }

        setTimeout(() => {
          SoundFX.playDefeat();
          updateStatus('💀 Nước đi sai lầm! Bại trận!');
          showDefeatModal(result);
        }, punishUci ? 800 : 0);
        return;
      }
    } catch (err) {
      // Khôi phục lại bàn cờ ngay lập tức về trạng thái hợp lệ trước nước đi lỗi
      state.board = prevBoard;
      state.lastMove = prevLastMove;
      state.isThinking = false;
      renderBoard();

      console.error('[Kỳ Biến Puzzle Error]', err);
      alert(`⚠️ Không thể thực thi nước đi: ${err.message}`);
    }
  }

  // =========================================================================
  // 6. SESSION LIFECYCLE & PUZZLE LOADER
  // =========================================================================
  async function loadPuzzles(tier = 'EASY') {
    state.tier = tier;
    updateStatus('📜 Đang tải danh sách thế cờ sa trường...');

    try {
      const resp = await apiFetch(`/api/puzzles?tier=${tier}&page=1&limit=50`);
      state.puzzles = resp.data.puzzles || [];
      renderPuzzleList();

      if (state.puzzles.length > 0) {
        selectPuzzle(0);
      } else {
        updateStatus('Chưa có thế cờ nào trong ải này.');
      }
    } catch (err) {
      console.error('[Load Puzzles Error]', err);
      updateStatus(`⚠️ Không thể kết nối máy chủ: ${err.message}`);
    }
  }

  async function selectPuzzle(index) {
    if (index < 0 || index >= state.puzzles.length) return;
    state.isDailyMode = false;
    state.currentIndex = index;
    const pz = state.puzzles[index];
    await loadPuzzle(pz);
    highlightCurrentPuzzleCard();
    renderDailyPuzzleList();
  }

  async function loadPuzzle(pz) {
    state.currentPuzzle = pz;
    state.board = parseFen(pz.fen);
    state.selectedSquare = null;
    state.lastMove = null;
    state.punishMove = null;
    state.moveLogs = [];
    clearLogs();

    renderBoard();
    updatePuzzleInfoUI(pz);

    // Khởi tạo phiên giải mới trên server
    try {
      state.isThinking = true;
      state.currentSession = null;
      updateStatus('⚡ Khởi tạo phiên kỳ trận...');
      const resp = await apiFetch(`/api/puzzles/${pz.id}/start-session`, {
        method: 'POST',
        body: JSON.stringify({
          mode: state.mode,
          sessionType: 'RANKED',
        }),
      });
      state.currentSession = resp.data;
      state.isThinking = false;
      updateStatus('🔴 Đến lượt Đại hiệp: Hãy tìm diệu thủ sát cục!');
      const authorDisplay = pz.creator?.username ? `Kỳ thủ ${pz.creator.username}` : 'Kỳ Biến Các';
      addLog(`⚔️ Khởi đầu kỳ trận: [${pz.title}] • ${authorDisplay}`);
    } catch (err) {
      state.isThinking = false;
      console.error('[Start Session Error]', err);
      updateStatus(`⚠️ Lỗi khởi tạo phiên chơi: ${err.message}`);
    }
  }

  function restartCurrentPuzzle() {
    if (state.currentPuzzle) {
      loadPuzzle(state.currentPuzzle);
    }
  }

  function nextPuzzle() {
    if (state.currentIndex + 1 < state.puzzles.length) {
      selectPuzzle(state.currentIndex + 1);
    } else {
      alert('Đại hiệp đã hoàn thành toàn bộ thế cờ của ải này!');
    }
  }

  function prevPuzzle() {
    if (state.currentIndex - 1 >= 0) {
      selectPuzzle(state.currentIndex - 1);
    }
  }

  // =========================================================================
  // 7. UI RENDERING & MODALS (Wuxia Styling)
  // =========================================================================
  async function loadDailyPuzzles(targetDate) {
    try {
      const url = targetDate ? `/api/puzzles/daily?date=${encodeURIComponent(targetDate)}` : '/api/puzzles/daily';
      const resp = await apiFetch(url);
      if (!resp.success || !resp.data) return;

      const daily = resp.data;
      state.dailyPuzzles = daily.puzzles || [];

      // Cập nhật UI ngày và tiến trình
      const dateLabel = document.getElementById('daily-date-label');
      if (dateLabel) dateLabel.textContent = daily.date;

      const progText = document.getElementById('daily-progress-text');
      if (progText) progText.textContent = `${daily.progress.solved_count}/${daily.progress.total_count}`;

      const bonusTag = document.getElementById('daily-bonus-tag');
      if (bonusTag) {
        if (daily.progress.all_solved) {
          bonusTag.innerHTML = '<span style="color: #2ecc71; font-weight: bold;">(✓ Đã nhận +15 EXP hôm nay!)</span>';
        } else {
          bonusTag.innerHTML = '(+15 EXP khi hoàn tất)';
        }
      }

      renderDailyPuzzleList();
    } catch (err) {
      console.warn('[Daily Puzzle Warning]', err);
    }
  }

  function renderDailyPuzzleList() {
    const container = document.getElementById('daily-puzzles-list');
    if (!container) return;

    if (!state.dailyPuzzles || state.dailyPuzzles.length === 0) {
      container.innerHTML = '<div style="font-size: 0.75rem; color: #a8947d; text-align: center; padding: 4px;">Chưa có thế cờ hôm nay.</div>';
      return;
    }

    container.innerHTML = '';
    const tierMeta = {
      EASY: { label: 'Dễ', class: 'daily-tag-easy', icon: '🟢' },
      MEDIUM: { label: 'Vừa', class: 'daily-tag-med', icon: '🟡' },
      HARD: { label: 'Khó', class: 'daily-tag-hard', icon: '🔴' },
    };

    state.dailyPuzzles.forEach((pz) => {
      const meta = tierMeta[pz.tier] || { label: pz.tier, class: 'daily-tag-easy', icon: '⚔️' };
      const item = document.createElement('div');
      const isCurrent = state.isDailyMode && state.currentPuzzle && state.currentPuzzle.id === pz.id;
      item.className = `daily-item ${isCurrent ? 'active' : ''} ${pz.is_solved ? 'solved' : ''}`;
      item.onclick = () => selectDailyPuzzle(pz);

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
          <span class="daily-badge-tag ${meta.class}" style="white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 58px;">
            <span>${meta.icon}</span><span>${meta.label}</span>
          </span>
          <span style="font-size: 0.8rem; color: #e8dcc6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(pz.title)}</span>
        </div>
        <div style="font-size: 0.74rem; font-weight: 600; color: ${pz.is_solved ? '#2ecc71' : '#f1c40f'}; margin-left: 6px; white-space: nowrap; flex-shrink: 0;">
          ${pz.is_solved ? '✓ Đã Phá' : `+${pz.exp_reward} EXP`}
        </div>
      `;
      container.appendChild(item);
    });
  }

  function selectDailyPuzzle(pz) {
    state.isDailyMode = true;
    loadPuzzle(pz);
    renderDailyPuzzleList();
    const items = document.querySelectorAll('.level-item');
    items.forEach(el => el.classList.remove('active'));
  }

  function renderPuzzleList() {
    const listEl = document.getElementById('puzzle-level-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (!state.puzzles || state.puzzles.length === 0) {
      listEl.innerHTML = `<div style="font-size: 0.8rem; color: #a8947d; text-align: center; padding: 24px 8px;">
        ${state.tier === 'UGC' ? 'Chưa có thế cờ cộng đồng nào.<br>Hãy bấm <strong>"Tự Tạo Thế Cờ"</strong> để là người đầu tiên khai trận!' : 'Chưa có thế cờ trong mục này.'}
      </div>`;
      return;
    }

    state.puzzles.forEach((pz, idx) => {
      const item = document.createElement('div');
      const isCurrent = !state.isDailyMode && idx === state.currentIndex;
      item.className = `level-item ${isCurrent ? 'active' : ''} ${pz.is_solved ? 'solved' : ''}`;
      item.onclick = () => selectPuzzle(idx);

      if (state.tier === 'UGC') {
        const creatorName = pz.creator?.username || 'Kỳ Biến Các';
        let constraintsBadge = '';
        if (pz.constraints) {
          try {
            const c = typeof pz.constraints === 'string' ? JSON.parse(pz.constraints) : pz.constraints;
            if (c.max_moves) constraintsBadge += ` ≤${c.max_moves} nước`;
            if (c.forbidden_pieces && c.forbidden_pieces.length > 0) constraintsBadge += ` 🚫${c.forbidden_pieces.join('')}`;
          } catch (e) {}
        }

        item.innerHTML = `
          <div style="flex: 1; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <span class="level-title" style="margin: 0; font-weight: bold; color: #f1c40f;">${escapeHtml(pz.title)}</span>
              <span style="font-size: 0.72rem; color: #ff6b6b; font-weight: bold; margin-left: 6px;">❤️ ${pz.upvote_count || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #a8947d;">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">👤 ${escapeHtml(creatorName)}${constraintsBadge ? ` | <span style="color: #e67e22;">${constraintsBadge}</span>` : ''}</span>
              <span class="level-badge" style="font-size: 0.68rem;">${pz.is_solved ? '✓ Đã Phá' : 'Khiêu chiến'}</span>
            </div>
          </div>
        `;
      } else {
        item.innerHTML = `
          <div class="level-num">Ải ${pz.order_index}</div>
          <div class="level-title">${escapeHtml(pz.title)}</div>
          <div class="level-badge">${pz.is_solved ? '✓ Đã Phá' : 'Khiêu chiến'}</div>
        `;
      }
      listEl.appendChild(item);
    });
  }

  function highlightCurrentPuzzleCard() {
    const items = document.querySelectorAll('.level-item');
    items.forEach((el, idx) => {
      if (!state.isDailyMode && idx === state.currentIndex) {
        el.classList.add('active');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  async function voteCurrentPuzzle() {
    if (!state.currentPuzzle || state.currentPuzzle.tier !== 'UGC') return;
    try {
      const resp = await apiFetch(`/api/puzzles/ugc/${state.currentPuzzle.id}/vote`, {
        method: 'POST',
      });
      if (resp.success && resp.data) {
        state.currentPuzzle.upvote_count = resp.data.upvoteCount;
        SoundFX.playSelect();
        const voteCountEl = document.getElementById('ugc-vote-count');
        if (voteCountEl) voteCountEl.textContent = resp.data.upvoteCount;
        renderPuzzleList();
      }
    } catch (err) {
      console.warn('[Vote Error]', err);
    }
  }

  function updatePuzzleInfoUI(pz) {
    const titleEl = document.getElementById('puzzle-current-title');
    const tierEl = document.getElementById('puzzle-current-tier');
    const indexEl = document.getElementById('puzzle-current-index');

    if (titleEl) {
      if (pz.tier === 'UGC') {
        titleEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span>${escapeHtml(pz.title)}</span>
            <button id="btn-ugc-vote-header" style="background: rgba(231,76,60,0.22); border: 1px solid #e74c3c; color: #ff6b6b; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 0.74rem; font-family: inherit;">
              ❤️ <span id="ugc-vote-count">${pz.upvote_count || 0}</span> Thích
            </button>
          </div>
        `;
        const voteBtn = document.getElementById('btn-ugc-vote-header');
        if (voteBtn) voteBtn.onclick = voteCurrentPuzzle;
      } else {
        titleEl.textContent = pz.title;
      }
    }

    if (tierEl) {
      if (pz.tier === 'UGC') {
        tierEl.textContent = 'Giang Hồ';
        tierEl.style.background = '#27ae60';
        tierEl.style.borderColor = '#2ecc71';
      } else {
        const tierName = pz.tier === 'EASY' ? 'Nhập Môn (Dễ)' : pz.tier === 'MEDIUM' ? 'Cao Thủ (Vừa)' : 'Tông Sư (Khó)';
        tierEl.textContent = tierName;
        tierEl.style.background = '#8b0000';
        tierEl.style.borderColor = '#a83a1f';
      }
    }

    if (indexEl) {
      const author = pz.creator?.username || 'Kỳ Biến Các';
      if (state.isDailyMode) {
        indexEl.textContent = `📅 Thế Cờ Hôm Nay • ${author}`;
      } else if (pz.tier === 'UGC') {
        indexEl.textContent = `Tác giả: ${author}`;
      } else {
        indexEl.textContent = `Ải ${pz.order_index} / ${state.puzzles.length} • ${author}`;
      }
    }

    // Nếu thế cờ có ràng buộc (constraints), hiển thị vào thanh log
    if (pz.constraints) {
      try {
        const c = typeof pz.constraints === 'string' ? JSON.parse(pz.constraints) : pz.constraints;
        const cArr = [];
        if (c.max_moves) cArr.push(`Sát cục trong ≤ ${c.max_moves} nước`);
        if (c.forbidden_pieces && c.forbidden_pieces.length > 0) {
          const pMap = { R: 'Xe', C: 'Pháo', N: 'Mã' };
          cArr.push(`Cấm dùng quân: ${c.forbidden_pieces.map((p) => pMap[p] || p).join(', ')}`);
        }
        if (cArr.length > 0) {
          addLog(`<div style="color: #f1c40f; font-weight: bold; background: rgba(241,196,15,0.1); border-left: 3px solid #f1c40f; padding: 4px 8px; border-radius: 4px; margin: 4px 0;">🎯 Thách đấu: ${cArr.join(' | ')}</div>`);
        }
      } catch (e) {}
    }

    if (pz.description) {
      addLog(`<div style="color: #a8947d; font-style: italic; margin-bottom: 4px;">💬 Gợi ý: "${escapeHtml(pz.description)}"</div>`);
    }
  }

  function updateStatus(text) {
    const statusEl = document.getElementById('puzzle-status-bar');
    if (statusEl) statusEl.innerHTML = text;
  }

  function addLog(text) {
    state.moveLogs.push(text);
    const logBox = document.getElementById('puzzle-move-history');
    if (!logBox) return;

    const line = document.createElement('div');
    line.className = 'history-line';
    line.innerHTML = text;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function clearLogs() {
    const logBox = document.getElementById('puzzle-move-history');
    if (logBox) logBox.innerHTML = '';
  }

  function showVictoryModal(result) {
    const modal = document.getElementById('puzzle-victory-modal');
    if (!modal) return;

    let expText = result.isFirstClear
      ? `+${result.expGained} EXP (Phá giải lần đầu)`
      : `0 EXP (Đã phá giải trước đó)`;

    if (result.isDailyAllClear) {
      expText += ` & +${result.dailyBonusExp} EXP Thưởng Ngày!`;
    }

    document.getElementById('vic-exp-reward').textContent = expText;
    document.getElementById('vic-total-exp').textContent = result.newTotalExp || '--';
    document.getElementById('vic-level').textContent = `Lv.${result.newLevel || 1}`;
    document.getElementById('vic-rank-title').textContent = result.rankTitle || 'Hiệp Khách';

    if (result.isDailyAllClear) {
      document.getElementById('vic-comment').innerHTML = `
        <div style="background: rgba(241,196,15,0.18); border: 1px solid #f1c40f; border-radius: 8px; padding: 10px; margin-bottom: 12px; color: #f1c40f; font-weight: bold; font-size: 0.95rem;">
          🎁 ĐẠI THẮNG: Hoàn thành Tam Đại Kỳ Trận Hôm Nay! Thưởng thêm +${result.dailyBonusExp} EXP!
        </div>
        ${escapeHtml(result.winComment || 'Sát cục tuyệt diệu!')}
      `;
    } else {
      document.getElementById('vic-comment').textContent = result.winComment || 'Sát cục tuyệt diệu!';
    }

    modal.style.display = 'flex';
  }

  function closeVictoryModal() {
    const modal = document.getElementById('puzzle-victory-modal');
    if (modal) modal.style.display = 'none';
  }

  function showDefeatModal(result) {
    const modal = document.getElementById('puzzle-defeat-modal');
    if (!modal) return;

    document.getElementById('def-reason').textContent = result.defeatReason || 'Nước đi sai lầm dẫn tới bại trận!';
    modal.style.display = 'flex';
  }

  function closeDefeatModal() {
    const modal = document.getElementById('puzzle-defeat-modal');
    if (modal) modal.style.display = 'none';
  }

  function toggleAudio() {
    state.audioEnabled = !state.audioEnabled;
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) {
      btn.innerHTML = state.audioEnabled ? '🔊 Âm Thanh: Bật' : '🔇 Âm Thanh: Tắt';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // =========================================================================
  // 8. UGC PUZZLE CREATOR & PROOF-OF-SOLUTION ENGINE
  // =========================================================================
  const Creator = {
    modal: null,
    canvas: null,
    ctx: null,
    board: Array(10).fill(null).map(() => Array(9).fill(null)),
    selectedPiece: 'K',
    mode: 'EDIT', // 'EDIT' | 'VERIFY'
    verifyDraftId: null,
    verifySessionId: null,
    selectedSquare: null,
    lastMove: null,
    isThinking: false,
    isVerified: false,
    draftInitialFen: null,

    init: function () {
      this.modal = document.getElementById('ugc-creator-modal');
      this.canvas = document.getElementById('creator-board-canvas');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.initDefaultBoard();

      // Bắt sự kiện Canvas
      this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      this.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleCanvasClick(e);
      }, { passive: false });

      // Nút Mở / Đóng Modal
      const btnOpen = document.getElementById('btn-open-creator');
      if (btnOpen) {
        btnOpen.onclick = () => this.open();
      }

      const btnClose = document.getElementById('btn-close-creator');
      if (btnClose) {
        btnClose.onclick = () => this.close();
      }

      // Nút chọn quân trong Palette
      const pieceBtns = document.querySelectorAll('.palette-box .piece-btn');
      pieceBtns.forEach((btn) => {
        btn.onclick = () => {
          pieceBtns.forEach((b) => b.classList.remove('active'));
          const eraserBtn = document.getElementById('btn-palette-eraser');
          if (eraserBtn) eraserBtn.classList.remove('active');

          btn.classList.add('active');
          this.selectedPiece = btn.dataset.piece;
          SoundFX.playSelect();
        };
      });

      // Mặc định chọn Soái Đỏ (K)
      const defaultPieceBtn = document.querySelector('.piece-btn[data-piece="K"]');
      if (defaultPieceBtn) defaultPieceBtn.classList.add('active');

      // Tẩy xóa ô
      const btnEraser = document.getElementById('btn-palette-eraser');
      if (btnEraser) {
        btnEraser.onclick = () => {
          pieceBtns.forEach((b) => b.classList.remove('active'));
          btnEraser.classList.add('active');
          this.selectedPiece = 'eraser';
          SoundFX.playSelect();
        };
      }

      // Xóa trắng bàn cờ
      const btnClear = document.getElementById('btn-palette-clear');
      if (btnClear) {
        btnClear.onclick = () => {
          this.board = Array(10).fill(null).map(() => Array(9).fill(null));
          this.resetVerification();
          this.render();
          SoundFX.playMove();
        };
      }

      // Bàn cờ chuẩn khai cuộc
      const btnDefault = document.getElementById('btn-palette-default');
      if (btnDefault) {
        btnDefault.onclick = () => {
          this.board = parseFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1');
          this.resetVerification();
          this.render();
          SoundFX.playMove();
        };
      }

      // Nút Tự Thử Nghiệm & Xác Minh
      const btnVerify = document.getElementById('btn-start-verification');
      if (btnVerify) {
        btnVerify.onclick = () => this.startVerification();
      }

      // Nút Công Khai Lên Giang Hồ
      const btnPublish = document.getElementById('btn-publish-ugc');
      if (btnPublish) {
        btnPublish.onclick = () => this.publishPuzzle();
      }
    },

    initDefaultBoard: function () {
      this.board = Array(10).fill(null).map(() => Array(9).fill(null));
      this.board[0][4] = 'k'; // Tướng Đen (0, 4)
      this.board[9][4] = 'K'; // Soái Đỏ (9, 4)
    },

    open: function () {
      const token = getAuthToken();
      if (!token) {
        alert('⚠️ Chức năng Bày Thế Cờ yêu cầu kỳ thủ phải Đăng Nhập tài khoản Kỳ Biến!\n\nĐại hiệp ẩn danh không thể sáng lập và lưu danh thế cờ trên Giang Hồ Kỳ Trận. Vui lòng đăng nhập để tiếp tục.');
        return;
      }
      if (!this.modal) return;
      this.modal.style.display = 'flex';
      this.mode = 'EDIT';
      this.resetVerification();
      this.resizeCanvas();
      this.render();
    },

    close: function () {
      if (!this.modal) return;
      this.modal.style.display = 'none';
      this.mode = 'EDIT';
      this.resetVerification();
    },

    resetVerification: function () {
      this.mode = 'EDIT';
      this.isVerified = false;
      this.verifyDraftId = null;
      this.verifySessionId = null;
      this.selectedSquare = null;
      this.lastMove = null;
      this.isThinking = false;

      const publishBtn = document.getElementById('btn-publish-ugc');
      if (publishBtn) publishBtn.style.display = 'none';

      const verifyBtn = document.getElementById('btn-start-verification');
      if (verifyBtn) {
        verifyBtn.innerHTML = '🧪 TỰ THỬ NGHIỆM &amp; XÁC MINH (Proof of Solution)';
        verifyBtn.className = 'btn-act btn-primary';
      }

      const statusBox = document.getElementById('creator-status-box');
      if (statusBox) {
        statusBox.innerHTML = '💡 Hãy bày các quân cờ, đặt điều kiện rồi bấm "Tự Thử Nghiệm &amp; Xác Minh" để chứng minh thế cờ có lời giải hợp lệ.';
        statusBox.style.color = '#f1c40f';
      }
    },

    resizeCanvas: function () {
      if (!this.canvas) return;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = 400 * dpr;
      this.canvas.height = 440 * dpr;
      this.canvas.style.width = '400px';
      this.canvas.style.height = '440px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    render: function () {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const CS = 40;
      const OX = 40;
      const OY = 40;
      const BOARD_W = 400;
      const BOARD_H = 440;

      // 1. Nền gỗ
      ctx.fillStyle = '#edd6b3';
      ctx.fillRect(0, 0, BOARD_W, BOARD_H);

      // Vân gỗ
      ctx.strokeStyle = '#e0c59e';
      ctx.lineWidth = 1;
      for (let i = 0; i < BOARD_H; i += 6) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(BOARD_W, i);
        ctx.stroke();
      }

      // Khung viền ngoài
      ctx.strokeStyle = '#4a2f13';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, BOARD_W - 16, BOARD_H - 16);

      ctx.strokeStyle = '#7c5225';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(14, 14, BOARD_W - 28, BOARD_H - 28);

      // Lưới bàn cờ
      ctx.strokeStyle = '#5a3d22';
      ctx.lineWidth = 1.5;

      // 10 hàng ngang
      for (let r = 0; r < 10; r++) {
        ctx.beginPath();
        ctx.moveTo(OX, OY + r * CS);
        ctx.lineTo(OX + 8 * CS, OY + r * CS);
        ctx.stroke();
      }

      // 9 cột dọc (cắt ngang sông)
      for (let c = 0; c < 9; c++) {
        ctx.beginPath();
        ctx.moveTo(OX + c * CS, OY);
        ctx.lineTo(OX + c * CS, OY + 4 * CS);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(OX + c * CS, OY + 5 * CS);
        ctx.lineTo(OX + c * CS, OY + 9 * CS);
        ctx.stroke();
      }

      // Viền bờ sông
      ctx.beginPath();
      ctx.moveTo(OX, OY + 4 * CS); ctx.lineTo(OX, OY + 5 * CS);
      ctx.moveTo(OX + 8 * CS, OY + 4 * CS); ctx.lineTo(OX + 8 * CS, OY + 5 * CS);
      ctx.stroke();

      // Chữ Sở Hà Hán Giới
      ctx.fillStyle = '#8b4513';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('楚  河', OX + 2 * CS, OY + 4.5 * CS);
      ctx.fillText('漢  界', OX + 6 * CS, OY + 4.5 * CS);

      // Cung Tướng
      ctx.beginPath();
      ctx.moveTo(OX + 3 * CS, OY); ctx.lineTo(OX + 5 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 5 * CS, OY); ctx.lineTo(OX + 3 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 3 * CS, OY + 7 * CS); ctx.lineTo(OX + 5 * CS, OY + 9 * CS);
      ctx.moveTo(OX + 5 * CS, OY + 7 * CS); ctx.lineTo(OX + 3 * CS, OY + 9 * CS);
      ctx.stroke();

      // Highlight Last Move trong Verify mode
      if (this.lastMove) {
        ctx.fillStyle = 'rgba(241, 196, 15, 0.45)';
        ctx.fillRect(OX + this.lastMove.from.c * CS - 16, OY + this.lastMove.from.r * CS - 16, 32, 32);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.55)';
        ctx.fillRect(OX + this.lastMove.to.c * CS - 16, OY + this.lastMove.to.r * CS - 16, 32, 32);
      }

      // Highlight Selected Square trong Verify mode
      if (this.selectedSquare) {
        const { r, c } = this.selectedSquare;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#f39c12';
        ctx.strokeRect(OX + c * CS - 18, OY + r * CS - 18, 36, 36);
        ctx.fillStyle = 'rgba(243, 156, 18, 0.35)';
        ctx.beginPath();
        ctx.arc(OX + c * CS, OY + r * CS, 17 + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Vẽ quân cờ trên bàn
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const p = this.board[r][c];
          if (!p) continue;
          this.drawPiece(r, c, p);
        }
      }
    },

    drawPiece: function (r, c, pieceChar) {
      const ctx = this.ctx;
      const CS = 40;
      const OX = 40;
      const OY = 40;
      const PIECE_RAD = 17;

      const x = OX + c * CS;
      const y = OY + r * CS;
      const isRed = pieceChar >= 'A' && pieceChar <= 'Z';

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1.5;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.arc(x, y, PIECE_RAD, 0, Math.PI * 2);
      ctx.fillStyle = isRed ? '#fffbf3' : '#f5efe6';
      ctx.fill();

      ctx.shadowColor = 'transparent';

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = isRed ? '#a93226' : '#2c3e50';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, PIECE_RAD - 3, 0, Math.PI * 2);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = isRed ? '#e6b0aa' : '#bdc3c7';
      ctx.stroke();

      ctx.font = 'bold 18px "Noto Serif TC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isRed ? '#b03a2e' : '#17202a';
      ctx.fillText(PIECE_NAMES[pieceChar] || pieceChar, x, y + 1);

      ctx.restore();
    },

    handleCanvasClick: async function (e) {
      if (this.isThinking) return;

      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = 400 / rect.width;
      const scaleY = 440 / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      const c = Math.round((x - 40) / 40);
      const r = Math.round((y - 40) / 40);

      if (r < 0 || r > 9 || c < 0 || c > 8) return;
      if (Math.hypot(x - (40 + c * 40), y - (40 + r * 40)) > 24) return;

      if (this.mode === 'EDIT') {
        if (this.selectedPiece === 'eraser') {
          if (this.board[r][c]) {
            this.board[r][c] = null;
            SoundFX.playMove();
            this.render();
          }
        } else if (this.selectedPiece) {
          this.board[r][c] = this.selectedPiece;
          SoundFX.playSelect();
          this.render();
        }

        if (this.isVerified) {
          this.isVerified = false;
          const publishBtn = document.getElementById('btn-publish-ugc');
          if (publishBtn) publishBtn.style.display = 'none';
        }
      } else if (this.mode === 'VERIFY') {
        await this.handleVerifyClick(r, c);
      }
    },

    handleVerifyClick: async function (r, c) {
      const piece = this.board[r][c];
      const isRed = piece && piece >= 'A' && piece <= 'Z';

      if (!this.selectedSquare) {
        if (isRed) {
          this.selectedSquare = { r, c };
          SoundFX.playSelect();
          this.render();
        }
        return;
      }

      const fromR = this.selectedSquare.r;
      const fromC = this.selectedSquare.c;

      if (fromR === r && fromC === c) {
        this.selectedSquare = null;
        this.render();
        return;
      }

      if (isRed) {
        this.selectedSquare = { r, c };
        SoundFX.playSelect();
        this.render();
        return;
      }

      const moveUci = gridToUci(fromR, fromC, r, c);
      this.selectedSquare = null;
      await this.executeVerifyMove(fromR, fromC, r, c, moveUci);
    },

    executeVerifyMove: async function (fromR, fromC, toR, toC, moveUci) {
      if (!this.verifySessionId) return;

      this.isThinking = true;
      const statusBox = document.getElementById('creator-status-box');
      if (statusBox) statusBox.innerHTML = '⚔️ Đang thẩm định nước đi &amp; phản ứng của AI...';

      const movingPiece = this.board[fromR][fromC];
      const targetPiece = this.board[toR][toC];

      this.board[fromR][fromC] = null;
      this.board[toR][toC] = movingPiece;
      this.lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };

      if (targetPiece) SoundFX.playCapture();
      else SoundFX.playMove();
      this.render();

      try {
        const resp = await apiFetch(`/api/puzzles/ugc/session/${this.verifySessionId}/verify-move`, {
          method: 'POST',
          body: JSON.stringify({ moveUci }),
        });

        const result = resp.data;

        if (result.status === 'CONTINUE') {
          setTimeout(() => {
            if (result.computerReply) {
              const compMove = uciToGrid(result.computerReply);
              if (compMove) {
                const compPiece = this.board[compMove.from.r][compMove.from.c];
                const compVictim = this.board[compMove.to.r][compMove.to.c];
                this.board[compMove.from.r][compMove.from.c] = null;
                this.board[compMove.to.r][compMove.to.c] = compPiece;
                this.lastMove = compMove;

                if (compVictim) SoundFX.playCapture();
                else SoundFX.playMove();
              }
            }

            if (result.currentFen) {
              this.board = parseFen(result.currentFen);
            }

            this.render();
            this.isThinking = false;
            if (statusBox) {
              statusBox.innerHTML = '⚫ Đối phương vừa ứng biến đáp trả. Đến lượt bạn đi tiếp!';
              statusBox.style.color = '#f1c40f';
            }
          }, 350);
          return;
        }

        if (result.status === 'VICTORY') {
          this.isThinking = false;
          this.isVerified = true;
          SoundFX.playVictory();

          if (statusBox) {
            statusBox.innerHTML = `
              <div style="color: #2ecc71; font-weight: bold; font-size: 0.95rem;">
                🎉 XÁC MINH THÀNH CÔNG!
              </div>
              <div style="color: #e8dcc6; font-size: 0.8rem; margin-top: 2px;">
                Đã chứng minh thế cờ có lời giải hợp lệ theo mọi điều kiện thách đấu!
              </div>
            `;
          }

          const publishBtn = document.getElementById('btn-publish-ugc');
          if (publishBtn) {
            publishBtn.style.display = 'block';
            publishBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          const verifyBtn = document.getElementById('btn-start-verification');
          if (verifyBtn) {
            verifyBtn.innerHTML = '🔄 Thử Nghiệm Lại (Proof Reset)';
          }
          return;
        }

        if (result.status === 'DEFEAT') {
          this.isThinking = false;
          SoundFX.playDefeat();
          if (statusBox) {
            statusBox.innerHTML = `
              <div style="color: #e74c3c; font-weight: bold;">
                💀 CHƯA ĐẠT CHUẨN THỬ NGHIỆM!
              </div>
              <div style="color: #e8dcc6; font-size: 0.8rem; margin-top: 2px;">
                ${result.defeatReason || 'Nước đi không giải được thế cờ hoặc vi phạm điều kiện!'}.
                Bấm <em>"Thử Nghiệm Lại"</em> để đánh lại.
              </div>
            `;
          }
          return;
        }
      } catch (err) {
        this.isThinking = false;
        console.error('[Verify Move Error]', err);
        if (statusBox) {
          statusBox.innerHTML = `<span style="color: #e74c3c;">⚠️ Lỗi: ${escapeHtml(err.message)}</span>`;
        }
        if (this.draftInitialFen) {
          this.board = parseFen(this.draftInitialFen);
          this.selectedSquare = null;
          this.lastMove = null;
          this.render();
        }
      }
    },

    startVerification: async function () {
      const token = getAuthToken();
      if (!token) {
        alert('⚠️ Vui lòng đăng nhập tài khoản Kỳ Biến để tự thử nghiệm và xác minh thế cờ!');
        return;
      }

      const statusBox = document.getElementById('creator-status-box');
      const title = (document.getElementById('creator-title')?.value || '').trim();
      const desc = (document.getElementById('creator-desc')?.value || '').trim();
      const maxMoves = parseInt(document.getElementById('creator-max-moves')?.value || '0', 10);

      const forbidden = [];
      if (document.getElementById('chk-forbid-r')?.checked) forbidden.push('R');
      if (document.getElementById('chk-forbid-c')?.checked) forbidden.push('C');
      if (document.getElementById('chk-forbid-n')?.checked) forbidden.push('N');

      if (title.length < 3) {
        if (statusBox) {
          statusBox.innerHTML = '<span style="color: #e74c3c;">⚠️ Tên thế cờ phải có ít nhất 3 ký tự!</span>';
        }
        return;
      }

      let countK = 0, countk = 0;
      let posK = null, posk = null;

      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const p = this.board[r][c];
          if (p === 'K') { countK++; posK = { r, c }; }
          if (p === 'k') { countk++; posk = { r, c }; }
        }
      }

      if (countK !== 1) {
        if (statusBox) statusBox.innerHTML = '<span style="color: #e74c3c;">⚠️ Bàn cờ phải có đúng 1 quân Soái Đỏ (帥)!</span>';
        return;
      }
      if (countk !== 1) {
        if (statusBox) statusBox.innerHTML = '<span style="color: #e74c3c;">⚠️ Bàn cờ phải có đúng 1 quân Tướng Đen (將)!</span>';
        return;
      }

      if (posK.r < 7 || posK.r > 9 || posK.c < 3 || posK.c > 5) {
        if (statusBox) statusBox.innerHTML = '<span style="color: #e74c3c;">⚠️ Soái Đỏ phải nằm trong Cung Tướng (hàng 8-10, cột 4-6)!</span>';
        return;
      }

      if (posk.r < 0 || posk.r > 2 || posk.c < 3 || posk.c > 5) {
        if (statusBox) statusBox.innerHTML = '<span style="color: #e74c3c;">⚠️ Tướng Đen phải nằm trong Cung Tướng (hàng 1-3, cột 4-6)!</span>';
        return;
      }

      if (posK.c === posk.c) {
        let intervening = 0;
        for (let r = posk.r + 1; r < posK.r; r++) {
          if (this.board[r][posK.c]) intervening++;
        }
        if (intervening === 0) {
          if (statusBox) statusBox.innerHTML = '<span style="color: #e74c3c;">⚠️ Lộ mặt Tướng: Hai Tướng đang đối mặt trực tiếp mà không có quân cản!</span>';
          return;
        }
      }

      const fen = boardToFen(this.board, 'w');
      this.draftInitialFen = fen;

      if (statusBox) statusBox.innerHTML = '⏳ Đang khởi tạo bản thảo &amp; AI hộ pháp...';

      try {
        const draftResp = await apiFetch('/api/puzzles/ugc/create-draft', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description: desc,
            fen,
            constraints: {
              max_moves: maxMoves,
              forbidden_pieces: forbidden,
            },
          }),
        });

        const draft = draftResp.data;
        this.verifyDraftId = draft.puzzleId;

        const verifyResp = await apiFetch(`/api/puzzles/ugc/${this.verifyDraftId}/start-verify`, {
          method: 'POST',
        });

        const session = verifyResp.data;
        this.verifySessionId = session.sessionId;

        this.mode = 'VERIFY';
        this.selectedSquare = null;
        this.lastMove = null;
        this.isVerified = false;

        const publishBtn = document.getElementById('btn-publish-ugc');
        if (publishBtn) publishBtn.style.display = 'none';

        const verifyBtn = document.getElementById('btn-start-verification');
        if (verifyBtn) {
          verifyBtn.innerHTML = '🔄 Đặt Lại Thử Nghiệm';
          verifyBtn.className = 'btn-act';
        }

        if (statusBox) {
          let reqText = [];
          if (maxMoves > 0) reqText.push(`Chiếu bí trong ≤ ${maxMoves} nước`);
          if (forbidden.length > 0) {
            const pMap = { R: 'Xe', C: 'Pháo', N: 'Mã' };
            reqText.push(`Cấm đi quân: ${forbidden.map((p) => pMap[p] || p).join(', ')}`);
          }
          const condStr = reqText.length > 0 ? ` (${reqText.join(' | ')})` : '';

          statusBox.innerHTML = `
            <div style="color: #2ecc71; font-weight: bold;">
              🔴 THỬ NGHIỆM ĐÃ BẮT ĐẦU!${escapeHtml(condStr)}
            </div>
            <div style="color: #e8dcc6; font-size: 0.8rem; margin-top: 2px;">
              Hãy cầm quân Đỏ xuất chiêu trên bàn cờ để chứng minh thế cờ có lời giải chiến thắng.
            </div>
          `;
        }
        this.render();
      } catch (err) {
        console.error('[Start Verification Error]', err);
        if (statusBox) {
          statusBox.innerHTML = `<span style="color: #e74c3c;">⚠️ Lỗi: ${escapeHtml(err.message)}</span>`;
        }
      }
    },

    publishPuzzle: async function () {
      const token = getAuthToken();
      if (!token) {
        alert('⚠️ Vui lòng đăng nhập tài khoản Kỳ Biến để xuất bản thế cờ lên giang hồ!');
        return;
      }

      if (!this.isVerified || !this.verifyDraftId) {
        alert('Đại hiệp phải hoàn thành thử nghiệm sát cục trước khi công khai!');
        return;
      }

      const statusBox = document.getElementById('creator-status-box');
      if (statusBox) statusBox.innerHTML = '🚀 Đang công khai thế cờ lên giang hồ...';

      try {
        const resp = await apiFetch(`/api/puzzles/ugc/${this.verifyDraftId}/publish`, {
          method: 'POST',
        });

        alert(`🎉 Chúc mừng Đại hiệp! Thế cờ "${resp.data.title}" đã được công khai lên Giang Hồ Kỳ Trận!`);
        this.close();

        const tabUgc = document.getElementById('tab-library-ugc');
        if (tabUgc) tabUgc.click();
      } catch (err) {
        console.error('[Publish Puzzle Error]', err);
        alert(`⚠️ Không thể công khai: ${err.message}`);
        if (statusBox) {
          statusBox.innerHTML = `<span style="color: #e74c3c;">⚠️ Lỗi: ${escapeHtml(err.message)}</span>`;
        }
      }
    },
  };

  // =========================================================================
  // 9. INITIALIZATION
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initCanvas();

    // Gán nút điều khiển
    const btnRestart = document.getElementById('btn-puzzle-restart');
    if (btnRestart) btnRestart.onclick = restartCurrentPuzzle;

    const btnNext = document.getElementById('btn-puzzle-next');
    if (btnNext) btnNext.onclick = nextPuzzle;

    const btnPrev = document.getElementById('btn-puzzle-prev');
    if (btnPrev) btnPrev.onclick = prevPuzzle;

    const btnSound = document.getElementById('btn-sound-toggle');
    if (btnSound) btnSound.onclick = toggleAudio;

    // Nút trong Modals
    const btnModalNext = document.getElementById('btn-vic-next');
    if (btnModalNext) {
      btnModalNext.onclick = () => {
        closeVictoryModal();
        nextPuzzle();
      };
    }

    const btnModalReplay = document.getElementById('btn-vic-replay');
    if (btnModalReplay) {
      btnModalReplay.onclick = () => {
        closeVictoryModal();
        restartCurrentPuzzle();
      };
    }

    const btnDefReplay = document.getElementById('btn-def-replay');
    if (btnDefReplay) {
      btnDefReplay.onclick = () => {
        closeDefeatModal();
        restartCurrentPuzzle();
      };
    }

    // Chuyển Tab Thư Viện: Chính Tông vs Giang Hồ (UGC)
    const tabStandard = document.getElementById('tab-library-standard');
    const tabUgc = document.getElementById('tab-library-ugc');

    if (tabStandard && tabUgc) {
      tabStandard.onclick = () => {
        tabStandard.classList.add('active');
        tabUgc.classList.remove('active');
        const catalogLabel = document.getElementById('catalog-count-label');
        if (catalogLabel) catalogLabel.textContent = '1,500 Kỳ Trận';
        loadPuzzles('EASY');
      };

      tabUgc.onclick = () => {
        tabUgc.classList.add('active');
        tabStandard.classList.remove('active');
        const catalogLabel = document.getElementById('catalog-count-label');
        if (catalogLabel) catalogLabel.textContent = 'Kỳ Trận Giang Hồ';
        loadPuzzles('UGC');
      };
    }

    // Khởi tạo Creator Engine
    Creator.init();

    // Tải 30 thế cờ Tier Nhập Môn mặc định
    loadPuzzles('EASY');

    // Kiểm tra URL Query Params: ?daily=2026-10-18 hoặc ?puzzle=12
    const urlParams = new URLSearchParams(window.location.search);
    const dailyParam = urlParams.get('daily');
    const puzzleParam = urlParams.get('puzzle');

    // Tải Thế cờ Hôm nay
    loadDailyPuzzles(dailyParam).then(() => {
      if (puzzleParam) {
        const targetId = parseInt(puzzleParam, 10);
        const dailyMatch = state.dailyPuzzles.find((p) => p.id === targetId);
        if (dailyMatch) {
          selectDailyPuzzle(dailyMatch);
          return;
        }
      } else if (dailyParam && state.dailyPuzzles.length > 0) {
        selectDailyPuzzle(state.dailyPuzzles[0]);
        return;
      }
    });
  });

  // Export ra window cho tương tác nếu cần
  window.KybienPuzzle = {
    loadPuzzles,
    selectPuzzle,
    restart: restartCurrentPuzzle,
    next: nextPuzzle,
    prev: prevPuzzle,
    toggleAudio,
    creator: Creator,
  };
})();
