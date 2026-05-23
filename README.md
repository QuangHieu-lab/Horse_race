# Horse Racing System

Hệ thống quản lý giải đua ngựa — tách **frontend** và **backend**.

## Cấu trúc

```
Horse_race/
├── backend/          # API (Express + TypeScript + MongoDB)
├── frontend/         # Web app (React + Vite + TypeScript)
├── docs/             # Tài liệu (REQUIREMENTS.md, …)
└── database.txt      # Schema Mongoose (tham chiếu)
```

## Database demo (diagram / test)

```bash
cd backend
npm run db:check    # kiểm tra kết nối + số document
npm run db:seed     # 1 bộ dữ liệu demo (xem docs/SEED_DATA.md)
```

Tài khoản demo: `*@demo.local` — mật khẩu `Demo@123`

## Chạy development

```bash
# Copy env (lần đầu)
cp backend/.env.example backend/.env

# Seed dữ liệu demo (lần đầu hoặc reset)
cd backend && npm run db:seed

# Terminal 1 — API (port 3000)
cd backend && npm install && npm run dev

# Terminal 2 — Web (port 5173)
cd frontend && npm install && npm run dev
```

Mở http://localhost:5173 — đăng nhập bằng tài khoản demo, xem dashboard theo role. Admin có thể **Publish kết quả** để chấm điểm dự đoán spectator.

API base: `http://localhost:3000/api/v1` — xem [docs/API.md](./docs/API.md).

Kiểm tra nhanh API (server đang chạy):

```bash
cd backend && npm run test:smoke
```

Hoặc từ thư mục gốc (sau khi `npm install` ở root):

```bash
npm run dev:backend
npm run dev:frontend
```

## Tài liệu

- [Yêu cầu & phân quyền](./docs/REQUIREMENTS.md)
- [Database & ODM (Mongoose)](./docs/DATABASE.md)
- [Database expect (schema mục tiêu)](./docs/DATABASE_EXPECT.md)
- [Quỹ dự đoán / bounty](./docs/PREDICTION_POOL.md)
- [Logic còn hở & thực tế](./docs/LOGIC_GAPS.md)
- [Seed demo](./docs/SEED_DATA.md)
- [Cấu trúc thư mục](./docs/PROJECT_STRUCTURE.md)
- [REST API](./docs/API.md)
- [Đối chiếu đề SU26SWP03](./docs/TOPIC_COMPLIANCE_SU26SWP03.md)
