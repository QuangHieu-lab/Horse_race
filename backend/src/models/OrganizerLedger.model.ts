import mongoose, { Schema } from 'mongoose';

export interface IOrganizerLedger {
  tournamentId: mongoose.Types.ObjectId;
  raceId?: mongoose.Types.ObjectId | null;
  predictionPoolId?: mongoose.Types.ObjectId | null;
  feeAmount: number;
  note?: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const OrganizerLedgerSchema = new Schema<IOrganizerLedger>(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    raceId: { type: Schema.Types.ObjectId, ref: 'Race', default: null },
    predictionPoolId: { type: Schema.Types.ObjectId, ref: 'PredictionPool', default: null },
    feeAmount: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

OrganizerLedgerSchema.index({ tournamentId: 1, createdAt: -1 });
OrganizerLedgerSchema.index({ raceId: 1 });

export const OrganizerLedger = mongoose.model<IOrganizerLedger>(
  'OrganizerLedger',
  OrganizerLedgerSchema,
);
