# Admin User CRUD Flow

Last checked: 2026-07-24

This document records the admin account-management flow for horse owners, jockeys, referees, and spectators.

## Supported Roles

Admin can manage these non-admin roles:

- `horse_owner`
- `jockey`
- `referee`
- `spectator`

Admin creation and admin privilege escalation are intentionally blocked from this flow.

## Backend API

### List Users

```http
GET /api/admin/users
```

Returns account identity plus profile fields used by FE edit forms:

- `phone`
- `licenseNumber`
- `licenseExpiry`
- `certificationId`
- `isActive`

### Create User

```http
POST /api/admin/users
```

Creates a login-ready account.

Role-specific fields:

- Jockey: `licenseNumber`, `licenseExpiry`
- Referee: `certificationId`
- Horse owner/spectator: base profile fields only

### Update User

```http
PATCH /api/admin/users/{id}
```

Supports:

- full name
- phone
- role
- active/inactive status
- password reset
- jockey license fields
- referee certification field

Safety rules:

- Current admin cannot disable their own account.
- Current admin cannot demote/change their own role.
- A non-admin account cannot be promoted to `admin` from this screen.
- When role changes, stale role-specific profiles are cleared.

### Delete User

```http
DELETE /api/admin/users/{id}
```

This is a safe hard-delete, not a blind delete.

Allowed only when the account is non-admin and has no linked business data:

- horses
- race registrations
- jockey invitations
- race assignments/participants/referee assignments
- results/rankings/violations
- payment transactions
- point wallet ledger entries
- notifications

If the account has history, backend returns `409` and the admin should use deactivate instead. This keeps race history, point ledgers, and audit-like data consistent.

## FE Web Flow

Admin page:

```text
FE/src/pages/admin/UsersPage.tsx
```

Current UI supports:

- Create horse owner, jockey, referee, or spectator.
- Show phone/license/certification summary in the user table.
- Edit selected account details.
- Change role from the table or edit panel.
- Activate/deactivate account.
- Reset password by entering a new password in the edit panel.
- Delete unused non-admin accounts with two-step confirmation.

## Test Notes

Commands run:

```bash
npm run db:seed
npx tsc --noEmit
npm run build
```

Backend service-level flow tests were executed with temporary users and then the DB was seeded again to restore clean demo data.

| Test case | Expected result | Result |
| --- | --- | --- |
| Create jockey with license profile | Account created and license returned | PASS |
| Create referee with certification profile | Account created and certification returned | PASS |
| Create horse owner | Account created | PASS |
| Update jockey name, phone, password, license | All fields persist and new password works | PASS |
| Change role and role-specific profile | Role/profile updated, stale profile cleared | PASS |
| Current admin demotes own role | Reject | PASS |
| Promote non-admin to admin | Reject | PASS |
| Delete linked owner with race data | Reject with 409 | PASS |
| Delete unused non-admin account | Delete succeeds | PASS |
| List users exposes profile fields for FE edit | Profile fields returned | PASS |

Observed successful messages:

```text
PASS allow: create jockey with license profile
PASS allow: create referee with certification profile
PASS allow: create horse owner
PASS allow: update jockey name/phone/password/license
PASS allow: change role and role profile
PASS reject: self admin cannot demote own role
PASS reject: non-admin cannot be promoted to admin
PASS reject: linked owner cannot be hard deleted
PASS allow: delete unused non-admin account
PASS allow: list users includes profile fields for FE edit
```

Final cleanup:

```bash
npm run db:seed
```

The final seed completed successfully after tests.
