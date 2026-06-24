# API Flow Checkplan

Base URL:

```text
http://localhost:5000/api
```

Default headers for protected APIs:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## 1. Auth

- [ ] `POST /auth/login` returns a valid token for each role.
- [ ] Spectator token can access `/spectator/*`.
- [ ] Jockey token can access `/jockey/*`.
- [ ] Referee token can access `/referee/*`.
- [ ] Wrong role is rejected by protected routes.

Example body:

```json
{
  "email": "spectator@example.com",
  "password": "123456"
}
```

## 2. Spectator Race Discovery

- [ ] `GET /spectator/tournaments` returns tournament list.
- [ ] `GET /spectator/races` returns spectator race list.
- [ ] `GET /spectator/races?filter=open` returns races open for prediction.
- [ ] `GET /spectator/races?filter=upcoming` returns upcoming races.
- [ ] `GET /spectator/races?filter=completed` returns completed races.
- [ ] `GET /spectator/races/:raceId` returns race detail.
- [ ] Race detail includes `canPredict`, `hasPrediction`, and `viewingTicket`.

Fields to verify:

```json
{
  "canPredict": true,
  "hasPrediction": false,
  "viewingTicket": {
    "requiresTicket": true,
    "hasPass": false,
    "canPurchase": true,
    "pricePoints": 100
  }
}
```

## 3. Spectator Points

- [ ] `GET /spectator/points` returns current point balance.
- [ ] Response includes `currentBalance`.
- [ ] Response includes `totalPointsEarned`.
- [ ] Response includes `totalPointsSpent`.
- [ ] Response includes transaction history.

## 4. Top-Up Payment: Money To Points

Business rule:

- `100 VND = 1 point`
- Minimum top-up: `100 points`

APIs:

- [ ] `POST /spectator/top-ups` with `100` points succeeds.
- [ ] `POST /spectator/top-ups` with less than `100` points returns `400`.
- [ ] Successful top-up creates a payment transaction.
- [ ] Successful top-up increases spectator balance.
- [ ] Successful top-up creates a `points_topup` notification.
- [ ] `GET /spectator/top-ups` returns top-up history.

Valid body:

```json
{
  "points": 100
}
```

Invalid body:

```json
{
  "points": 99
}
```

## 5. Prediction Entry

Business rule:

- Minimum prediction entry: `100 points`
- If bounty pool is enabled, cost is `entryFee * riskMultiplier`.
- Current MVP prediction accepts rank 1 winner prediction.

APIs:

- [ ] `POST /spectator/predictions/:raceId` succeeds when prediction window is open.
- [ ] Prediction deducts the correct number of points.
- [ ] Duplicate prediction for the same race is rejected.
- [ ] Prediction outside the prediction window is rejected.
- [ ] Prediction with insufficient points is rejected.
- [ ] Prediction with invalid horse ID is rejected.
- [ ] `GET /spectator/predictions/:id` returns authenticated spectator prediction history.

Example body:

```json
{
  "raceId": "<raceId>",
  "predictedRanks": [
    {
      "rank": 1,
      "horseId": "<horseId>"
    }
  ],
  "riskMultiplier": 1
}
```

Known route note:

- Backend currently ignores `:id` in `GET /spectator/predictions/:id` and uses the authenticated spectator from the token.
- FE web calls this route with the current user ID.
- FE mobile currently calls `/api/spectator/predictions/current`, which should either be added in backend or changed in mobile.

## 6. Prediction Settlement And Rewards

Trigger path:

- Referee submits and confirms result.
- Result publish/settlement scores predictions.

Checks:

- [ ] Correct winner prediction is marked as correct.
- [ ] Incorrect winner prediction is marked as incorrect.
- [ ] Winner receives returned entry points.
- [ ] Winner receives pool share when applicable.
- [ ] Owner/jockey reward split is created when configured.
- [ ] Organizer/racecourse fee is recorded when configured.
- [ ] Spectator receives `prediction_reward` notification.
- [ ] Ledger/audit records are created for settled pool.

## 7. Viewing Pass

- [ ] `POST /spectator/races/:raceId/viewing-pass` succeeds when spectator has enough points.
- [ ] Purchase deducts `pricePoints`.
- [ ] Purchase is rejected when balance is insufficient.
- [ ] Purchase is rejected when pass already exists.
- [ ] `GET /spectator/viewing-passes` returns purchased passes.
- [ ] `GET /spectator/viewing-passes?filter=upcoming` returns upcoming passes only.

## 8. Product Redemption

- [ ] `GET /spectator/products` returns active products.
- [ ] `POST /spectator/redemptions` succeeds when spectator has enough points.
- [ ] Redemption deducts `pointsCost * quantity`.
- [ ] Redemption is rejected when balance is insufficient.
- [ ] Redemption is rejected when product is inactive or out of stock.

Example body:

```json
{
  "productId": "<productId>",
  "quantity": 1
}
```

## 9. Notifications

- [ ] `GET /spectator/notifications` returns spectator notifications.
- [ ] `GET /jockey/notifications` returns jockey notifications.
- [ ] Referee notification behavior is decided and aligned.

Known mismatch:

- FE web calls `GET /referee/notifications`.
- Backend currently does not expose `/api/referee/notifications`.
- Fix option A: add backend route.
- Fix option B: remove/disable FE web call.

## 10. FE Connection Status

FE web:

- [x] Spectator race list is connected.
- [x] Spectator race detail is connected.
- [x] Spectator prediction create flow is connected.
- [x] Spectator prediction history is connected.
- [x] Spectator points balance is connected.
- [x] Spectator top-up flow is connected.
- [x] Spectator notifications are connected.
- [ ] Referee notifications are not aligned with backend.

FE mobile:

- [x] Spectator race list is connected.
- [x] Spectator prediction create flow is connected.
- [x] Spectator points balance is connected.
- [x] Spectator products/redemption APIs are present.
- [x] Spectator notifications are connected.
- [ ] Spectator top-up API is not connected in mobile yet.
- [ ] Prediction history route is mismatched: mobile uses `/predictions/current`, backend has `/predictions/:id`.

## 11. Current Verification Commands

- [ ] Backend: `npx tsc --noEmit`
- [ ] FE web: `npm run build`
- [ ] FE mobile: `npx tsc --noEmit`
- [ ] Optional FE mobile audit: `npm audit --audit-level=high`

Latest observed status:

- Backend typecheck passed.
- FE web build passed.
- FE mobile typecheck passed after route fixes.
- FE mobile audit reported only low/moderate vulnerabilities; no high/critical issues were reported.
