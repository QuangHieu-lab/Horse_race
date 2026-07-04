# PayOS Local Setup and Test Guide

This guide explains how to configure and test point top-up locally.

## 1. Backend env file location

The backend app runs from:

```powershell
cd C:\Users\trung\Desktop\WDP\Horse_race\backend\backend
```

Create or update this file:

```text
C:\Users\trung\Desktop\WDP\Horse_race\backend\backend\.env
```

Do not commit `.env` to GitHub.

## 2. Required env values

```env
PORT=3000
NODE_ENV=development

MONGODB_URI=mongodb://127.0.0.1:27017/horse_racing

JWT_SECRET=horse-racing-dev-secret-change-in-production
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173,http://localhost:8081,http://127.0.0.1:8081

ALLOW_MOCK_TOPUP=true

PAYOS_CLIENT_ID=your-payos-client-id
PAYOS_API_KEY=your-payos-api-key
PAYOS_CHECKSUM_KEY=your-payos-checksum-key
PAYOS_API_URL=https://api-merchant.payos.vn
PAYOS_RETURN_URL=http://localhost:3000/api/payments/payos/return
PAYOS_CANCEL_URL=http://localhost:3000/api/payments/payos/cancel
PAYOS_FRONTEND_RETURN_URL=http://localhost:5173
```

## 3. Run backend

```powershell
cd C:\Users\trung\Desktop\WDP\Horse_race\backend\backend
npm install
npm run db:seed
npm run start
```

Swagger is available at:

```text
http://localhost:3000/api-docs
```

## 4. Demo account

```text
spectator@demo.local / Demo@123
spectator2@demo.local / Demo@123
spectator3@demo.local / Demo@123
```

## 5. Mock top-up test

Mock top-up does not need PayOS credentials.

Endpoint:

```text
POST http://localhost:3000/api/spectator/top-ups
```

Body:

```json
{
  "points": 100
}
```

Expected:

```text
amountVnd = 100000
exchangeRateVndPerPoint = 1000
status = paid
spectator balance increases by 100 points
```

## 6. PayOS top-up test

Endpoint:

```text
POST http://localhost:3000/api/spectator/top-ups/payos
```

Body:

```json
{
  "points": 100
}
```

Expected:

```text
status = pending
amountVnd = 100000
paymentUrl = https://pay.payos.vn/...
```

Open `paymentUrl` in the browser to test checkout.

## 7. Webhook note

PayOS cannot call `localhost` from the internet. For local webhook testing, expose the backend with a tunnel such as ngrok or cloudflared.

Example webhook URL:

```text
https://your-tunnel-url.ngrok-free.app/api/payments/payos/webhook
```

For deployed backend:

```text
https://your-backend-domain.com/api/payments/payos/webhook
```

## 8. FE env

FE web:

```env
VITE_API_URL=http://localhost:3000/api
```

FE mobile:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Android emulator may need:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```
