# Project Flow Audit - 2026-07-24

Scope: backend, FE web, and FE mobile.

Mode: test and document only. No fixes were made for findings discovered during this audit.

## Branches

- Backend branch: `Bao-fix-admin`
- FE web branch: `Bao-fix-admin`
- FE mobile branch: `main` was only checked/tested; no changes were made.

## Commands Run

Backend:

```bash
npx tsc --noEmit
npm run db:seed
```

FE web:

```bash
npm run build
```

FE mobile:

```bash
npx tsc --noEmit
```

## Results

| Area | Check | Result |
| --- | --- | --- |
| Backend | TypeScript compile | PASS |
| Backend | Seed clean demo data | PASS |
| FE web | Production build | PASS |
| FE mobile | TypeScript compile | PASS |
| Backend flow | Admin create/update/delete unused referee | PASS |
| Backend flow | Block deleting linked owner account | PASS |
| Backend flow | Block race start when pre-race checks are missing | PASS |
| Backend flow | Allow race start after all pre-race checks are complete | PASS |
| Backend flow | Publish confirmed result and settle prediction points | PASS |

After backend smoke tests mutated the demo DB, `npm run db:seed` was run again and completed successfully to restore clean seed data.

## Flow Coverage Checked

### Admin User Management

Checked:

- Create jockey with license profile.
- Create referee with certification profile.
- Create horse owner.
- Update user profile and role-specific fields.
- Reset password through admin update service.
- Delete unused non-admin account.
- Block deleting account with linked business history.
- Block self-demotion for current admin.
- Block promoting non-admin account to admin.

Status: pass.

### Pre-Race Eligibility

Checked:

- Race cannot start if an active participant is missing veterinary approval.
- Race cannot start if an active participant is missing information confirmation.
- Race can move to `ready` when checks are complete.

Status: pass.

### Prediction Settlement

Checked:

- Publishing seeded confirmed result settles predictions.
- Winning spectator balance increased.
- Predictions moved into settled statuses.

Status: pass.

## Findings To Review Later

These were not fixed in this audit.

### 1. FE Web Has A Few Loose `any` Casts In Race/Admin Flow

Observed files:

- `FE/src/pages/admin/RacesPage.tsx`
- `FE/src/context/AppContext.tsx`

Impact:

- Build passes, but some race participant fields are accessed through `as any`.
- This can hide API/DTO drift between BE and FE, especially around participant scratched/disqualified state and populated referee IDs.

Recommended next action:

- Tighten FE types for race participant details and API race DTOs.

### 2. Backend Still Has A Few `as any` / `@ts-ignore` Compatibility Spots

Observed examples:

- `backend/src/routes/auth.routes.ts`
- `backend/src/controllers/race.controller.ts`
- `backend/src/services/result.service.ts`
- `backend/src/services/referee.service.ts`

Impact:

- Typecheck passes, but these spots can hide model/schema mismatches.

Recommended next action:

- Replace with proper DTO/model typing gradually, starting with result/referee penalty fields because they affect ranking, DQ, and prize settlement.

### 3. Delete User Is Intentionally Conservative

Status:

- Works as designed.

Notes:

- Hard delete succeeds only for accounts without linked business data.
- Accounts with history must be deactivated.

Impact:

- This is safer for demo and production-like data, but admin users may expect delete to always work. FE should keep the current error message visible.

### 4. FE Mobile Was Compile-Tested Only

Status:

- `npx tsc --noEmit` passes.

Not covered:

- Emulator/runtime click-through.
- Real API login/prediction/top-up flow from mobile UI.

Recommended next action:

- Run mobile against local backend and test spectator login, race list, prediction ticket count, points balance, and notification display.

## Current Conclusion

No blocking compile/build/seed error was found.

The main backend flows tested in this pass are working:

- admin user CRUD safeguards
- pre-race eligibility gate
- prediction point settlement on publish

The remaining issues are mostly type-safety and runtime/manual QA items, not confirmed broken flows from this audit.
