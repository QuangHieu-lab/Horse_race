# Business Rules - Pre-Race Eligibility Checks

Last checked: 2026-07-24

This note documents the backend business rules added to prevent invalid race participation, especially the case where horses can still race before their information is confirmed.

## Scope

These rules apply to backend race participation and referee race control flows:

- Admin/BTC adds a horse and jockey to a race.
- Referee checks horse information before race day.
- Referee starts race control and lane draw.
- Referee starts local race simulation.

FE web and FE mobile should display these states clearly, but the backend is the source of truth and blocks invalid calls even if the UI sends them.

## Enforced Rules

### 1. Participant Requires Approved Registration

Endpoint:

```http
POST /api/races/{id}/participants
```

Backend now requires:

- The race must still be `scheduled`.
- The horse must be `fit`.
- Horse, horse owner, and jockey must not be banned from competition.
- The horse must have a `RaceRegistration` for that race with status `approved`.
- The selected jockey must either:
  - match `RaceRegistration.jockeyId`, or
  - have an accepted `JockeyInvitation` for the same race, horse, owner, and jockey.

This prevents manually adding an unapproved horse or an unconfirmed jockey to a race.

### 2. Pre-Race Checks Are Required Before Start

Endpoint:

```http
POST /api/referee/races/{id}/start
```

Backend now requires every active participant to have:

- `vetApprovedAt` set
- `confirmedAt` set

If any active participant is missing one of these checks, the race cannot move from `scheduled` to `ready`.

This prevents a horse from racing when the referee has not confirmed veterinary status or race information.

### 3. Simulation Requires Assigned Referee And Completed Checks

Endpoint:

```http
POST /api/referee/races/{id}/start-simulation
```

Backend now requires:

- The caller must be the assigned referee of the race.
- The race must already be `ready`.
- Every active participant must still have `vetApprovedAt` and `confirmedAt`.

This prevents another referee from starting a race simulation and blocks old or inconsistent data from bypassing the pre-race check gate.

### 4. Checks Cannot Be Edited After Race Control Starts

Endpoint:

```http
PATCH /api/referee/races/{id}/checks
```

Backend now allows toggling `vetApprovedAt` or `confirmedAt` only while the race is still `scheduled`.

It also blocks updates for participants that are scratched or disqualified.

This keeps the pre-race inspection record stable after the referee starts race control.

## Swagger Updates

Swagger now documents:

- `ToggleRaceCheckRequest` as the pre-race gate.
- `POST /api/referee/races/{id}/start`.
- `POST /api/referee/races/{id}/start-simulation`.
- `POST /api/races/{id}/participants` approved-registration requirement.

## Test Notes

Commands run:

```bash
npm run db:seed
npx tsc --noEmit
```

Additional backend service-level test cases were executed with temporary data and cleaned up after the run:

| Test case | Expected result | Result |
| --- | --- | --- |
| Start race with missing veterinary check | Reject | PASS |
| Start race with veterinary check but missing information confirmation | Reject | PASS |
| Start race after all active participants have both checks | Race moves to `ready` | PASS |
| Start simulation using a referee who is not assigned to the race | Reject | PASS |
| Toggle pre-race check after the race is already `ready` | Reject | PASS |
| Admin/BTC adds participant without approved registration | Reject | PASS |

Observed successful messages:

```text
PASS reject: start blocks missing veterinary check
PASS reject: start blocks missing information confirmation
PASS allow: start with all pre-race checks -> ready
PASS reject: simulation blocks non-assigned referee
PASS reject: check update blocks after race is ready/started
PASS reject: admin add participant blocks missing approved registration
```

## Remaining Notes

- FE web should keep showing both pre-race check states so the referee knows why a race cannot start.
- FE mobile does not need to manage these referee/admin checks because mobile is spectator-focused.
- Existing seed data is compatible: races with populated participants already include `confirmedAt` and `vetApprovedAt` where they are meant to be runnable.
