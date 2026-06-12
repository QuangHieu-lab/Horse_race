# Horse Race Project Context

File nay dung de doc nhanh codebase va lam prompt nen cho cac lan lam viec sau. Noi dung chi la tong quan du an, khong phai danh sach loi can sua.

## Nguyen tac khi tiep tuc lam viec

- Repo co nhieu thay doi chua commit san tu truoc. Khi sua code, phai doc `git status --short` truoc va khong revert thay doi khong phai cua minh.
- Neu user chi yeu cau doc/phan tich/tai lieu hoa thi chi tao/sua file tai lieu duoc chi dinh, khong fix code.
- Khi can tim nhanh: dung `rg --files`, `rg "pattern"`, doc entrypoint truoc roi moi di vao service/controller.
- Lam viec trong workspace: `C:\Users\trung\Desktop\WDP\Horse_race`.

## Tong quan he thong

Du an la he thong quan ly giai dua ngua gom 3 phan:

- `backend/`: Express 5 + TypeScript + Mongoose, API REST, auth JWT, seed MongoDB.
- `FE/`: React + Vite web dashboard cho nhieu role.
- `FE_mobile/`: Expo Router + React Native app, hien tai tap trung vao spectator va mot so man hinh jockey.

Domain chinh:

- User role: `admin`, `spectator`, `jockey`, `referee`, `horse_owner`.
- Admin tao/quan ly tournament, race, user, registration, publish result.
- Horse owner quan ly ngua, dang ky race, moi jockey.
- Jockey xem invitation, chap nhan/tu choi, xem race duoc gan.
- Referee check truoc race, cap nhat/confirm result.
- Spectator xem tournament/race, mua viewing pass, du doan ket qua, tich diem, doi thuong, nhan notification.

## Cau truc thu muc

```text
backend/
  src/
    app.ts                    # gan middleware va mount route
    server.ts                 # connect DB va listen port
    config/                   # env, database, cors
    middleware/               # auth, role guard, error handler
    routes/                   # REST route theo role/domain
    controllers/              # parse req/res
    services/                 # business logic
    models/                   # Mongoose schemas
    types/                    # shared/api types
    utils/                    # helper domain
    scripts/seed.ts           # seed data

FE/
  src/
    App.tsx                   # BrowserRouter, login/protected route
    context/AppContext.tsx    # auth state, app state sync, action dispatcher
    api/                      # REST clients
    config/roleConfigs.ts     # menu theo role
    pages/                    # page theo role
    layouts/                  # AuthScreen, AppShell
    components/               # shared UI
    data/mockData.ts          # fallback/local initial data

FE_mobile/
  src/
    app/                      # Expo Router routes
    context/AuthContext.tsx   # mobile auth state
    api/                      # mobile REST clients
    components/               # spectator/jockey/UI components
    mock-data/                # mock fallback data
    constants/theme.ts        # theme/font config
```

## Lenh chay

Backend:

```powershell
cd backend
npm install
npm run dev
npm run db:seed
```

Web FE:

```powershell
cd FE
npm install
npm run dev
```

Mobile:

```powershell
cd FE_mobile
npm install
npm run web
npm run android
```

Env backend mac dinh trong `backend/.env.example`:

- `PORT=3000`
- `MONGODB_URI=mongodb://127.0.0.1:27017/horse_racing`
- `JWT_SECRET=horse-racing-dev-secret-change-in-production`
- `JWT_EXPIRES_IN=7d`
- `CORS_ORIGIN=http://localhost:5173,http://localhost:8081,http://127.0.0.1:8081`

Frontend API base:

- Web: `VITE_API_URL`, mac dinh rong string nen goi same-origin neu khong set.
- Mobile: `EXPO_PUBLIC_API_URL`, mac dinh `http://10.0.2.2:3000`.

## Backend entrypoint

`backend/src/server.ts`:

- Goi `connectDatabase()`.
- Tao app bang `createApp()`.
- Listen theo `env.port`.

`backend/src/app.ts`:

- Middleware: CORS, `express.json()`.
- Health check: `GET /api/health`.
- Public auth route: `/api/auth`.
- Cac route con lai dung `authenticate` va `requireRole`.
- Error cuoi pipeline: `errorHandler`.

## Backend route map

Auth:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

Jockey, yeu cau role `jockey`:

- `GET /api/jockey/dashboard`
- `GET /api/jockey/invitations`
- `PATCH /api/jockey/invitations/:id`
- `GET /api/jockey/races`
- `GET /api/jockey/races/:id`
- `GET /api/jockey/notifications`

Spectator, yeu cau role `spectator`:

- `GET /api/spectator/tournaments`
- `GET /api/spectator/races`
- `GET /api/spectator/races/:id`
- `POST /api/spectator/races/:id/viewing-pass`
- `GET /api/spectator/viewing-passes`
- `GET /api/spectator/predictions/:id`
- `POST /api/spectator/predictions/:id`
- `GET /api/spectator/points`
- `GET /api/spectator/products`
- `POST /api/spectator/redemptions`
- `GET /api/spectator/notifications`

Admin, yeu cau role `admin`:

- `GET /api/admin/users`
- `GET /api/admin/registrations`
- `PATCH /api/admin/registrations/:id`
- `PATCH /api/admin/races/:id/result/publish`
- `GET /api/admin/results/publish-queue`
- `POST /api/admin/jobs/viewing-ticket-reminders`
- `POST /api/tournaments`
- `GET /api/tournaments`
- `GET /api/tournaments/:id`
- `PATCH /api/tournaments/:id/status`
- `POST /api/races`
- `GET /api/races/tournament/:tournamentId`
- `GET /api/races/:id`
- `POST /api/races/:id/participants`
- `PATCH /api/races/:id/status`

Referee, yeu cau role `referee`:

- `GET /api/referee/dashboard`
- `GET /api/referee/races`
- `GET /api/referee/races/:id/checks`
- `PATCH /api/referee/races/:id/checks`
- `GET /api/referee/races/:id/result`
- `POST /api/referee/races/:id/result`
- `PATCH /api/referee/races/:id/result/confirm`

Horse owner, yeu cau role `horse_owner`:

- `POST /api/horse-owner/horses`
- `GET /api/horse-owner/horses`
- `PATCH /api/horse-owner/horses/:id`
- `POST /api/horse-owner/registrations`
- `GET /api/horse-owner/registrations`
- `DELETE /api/horse-owner/registrations/:id`
- `POST /api/horse-owner/invitations`

## Backend model map

Model export tap trung o `backend/src/models/index.ts`:

- User, Horse, Track
- RaceMeeting, Tournament, Race, RaceViewingPass
- ViewingTicketReminderLog
- RaceRegistration, Result
- JockeyInvitation
- Prediction, PredictionPool
- SpectatorProfile
- Product, Redemption
- Notification, AuditLog, OrganizerLedger

Khi can sua logic domain, thuong di theo chuoi:

```text
routes -> controllers -> services -> models
```

## Web FE

`FE/src/App.tsx`:

- Browser routes:
  - `/login`: man hinh auth.
  - `/:page`: protected app shell.
  - `/` va `*`: redirect `/dashboard`.
- `ProtectedRoute` yeu cau co user trong `AppContext`.

`FE/src/context/AppContext.tsx`:

- Quan ly token, session, user, app state.
- Token key: `horse-racing-token`.
- Goi `authApi.getMe()` khi co token.
- Sau login/register goi `syncAppState(account)`.
- Co demo accounts:
  - `spectator@demo.local`
  - `jockey1@demo.local`
  - `owner@demo.local`
  - `referee@demo.local`
  - `admin@demo.local`
  - Password: `Demo@123`
- Registration trong web hien chi cho spectator; cac role khac dung demo account.
- `handleAction()` gom cac action UI nhu jockey invite, admin approval, publish result, referee check, make prediction.

Menu role trong `FE/src/config/roleConfigs.ts`:

- Owner: dashboard, horses, jockeys, schedule, results.
- Jockey: dashboard, invitations, assigned, schedule, performance.
- Referee: dashboard, checks, monitor, violations, reports.
- Spectator: dashboard, tournaments, live, predictions, rewards.
- Admin: dashboard, users, tournaments, approvals, results.

API web:

- `FE/src/api/client.ts` boc `fetch`, tu them `Authorization: Bearer <token>`.
- Cac module domain: `auth.api.ts`, `admin.api.ts`, `jockey.api.ts`, `owner.api.ts`, `referee.api.ts`, `spectator.api.ts`, `dataSync.ts`.

## Mobile FE

`FE_mobile/src/app/_layout.tsx`:

- Root app dung `AuthProvider`, `PaperProvider`, `ThemeProvider`.
- Load font tu `constants/theme.ts`.
- Dung Expo Router `Stack`, an header.

`FE_mobile/src/context/AuthContext.tsx`:

- Goi `authApi.getMe()` khi mount.
- Cung cap `login`, `registerSpectator`, `logout`.

`FE_mobile/src/app/(app)/_layout.tsx`:

- Bao ve khu app cho user role `spectator`.
- Neu chua login hoac role khac thi redirect `/(auth)/auth`.
- Tabs spectator:
  - `home` = Trang chu
  - `live` = Truc tiep
  - `predict` = Du doan
  - `notifications` = Thong bao
- Lay unread notification count bang `spectatorApi.listNotifications()`.

Mobile API:

- `FE_mobile/src/api/client.ts` dung `expo-secure-store` tren native, `localStorage` tren web.
- API base mac dinh `http://10.0.2.2:3000`.

## Prompt nen dung cho lan sau

```text
Ban dang lam trong repo Horse_race tai C:\Users\trung\Desktop\WDP\Horse_race.
Hay doc PROJECT_CONTEXT.md truoc de tiet kiem token.
Du an gom backend Express/Mongoose TypeScript, FE React/Vite, FE_mobile Expo Router.
Truoc khi sua file, chay git status --short va khong revert thay doi khong phai cua ban.
Neu task lien quan backend, di theo routes -> controllers -> services -> models.
Neu task lien quan web, xem FE/src/App.tsx, FE/src/context/AppContext.tsx, FE/src/api/* va page theo role.
Neu task lien quan mobile, xem FE_mobile/src/app, FE_mobile/src/context/AuthContext.tsx va FE_mobile/src/api/*.
Chi sua dung pham vi user yeu cau, khong refactor lan man.
Sau khi sua, chay test/build/lint phu hop neu co the, va bao ro neu khong chay duoc.
```

## Prompt ngan cho task sua loi

```text
Doc PROJECT_CONTEXT.md. Toi can sua: <mo ta loi/tinh nang>.
Pham vi cho phep: <backend/FE/FE_mobile/file cu the>.
Khong sua ngoai pham vi. Hay kiem tra git status truoc, doc code lien quan, sua toi thieu, va chay lenh verify phu hop.
```

## Ghi chu trang thai hien tai khi tao file nay

- `git status --short` dang hien nhieu file modified/deleted/untracked co san.
- File nay duoc tao chi de lam context/doc cho lan sau.
- Khong co build/test nao duoc chay trong qua trinh tao file nay vi user yeu cau chi doc va tao Markdown.
