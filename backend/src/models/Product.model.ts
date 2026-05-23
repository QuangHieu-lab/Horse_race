import mongoose, { Schema } from 'mongoose';
import type { ProductCategory } from '../types/shared.types.js';

export interface IProduct {
  name: string;
  description?: string;
  imageUrl?: string;
  category: ProductCategory;
  pointsCost: number;
  stock: number;
  totalRedeemed: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    imageUrl: { type: String },
    category: {
      type: String,
      enum: ['merchandise', 'voucher', 'experience', 'digital', 'other'],
      default: 'other',
    },
    pointsCost: { type: Number, required: true, min: 1 },
    stock: { type: Number, default: -1 },
    totalRedeemed: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

ProductSchema.virtual('isInStock').get(function () {
  return this.stock === -1 || this.stock > 0;
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

ProductSchema.index({ isActive: 1, category: 1 });
ProductSchema.index({ pointsCost: 1 });
ProductSchema.index({ stock: 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
