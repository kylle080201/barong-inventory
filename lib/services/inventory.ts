import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import { ServiceError, toServiceError } from './errors';

export const INVENTORY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Yards'] as const;

export interface InventoryInput {
  name: string;
  description?: string;
  size: string;
  price: number;
  cost: number;
  quantity: number;
  imageUrl?: string;
}

const EDITABLE_FIELDS = ['name', 'description', 'size', 'price', 'cost', 'quantity', 'imageUrl'] as const;

/** Drops legacy category/color fields and normalizes ids for API/MCP output. */
export function cleanInventoryItem(item: any) {
  if (!item) return item;
  const { category: _category, color: _color, __v: _v, ...rest } = item;
  return { ...rest, _id: String(rest._id), userId: rest.userId ? String(rest.userId) : rest.userId };
}

function assertValidId(id: string, label = 'product') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ServiceError(`Invalid ${label} id`, 400);
  }
}

export async function listInventory(userId: string, search?: string) {
  await connectDB();
  const query: any = { userId };
  if (search) {
    const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { description: { $regex: pattern, $options: 'i' } },
    ];
  }
  const items = await Inventory.find(query).sort({ createdAt: -1 }).lean();
  return items.map(cleanInventoryItem);
}

export async function createInventoryItem(userId: string, input: Partial<InventoryInput>) {
  if (
    !input.name ||
    !input.size ||
    input.price === undefined ||
    input.cost === undefined ||
    input.quantity === undefined
  ) {
    throw new ServiceError('Missing required fields: name, size, price, cost, quantity', 400);
  }
  if (!INVENTORY_SIZES.includes(input.size as any)) {
    throw new ServiceError(`Size must be one of: ${INVENTORY_SIZES.join(', ')}`, 400);
  }

  await connectDB();
  const data: any = {};
  for (const field of EDITABLE_FIELDS) {
    if (input[field] !== undefined) data[field] = input[field];
  }

  try {
    const item = await Inventory.create({ ...data, userId });
    return cleanInventoryItem(item.toObject());
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function updateInventoryItem(userId: string, id: string, patch: Partial<InventoryInput>) {
  assertValidId(id);
  await connectDB();

  const update: any = {};
  for (const field of EDITABLE_FIELDS) {
    if (patch[field] !== undefined) update[field] = patch[field];
  }
  if (Object.keys(update).length === 0) {
    throw new ServiceError('Nothing to update', 400);
  }

  try {
    const item = await Inventory.findOneAndUpdate({ _id: id, userId }, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!item) throw new ServiceError('Item not found', 404);
    return cleanInventoryItem(item);
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function restockInventoryItem(userId: string, id: string, amount: number) {
  assertValidId(id);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new ServiceError('Amount must be a whole number greater than 0', 400);
  }
  await connectDB();

  const item = await Inventory.findOneAndUpdate(
    { _id: id, userId },
    { $inc: { quantity: amount } },
    { new: true }
  ).lean();
  if (!item) throw new ServiceError('Product not found', 404);
  return cleanInventoryItem(item);
}
