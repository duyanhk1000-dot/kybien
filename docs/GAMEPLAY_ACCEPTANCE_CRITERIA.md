# TIÊU CHÍ NGHIỆM THU GAMEPLAY THỐNG NHẤT — MỤC 1
## DỰ ÁN: TIÊN LỘ: VẠN GIỚI TRANH PHONG

**Tác giả:** Senior QA Lead & Gameplay Engineer  
**Phiên bản:** 2.0 (Verified & Accepted)  
**Phạm vi:** Mục 1 — Thống Nhất Gameplay Tổng Thể  
**Trạng thái:** ĐÃ NGHIỆM THU ĐẠT 100% (ALL TESTS PASSED & VERIFIED)  

---

## I. NGUYÊN TẮC NGHIỆM THU

Một tính năng chỉ được đánh dấu là **HOÀN THÀNH (PASSED)** khi thỏa mãn đồng thời:
1. Có bằng chứng kiểm thử thực tế (Test Run Logs) đạt 100%.
2. Không gây lỗi hồi quy (Regression) trên bất kỳ luồng hoạt động cũ nào.
3. Đúng với định hướng đã được Chủ Dự Án phê duyệt: *"Chiến đấu tự động hoàn toàn, thể loại Idle RPG tu tiên kết hợp cốt truyện và thám hiểm tự do"*.

---

## II. MA TRẬN TIÊU CHÍ NGHIỆM THU CHI TIẾT & KẾT QUẢ THỰC TẾ

### Tiêu Chí 1: Chiến Đấu Tự Động Hoàn Toàn (Full Auto-Combat)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-1.1** | Người chơi khi bấm "Khiêu Chiến" Dị Thú không phải bấm chọn `STRIKE`, `SKILL`, `GUARD`, `FLEE` ở bất kỳ hiệp nào. | Thao tác trên giao diện thực tế và theo dõi hàm `startBattle`. | Trận đấu tự động diễn tiến từng hiệp, thanh máu co giãn, combat log tự động chạy mà không cần bất kỳ cú click chuột nào của người chơi. | **✅ ĐẠT (PASS)** |
| **AC-1.2** | Hệ thống tự động quyết định thứ tự xuất chiêu dựa trên Thân pháp (Speed). | Kiểm tra log chiến trận giữa nhân vật có Thân pháp cao hơn quái và ngược lại. | Bên có Speed cao hơn luôn là bên tung đòn mở màn ở Hiệp 1. | **✅ ĐẠT (PASS)** |
| **AC-1.3** | Nhân vật tự động thi triển Thần Thông khi đủ Chân Khí (theo phân tầng: 12/20/30 Qi) và đánh thường tích lũy Qi (+8 Qi) khi thiếu. | So sánh chỉ số Qi trên giao diện và dòng log chiêu thức. | Khi Qi $\ge$ chi phí chiêu thức, log báo thi triển Thần Thông và trừ Qi tương ứng; khi thiếu Qi, log báo Trảm Kích và hồi +8 Qi. | **✅ ĐẠT (PASS)** |
| **AC-1.4** | Bắt buộc xem tối thiểu Hiệp 1 trước khi mở nút Bỏ qua. Nút Skip bị vô hiệu hóa trong Hiệp 1 và kích hoạt sau khi Hiệp 1 kết thúc. | Quan sát nút `[⏭ Xem Kết Quả Ngay]` từ lúc bắt đầu trận đến hết Hiệp 1. | Nút `Disabled` trong Hiệp 1, tự động chuyển sang `Enabled` ngay khi Hiệp 1 kết thúc. Bấm nút sẽ nhảy ngay đến kết quả cuối cùng. | **✅ ĐẠT (PASS)** |
| **AC-1.5** | Giới hạn 30 hiệp và phán quyết hòa trận an toàn. | Mô phỏng trận đấu kéo dài quá 30 hiệp. | Trận đấu dừng ở Hiệp 30. Nếu % HP người chơi cao hơn: nhận 50% EXP/Tu vi. Nếu thấp hơn hoặc bằng: tự động rút lui an toàn, không bị phạt HP về 20 hay mất thể lực. | **✅ ĐẠT (PASS)** |
| **AC-1.6** | Hình phạt chuẩn xác khi thất bại trong chiến đấu. | Người chơi bị quái đánh cạn HP trong trận. | Trở về Động Phủ Tán Tu với đúng 20 HP, mất 15 Thể lực; 100% trang bị, túi đồ, cảnh giới và cấp độ được bảo toàn nguyên vẹn. | **✅ ĐẠT (PASS)** |

---

### Tiêu Chí 2: Tách Bạch EXP (Cấp Độ Thể Phách) vs Tu Vi (Cảnh Giới)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-2.1** | Điểm EXP từ chiến đấu và nhiệm vụ được cộng trực tiếp vào thanh EXP nhân vật. | Đánh bại 1 Thổ Lang (thưởng 100 EXP), kiểm tra `player.exp`. | `player.exp` tăng chính xác 100 điểm; không còn bị vứt bỏ như trước (`BUG-01`). | **✅ ĐẠT (PASS)** |
| **AC-2.2** | Khi tích lũy đủ EXP, nhân vật thăng cấp Cấp Độ Thể Phách (Level Up). | Nhận EXP vượt ngưỡng `exp_required`. | Nhân vật tăng cấp (Level 1 $\rightarrow$ Level 2), `max_health` tăng +4, `max_fatigue` tăng +1 mỗi 2 cấp, mỗi 10 cấp thưởng 1 Điểm Tiềm Năng, hồi đầy thể lực. | **✅ ĐẠT (PASS)** |
| **AC-2.3** | Tu Vi chỉ phục vụ mục đích ngưng tụ chân nguyên và Xung Quan Đột Phá Cảnh Giới (Realm). | Kiểm tra thanh Tu Vi và hàm `addCultivation`. | Điểm Tu Vi tăng riêng biệt; khi đầy thanh tu vi, sáng nút "Xung Quan Đột Phá" để nâng Cảnh Giới (Phàm Nhân $\rightarrow$ Luyện Khí $\rightarrow$ Trúc Cơ). | **✅ ĐẠT (PASS)** |
| **AC-2.4** | Điều kiện nhiệm vụ yêu cầu Cấp Độ (`min_level`) hoạt động chính xác. | Kiểm tra nhiệm vụ có `"min_level": 2` trong `quests.json`. | Khi nhân vật Level 1: hiển thị trạng thái Khóa (`LOCKED`); khi nhân vật lên Level 2: tự động mở khóa thành Có Thể Nhận (`AVAILABLE`). | **✅ ĐẠT (PASS)** |

---

### Tiêu Chí 3: Tính Nhất Quán Nguồn Sự Thật Dữ Liệu (Data Integrity)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-3.1** | Đồng bộ tuyệt đối 9 tệp JSON giữa thư mục Backend và Frontend. | Chạy script kiểm tra hash nhị phân trên toàn bộ 9 file JSON. | 100% hash trùng khớp, không có bất kỳ sai lệch nào về vật phẩm, quái vật hay nhiệm vụ (`BUG-03`). | **✅ ĐẠT (PASS)** |
| **AC-3.2** | Vật phẩm `item_thanh_tam_boi` tồn tại hợp lệ ở cả Backend và Frontend. | Truy vấn API `/api/xianxia/crafting/items` và đọc `items.json`. | Cả hai phía đều trả về đầy đủ định nghĩa, chỉ số của Thanh Tâm Ngọc Bội. | **✅ ĐẠT (PASS)** |

---

### Tiêu Chí 4: Lưu Trữ, Khôi Phục & Tương Thích Dữ Liệu Cũ (Persistence)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-4.1** | Dữ liệu cũ trong `localStorage` không bị mất khi cập nhật cấu trúc mới. | Nạp chuỗi JSON của phiên bản cũ (thiếu trường `level`, `exp`) vào `localStorage` rồi tải lại trang. | Game tự động điền các giá trị mặc định (`level: 1, exp: 0`) mà không xóa tên, đồ đạc hay cảnh giới của người chơi. | **✅ ĐẠT (PASS)** |
| **AC-4.2** | Nút "Trùng Sinh" (Reset) xóa sạch dữ liệu và mở lại màn hình Tạo Nhân Vật. | Bấm nút "🔄 Trùng Sinh" trên thanh điều hướng và xác nhận. | LocalStorage được dọn dẹp, nhân vật trở về trạng thái sơ khai, mở modal chọn Linh Căn & Xuất Thân. | **✅ ĐẠT (PASS)** |

---

### Tiêu Chí 5: Bảo Toàn Toàn Bộ Bộ Kiểm Thử Hệ Thống (Zero Regression)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-5.1** | Bộ kiểm thử Thế Giới Tu Tiên (`xianxiaWorld.test.ts`) đạt 100%. | Chạy `node dist/tests/xianxiaWorld.test.js`. | Toàn bộ 8 bài test phân khu, lộ trình, di chuyển liên vùng đạt PASS. | **✅ ĐẠT (PASS)** |
| **AC-5.2** | Bộ kiểm thử Danh Lục Dị Thú (`xianxiaBestiary.test.ts`) đạt 100%. | Chạy `node dist/tests/xianxiaBestiary.test.js`. | Toàn bộ 6 bài test NPC, quái vật, roll loot đạt PASS. | **✅ ĐẠT (PASS)** |
| **AC-5.3** | Bộ kiểm thử Chế Tác & Thu Thập (`xianxiaCrafting.test.ts`) đạt 100%. | Chạy `node dist/tests/xianxiaCrafting.test.js`. | Toàn bộ 6 bài test lò luyện đan, rèn kiếm, bãi thảo mộc đạt PASS. | **✅ ĐẠT (PASS)** |
| **AC-5.4** | Bộ kiểm thử Nhiệm Vụ Tu Chân (`xianxiaQuest.test.ts`) đạt 100%. | Chạy `node dist/tests/xianxiaQuest.test.js`. | Toàn bộ các bài test chính tuyến, cày cuốc, khảo nghiệm đạt PASS. | **✅ ĐẠT (PASS)** |
| **AC-5.5** | Bộ kiểm thử Tiêu Cục Giang Hồ (`xianxiaAgency.test.ts`) đạt 100%. | Chạy `node dist/tests/xianxiaAgency.test.js`. | Toàn bộ 9 bài test áp tiêu, phi tiêu, thăng cấp tiêu sư đạt PASS. | **✅ ĐẠT (PASS)** |
| **AC-5.6** | Bộ kiểm thử Tích Hợp Frontend (`xianxiaFrontendIntegration.test.ts`) đạt 100%. | Chạy `node dist/tests/xianxiaFrontendIntegration.test.js`. | Cả 3 bài test tải trang, nạp script engine, liên kết sảnh chính đạt PASS. | **✅ ĐẠT (PASS)** |

---

## III. TIÊU CHÍ NGHIỆM THU MỤC 2: CORE GAMEPLAY (AUTHORITATIVE BACKEND)

### Tiêu Chí 6: Máy Chủ Thẩm Quyền & Lưu Trữ Dữ Liệu Thực Thể (Authoritative Database)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-6.1** | Schema Prisma và PostgreSQL bổ sung 4 bảng thực thể tu tiên (`XianxiaCharacter`, `XianxiaInventoryItem`, `XianxiaBattleLog`, `XianxiaQuestProgress`) liên kết an toàn với `User`. | Chạy `prisma generate` và `prisma db push` lên Supabase. | Tạo bảng thành công, khóa ngoại `onDelete: Cascade`, quan hệ 1-1 và 1-N chuẩn xác. | **✅ ĐẠT (PASS)** |
| **AC-6.2** | Khởi tạo nhân vật phía máy chủ khi người chơi đăng nhập và truy cập phân hệ Tiên Lộ. | Gọi API `GET /api/xianxia/gameplay/character/me`. | Tự động sinh nhân vật mặc định (Lv1, Phàm Nhân, Căn Cốt 12, Ngộ Tính 14, Khí Vận 12, 120 HP, 100 Thể Lực, 150 Bạc) cùng túi đồ khởi đầu. | **✅ ĐẠT (PASS)** |

### Tiêu Chí 7: Tính Toán Thuộc Tính & Chiến Lực Thực Thể (Stat Calculations)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-7.1** | Thuật toán tính toán chỉ số chiến đấu tổng hợp từ Căn cốt, Ngộ tính, Khí vận và Trang bị 3 ô. | Test đơn vị `calculateEffectiveStats` trên nhân vật trang bị Thanh Phong Kiếm và Thiết Giáp Y. | Công, Thủ, Tốc, Max Qi tính toán tức thì, không lưu trường phụ thuộc vào DB, không bị cộng dồn chồng chéo khi tháo lắp đồ. | **✅ ĐẠT (PASS)** |
| **AC-7.2** | Phân bổ điểm tiềm năng (`physique`, `comprehension`, `luck`) an toàn phía máy chủ. | Gọi API `POST /api/xianxia/gameplay/character/stat-points`. | Khấu trừ đúng 1 `stat_points`, tăng thuộc tính tương ứng, kiểm soát không cho phép cộng điểm âm. | **✅ ĐẠT (PASS)** |

### Tiêu Chí 8: Chiến Đấu Tự Động Thẩm Quyền Phía Máy Chủ (Authoritative Combat)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-8.1** | Người chơi gửi yêu cầu khiêu chiến quái (`monster_id`), máy chủ quyết định từng lượt, sát thương, kỹ năng và kết quả. | Gọi `POST /api/xianxia/gameplay/combat/battle`. | Máy chủ mô phỏng 30 hiệp tối đa, frontend không thể tự gửi kết quả gian lận; trả về danh sách `playbackTurns` và kết quả phán quyết. | **✅ ĐẠT (PASS)** |
| **AC-8.2** | Cơ chế chống nhận thưởng trùng lặp (Idempotency Key). | Gửi 2 request khiêu chiến liên tiếp với cùng một `idempotency_key`. | Request thứ hai trả về nguyên vẹn bản ghi chiến báo của request đầu mà không nhân đôi EXP, Tu vi, Bạc hay Vật phẩm rơi. | **✅ ĐẠT (PASS)** |
| **AC-8.3** | Quy tắc 30 hiệp, xem trọn Hiệp 1 trước khi bỏ qua, và hình phạt thất bại. | Kiểm chứng qua `simulateAndResolveBattle` và phát lại frontend. | Khi thua: HP về 20, mất 15 Thể lực tổng, đưa về Động Phủ Tán Tu; khi chiếm thế thượng phong sau 30 hiệp: nhận 50% phần thưởng; không mất trang bị/vật phẩm. | **✅ ĐẠT (PASS)** |

### Tiêu Chí 9: Quản Lý Túi Đồ, Trang Bị & Vật Phẩm Tiêu Hao (Inventory & Equipment)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-9.1** | Kiểm tra điều kiện cảnh giới (`realm_requirement`) khi mang trang bị. | Nhân vật Phàm Nhân cố gắng trang bị Thanh Phong Kiếm (yêu cầu Luyện Khí Tầng 2). | Máy chủ chặn lại với lỗi 400 Bad Request: "Cảnh giới chưa đủ". | **✅ ĐẠT (PASS)** |
| **AC-9.2** | Tháo lắp trang bị bảo toàn nguyên vẹn số lượng trong Prisma Transaction. | Trang bị vũ khí mới khi ô vũ khí đang có đồ cũ; sau đó tháo đồ về túi. | Vũ khí cũ được hoàn về túi trữ vật an toàn; tháo vũ khí tăng số lượng trong túi lên +1, không sinh đồ ảo hoặc mất đồ. | **✅ ĐẠT (PASS)** |
| **AC-9.3** | Phục dụng đan dược tiêu hao hồi phục chỉ số và trừ số lượng. | Gọi `POST /api/xianxia/gameplay/equipment/use` với Hồi Xuân Đan. | Hồi phục +60 HP (không vượt quá `max_health`), trừ đúng 1 viên trong túi; khi hết đồ thì xóa slot. | **✅ ĐẠT (PASS)** |

### Tiêu Chí 10: Lịch Sử Chiến Báo & Bảo Mật Cá Nhân (Battle Log & Privacy)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-10.1** | Toàn bộ kết quả trận đấu được ghi nhận vào bảng `XianxiaBattleLog` trên PostgreSQL. | Truy vấn lịch sử trận đấu qua API `GET /api/xianxia/gameplay/combat/history`. | Hiển thị đầy đủ danh sách chiến báo với thời gian, số hiệp, quái vật, phần thưởng và kết quả. | **✅ ĐẠT (PASS)** |
| **AC-10.2** | Bảo mật đa người chơi: Chỉ chủ sở hữu nhân vật mới xem được chiến báo của mình. | Người chơi B truy vấn lịch sử khi người chơi A đã đánh nhiều trận. | Người chơi B nhận danh sách rỗng, 100% không rò rỉ dữ liệu chiến trận của người chơi khác. | **✅ ĐẠT (PASS)** |

---

---

## V. TIÊU CHÍ NGHIỆM THU MỤC 3: TIẾN TRÌNH KHÁM PHÁ & KINH TẾ SINH HOẠT

### Tiêu Chí 11: Tiến Trình Nhiệm Vụ Bền Vững Trên Database & Hook Tự Động (Authoritative Quests)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-11.1** | Trạng thái và tiến độ nhiệm vụ lưu trữ bền vững trên bảng `XianxiaQuestProgress` qua Prisma PostgreSQL. | Tiếp nhận nhiệm vụ qua `acceptQuestDb`, kiểm tra DB sau reload/query lại. | Bản ghi tồn tại với trạng thái `IN_PROGRESS` và mảng mục tiêu chi tiết; không bị mất khi F5 hoặc đổi thiết bị. | **✅ ĐẠT (PASS)** |
| **AC-11.2** | Kiểm tra điều kiện Cảnh giới, Cấp độ và Nhiệm vụ tiền đề trước khi cho phép tiếp nhận. | Tiếp nhận nhiệm vụ khi chưa thỏa mãn điều kiện `min_realm`, `min_level` hoặc `prerequisite_quest_id`. | Hệ thống từ chối với thông báo lỗi cụ thể, ngăn chặn nhảy cóc nhiệm vụ. | **✅ ĐẠT (PASS)** |
| **AC-11.3** | Nộp nhiệm vụ kiểm tra túi đồ thực tế, khấu trừ vật phẩm nộp, trao thưởng nguyên tử và chống nhận trùng lặp. | Hoàn thành và nộp nhiệm vụ qua `turnInQuestDb`. | Khấu trừ vật phẩm nộp khỏi kho đồ, cộng EXP, Tu vi, Bạc vào DB trong 1 Transaction; gọi lại lần 2 bị chặn đứng báo lỗi nhiệm vụ đã hoàn tất. | **✅ ĐẠT (PASS)** |
| **AC-11.4** | Hook tự động kích hoạt tiến độ nhiệm vụ khi đánh thắng quái hoặc nhặt đồ rơi trong chiến đấu. | Thắng trận chiến trong `simulateAndResolveBattle` khi đang có nhiệm vụ diệt quái tương ứng. | Bản ghi `XianxiaQuestProgress` trên DB tự động tăng tiến độ mục tiêu `KILL_MONSTER` và `LOOT_DROP`. | **✅ ĐẠT (PASS)** |

### Tiêu Chí 12: Kinh Tế Tiệm Bách Hóa & Dược Thảo (Authoritative Merchant Service)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-12.1** | Mua vật phẩm từ tiệm bách hóa: trừ Bạc nhân vật và cộng vật phẩm vào kho đồ an toàn trong Transaction. | Gọi `buyItem` với Hồi Xuân Đan x2 (giá 30 Bạc/viên). | Bạc trên DB trừ đúng 60 Bạc, kho đồ tăng đúng 2 viên Hồi Xuân Đan. | **✅ ĐẠT (PASS)** |
| **AC-12.2** | Chặn đứng việc mua hàng khi nhân vật không đủ Bạc (Anti-cheat & Anti-exploit). | Thử mua số lượng lớn vượt quá ngân lượng đang có. | Giao dịch bị từ chối với thông báo "Không đủ Bạc", bảo toàn nguyên vẹn số dư và kho đồ. | **✅ ĐẠT (PASS)** |
| **AC-12.3** | Bán vật phẩm từ kho đồ: kiểm tra số lượng sở hữu, trừ vật phẩm và cộng Bạc. | Gọi `sellItem` với số lượng hợp lệ và số lượng vượt quá số dư trong kho đồ. | Bán hợp lệ: trừ vật phẩm và cộng Bạc chuẩn xác; bán quá số lượng: bị chặn lại với lỗi "Không đủ số lượng". | **✅ ĐẠT (PASS)** |

### Tiêu Chí 13: Kỹ Nghệ Sinh Hoạt: Thu Thập & Luyện Chế Tiên Gia (Authoritative Life Skills)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-13.1** | Thu thập tài nguyên tại Gathering Node kiểm tra cảnh giới, trừ thể lực và roll vật phẩm rơi. | Gọi `gatherResource` tại điểm thu thập `node_thao_duoc_ngoai_o`. | Thể lực trừ đúng 5 điểm, nhận điểm tu vi và các loại dược liệu rơi ngẫu nhiên vào kho đồ DB. | **✅ ĐẠT (PASS)** |
| **AC-13.2** | Luyện chế đan dược / pháp khí kiểm tra đầy đủ nguyên liệu, trừ thể lực và Bạc. | Gọi `craftItem` với công thức `recipe_luyen_dan_hoi_xuan`. | Khấu trừ đầy đủ Thảo Mộc Linh Chi x2, Kim Ngân Hoa x1, trừ 10 Bạc và 6 Thể lực; nhận thành phẩm Hồi Xuân Đan, EXP và Tu Vi. | **✅ ĐẠT (PASS)** |
| **AC-13.3** | Cơ chế nổ lò phế đan khi luyện chế thất bại. | Luyện chế với tỷ lệ thất bại (`forcedSuccess: false`). | Không tạo ra đan dược chính mà sinh ra Phế Đan (`item_phe_dan` x1) cùng 5 EXP & 5 Tu Vi an ủi, bảo toàn tính nghiêm cẩn của đan đạo. | **✅ ĐẠT (PASS)** |

### Tiêu Chí 14: Xung Quan Đột Phá Cảnh Giới & Đan Dược Bảo Hộ (Authoritative Breakthrough)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-14.1** | Đột phá cảnh giới thành công trên máy chủ khi đủ tu vi yêu cầu. | Gọi `breakthroughRealm` khi đạt đủ tu vi (Phàm Nhân $\rightarrow$ Luyện Khí Tầng 1). | Thăng cảnh giới `LUYEN_KHI_1`, trừ 180 tu vi yêu cầu và giữ lại phần dư, nâng Max HP/Thể lực, hồi đầy máu & thể lực, **thưởng đúng +4 Điểm Tiềm Năng** (`stat_points += 4`). | **✅ ĐẠT (PASS)** |
| **AC-14.2** | Cơ chế phản phệ khi xung quan thất bại không có đan bảo hộ. | Đột phá thất bại không kèm đan dược. | Mất 30% tu vi hiện tại, bị phản phệ thương tích trừ 30 HP (không tụt dưới 20 HP). | **✅ ĐẠT (PASS)** |
| **AC-14.3** | Công hiệu đặc biệt của Trúc Cơ Đan khi xung quan. | Đột phá thất bại có sử dụng `item_truc_co_dan`. | Mất 30% tu vi nhưng **hoàn toàn miễn trừ thương tích trừ HP**, tiêu hao đúng 1 viên Trúc Cơ Đan trong kho đồ. | **✅ ĐẠT (PASS)** |

### Tiêu Chí 15: An Toàn Đồng Thời & Khóa Hàng Bi Quan (Concurrency Row-Level Locking & Atomicity)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-15.1** | Khóa hàng bi quan (`SELECT ... FOR UPDATE`) chống Race Condition khi mua hàng đồng thời. | Gửi 2 request `buyItem` đồng thời (`Promise.allSettled`) khi ngân lượng chỉ đủ mua 1 lần. | Đúng 1 request thành công, request thứ hai bị từ chối do không đủ Bạc; số dư không bị âm và không bị dup vật phẩm. | **✅ ĐẠT (PASS)** |
| **AC-15.2** | Chống Race Condition khi bán vật phẩm đồng thời. | Gửi 2 request `sellItem` đồng thời khi trong túi chỉ có đúng 1 vật phẩm. | Đúng 1 request thành công, request thứ hai bị từ chối; không bị nhân đôi tiền thu về. | **✅ ĐẠT (PASS)** |
| **AC-15.3** | Chống Race Condition khi đột phá cảnh giới đồng thời. | Gửi 2 request `breakthroughRealm` đồng thời khi tu vi chỉ đủ 1 lần. | Đúng 1 request thành công, điểm tiềm năng chỉ cộng đúng +4 điểm, không bị x2. | **✅ ĐẠT (PASS)** |
| **AC-15.4** | Chặn đứng Double Turn-in khi nộp nhiệm vụ đồng thời. | Gửi 2 request `turnInQuestDb` đồng thời cho cùng 1 nhiệm vụ. | Đúng 1 request thành công, request thứ hai báo lỗi nhiệm vụ đã hoàn tất; vật phẩm nộp bị khấu trừ sạch, không dup EXP/Bạc. | **✅ ĐẠT (PASS)** |
| **AC-15.5** | Tính nguyên tử (Atomicity B2) giữa chiến đấu, túi đồ và nhiệm vụ. | Kiểm chứng qua `simulateAndResolveBattle` trong `prisma.$transaction`. | Toàn bộ cập nhật nhân vật, vật phẩm rơi, nhật ký chiến đấu và hook nhiệm vụ nằm trong 1 Transaction duy nhất; rollback 100% nếu có lỗi. | **✅ ĐẠT (PASS)** |

---

### Tiêu Chí 16: Bảng Xếp Hạng Thiên Kiêu (Authoritative Leaderboard M4.1)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-16.1** | Dữ liệu xếp hạng lấy trực tiếp từ PostgreSQL thật, thứ tự sắp xếp phân tầng cảnh giới chuẩn xác. | Gọi `getLeaderboard` với các nhân vật Trúc Cơ, Luyện Khí 3, Luyện Khí 1, Phàm Nhân. | Trúc Cơ xếp trên Luyện Khí 3, Luyện Khí 3 xếp trên Luyện Khí 1, Luyện Khí 1 xếp trên Phàm Nhân. | **✅ ĐẠT (PASS)** |
| **AC-16.2** | Phân xử hòa (Tie-break) ổn định tuyệt đối khi có cùng chỉ số. | So sánh 2 nhân vật có cùng cảnh giới, level, tu vi và EXP. | Nhân vật tạo trước (ID nhỏ hơn) luôn đứng trước nhân vật tạo sau; phân trang không bị nhảy. | **✅ ĐẠT (PASS)** |
| **AC-16.3** | Phân trang và giới hạn kích thước trang an toàn. | Truy vấn với `page` và `limit` hợp lệ và không hợp lệ (âm, chuỗi, >50). | Dữ liệu phân trang độc lập không trùng lặp; tham số âm chuẩn hóa về 1, limit trần tối đa 50. | **✅ ĐẠT (PASS)** |
| **AC-16.4** | Bảo vệ quyền riêng tư người dùng. | Kiểm tra các trường trong payload trả về của bảng xếp hạng. | 100% không để lộ `email`, `password_hash`, hoặc `user_id` nội bộ. | **✅ ĐẠT (PASS)** |
| **AC-16.5** | Xác định thứ hạng cá nhân (`myRank`). | Gửi request có Bearer token hợp lệ và request không có token. | Có token: trả về đúng thứ hạng `myRank`; khách vãng lai: `myRank = null`, xem được public. | **✅ ĐẠT (PASS)** |
| **AC-16.6** | Công thức tính Chiến Lực Đạo Hạnh minh bạch và chính xác. | So sánh giá trị `combatPower` với công thức toán học đặc tả. | Giá trị tính toán khớp 100% với công thức O(1), không sinh N+1 query. | **✅ ĐẠT (PASS)** |
| **AC-16.7** | Native HTTP REST API (`/api/xianxia/leaderboard` & `/gameplay/leaderboard`). | Gọi qua HTTP network fetch trên ephemeral port. | Phản hồi chuẩn 200 OK, định dạng JSON chuẩn mực. | **✅ ĐẠT (PASS)** |
| **AC-16.8** | Cô lập bộ nhớ đệm đa người dùng (Multi-User Cache Isolation & RAM Protection). | 2 User khác nhau và 1 khách vãng lai cùng truy vấn 1 trang khi cache hit; dọn dẹp cache quá tải. | Cache chung không chứa `myRank`, mỗi user nhận đúng rank cá nhân; cơ chế FIFO và TTL 10s bảo vệ RAM. | **✅ ĐẠT (PASS)** |
| **AC-16.9** | Bao phủ phân tầng cảnh giới mở rộng (Trúc Cơ Trung/Hậu Kỳ, Kim Đan Sơ Kỳ). | Tạo nhân vật Kim Đan Sơ Kỳ (`KIM_DAN_SO_KY`) và kiểm tra xếp hạng. | Đứng vị trí Top 1 (Order 13) vượt trên Trúc Cơ Sơ Kỳ, không bị rơi vào `ELSE 0`. | **✅ ĐẠT (PASS)** |
| **AC-16.10** | Kháng lỗi middleware JWT và đồng bộ route alias `/gameplay/leaderboard`. | Gửi request với token rác, token hết hạn, và gọi alias không có token. | Phản hồi 200 OK, `myRank = null`, server không crash; alias cho phép khách xem công khai. | **✅ ĐẠT (PASS)** |
| **AC-16.11** | An toàn số học cho điểm Chiến Lực (`calcCombatPower`). | Gọi hàm với tham số null, undefined, số âm, thuộc tính chuỗi rác. | Trả về số nguyên `>= 0`, không crash, không ra NaN. | **✅ ĐẠT (PASS)** |

---

### Tiêu Chí 17: Đấu Trường Thiên Kiêu (Asynchronous PvP Arena M4.2)
| Mã AC | Tiêu chí cụ thể | Phương pháp kiểm chứng | Kết quả kỳ vọng | Trạng thái |
|---|---|---|---|---|
| **AC-17.1** | Snapshot đối thủ bất biến lưu tại backend, độc lập hoàn toàn với thay đổi sau đó của nhân vật. | Attacker khiêu chiến Defender; Defender sau đó tăng cấp, đổi trang bị hoặc đổi tên. | Snapshot trận đấu lưu đúng trạng thái tại thời điểm thách đấu, không bị sửa đổi. | **✅ ĐẠT (PASS)** |
| **AC-17.2** | Chặn đứng hành vi tự khiêu chiến chính mình. | Gửi request thách đấu với `defenderId === attackerId`. | Máy chủ từ chối với lỗi 400 Bad Request: "Không thể tự khiêu chiến chính mình". | **✅ ĐẠT (PASS)** |
| **AC-17.3** | Máy chủ mô phỏng chiến đấu tự động thẩm quyền, tuân thủ giới hạn 30 lượt. | Kiểm tra nhật ký lượt đi và kết quả phán quyết từ server. | Không tin kết quả client gửi; tối đa 30 lượt; tự dùng Thần Thông khi đủ Qi; xử lý thắng/thua/hòa minh bạch. | **✅ ĐẠT (PASS)** |
| **AC-17.4** | Điểm Danh Vọng & Bạc cập nhật chính xác theo công thức thiết kế. | Kiểm tra thay đổi Danh Vọng và Bạc sau trận thắng, thua, hòa. | Thắng nhận +Danh Vọng & +50 Bạc; Thua trừ 10 Danh Vọng (sàn tối thiểu 0); Hòa ưu thế +5 Danh Vọng. | **✅ ĐẠT (PASS)** |
| **AC-17.5** | Bảo vệ tuyệt đối tài nguyên người chơi: Thua không mất EXP, tu vi, bạc, trang bị. | Kiểm tra thuộc tính của Defender và Attacker khi thất bại. | 100% EXP, Tu Vi, Bạc, Túi đồ, Trang bị được bảo toàn nguyên vẹn; không bị trừ máu về 20. | **✅ ĐẠT (PASS)** |
| **AC-17.6** | Idempotency Key bảo vệ cấp cơ sở dữ liệu chống nhân đôi trận và phần thưởng. | Gửi lại cùng một `idempotency_key` liên tiếp hoặc khi timeout/retry. | Request lặp trả về cùng bản ghi cũ (`idempotent = true`), không trừ thêm thể lực, không dup thưởng. | **✅ ĐẠT (PASS)** |
| **AC-17.7** | Khóa hàng bi quan (`FOR UPDATE`) ngăn chặn Race Condition khi thách đấu đồng thời. | Gửi 2 request khiêu chiến đồng thời khi thể lực chỉ đủ 1 trận (15 Thể Lực). | Đúng 1 request thành công, request thứ hai bị từ chối; không bị âm thể lực hay sai lệch danh vọng. | **✅ ĐẠT (PASS)** |
| **AC-17.8** | Cơ chế chống cày điểm lặp lại (Anti-Farming / Anti-Win-Trading). | Khiêu chiến cùng 1 đối thủ quá 3 lần trong vòng 24 giờ. | Từ trận thứ 4 trở đi, trận đấu chỉ giao lưu học hỏi, không cộng thêm Danh Vọng và Bạc thưởng. | **✅ ĐẠT (PASS)** |
| **AC-17.9** | Bảo mật phân quyền truy xuất chiến báo chi tiết. | Người thứ ba không tham gia trận đấu gửi request xem chi tiết match ID. | Máy chủ từ chối với lỗi 403 Forbidden: "Không có thẩm quyền truy xuất chiến báo". | **✅ ĐẠT (PASS)** |
| **AC-17.10** | Tích hợp giao diện Frontend HTML/JS hoàn chỉnh, thẩm mỹ cổ phong. | Mở `#pvp-modal`, xem danh sách đối thủ, khiêu chiến, phát lại diễn biến, xem lịch sử và BXH. | Giao diện hoạt động trơn tru, hiển thị đầy đủ thông tin, xử lý loading và lỗi thân thiện. | **✅ ĐẠT (PASS)** |
| **AC-17.11** | Cô lập Scoped Idempotency Key đa người chơi (Cross-User Collision Immunity). | Hai người chơi khác nhau cùng gửi một `idempotency_key` giống hệt nhau. | Key được tự động scoped theo `userId` (`pvp:u{userId}:{key}`); hai người chơi tạo hai trận đấu hoàn toàn độc lập, không rò rỉ hay tái hiện chéo kết quả của nhau. | **✅ ĐẠT (PASS)** |
| **AC-17.12** | Double-Checked Locking & Bắt lỗi P2002 khi có 2 request đồng thời cùng Idempotency Key. | Gửi 2 request thách đấu đồng thời với cùng một `idempotency_key` từ cùng 1 người chơi. | Cả hai request trả về HTTP 200 OK cùng `matchId`; đúng 1 request tạo trận mới (`idempotent = false`) và 1 request trả replay (`idempotent = true`), thể lực chỉ trừ đúng 1 lần (-10). | **✅ ĐẠT (PASS)** |
| **AC-17.13** | Tính nguyên tử và Rollback giao dịch PvP khi gặp sự cố bất ngờ. | Giả lập lỗi hoặc chỉ định đối thủ không tồn tại trong giao dịch thách đấu. | Giao dịch tự động rollback 100%; Thể lực, Bạc, Danh Vọng và số trận thắng/thua được bảo toàn nguyên vẹn, không bị khấu trừ dở dang. | **✅ ĐẠT (PASS)** |
| **AC-17.14** | Bộ lọc chuẩn mực Anti-Farming: Các trận giao lưu không thưởng không chặn nhận thưởng tương lai. | Sau 3 trận nhận thưởng, người chơi đánh thêm các trận giao lưu; kiểm tra bộ đếm giới hạn thưởng sau 24h. | Chỉ đếm các trận thực sự nhận thưởng (`reputation_change != 0` hoặc `silver_reward != 0`); trận giao lưu không làm kéo dài thời gian chặn nhận thưởng. | **✅ ĐẠT (PASS)** |
| **AC-17.15** | Chuẩn hóa mã trạng thái HTTP REST API (404 Not Found vs 403 Forbidden vs 400 Bad Request). | Gọi API xem chi tiết trận với ID không tồn tại (404), gọi xem trận của người khác (403), và truyền `defenderId` âm/sai (400). | Phản hồi đúng mã trạng thái HTTP theo chuẩn RESTful; thông điệp lỗi rõ ràng và chuẩn mực. | **✅ ĐẠT (PASS)** |
| **AC-17.16** | Chống va chạm do cắt chuỗi Idempotency Key (No Truncation Collision). | Thử thách đấu với 2 raw key 64 ký tự khác nhau ở những ký tự cuối. | Không cắt chuỗi bừa bãi; cả 2 key lưu trữ nguyên vẹn trong DB và sinh 2 trận độc lập. | **✅ ĐẠT (PASS)** |
| **AC-17.17** | Phát hiện và ngăn chặn Payload Mismatch khi replay cùng Idempotency Key. | Gửi lại cùng một `idempotency_key` nhưng đổi `defenderId` sang đối thủ khác. | Máy chủ phát hiện Payload mismatch và từ chối với HTTP 400 Bad Request, bảo vệ ngữ nghĩa IETF. | **✅ ĐẠT (PASS)** |
| **AC-17.18** | Giới hạn Anti-Farming áp dụng cho CẶP ĐẤU hai chiều (Mutual Pair Limit). | Defender chủ động thách đấu ngược lại Attacker sau khi cặp đấu đã hết 3 trận có thưởng trong ngày. | Cặp đấu bị chặn thưởng hai chiều (`reputation_change = 0, silver_reward = 0`), bất kể ai là người khởi xướng. | **✅ ĐẠT (PASS)** |
| **AC-17.19** | Reset trần nhận thưởng tự động theo ranh giới ngày múi giờ Việt Nam (00:00:00 ICT). | Thực hiện thách đấu khi bước qua mốc nửa đêm (00:00:00 UTC+7). | Bộ đếm tự động reset về 0 cho ngày mới, người chơi nhận thưởng bình thường. | **✅ ĐẠT (PASS)** |
| **AC-17.20** | Triệt tiêu hoàn toàn Deadlock khi 2 người chơi đồng thời khiêu chiến lẫn nhau. | 2 người chơi gửi request thách đấu đối ứng đồng thời (`Promise.all`). | Khóa hàng theo thứ tự ID tăng dần (`ORDER BY id FOR UPDATE`) loại bỏ 100% vòng chờ, cả 2 trận hoàn tất an toàn. | **✅ ĐẠT (PASS)** |

---

## VI. KẾT LUẬN NGHIỆM THU TỔNG THỂ (MỤC 1, MỤC 2, MỤC 3, MỤC 4.1 & MỤC 4.2)
1. **Mục 1 (Thống nhất Gameplay): 16/16 tiêu chí ĐẠT PASS 100%.**
2. **Mục 2 (Core Gameplay Authoritative Backend): 10/10 bài kiểm thử và 10 tiêu chí ĐẠT PASS 100%.**
3. **Mục 3 (Tiến Trình Khám Phá, Kinh Tế & Concurrency): 14/14 bài kiểm thử và 18 tiêu chí ĐẠT PASS 100%.**
4. **Mục 4.1 (Bảng Xếp Hạng Thiên Kiêu): 15/15 bài kiểm thử độc lập và 11 tiêu chí ĐẠT PASS 100%.**
5. **Mục 4.2 (Đấu Trường Thiên Kiêu PvP Bất Đồng Bộ): 23/23 bài kiểm thử thực tế và 20 tiêu chí ĐẠT PASS 100%.**
6. **Bộ kiểm thử toàn diện của hệ sinh thái Kỳ Biến (`npm test`) chạy thành công 100% với Exit code 0.**
7. **Tuyệt đối không có lỗi hồi quy (Zero Regression) trên toàn bộ hệ thống.**
8. **Bảo toàn tuyệt đối phạm vi: Chưa triển khai bất kỳ dòng code nào thuộc Mục 4.3+ (Chat Realtime, Bang Hội, Tổ Đội, World Boss, Player Trading).**






