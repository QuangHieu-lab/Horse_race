# Kiểm tra logic — chỗ còn hở & khác thực tế

> Cập nhật sau khi enforce schema (RaceRegistration, invitation → participant, Result).  
> **Mục đích:** biết cái nào **đã khóa ở DB**, cái nào **chờ API**, cái nào **cố ý đơn giản** cho đồ án.

---

## 1. Tóm tắt nhanh

| Lớp | Trạng thái |
|-----|------------|
| Luồng quản lý giải (owner → admin → jockey → referee → admin publish) | ✅ Khớp thực tế tổ chức giải VN |
| Ràng buộc DB (participant, race state, result, disqualify) | ✅ Đã có hooks |
| API / auth / frontend | ❌ Chưa — chỉ `/health` + seed |
| Trải nghiệm khán giả kiểu [Flashscore](https://www.flashscore.vn/dua-ngua/) | ⚠️ Thiếu live, race card chi tiết |
| Quỹ dự đoán (bounty pool) | ✅ Model `PredictionPool` + config; ⏳ API settle |
| Schema production expect | ✅ [DATABASE_EXPECT.md](./DATABASE_EXPECT.md) áp dụng vào models |
| Cược tiền / odds | 🚫 Không làm — đúng bối cảnh VN |

---

## 2. Đã khớp logic (không cần sửa schema trừ khi mở rộng)

| Hạng mục | Ghi chú |
|----------|---------|
| Duyệt đăng ký tách khỏi vào đường đua | `RaceRegistration` approved ≠ participant |
| Participant sau jockey accept | `JockeyInvitation` hook + `race-participant.service` |
| Unique horse / jockey / lane | `validateParticipants` |
| Race `scheduled` → `ongoing` (≥2 ngựa) → `completed` | pre-save Race |
| Result confirm khi race `completed` | pre-save Result |
| Disqualify không nằm trong rankings | seed + `result-rankings` |
| Spectator profile tự tạo | User post-save |
| Ngựa không `fit` không đăng ký | RaceRegistration pre-save |

---

## 3. Còn hở — nên xử lý khi làm API (ưu tiên cao)

| # | Vấn đề | Rủi ro | Hướng xử lý |
|---|--------|--------|-------------|
| H1 | **Chưa có API** — mọi rule chỉ chạy khi `save()` qua Mongoose | Bypass nếu sửa DB tay | Service layer + route; không ghi thẳng collection ngoài service |
| H2 | **Role user** — `refereeId` / `jockeyId` chưa ép role ở mọi chỗ | Gán nhầm spectator làm trọng tài | Middleware + `assertUserRole` khi assign |
| H3 | **Chấm prediction** — chưa có service sau `publishedAt` | Điểm không tự cộng | `prediction-scoring.service.ts` (xem PREDICTION_POOL) |
| H4 | **Admin duyệt registration** — chưa API notify + không auto participant | OK nếu doc rõ | Service approve chỉ đổi status + notification |
| H5 | **Owner `confirmedAt`** — chưa validate “chỉ owner của horse” | Giả mạo xác nhận | API check `participant.ownerId === req.user` |
| H6 | **Publish result** — chưa chặn ở route | Publish khi chưa confirm | Admin route check `confirmedAt` |
| H7 | **Invitation decline** — chưa auto notify owner | Thiếu UX | Notification `invitation_declined` |

---

## 4. Còn hở — trung bình (thực tế đua ngựa / Flashscore)

| # | Thiếu so với thực tế | Đồ án có cần? |
|---|----------------------|---------------|
| M1 | **Track / meeting** | ✅ `Track`, `RaceMeeting`, `Race.meetingId` |
| M2 | **Going / weather / surface** | ✅ trên `Race` |
| M3 | **Non-runner (scratch)** | ✅ `participant.scratchedAt` — ⏳ API scratch |
| M4 | **Cloth number vs lane** | ✅ `clothNumber` |
| M5 | **Dead heat** | ✅ `rankings[].isDeadHeat` — ⏳ quy tắc API |
| M6 | **Margin** | ✅ `marginBehind` |
| M7 | **Handicap weight carried** | ✅ `carriedWeight` trên participant |
| M8 | **Trainer, pedigree** | ✅ `trainerName`, `sire`, `dam`, `registrationId` |
| M9 | **Livescore / SSE** | ⏳ Phase 7 |
| M10 | **Cửa sổ dự đoán theo race** | ✅ `Race.predictionOpenAt/CloseAt` |
| M11 | **Jockey license** | ✅ `User.jockeyProfile` |
| M12 | **Protest kết quả** | ✅ `Result.protests` — ⏳ API |
| M13 | **Audit** | ✅ `AuditLog` — ⏳ ghi khi API |

---

## 5. Cố ý đơn giản (không coi là lỗi)

| Hạng mục | Lý do |
|----------|--------|
| Không odds / không tiền thật | Học tập + pháp lý VN |
| Một giải tự quản, không feed 100+ sân | Khác Flashscore |
| `prize` nhập tay trong Result | Không auto chia `prizePool` |
| Product / Redemption | Phase 2 gamification |
| Violation `penaltyApplied` dạng enum đơn giản | Đủ demo disqualify / warning |

---

## 6. Tài liệu / code lệch nhau (đã xử lý hoặc cần đọc bản mới)

| Chỗ | Trạng thái |
|-----|------------|
| REQUIREMENTS mục 5.1 “chưa có RaceRegistration” | **Lỗi thời** — đã có model; xem REQUIREMENTS bản cập nhật |
| DATABASE “sync participants khi duyệt” | **Lỗi thời** — participant qua invitation |
| `database.txt` | Chỉ index; schema trong `backend/src/models/` |

---

## 7. Việt Nam vs chuẩn quốc tế (Flashscore)

| | Quốc tế (Flashscore) | Project / VN |
|---|----------------------|--------------|
| Cược | Hợp pháp nhiều nước | Không — điểm ảo + [PREDICTION_POOL](./PREDICTION_POOL.md) |
| Steward / inquiry | Chi tiết, photo finish | Referee + `violations` + `reportUrl` |
| Jockey license | Chuẩn ngành | User role `jockey` (đơn giản) |
| Đua ngựa địa phương | Ít trên Flashscore | Phù hợp mô hình giải + trường đua |

---

## 8. Thứ tự làm tiếp theo (gợi ý sprint)

1. Auth JWT + role middleware  
2. CRUD Tournament / Race / Registration approve  
3. Invitation accept/decline (API; hook DB đã có)  
4. Referee result + admin publish  
5. Prediction submit + scoring (Phase 1 điểm cố định)  
6. [PREDICTION_POOL.md](./PREDICTION_POOL.md) Phase 2 nếu cần bounty  
7. SSE / public race page (Flashscore-lite)

---

## 9. Ma trận: đã enforce DB?

| Rule | DB hook | API (chưa) |
|------|:-------:|:------------:|
| Unique participants | ✅ | — |
| Invitation → participant | ✅ | — |
| Race state machine | ✅ | — |
| Result vs participants | ✅ | — |
| Fit horse only register | ✅ | — |
| Prediction pool / fee | ❌ | 📄 doc only |
| Role on assign referee | ❌ | ⏳ |
| Scoring after publish | ❌ | ⏳ |
