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
```

## Seeded Scenarios

- Jockey flow: pending invitation and assigned race data.
- Horse owner flow: horses, approved registrations, and one independent race without a jockey yet.
- Spectator flow: tournaments, races, points wallet, top-up payments, prediction data, products, and a viewing pass.
- Prediction settlement flow: a completed race with confirmed result waiting for admin publish, including one correct prediction and one incorrect prediction.
- Referee flow: draft result race for testing time penalty, disqualification-style penalty through `penalize`, revoke penalty, and result confirmation.
- Horse PDF data: demo horses point to a local copy of the NJ 4-H Horse Registration Form PDF.

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
