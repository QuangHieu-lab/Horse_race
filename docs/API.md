# API — Horse Racing (`/api/v1`)

Base URL: `http://localhost:3000/api/v1`

## Auth

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/auth/register` | — | Đăng ký (không `admin`) |
| POST | `/auth/login` | — | Login → `{ token, user }` |
| GET | `/auth/me` | JWT | Profile |

Body register/login: `{ email, password, fullName?, role? }`

## Tournaments

| Method | Path | Role |
|--------|------|------|
| GET | `/tournaments` | * |
| GET | `/tournaments/:id` | * |
| POST | `/tournaments` | admin |
| PATCH | `/tournaments/:id` | admin |

## Races

| Method | Path | Role |
|--------|------|------|
| GET | `/races` | * |
| GET | `/races/:id` | * |
| POST | `/tournaments/:tournamentId/races` | admin |
| PATCH | `/races/:id` | admin |
| PATCH | `/races/:id/status` | admin, referee |
| PATCH | `/races/:id/participants/confirm` | horse_owner |

## Horses

| Method | Path | Role |
|--------|------|------|
| GET | `/horses` | owner: own; admin: all |
| POST | `/horses` | horse_owner |
| PATCH | `/horses/:id` | horse_owner (own) |

## Registrations

| Method | Path | Role |
|--------|------|------|
| POST | `/races/:raceId/registrations` | horse_owner |
| GET | `/registrations` | admin, owner |
| PATCH | `/registrations/:id` | admin (`approved`/`rejected`) |

## Invitations

| Method | Path | Role |
|--------|------|------|
| POST | `/invitations` | horse_owner |
| GET | `/invitations` | jockey, owner |
| PATCH | `/invitations/:id/respond` | jockey (`accepted`/`declined`) |

## Results

| Method | Path | Role |
|--------|------|------|
| GET | `/results` | * |
| GET | `/results/race/:raceId` | * |
| PUT | `/results/race/:raceId` | referee |
| POST | `/results/race/:raceId/confirm` | referee |
| POST | `/results/race/:raceId/publish` | admin |

## Predictions

| Method | Path | Role |
|--------|------|------|
| POST | `/predictions` | spectator |
| GET | `/predictions/me` | spectator |

## Notifications

| Method | Path | Role |
|--------|------|------|
| GET | `/notifications` | JWT |
| PATCH | `/notifications/:id/read` | JWT |

## Users (admin)

| Method | Path | Role |
|--------|------|------|
| GET | `/users` | admin |
| PATCH | `/users/:id` | admin |

## Lỗi chuẩn

```json
{ "success": false, "message": "...", "code": "VALIDATION_ERROR" }
```
