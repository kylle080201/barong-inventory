import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInventory extends Document {
  name: string;
  description?: string;
  size: string;
  price: number;
  cost: number;
  quantity: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      required: [true, 'Size is required'],
      trim: true,
      enum: {
        values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
        message: 'Size must be one of: XS, S, M, L, XL, XXL, XXXL',
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be positive'],
    },
    cost: {
      type: Number,
      required: [true, 'Cost is required'],
      min: [0, 'Cost must be positive'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Inventory: Model<IInventory> =
  mongoose.models.Inventory || mongoose.model<IInventory>('Inventory', InventorySchema);

export default Inventory;

