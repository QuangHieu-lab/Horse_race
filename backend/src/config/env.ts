import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function parseCorsOrigins(raw: string): string[] | true {
  const trimmed = raw.trim();
  if (trimmed === '*' || trimmed === 'true') return true;
  return trimmed.split(',').map((o) => o.trim()).filter(Boolean);
}

const corsRaw = process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:8081';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  
  port: Number(process.env.PORT) || 3000,
  mongodbUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/horse_racing'),
  corsOrigins: parseCorsOrigins(corsRaw),
  jwtSecret: required('JWT_SECRET', 'horse-racing-dev-secret-change-in-production'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  allowMockTopUp: process.env.ALLOW_MOCK_TOPUP === 'true' || (process.env.NODE_ENV ?? 'development') !== 'production',
  payos: {
    clientId: process.env.PAYOS_CLIENT_ID ?? '',
    apiKey: process.env.PAYOS_API_KEY ?? '',
    checksumKey: process.env.PAYOS_CHECKSUM_KEY ?? '',
    apiUrl: process.env.PAYOS_API_URL ?? 'https://api-merchant.payos.vn',
    returnUrl: process.env.PAYOS_RETURN_URL ?? 'http://localhost:3000/api/payments/payos/return',
    cancelUrl: process.env.PAYOS_CANCEL_URL ?? 'http://localhost:3000/api/payments/payos/cancel',
    frontendReturnUrl: process.env.PAYOS_FRONTEND_RETURN_URL ?? '',
  },
} as const;
