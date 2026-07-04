# Seed Data Guide

This guide explains how to reset and seed demo data for the Horse Racing backend.

## Location

Run the seed command from the backend application folder:

```powershell
cd C:\Users\trung\Desktop\WDP\Horse_race\backend\backend
```

## Requirements

- MongoDB must be running.
- By default, the backend uses:

```text
mongodb://127.0.0.1:27017/horse_racing
```

- If you use another database URL, set `MONGODB_URI` before running the command.

```powershell
$env:MONGODB_URI="mongodb://127.0.0.1:27017/horse_racing"
```

## Run Seed

```powershell
npm run db:seed
```

The seed script clears existing demo collections first, then creates fresh demo data.

## Demo Password

All demo users use:

```text
Demo@123
```

## Demo Accounts

```text
admin@demo.local
owner@demo.local
jockey1@demo.local
jockey2@demo.local
jockey3@demo.local
referee@demo.local
spectator@demo.local
spectator2@demo.local
spectator3@demo.local
```

## Seeded Scenarios

- Jockey flow: pending invitation and assigned race data.
- Horse owner flow: horses, approved registrations, and one independent race without a jockey yet.
- Spectator flow: tournaments, races, points wallet, top-up payments, prediction data, products, and a viewing pass.
- Prediction settlement flow: a completed race with confirmed result waiting for admin publish, including one correct 1x prediction, one incorrect 1x prediction, and one correct 2x prediction.
- Referee flow: draft result race for testing time penalty, disqualification-style penalty through `penalize`, revoke penalty, and result confirmation.
- Horse PDF data: demo horses point to a local copy of the NJ 4-H Horse Registration Form PDF.

## Spectator Point Test Data

The seed creates three spectator accounts:

```text
spectator@demo.local   / Demo@123 — correct winner prediction, 1x risk
spectator2@demo.local  / Demo@123 — incorrect winner prediction, 1x risk
spectator3@demo.local  / Demo@123 — correct winner prediction, 2x risk
```

Initial point wallets after seed:

```text
spectator@demo.local  — earned 250,000, spent 50,000, balance 200,000
spectator2@demo.local — earned 150,000, spent 80,000, balance 70,000
spectator3@demo.local — earned 300,000, spent 100,000, balance 200,000
```

The completed race `Vòng loại — Heat 1` is seeded with:

```text
3 pending predictions
totalBountyPool = 200,000 points
entryFee = 50,000 points
allowed risk multipliers = 1, 2, 3, 6
```

When admin publishes this result, the pool settlement can be tested with weighted scoring:

```text
predictionScore = contribution * riskMultiplier
spectator@demo.local  score = 50,000 * 1 = 50,000
spectator3@demo.local score = 100,000 * 2 = 200,000
spectator2@demo.local loses and funds the winPool
```

The seed also creates two redeemable products:

```text
Voucher xem giải VIP — 500 points, grants a race viewing pass
Hộp quà lưu niệm trường đua — 1,000 points, merchandise demo
```

## Demo PDF

The demo PDF is stored in the backend app folder:

```text
backend/public/demo-files/horses/horse-reg-form.pdf
```

Original source:

```text
https://nj4h.rutgers.edu/horses/horse-reg-form.pdf
```

When the backend server is running on port `3000`, the seeded horse profile PDF URL is:

```text
http://localhost:3000/demo-files/horses/horse-reg-form.pdf
```

## Useful Notes

- The script prints ready-to-use IDs for referee penalty testing after it finishes.
- Running the seed repeatedly is safe for demo use because it resets the configured demo collections each time.
- Do not run this against production data.

## Payment Notes

The current exchange rate is:

```text
1000 VND = 1 point
```

Mock top-up works without external credentials. PayOS top-up requires these environment variables:

```text
ALLOW_MOCK_TOPUP=true
PAYOS_CLIENT_ID=your-payos-client-id
PAYOS_API_KEY=your-payos-api-key
PAYOS_CHECKSUM_KEY=your-payos-checksum-key
PAYOS_API_URL=https://api-merchant.payos.vn
PAYOS_RETURN_URL=http://localhost:3000/api/payments/payos/return
PAYOS_CANCEL_URL=http://localhost:3000/api/payments/payos/cancel
PAYOS_FRONTEND_RETURN_URL=http://localhost:5173
```

For local demo, use the mock top-up endpoint/button first:

```text
POST /api/spectator/top-ups
body: { "points": 100 }
```

Expected result:

```text
amountVnd = 100,000
exchangeRateVndPerPoint = 1000
status = paid
spectator balance increases by 100 points
```

PayOS is intentionally not usable with placeholder credentials. If `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, or `PAYOS_CHECKSUM_KEY` are missing, the backend returns a configuration error for:

```text
POST /api/spectator/top-ups/payos
```
