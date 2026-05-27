# Horse Racing

Monorepo: backend API + frontend portals (Jockey / Spectator).

## Yêu cầu

- Node.js 20+
- MongoDB chạy local (`mongodb://127.0.0.1:27017`)

## Chạy lần đầu

**Quan trọng:** Mở **hai terminal**. Lệnh `db:seed` phải chạy trong thư mục `backend` (hoặc từ gốc repo qua script bên dưới). Nếu bạn đang ở trong `frontend/` mà gõ `cd backend`, PowerShell sẽ báo lỗi *path not found* và **không seed được** — login sẽ báo *Email hoặc mật khẩu không đúng*.

### Cách nhanh (từ thư mục gốc `Horse_race`)

```bash
# Terminal 1 — backend
cd backend
npm install
npm run db:seed
npm run dev

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

Hoặc từ gốc `Horse_race` (sau khi `npm install` trong `backend` và `frontend`):

```bash
npm run db:seed        # seed (chỉ khi đứng ở Horse_race, không phải frontend/)
npm run dev:backend    # terminal 1
npm run dev:frontend   # terminal 2
```

### 1. Backend

```bash
cd backend
cp .env.example .env   # nếu chưa có .env
npm install
npm run db:seed        # tài khoản demo, mật khẩu: Demo@123
npm run dev            # http://localhost:3000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # tùy chọn; mặc định proxy /api
npm install
npm run dev            # http://localhost:5173
```

## Kiểm tra nhanh (smoke test)

| Hành động | Kỳ vọng |
|-----------|---------|
| Login `jockey1@demo.local` / `Demo@123` | Redirect `/jockey`, thấy cuộc đua đã phân công |
| Login `jockey2@demo.local` / `Demo@123` | Redirect `/jockey`, **Lời mời** có 1 pending (Gió Xuân) |
| Jockey accept lời mời pending | Lời mời → accepted; cuộc đua xuất hiện trong **Cuộc đua** |
| Login `spectator@demo.local` / `Demo@123` | Redirect `/spectator` |
| Spectator → **Dự đoán** → gửi dự đoán cuộc *Chung kết — Vòng 1* | 201, lịch sử có dự đoán pending |
| Đăng ký spectator mới | Redirect `/spectator` |
| Jockey truy cập `/spectator` | Redirect về `/jockey` |
| Login `admin@demo.local` | Thông báo role chưa hỗ trợ portal |

### Seed demo (3 scenario)

| Scenario | Mục đích |
|----------|----------|
| A | `jockey2@demo.local` — lời mời **pending** (Bán kết — Vòng 2) |
| B | `spectator@demo.local` — cuộc *Chung kết — Vòng 1* **mở dự đoán**, chưa gửi |
| C | Cuộc *Vòng loại — Heat 1* — result confirmed, **chờ admin publish** → chấm điểm |

### API auth

- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/register` — spectator only: `{ email, password, fullName, phone? }`
- `GET /api/auth/me` — `Authorization: Bearer <token>`

### API Jockey (`Authorization: Bearer`, role `jockey`)

- `GET /api/jockey/dashboard`
- `GET /api/jockey/invitations?status=pending`
- `PATCH /api/jockey/invitations/:id` — `{ action: "accept" | "decline" }`
- `GET /api/jockey/races`
- `GET /api/jockey/races/:id`

### API Spectator (`Authorization: Bearer`, role `spectator`)

- `GET /api/spectator/tournaments`
- `GET /api/spectator/races?filter=open|upcoming|completed`
- `GET /api/spectator/races/:id`
- `POST /api/spectator/predictions` — `{ raceId, predictedRanks: [{ rank, horseId }] }`
- `GET /api/spectator/predictions`
- `GET /api/spectator/points`
- `GET /api/spectator/products`
- `POST /api/spectator/redemptions` — `{ productId, quantity? }`

## Tài khoản seed

Mật khẩu chung: **Demo@123**

- `jockey1@demo.local`, `jockey2@demo.local`
- `spectator@demo.local`
- `admin@demo.local`, `owner@demo.local`, `referee@demo.local`
