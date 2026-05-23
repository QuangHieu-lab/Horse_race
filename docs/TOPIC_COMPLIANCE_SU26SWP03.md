# Tuân thủ đề tài SU26SWP03

**Topic:** Hệ thống quản lý giải đua ngựa / Horse Racing Tournament Management System  
**Mã:** SU26SWP03

---

## Primary Actors — 5/5

| Đề tài | `User.role` |
|--------|-------------|
| Horse Owner | `horse_owner` |
| Jockey | `jockey` |
| Race Referee | `referee` |
| Spectator | `spectator` |
| Admin | `admin` |

---

## Main Entities — mapping

| Entity (đề) | Hệ thống | Ghi chú |
|-------------|----------|---------|
| Horse Owner / Jockey | `User` | |
| Horse | `Horse` | |
| Tournament | `Tournament` | |
| Race | `Race` | |
| Registration | `RaceRegistration` | |
| Race Result | `Result` | |
| Bet | `Prediction` + `PredictionPool` | Điểm ảo, không cược tiền |
| Prize | `prizePool` + `rankings.prize` | |
| Referee Report | `Result.reportUrl` + violations | |

---

## Functional Requirements

Chi tiết endpoint: [API.md](./API.md). Schema: [DATABASE_EXPECT.md](./DATABASE_EXPECT.md).

| Role | FR | API |
|------|-----|-----|
| Owner | 8 | auth, horses, registrations, invitations, races |
| Jockey | 6 | auth, invitations/respond, races |
| Referee | 5 | races/status, results confirm |
| Spectator | 5 | tournaments, races, predictions |
| Admin | 8 | users, tournaments, registrations approve, publish |

---

## Demo

`npm run db:seed` — mật khẩu `Demo@123`, email `*@demo.local`.
