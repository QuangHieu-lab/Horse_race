import mongoose, { Schema } from 'mongoose';

export type PaymentProvider = 'mock' | 'fdi' | 'payos';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface IPaymentTransaction {
  userId: mongoose.Types.ObjectId;
  provider: PaymentProvider;
  amountVnd: number;
  points: number;
  exchangeRateVndPerPoint: number;
  status: PaymentStatus;
  providerTransactionId?: string | null;
  providerPayload?: Record<string, unknown> | null;
  paidAt?: Date | null;
  expiredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['mock', 'fdi', 'payos'], default: 'mock', required: true },
    amountVnd: { type: Number, required: true, min: 0 },
    points: { type: Number, required: true, min: 1 },
    exchangeRateVndPerPoint: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'expired', 'cancelled'],
      default: 'pending',
      required: true,
    },
    providerTransactionId: { type: String, default: null, index: true },
    providerPayload: { type: Schema.Types.Mixed, default: null },
    paidAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PaymentTransactionSchema.index({ userId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ status: 1, createdAt: -1 });

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  PaymentTransactionSchema,
);
