# Dữ liệu demo (1 scenario nhất quán)

```bash
cd backend
npm run db:seed
npm run db:check
```

**Mật khẩu:** `Demo@123`

> Dự đoán trong seed: **pending**, chưa chấm điểm — chưa bật quỹ bounty ([PREDICTION_POOL.md](./PREDICTION_POOL.md)).

---

## Luồng dữ liệu sau seed

```
Admin tạo giải + race (chưa có participant)
Owner → RaceRegistration (approved)
Owner → JockeyInvitation → accept → tự thêm vào Race.participants
Owner → confirmedAt trên từng participant
Race: scheduled → ongoing → completed
Referee → Result (BXH 1 ngựa; Bóng Mây disqualify false_start)
Referee → confirm (chưa publish)
Spectator → Prediction pending
```

---

## Trạng thái chính

| Entity | Trạng thái |
|--------|------------|
| Tournament | `ongoing` |
| Race | `completed` (đã đua) |
| RaceRegistration ×2 | `approved` |
| JockeyInvitation ×2 | `accepted` |
| Result | `confirmedAt` có, `publishedAt` null |
| Prediction | `pending` |

---

## Tài khoản

| Email | Role |
|-------|------|
| admin@demo.local | admin |
| owner@demo.local | horse_owner |
| jockey1@demo.local | jockey |
| jockey2@demo.local | jockey |
| referee@demo.local | referee |
| spectator@demo.local | spectator |

---

## Kết quả demo

- **Hạng 1:** Sóng Gió — 98.42s — 30M
- **Bóng Mây:** vi phạm `false_start` → `disqualify` (không trong BXH)

---

## Thống kê

| Collection | Số lượng |
|------------|----------|
| users | 6 |
| horses | 2 |
| tracks | 1 |
| racemeetings | 1 |
| tournaments | 1 |
| races | 1 |
| raceregistrations | 2 |
| jockeyinvitations | 2 |
| results | 1 |
| predictions | 1 |
| spectatorprofiles | 1 |
| products | 1 |
| notifications | 4 |
