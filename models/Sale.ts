import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISaleItem {
  inventoryId: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ISale extends Document {
  saleDate: Date;
  items: ISaleItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  customerContact?: string;
  notes?: string;
  userId: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema: Schema = new Schema({
  inventoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    required: false,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const SaleSchema: Schema = new Schema(
  {
    saleDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: {
      type: [SaleItemSchema],
      required: true,
      validate: {
        validator: (items: ISaleItem[]) => items.length > 0,
        message: 'Sale must have at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['cash', 'card', 'gcash', 'paymaya', 'bank_transfer', 'other'],
      default: 'cash',
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerContact: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
SaleSchema.index({ saleDate: -1 });
SaleSchema.index({ createdAt: -1 });

const Sale: Model<ISale> = mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema);

export default Sale;

