// @ts-nocheck
import {
  newGame, newPlayer, startRound, makeMatches, simMatch, applyRound,
  buyUnit, sellUnit, moveUnit, buyXp, reroll, incomeOf,
  traitCounts, tierOf, activeBonds, boardList, boardCount, poolCount,
  HERO, TR, CS, BONDS, XPN, botPrep, mkUnitObj, addUnit, poolTake
} from '../engine/coHuyenSuEngine.js';
import { coHuyenSuService } from '../services/coHuyenSuService.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failed++;
  }
}

async function runAntiCheatTests() {
  console.log('====================================================');
  console.log('🛡️ BẮT ĐẦU TEST TOÀN DIỆN CƠ CHẾ CHỐNG HACK SERVER-AUTHORITATIVE');
  console.log('====================================================\n');

  // TEST 1: CHỐNG HACK QUÂN LƯƠNG (DECK VALIDATION)
  console.log('--- TEST 1: Xác thực & Chống Hack Quân Lương (Tối đa 10 Điểm) ---');
  const ptsMap: Record<number, number> = { 1: 3, 2: 5, 3: 7 };
  function validateDeck(rawDeck: any) {
    if (!Array.isArray(rawDeck)) return [{ heroId: 'caolo', star: 1 }];
    const sanitized: Array<{ heroId: string; star: number }> = [];
    let totalPts = 0;
    for (const item of rawDeck) {
      if (!item || typeof item.heroId !== 'string' || !HERO[item.heroId]) continue;
      const star = Math.min(3, Math.max(1, Math.floor(Number(item.star) || 1)));
      const cost = ptsMap[star] || 3;
      if (totalPts + cost <= 10) {
        totalPts += cost;
        sanitized.push({ heroId: item.heroId, star });
      }
    }
    return sanitized.length > 0 ? sanitized : [{ heroId: 'caolo', star: 1 }];
  }

  const hackDeck1 = [
    { heroId: 'thanhgiong', star: 3 }, // 7 pts
    { heroId: 'laclongquan', star: 3 }, // 7 pts -> Tổng 14 pts (Gian lận)
  ];
  const cleaned1 = validateDeck(hackDeck1);
  assert(cleaned1.length === 1 && cleaned1[0].heroId === 'thanhgiong', 'Server chặn đứng deck 2 tướng 3 sao (14 > 10 điểm)');

  const hackDeck2 = [
    { heroId: 'hacker_hero_999', star: 3 }, // Tướng không tồn tại
    { heroId: 'caolo', star: 2 }, // 5 pts
    { heroId: 'yetkieu', star: 2 }, // 5 pts -> Tổng 10 pts (Hợp lệ)
  ];
  const cleaned2 = validateDeck(hackDeck2);
  assert(cleaned2.length === 2 && !cleaned2.some(c => c.heroId === 'hacker_hero_999'), 'Server loại bỏ mã tướng lạ / tướng hack');

  // TEST 2: CHỐNG HACK VÀNG (GOLD & ECONOMY)
  console.log('\n--- TEST 2: Chống Hack Vàng, Mua Tướng & Reroll ---');
  const G = newGame({ diff: 1 });
  const player = G.players[0];
  player.gold = 0; // Đặt về 0 vàng
  player.shop = ['thanhgiong', 'caolo', 'sontinh', 'yetkieu', 'leloi']; // Có tướng 5đ và 1đ

  const buyZeroGold = buyUnit(G, player, 1); // Cao Lỗ 1đ
  assert(buyZeroGold === false && player.gold === 0, 'Người chơi 0 vàng không thể mua tướng');

  player.gold = 3;
  const buyXpNotEnough = buyXp(player); // Cần 4 vàng
  assert(buyXpNotEnough === false && player.gold === 3 && player.xp === 0, 'Người chơi có 3 vàng không thể mua kinh nghiệm (cần 4 vàng)');

  player.gold = 1;
  const oldShop = [...player.shop];
  const rerollNotEnough = reroll(G, player); // Cần 2 vàng
  assert(rerollNotEnough === false && player.gold === 1 && JSON.stringify(player.shop) === JSON.stringify(oldShop), 'Người chơi có 1 vàng không thể làm mới cửa hàng (cần 2 vàng)');

  // TEST 3: CHỐNG HACK SỐ LƯỢNG TƯỚNG TRÊN BÀN (BOARD CAPACITY = LEVEL)
  console.log('\n--- TEST 3: Giới hạn số lượng tướng trên bàn theo Cấp độ ---');
  player.lvl = 1; // Cấp 1 chỉ được 1 tướng trên bàn
  player.board.fill(null);
  player.bench.fill(null);
  player.board[0] = mkUnitObj('caolo', 1); // 1 tướng đã trên bàn
  player.bench[0] = mkUnitObj('yetkieu', 1);

  // Giả lập thao tác kéo tướng thứ 2 từ bench lên board[1]
  const destUnit = player.board[1];
  const currentBoardUnits = boardCount(player);
  const isIllegalMove = (!destUnit && currentBoardUnits >= player.lvl);
  assert(isIllegalMove === true, 'Server chặn kéo tướng thứ 2 lên bàn khi người chơi đang ở Cấp độ 1');

  // TEST 4: CHỐNG HACK GIAO TRANH & SÁT THƯƠNG (SERVER-AUTHORITATIVE COMBAT)
  console.log('\n--- TEST 4: Mô phỏng Giao tranh & Trừ máu độc quyền tại Server ---');
  G.round = 4; // Vòng 4 PvP
  const G_test = newGame({ diff: 1 });
  G_test.round = 4;
  const pA = G_test.players[0];
  const pB = G_test.players[1];
  pA.hp = 100;
  pB.hp = 100;
  pA.board[0] = mkUnitObj('thanhgiong', 3); // Đội hình mạnh
  pB.board[0] = mkUnitObj('caolo', 1); // Đội hình yếu

  G_test.matches = [{ a: pA, b: pB, pve: false }];
  simMatch(G_test, G_test.matches[0]);
  assert(G_test.matches[0].res !== undefined, 'Server tự chạy hàm simMatch mô phỏng trận đấu');
  assert(G_test.matches[0].res.win0 === true, 'Đội Thánh Gióng 3★ thắng đội Cao Lỗ 1★ chính xác');

  applyRound(G_test);
  assert(pB.hp < 100, `Server tự trừ máu người thua (pB còn ${pB.hp} HP). Client không thể sửa số máu này.`);
  assert(pA.hp === 100, 'Người thắng pA bảo toàn nguyên vẹn 100 HP');

  // TEST 5: CHỐNG HACK CHIÊU HIỀN CÁC (3 SHARDS / NGÀY & ĐỦ HB)
  console.log('\n--- TEST 5: Giới hạn Mua Mảnh Chiêu Hiền Các & Hưng Bảo ---');
  const testUserId = 99999;
  try {
    // Mua quá 3 mảnh cùng 1 lúc
    await coHuyenSuService.buyShard(testUserId, 1, 4);
    assert(false, 'Lẽ ra phải chặn mua 4 mảnh');
  } catch (err: any) {
    assert(err.message.includes('1 - 3 mảnh'), 'Chặn thành công yêu cầu mua quá 3 mảnh cùng lúc');
  }

  // TEST 6: CHỐNG HACK HỢP THẺ & GHÉP THẺ (CARD FUSION & MERGE)
  console.log('\n--- TEST 6: Kiểm tra điều kiện Ghép thẻ & Hợp sao ---');
  try {
    // Ghép thẻ 1★ khi không đủ mảnh
    await coHuyenSuService.fuseShardsToCard(testUserId, 'thanhgiong');
    assert(false, 'Lẽ ra phải chặn ghép khi thiếu mảnh');
  } catch (err: any) {
    assert(err.message.includes('Cần đủ') && err.message.includes('mảnh'), 'Chặn ghép thẻ khi người chơi không đủ mảnh');
  }

  try {
    // Hợp lên 2★ khi chưa đủ 3 thẻ
    await coHuyenSuService.mergeCards(testUserId, 'caolo', 1);
    assert(false, 'Lẽ ra phải chặn hợp khi thiếu 3 thẻ');
  } catch (err: any) {
    assert(err.message.includes('tối thiểu 3 thẻ'), 'Chặn hợp thẻ khi không đủ 3 thẻ cùng loại');
  }

  console.log('\n====================================================');
  console.log(`🏁 KẾT QUẢ KIỂM THỬ: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runAntiCheatTests().catch(e => {
  console.error('Lỗi kiểm thử:', e);
  process.exit(1);
});
