# KY BIẾN CHESS — ELO, EXP, RANK & WIN STATISTICS AUDIT REPORT

## 1. EXECUTIVE SUMMARY

This report documents the architectural review, implementation, refactoring, and post-fix automated testing for the **ELO Rating, EXP Progression, Rank Titles, and Leaderboard Statistics System** of **Kỳ Biến Chess**.

All changes were executed directly within the existing repository (`d:\Lap trinh game\ky_bien`) without resetting user ratings or altering unrelated UI/game loop behaviors.

### Core Audit Outcomes:
* **EIDE ELO Formula**: Transitioned from fixed deltas to standard EIDE expected score calculations with dynamic $K$-factor scaling ($K=40$ for initial 10 matches, $K=32$ for established players) and a minimum rating floor clamp of $100$.
* **Martial Arts Rank Tiers**: Implemented `getRankTitle(elo)` helper mapping ratings into 8 martial arts titles (*Tân Thủ*, *Tập Sự*, *Cao Thủ*, *Tinh Anh*, *Đại Cao Thủ*, *Tông Sư*, *Đại Tông Sư*, *Võ Lâm Chí Tôn*).
* **EXP & Level Curve**: Standardized EXP rewards (+10 PvP completion base, +15 win bonus [total +25], +10 draw, +5 loss) while preserving the non-linear level curve $\text{Required Exp} = 100 \times \text{Level}^{1.5}$.
* **Leaderboard & Profile APIs**: Updated `/api/auth/profile` and `/api/auth/leaderboard` to expose rank titles, calculated win rates (with zero-division protection), and multi-level tie-breaker sorting.
* **Test Verification**: Expanded test runner (`npm test`) with dedicated test suites covering ELO formulas, EXP thresholds, rank title boundaries, leaderboard tie-breaking, and XSS sanitization. All tests achieved **100% PASS**.

---

## 2. PRE vs POST ARCHITECTURE COMPARISON

```
+-----------------------------------------------------------------------------------+
| BEFORE REFACTORING                                                                |
+-----------------------------------------------------------------------------------+
| 1. Fixed Rating Deltas (+15 win, -12 loss) ignoring opponent ELO difference.      |
| 2. Static K-factor (no distinction between placement & established matches).       |
| 3. Missing formal Rank Titles (Martial Arts Tiers) in API responses.             |
| 4. Static EXP gains (+50 win, +25 draw, +10 loss) inconsistent with SRS.         |
| 5. Leaderboard ordered solely by ELO without secondary win tie-breakers.          |
+-----------------------------------------------------------------------------------+
                                        │
                                        ▼
+-----------------------------------------------------------------------------------+
| AFTER REFACTORING                                                                 |
+-----------------------------------------------------------------------------------+
| 1. Standard EIDE ELO Rating: E_A = 1 / (1 + 10^((R_B - R_A)/400)).                |
| 2. Dynamic K-factor: K=40 (matches_played < 10), K=32 (matches_played >= 10).     |
| 3. Minimum rating floor: Math.max(100, R') preventing negative/invalid ratings.  |
| 4. Rank Titles: 8 Martial Arts tiers mapped across 1000..2200+ ELO.               |
| 5. Standardized EXP: Base +10, Win +15 (+25 total), Draw +10, Loss +5.            |
| 6. Enhanced Leaderboard: Primary ELO desc, Secondary wins desc, Tertiary ID asc. |
| 7. Zero-division safe win rates & context-aware XSS escaping.                    |
+-----------------------------------------------------------------------------------+
```

---

## 3. COMPREHENSIVE LIST OF CHANGES

| File Path | Description of Changes |
| :--- | :--- |
| [`backend/src/services/levelService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/levelService.ts) | Implemented EIDE ELO formula, $K$-factor selection ($40/32$), `getRankTitle(elo)` mapping, minimum floor clamp ($100$), and EXP reward rules (+25/+10/+5). |
| [`backend/src/services/matchmakingService.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/services/matchmakingService.ts#L293-L308) | Passed `matchesPlayed` into `calculatePostMatchStats` for both white & black players to support dynamic K-factor. |
| [`backend/src/controllers/authController.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/controllers/authController.ts) | Included `rankTitle` and `winRate` in profile/auth endpoints; updated `getLeaderboard` with multi-tier sorting (ELO desc, matches_won desc, ID asc). |
| [`backend/src/tests/eloRating.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/eloRating.test.ts) | Created unit test suite for equal ELO, strong vs weak, K-factor transitions, draw rules, minimum floor clamp, and rank title boundaries. |
| [`backend/src/tests/expLevel.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/expLevel.test.ts) | Created unit test suite for EXP rewards, level formula $100 \times \text{Level}^{1.5}$, and level advancement. |
| [`backend/src/tests/leaderboardStats.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/leaderboardStats.test.ts) | Created unit test suite for win rate %, zero-division safety, leaderboard tie-breaker sorting, and XSS sanitization. |
| [`backend/src/tests/p1Integrity.test.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/p1Integrity.test.ts#L104-L107) | Updated regression test expected Elo (+20/-20) and EXP (+25/+5) assertions for equal ELO placement matches. |
| [`backend/src/tests/runAllTests.ts`](file:///d:/Lap%20trinh%20game/ky_bien/backend/src/tests/runAllTests.ts) | Registered new ELO, EXP, and Leaderboard test suites in global test runner. |

---

## 4. EXACT FORMULAS IMPLEMENTED

### A. Standard EIDE ELO Rating Formula
$$E_A = \frac{1}{1 + 10^{(R_B - R_A)/400}}$$
$$E_B = 1 - E_A$$

$$R'_A = \max\left(100, R_A + \text{Math.round}(K_A \times (S_A - E_A))\right)$$
$$R'_B = \max\left(100, R_B + \text{Math.round}(K_B \times (S_B - E_B))\right)$$

Where:
* $S_A = 1.0$ (Win), $S_A = 0.5$ (Draw), $S_A = 0.0$ (Loss)
* $K_A = 40$ if $\text{matchesPlayed}_A < 10$, else $K_A = 32$
* $K_B = 40$ if $\text{matchesPlayed}_B < 10$, else $K_B = 32$

### B. Rank Titles (Martial Arts Tiers)
```ts
export function getRankTitle(elo: number): string {
  if (elo < 1000) return 'Tân Thủ';
  if (elo <= 1199) return 'Tập Sự';
  if (elo <= 1399) return 'Cao Thủ';
  if (elo <= 1599) return 'Tinh Anh';
  if (elo <= 1799) return 'Đại Cao Thủ';
  if (elo <= 1999) return 'Tông Sư';
  if (elo <= 2199) return 'Đại Tông Sư';
  return 'Võ Lâm Chí Tôn';
}
```

### C. EXP & Level Progression
* **PvP Match Rewards**:
  * Winner: $+25 \text{ EXP}$ ($+10 \text{ completion} + 15 \text{ win bonus}$)
  * Draw: $+10 \text{ EXP}$ ($+10 \text{ completion}$)
  * Loser: $+5 \text{ EXP}$ ($+5 \text{ consolation}$)
* **Level Threshold Formula**:
  $$\text{Required Exp for Level } L = \left\lfloor 100 \times L^{1.5} \right\rfloor$$

### D. Win Rate & Leaderboard Sorting
$$\text{Win Rate \%} = \begin{cases} \text{Number}\left(\left(\frac{\text{matches\_won}}{\text{matches\_played}} \times 100\right).\text{toFixed}(1)\right) & \text{if } \text{matches\_played} > 0 \\ 0 & \text{if } \text{matches\_played} = 0 \end{cases}$$

**Sorting Order**: `elo DESC` $\rightarrow$ `matches_won DESC` $\rightarrow$ `id ASC`.

---

## 5. DATABASE & MIGRATION IMPACT ANALYSIS

* **Database Schema (`prisma/schema.prisma`)**:
  * Existing models (`User`, `Match`) were preserved intact.
  * `elo` field default `1200` maintained.
  * Existing user ELO ratings were **NOT** reset.
* **Idempotency & Atomic Transactions**:
  * Match completion is processed inside Prisma transactions (`prisma.$transaction`).
  * Room status check (`room.status === 'FINISHED'`) prevents duplicate game-over updates.

---

## 6. EMPIRICAL TEST EVIDENCE TABLE

| Test Suite | Test Case Description | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `eloRating` | Equal Elo Win ($1200$ vs $1200$, $K=40$) | $+20$ Winner / $-20$ Loser | $+20$ / $-20$ | **PASS** |
| `eloRating` | Equal Elo Win ($1200$ vs $1200$, $K=32$) | $+16$ Winner / $-16$ Loser | $+16$ / $-16$ | **PASS** |
| `eloRating` | Strong vs Weak Upset ($1200$ beats $1600$) | $+29$ Winner / $-29$ Loser | $+29$ / $-29$ | **PASS** |
| `eloRating` | Draw Rating Adjustment ($1400$ vs $1200$) | Higher drops / Lower gains | $-8$ / $+8$ | **PASS** |
| `eloRating` | Minimum ELO Floor Clamp | ELO $\ge 100$ | $100$ | **PASS** |
| `eloRating` | Rank Titles Tier Mapping ($800..2200$) | Mapped 8 titles | Mapped 8 titles | **PASS** |
| `expLevel` | EXP Rewards (Win, Draw, Loss) | $+25$, $+10$, $+5$ | $+25$, $+10$, $+5$ | **PASS** |
| `expLevel` | Required EXP Curve ($L1..L4$) | $100, 282, 519, 800$ | $100, 282, 519, 800$ | **PASS** |
| `expLevel` | Level Progression from EXP ($1000\text{ EXP}$) | Advances to Level $5$ | Level $5$ | **PASS** |
| `leaderboardStats` | Zero-Division Safety ($0$ matches) | $0\%$ win rate | $0\%$ | **PASS** |
| `leaderboardStats` | Leaderboard Tie-Breakers | ELO desc $\rightarrow$ wins desc $\rightarrow$ ID asc | Correctly sorted | **PASS** |
| `leaderboardStats` | XSS Escaping in Username | `<script>` sanitized | Sanitized | **PASS** |
| `securityRegression` | P0 & P1 Security Suite | All 4 groups pass | All pass | **PASS** |
| `p1Integrity` | Cancel Queue, 2-Player Match, Reconnect | All 8 tests pass | All pass | **PASS** |

---

## 7. PASS / FAIL / PARTIAL STATUS MATRIX

| Requirement / Module | Implementation Status | Test Status | Overall Status |
| :--- | :---: | :---: | :---: |
| **Standard EIDE ELO Rating** | Complete | Complete | **PASS** |
| **Dynamic K-factor (40 / 32)** | Complete | Complete | **PASS** |
| **Minimum ELO Clamp (100)** | Complete | Complete | **PASS** |
| **8 Martial Arts Rank Titles** | Complete | Complete | **PASS** |
| **EXP Rewards (+25/+10/+5)** | Complete | Complete | **PASS** |
| **Non-linear Level Curve** | Complete | Complete | **PASS** |
| **Leaderboard Multi-Tie-Breaker** | Complete | Complete | **PASS** |
| **Zero-Division Win Rate Safety** | Complete | Complete | **PASS** |
| **Context-Aware XSS Escaping** | Complete | Complete | **PASS** |
| **Server-Only Authority / Idempotency** | Complete | Complete | **PASS** |

---

## 8. COMMANDS EXECUTED & RESULTS LOG

```powershell
# Build TypeScript and Execute Test Suite
Cwd: d:\Lap trinh game\ky_bien\backend
Command: npm run build; if ($?) { npm test }

Output Summary:
> kybien-backend@1.0.0 build
> tsc

> kybien-backend@1.0.0 test
> tsc && node dist/tests/runAllTests.js

🧪 RUNNING SECURITY & INTEGRITY REGRESSION TESTS...
✅ Group C Tests Passed!
✅ Group A Tests Passed!
✅ Group B Tests Passed!
✅ Group D Tests Passed!
🎉 ALL SECURITY REGRESSION TESTS COMPLETED SUCCESSFULLY!

🧪 RUNNING MANDATORY P1 INTEGRITY TEST SUITE...
✅ Test 1 Passed: Hủy tìm trận thành công, người chơi hủy không bị ghép trận!
✅ Test 2 Passed: Ghép trận 2 người chơi thành công!
✅ Test 3 Passed: Tạo và vào phòng riêng bằng mã thành công!
✅ Test 4 Passed: Thực hiện chuỗi nước đi hợp lệ & từ chối nước đi sai lượt!
✅ Test 5 Passed: Khôi phục trạng thái phòng đấu khi reload/reconnect thành công!
✅ Test 6, 7 & 8 Passed: Cập nhật Elo/EXP chuẩn xác và ngăn ngừa game_over lặp!
🎉 ALL 8 MANDATORY P1 INTEGRITY TESTS PASSED 100%!

🧪 RUNNING SANITIZE & AUDIT TESTS...
✅ All Sanitize & Audit Tests Passed Successfully!

🧪 RUNNING VARIANT ENGINE & EXTENDED REGRESSION TESTS...
✅ All Variant Engine & Extended Tests Passed Successfully!

🧪 RUNNING AUTHENTICATION & SESSION SYNC AUDIT TESTS...
✅ All Auth Session Audit Tests Passed Successfully!

🧪 RUNNING ELO RATING & RANK TITLE TEST SUITE...
✅ Test 1 Passed! (Equal Elo Win K=40)
✅ Test 2 Passed! (Equal Elo Win K=32)
✅ Test 3 Passed! (Strong vs Weak Player)
✅ Test 4 Passed! (Draw Rating Adjustments)
✅ Test 5 Passed! (Minimum ELO Floor Clamp at 100)
✅ Test 6 Passed! (Rank Titles Tier Boundaries)
🎉 ALL ELO RATING & RANK TITLE TESTS PASSED!

🧪 RUNNING EXP & LEVEL PROGRESSION TEST SUITE...
✅ Test 1 Passed! (Match Outcome EXP Rewards)
✅ Test 2 Passed! (Level Threshold Formula)
✅ Test 3 Passed! (Level Progression)
🎉 ALL EXP & LEVEL PROGRESSION TESTS PASSED!

🧪 RUNNING LEADERBOARD & STATS INTEGRITY TEST SUITE...
✅ Test 1 Passed! (Win Rate & Zero Division)
✅ Test 2 Passed! (Leaderboard Tie-Breaker Sorting)
✅ Test 3 Passed! (Rank Titles in Payload)
✅ Test 4 Passed! (XSS Escaping)
🎉 ALL LEADERBOARD & STATS INTEGRITY TESTS PASSED!

==================================================
🏆 ALL KYBIEN SYSTEM TESTS (SECURITY, ENGINE, ELO, EXP, LEADERBOARD) PASSED 100%!
==================================================
```

---

## 9. STEP-BY-STEP MANUAL VERIFICATION INSTRUCTIONS FOR USERS

To verify the ELO, EXP, Rank Titles, and Leaderboard features locally or in production:

1. **Start Backend Server**:
   ```bash
   cd backend
   npm run build
   npm start
   ```
2. **Register/Login User Accounts**:
   * Create two test accounts (e.g. `KyThuAlpha` and `KyThuBeta`).
   * Perform `POST /api/auth/login` to obtain JWT tokens.
3. **Inspect Profile & Initial Rank Title**:
   * Call `GET /api/auth/me` with header `Authorization: Bearer <TOKEN>`.
   * Verify response includes `elo: 1200`, `rankTitle: "Cao Thủ"`, `matchesPlayed: 0`, `matchesWon: 0`, `winRate: 0`.
4. **Play Ranked Match & Verify Post-Match ELO/EXP Updates**:
   * Connect both players via Socket.IO, complete a ranked match.
   * Observe `game_over` broadcast response containing `newElo`, `eloDelta`, `newExp`, `expDelta`, `newLevel`, and updated `rankTitle`.
5. **Check Global Leaderboard**:
   * Call `GET /api/auth/leaderboard`.
   * Verify top players are ordered by ELO (descending), then wins (descending), with correct `rankTitle` and `winRate` percentages.

---

## 10. INDEPENDENT AUDIT V2 — MATHEMATICAL AND DATA INTEGRITY VERIFICATION

This section documents an independent, rigorous re-verification of the ELO rating mathematics, EXP-to-level curve, match rewards, transaction idempotency, and database guarantees.

### A. Findings by Severity

| ID | Category | Severity | Description | Status / Resolution |
| :--- | :--- | :---: | :--- | :--- |
| **F-01** | Documentation / Report | **LOW** | **Discrepancy in V1 Report Case D**: V1 text claimed $-3 / +3$ for a 1400 vs 1200 draw. Mathematical evaluation of standard ELO $E_W = 0.7597, E_B = 0.2403$ with $K=32$ yields exact deltas $-8.31 / +8.31$, rounded to **$-8 / +8$**. Implementation in `levelService.ts` correctly yields **$-8 / +8$**. | **RESOLVED & DOCUMENTED** |
| **F-02** | Rating Mechanics | **INFO** | **Asymmetric $K$-factor Net Rating Change**: When a placement player ($K=40$) plays an established player ($K=32$), the combined rating change is non-zero (e.g. $+20 - 16 = +4$). This is intentional and standard in ELO systems (FIDE / Chess.com / Lichess) to allow new accounts to quickly reach their true rating. | **VERIFIED INTENTIONAL** |
| **F-03** | Database / Concurrency | **MEDIUM** | **Multi-Instance Concurrency Limitation**: Single-instance idempotency is guaranteed via Node.js single-thread event loop and `room.status === 'FINISHED'`. In multi-instance / clustered deployments without sticky sessions, two concurrent `finishGame` calls could attempt duplicate DB inserts because `matches` table currently lacks a `room_id` unique constraint. | **PARTIAL (Single-instance PASS / Multi-instance requires DB schema unique constraint on `room_id`)** |
| **F-04** | Global vs Per-Variant ELO | **INFO** | **Global Rating System**: Database model `User` contains a single `elo` column. Rating updates apply globally across all 4 variants (`n`, `kb`, `t`, `g`). | **VERIFIED DESIGN** |

---

### B. Mathematical Formula Verification (Cases A through F)

All calculations were evaluated against `calculatePostMatchStats()` in `backend/src/services/levelService.ts`:

#### Case A: Equal Rating 1200 vs 1200, both K=40, White wins
* **Inputs**: White $1200$ ($K=40$), Black $1200$ ($K=40$), $S_W=1.0, S_B=0.0$
* **Expected Scores**: $E_W = 0.5$, $E_B = 0.5$
* **Exact Deltas Before Rounding**: White $+20.0$, Black $-20.0$
* **Actual Deltas from Implementation**: White $+20$, Black $-20$
* **Expected Final Ratings**: White $1220$, Black $1180$
* **Actual Final Ratings**: White $1220$, Black $1180$
* **Test File & Name**: `v2IndependentAudit.test.ts` $\rightarrow$ `Case A` (**PASS**)

#### Case B: Equal Rating 1200 vs 1200, both K=32, White wins
* **Inputs**: White $1200$ ($K=32$), Black $1200$ ($K=32$), $S_W=1.0, S_B=0.0$
* **Expected Scores**: $E_W = 0.5$, $E_B = 0.5$
* **Exact Deltas Before Rounding**: White $+16.0$, Black $-16.0$
* **Actual Deltas from Implementation**: White $+16$, Black $-16$
* **Expected Final Ratings**: White $1216$, Black $1184$
* **Actual Final Ratings**: White $1216$, Black $1184$
* **Test File & Name**: `v2IndependentAudit.test.ts` $\rightarrow$ `Case B` (**PASS**)

#### Case C: Rating 1200 beats Rating 1600, both K=32 (Upset)
* **Inputs**: White $1200$ ($K=32$), Black $1600$ ($K=32$), $S_W=1.0, S_B=0.0$
* **Expected Scores**: $E_W = \frac{1}{1 + 10^1} = \frac{1}{11} \approx 0.090909$, $E_B \approx 0.909091$
* **Exact Deltas Before Rounding**: White $32 \times (1 - \frac{1}{11}) = +\frac{320}{11} \approx +29.090909$, Black $-\frac{320}{11} \approx -29.090909$
* **Actual Deltas from Implementation**: White $+29$, Black $-29$
* **Expected Final Ratings**: White $1229$, Black $1571$
* **Actual Final Ratings**: White $1229$, Black $1571$
* **Test File & Name**: `v2IndependentAudit.test.ts` $\rightarrow$ `Case C` (**PASS**)

#### Case D: Rating 1400 vs 1200, both K=32, Draw
* **Inputs**: White $1400$ ($K=32$), Black $1200$ ($K=32$), $S_W=0.5, S_B=0.5$
* **Expected Scores**: $E_W = \frac{1}{1 + 10^{-0.5}} \approx 0.759747$, $E_B \approx 0.240253$
* **Exact Deltas Before Rounding**: White $32 \times (0.5 - 0.759747) = -8.311902$, Black $+8.311902$
* **Actual Deltas from Implementation**: White $-8$, Black $+8$
* **Expected Final Ratings**: White $1392$, Black $1208$
* **Actual Final Ratings**: White $1392$, Black $1208$
* **Test File & Name**: `v2IndependentAudit.test.ts` $\rightarrow$ `Case D` (**PASS**)
* *Note*: Disproves the V1 report statement claiming $-3/+3$. The code implementation was already correctly producing $-8/+8$.

#### Case E: Asymmetric K-factors (White K=40, Black K=32, Equal Ratings 1200, White Wins)
* **Inputs**: White $1200$ ($K=40$), Black $1200$ ($K=32$), $S_W=1.0, S_B=0.0$
* **Expected Scores**: $E_W = 0.5$, $E_B = 0.5$
* **Exact Deltas Before Rounding**: White $+20.0$, Black $-16.0$
* **Actual Deltas from Implementation**: White $+20$, Black $-16$
* **Combined Rating Change**: $+20 - 16 = +4$ (net rating injection into pool)
* **Explanation**: $K$-factor asymmetry reflects higher rating volatility for placement accounts ($<10$ matches). Rating conservation applies only when both players share equal $K$-factors.
* **Test File & Name**: `v2IndependentAudit.test.ts` $\rightarrow$ `Case E` (**PASS**)

#### Case F: Minimum ELO Floor Clamp at 100
* **Inputs**: White $105$ ($K=40$), Black $105$ ($K=40$), White Wins
* **Uncapped Deltas**: White $+20$, Black $-20$ (Uncapped Black rating = $85$)
* **Clamped Black Rating**: $\max(100, 85) = 100$
* **Actual Deltas from Implementation**: White $+20$, Black $-5$
* **Safety Verification**: Prevents negative or non-finite ELO ratings under all loss conditions.
* **Test File & Name**: `v2IndependentAudit.test.ts` $\rightarrow$ `Case F` (**PASS**)

---

### C. EXP-to-Level Curve & Threshold Analysis

The formula $\text{Required Exp for Level } L = \left\lfloor 100 \times L^{1.5} \right\rfloor$ is evaluated as a **cumulative total-EXP threshold**. EXP is stored cumulatively in `user.exp` and is **never reset or subtracted** on level-up.

#### Minimum Total EXP Required for Levels 1 through 10:

| Target Level | Exact Minimum Cumulative EXP Required | Behavior at Threshold $-1$ | Behavior at Exact Threshold | Behavior at Threshold $+1$ |
| :---: | :---: | :---: | :---: | :---: |
| **Level 1** | $0 \text{ EXP}$ | N/A | Level 1 | Level 1 |
| **Level 2** | $100 \text{ EXP}$ | Level 1 ($99 \text{ EXP}$) | Level 2 ($100 \text{ EXP}$) | Level 2 ($101 \text{ EXP}$) |
| **Level 3** | $282 \text{ EXP}$ | Level 2 ($281 \text{ EXP}$) | Level 3 ($282 \text{ EXP}$) | Level 3 ($283 \text{ EXP}$) |
| **Level 4** | $519 \text{ EXP}$ | Level 3 ($518 \text{ EXP}$) | Level 4 ($519 \text{ EXP}$) | Level 4 ($520 \text{ EXP}$) |
| **Level 5** | $800 \text{ EXP}$ | Level 4 ($799 \text{ EXP}$) | Level 5 ($800 \text{ EXP}$) | Level 5 ($801 \text{ EXP}$) |
| **Level 6** | $1118 \text{ EXP}$ | Level 5 ($1117 \text{ EXP}$) | Level 6 ($1118 \text{ EXP}$) | Level 6 ($1119 \text{ EXP}$) |
| **Level 7** | $1469 \text{ EXP}$ | Level 6 ($1468 \text{ EXP}$) | Level 7 ($1469 \text{ EXP}$) | Level 7 ($1470 \text{ EXP}$) |
| **Level 8** | $1852 \text{ EXP}$ | Level 7 ($1851 \text{ EXP}$) | Level 8 ($1852 \text{ EXP}$) | Level 8 ($1853 \text{ EXP}$) |
| **Level 9** | $2262 \text{ EXP}$ | Level 8 ($2261 \text{ EXP}$) | Level 9 ($2262 \text{ EXP}$) | Level 9 ($2263 \text{ EXP}$) |
| **Level 10** | $2700 \text{ EXP}$ | Level 9 ($2699 \text{ EXP}$) | Level 10 ($2700 \text{ EXP}$) | Level 10 ($2701 \text{ EXP}$) |

* **Verification of $1000 \text{ EXP}$**: $800 \le 1000 < 1118$, resulting in **Level 5**.
* **Multi-level Jump**: A player gaining $2000 \text{ EXP}$ from Level 1 advances directly to **Level 8** in a single reward cycle because `calculateLevelFromExp()` loops until `exp < requiredExp`.

---

### D. Match Reward Consistency

| Match Type | Win Reward | Draw Reward | Loss Reward | Frequency |
| :--- | :---: | :---: | :---: | :---: |
| **PvP Ranked Match** | $+25 \text{ EXP}$ ($10 \text{ completion} + 15 \text{ win}$) | $+10 \text{ EXP}$ ($10 \text{ completion}$) | $+5 \text{ EXP}$ ($5 \text{ consolation}$) | Max 1 per match finish |
| **Cancelled Queue / Waiting Room** | $0 \text{ EXP}$ | $0 \text{ EXP}$ | $0 \text{ EXP}$ | $0$ |
| **Disconnected Match** | Granted to non-disconnected winner | N/A | Disconnected player loses | Max 1 per match finish |

---

### E. Concurrency & Database Limitations

1. **Single Instance Safety**:
   * Synchronous memory check `if (!room || room.status === 'FINISHED') return null;` in `MatchmakingManager.finishGame()` is atomic within Node.js event loop.
   * `prisma.$transaction([ match.create, user.update White, user.update Black ])` guarantees all-or-nothing database atomicity.
2. **Multi-Instance Limitation**:
   * In a multi-node cluster without sticky sessions or distributed locks, concurrent `finishGame` calls across nodes could bypass in-memory `activeRooms` checks.
   * **Recommended Production Schema Enhancement**: Add `room_id String @unique` to `model Match` in `prisma/schema.prisma` to enforce database-level idempotency across multiple backend nodes.

---

### F. Real Execution Command Log & Test Output

```powershell
Cwd: d:\Lap trinh game\ky_bien\backend
Command: npm run build; if ($?) { npm test }
Exit Code: 0

Output:
> kybien-backend@1.0.0 build
> tsc

> kybien-backend@1.0.0 test
> tsc && node dist/tests/runAllTests.js

🧪 RUNNING SECURITY & INTEGRITY REGRESSION TESTS...
✅ Group C Tests Passed!
✅ Group A Tests Passed!
✅ Group B Tests Passed!
✅ Group D Tests Passed!
🎉 ALL SECURITY REGRESSION TESTS COMPLETED SUCCESSFULLY!

🧪 RUNNING MANDATORY P1 INTEGRITY TEST SUITE...
✅ Test 1 Passed: Hủy tìm trận thành công!
✅ Test 2 Passed: Ghép trận 2 người chơi thành công!
✅ Test 3 Passed: Tạo và vào phòng riêng bằng mã thành công!
✅ Test 4 Passed: Thực hiện chuỗi nước đi hợp lệ & từ chối nước đi sai lượt!
✅ Test 5 Passed: Khôi phục trạng thái phòng đấu khi reload/reconnect thành công!
✅ Test 6, 7 & 8 Passed: Cập nhật Elo/EXP chuẩn xác và ngăn ngừa game_over lặp!
🎉 ALL 8 MANDATORY P1 INTEGRITY TESTS PASSED 100%!

🧪 RUNNING SANITIZE & AUDIT TESTS...
✅ All Sanitize & Audit Tests Passed Successfully!

🧪 RUNNING VARIANT ENGINE & EXTENDED REGRESSION TESTS...
✅ All Variant Engine & Extended Tests Passed Successfully!

🧪 RUNNING AUTHENTICATION & SESSION SYNC AUDIT TESTS...
✅ All Auth Session Audit Tests Passed Successfully!

🧪 RUNNING ELO RATING & RANK TITLE TEST SUITE...
✅ Test 1 Passed!
✅ Test 2 Passed!
✅ Test 3 Passed!
✅ Test 4 Passed!
✅ Test 5 Passed!
✅ Test 6 Passed!
🎉 ALL ELO RATING & RANK TITLE TESTS PASSED!

🧪 RUNNING EXP & LEVEL PROGRESSION TEST SUITE...
✅ Test 1 Passed!
✅ Test 2 Passed!
✅ Test 3 Passed!
🎉 ALL EXP & LEVEL PROGRESSION TESTS PASSED!

🧪 RUNNING LEADERBOARD & STATS INTEGRITY TEST SUITE...
✅ Test 1 Passed!
✅ Test 2 Passed!
✅ Test 3 Passed!
✅ Test 4 Passed!
🎉 ALL LEADERBOARD & STATS INTEGRITY TESTS PASSED!

🧪 RUNNING INDEPENDENT AUDIT V2 MATHEMATICAL & DATA INTEGRITY TESTS...
-> 1. ELO Mathematical Verification (Cases A through F)...
✅ Section 1 ELO Mathematical Cases A-F Verified 100%!
-> 2. EXP-to-Level Curve & Boundary Verification...
✅ Section 2 EXP-to-Level Curve & Boundaries Verified 100%!
-> 3. Match Reward & PvP Consistency Verification...
✅ Section 3 Match Reward & PvP Consistency Verified 100%!
🎉 ALL INDEPENDENT AUDIT V2 MATHEMATICAL & DATA INTEGRITY TESTS PASSED!

==================================================
🏆 ALL KYBIEN SYSTEM TESTS (SECURITY, ENGINE, ELO, EXP, LEADERBOARD, V2 AUDIT) PASSED 100%!
==================================================
```

---

### G. Remaining Status Matrix

| Module / Topic | Audit Status | Production Status | Notes |
| :--- | :---: | :---: | :--- |
| **ELO Mathematics (Cases A-F)** | **PASS** | Ready | Exact values verified against `v2IndependentAudit.test.ts` |
| **EXP-to-Level Curve & Boundaries** | **PASS** | Ready | Thresholds 1-10 verified; multi-level jump tested |
| **Match Rewards (+25/+10/+5)** | **PASS** | Ready | Single-reward per match enforced |
| **Single-Instance Idempotency** | **PASS** | Ready | Node.js single-thread event loop & `prisma.$transaction` verified |
| **Multi-Instance Clustered Idempotency** | **PARTIAL** | Requires DB Schema Migration | Recommend adding `@unique room_id` constraint before multi-node scale |
| **Global Leaderboard & Win Rates** | **PASS** | Ready | Multi-tie-breaker sorting verified |
