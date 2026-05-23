# Cấu trúc project

## Backend (`backend/`)

| Thư mục | Mục đích |
|---------|----------|
| `src/config/` | DB, env, CORS |
| `src/models/` | Mongoose models (đã tách từ `database.txt`) — xem [DATABASE.md](./DATABASE.md) |
| `src/types/` | `shared.types.ts` — enum dùng chung |
| `src/routes/` | Định nghĩa route theo module |
| `src/controllers/` | Xử lý request/response |
| `src/services/` | Business logic |
| `src/middleware/` | Auth, role guard, error handler |
| `src/validators/` | Validate body/query |
| `src/types/` | Shared TS types |
| `src/utils/` | Helper |
| `tests/unit/` | Unit tests |
| `tests/integration/` | API integration tests |

**Entry:** `src/index.ts` → `src/app.ts`

## Frontend (`frontend/`)

| Thư mục | Mục đích |
|---------|----------|
| `src/api/` | HTTP client, gọi backend |
| `src/assets/` | Ảnh, icon |
| `src/components/common/` | Button, Modal, … |
| `src/components/ui/` | UI primitives |
| `src/features/` | Theo domain (auth, races, …) |
| `src/hooks/` | Custom hooks |
| `src/layouts/` | MainLayout, AuthLayout |
| `src/pages/` | Trang theo route |
| `src/routes/` | React Router config |
| `src/store/` | State (context / zustand sau) |
| `src/types/` | DTO, API types |
| `src/utils/` | Format date, … |
| `src/styles/` | Global CSS |

**Dev:** Vite port `5173`, proxy `/api` → backend `3000`.

## Gợi ý đặt feature (frontend)

```
src/features/
  auth/
  horses/          # horse_owner
  invitations/     # owner + jockey
  tournaments/     # admin + public
  races/
  results/
  predictions/     # spectator
  admin/
```

Mỗi feature có thể gồm: `components/`, `hooks/`, `types/` (tạo khi implement).

## Tài liệu (`docs/`)

| File | Nội dung |
|------|----------|
| REQUIREMENTS.md | Use case, phân quyền, lộ trình |
| DATABASE.md | ODM, collections, enforce |
| DATABASE_EXPECT.md | Schema mục tiêu production (đã áp dụng models) |
| PREDICTION_POOL.md | Quỹ dự đoán / bounty (logic settle — API sau) |
| LOGIC_GAPS.md | Hở logic vs thực tế / Flashscore |
| SEED_DATA.md | Scenario demo sau `db:seed` |
