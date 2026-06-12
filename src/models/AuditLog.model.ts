import mongoose, { Schema } from 'mongoose';
import type { AuditAction } from '../types/shared.types.js';

export interface IAuditLog {
  action: AuditAction;
  entityModel: string;
  entityId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: [
        'registration_approved',
        'registration_rejected',
        'race_status_changed',
        'result_confirmed',
        'result_published',
        'prediction_pool_settled',
        'participant_scratched',
      ],
      required: true,
    },
    entityModel: { type: String, required: true, trim: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ entityModel: 1, entityId: 1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
