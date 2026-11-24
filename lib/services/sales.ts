import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Sale from '@/models/Sale';
import Inventory from '@/models/Inventory';
import { ServiceError, toServiceError } from './errors';

export const PAYMENT_METHODS = ['cash', 'card', 'gcash', 'paymaya', 'bank_transfer', 'other'] as const;

/** Offset used when a sale date is given as a bare YYYY-MM-DD (the shop is in the Philippines). */
const BUSINESS_UTC_OFFSET = process.env.BUSINESS_UTC_OFFSET || '+08:00';

export interface SaleItemInput {
  inventoryId: string;
  quantity: number;
  /** Unit price. Defaults to the product's current price. */
  price?: number;
}

export interface SaleInput {
  saleDate?: string | Date;
  items: SaleItemInput[];
  discount?: number;
  paymentMethod?: string;
  customerName?: string;
  customerContact?: string;
  notes?: string;
}

export type SaleUpdateInput = Partial<SaleInput>;

interface SaleLine {
  inventoryId: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  total: number;
}

export function cleanSale(sale: any) {
  if (!sale) return sale;
  const { __v: _v, ...rest } = sale;
  return {
    ...rest,
    _id: String(rest._id),
    userId: rest.userId ? String(rest.userId) : rest.userId,
    items: (rest.items || []).map((item: any) => {
      const { _id: _itemId, ...line } = item;
      return { ...line, inventoryId: String(line.inventoryId) };
    }),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function todayInBusinessTz() {
  const offsetMatch = BUSINESS_UTC_OFFSET.match(/^([+-])(\d{2}):(\d{2})$/);
  const sign = offsetMatch?.[1] === '-' ? -1 : 1;
  const minutes = offsetMatch ? sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3])) : 480;
  return new Date(Date.now() + minutes * 60_000).toISOString().slice(0, 10);
}

/**
 * Parses a sale date. A bare YYYY-MM-DD means that calendar day in the shop's time zone:
 * today keeps the current time, other days are stored at noon (same rule as the web form).
 */
export function parseSaleDate(value: string | Date | undefined, fallback: Date = new Date()): Date {
  let date: Date;
  if (value === undefined || value === null || value === '') {
    date = fallback;
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date = value === todayInBusinessTz() ? new Date() : new Date(`${value}T12:00:00${BUSINESS_UTC_OFFSET}`);
  } else {
    date = new Date(value);
  }

  if (isNaN(date.getTime())) throw new ServiceError('Invalid sale date', 400);

  // 14h of slack covers clients in time zones ahead of the server
  if (date.getTime() > Date.now() + 14 * 60 * 60 * 1000) {
    throw new ServiceError('Sale date cannot be in the future', 400);
  }
  return date;
}

function validateItemsShape(items: unknown): asserts items is SaleItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ServiceError('Sale must have at least one item', 400);
  }
  for (const item of items as any[]) {
    if (!item || !mongoose.Types.ObjectId.isValid(String(item.inventoryId))) {
      throw new ServiceError('Each item needs a valid inventoryId', 400);
    }
    if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
      throw new ServiceError('Item quantity must be a whole number of at least 1', 400);
    }
    if (item.price !== undefined && (typeof item.price !== 'number' || item.price < 0 || isNaN(item.price))) {
      throw new ServiceError('Item price must be a number of 0 or more', 400);
    }
  }
}

/**
 * Builds sale lines from product ids, using the product's name, size and (unless given) price.
 * `previousLines` lets an edited sale keep lines whose product has since been deleted.
 */
async function buildLines(userId: string, items: SaleItemInput[], previousLines: SaleLine[] = []) {
  const ids = Array.from(new Set(items.map((i) => String(i.inventoryId))));
  const products = await Inventory.find({ _id: { $in: ids }, userId }).lean();
  const byId = new Map(products.map((p: any) => [String(p._id), p]));

  return items.map((item): SaleLine => {
    const id = String(item.inventoryId);
    const product: any = byId.get(id);
    const previous = previousLines.find((l) => String(l.inventoryId) === id);
    if (!product && !previous) {
      throw new ServiceError(`Inventory item ${id} not found or not accessible`, 404);
    }
    const quantity = Number(item.quantity);
    // Edits keep the price the item originally sold at unless a new one is given
    const price = item.price ?? previous?.price ?? product.price;
    return {
      inventoryId: id,
      name: product?.name ?? previous!.name,
      size: product?.size ?? previous?.size ?? '',
      quantity,
      price,
      total: round2(price * quantity),
    };
  });
}

function quantitiesById(lines: { inventoryId: any; quantity: number }[]) {
  const map = new Map<string, number>();
  for (const line of lines) {
    const id = String(line.inventoryId);
    map.set(id, (map.get(id) || 0) + line.quantity);
  }
  return map;
}

/**
 * Applies stock changes (positive = take from stock, negative = return to stock).
 * Each take is guarded so stock can't go below zero; on failure everything applied is undone.
 * Returns an undo function.
 */
async function applyStockChanges(userId: string, deltas: Map<string, number>, names: Map<string, string>) {
  const applied: [string, number][] = [];
  const undo = async () => {
    for (const [id, delta] of applied.reverse()) {
      await Inventory.updateOne({ _id: id, userId }, { $inc: { quantity: delta } });
    }
  };

  // Takes first, so a shortage fails before anything is returned to stock
  const ordered = Array.from(deltas.entries())
    .filter(([, d]) => d !== 0)
    .sort((a, b) => b[1] - a[1]);

  for (const [id, delta] of ordered) {
    if (delta > 0) {
      const result = await Inventory.updateOne(
        { _id: id, userId, quantity: { $gte: delta } },
        { $inc: { quantity: -delta } }
      );
      if (result.modifiedCount === 0) {
        await undo();
        const exists = await Inventory.exists({ _id: id, userId });
        throw exists
          ? new ServiceError(`Insufficient stock for ${names.get(id) || id}`, 400)
          : new ServiceError(`Inventory item ${names.get(id) || id} not found or not accessible`, 404);
      }
    } else {
      // Returning stock to a product that was deleted is skipped, as before
      await Inventory.updateOne({ _id: id, userId }, { $inc: { quantity: -delta } });
    }
    applied.push([id, delta]);
  }
  return undo;
}

function validateTotals(subtotal: number, discount: number) {
  if (typeof discount !== 'number' || isNaN(discount) || discount < 0) {
    throw new ServiceError('Discount must be a number of 0 or more', 400);
  }
  if (subtotal - discount < 0) {
    throw new ServiceError('Total cannot be negative. Please adjust the discount.', 400);
  }
}

function validatePaymentMethod(method: string) {
  if (!PAYMENT_METHODS.includes(method as any)) {
    throw new ServiceError(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`, 400);
  }
}

export async function listSales(
  userId: string,
  options: { startDate?: string; endDate?: string; limit?: number } = {}
) {
  await connectDB();
  const query: any = { userId, deletedAt: null };
  if (options.startDate || options.endDate) {
    query.saleDate = {};
    if (options.startDate) query.saleDate.$gte = new Date(options.startDate);
    if (options.endDate) query.saleDate.$lte = new Date(options.endDate);
  }
  let cursor = Sale.find(query).sort({ saleDate: -1 });
  if (options.limit) cursor = cursor.limit(options.limit);
  const sales = await cursor.lean();
  return sales.map(cleanSale);
}

export async function recordSale(userId: string, input: SaleInput) {
  await connectDB();

  const saleDate = parseSaleDate(input.saleDate);
  validateItemsShape(input.items);
  const paymentMethod = input.paymentMethod || 'cash';
  validatePaymentMethod(paymentMethod);

  const lines = await buildLines(userId, input.items);
  const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const discount = input.discount ?? 0;
  validateTotals(subtotal, discount);

  const names = new Map(lines.map((l) => [l.inventoryId, l.name]));
  const undo = await applyStockChanges(userId, quantitiesById(lines), names);

  try {
    const sale = await Sale.create({
      saleDate,
      items: lines,
      subtotal,
      discount,
      total: round2(subtotal - discount),
      paymentMethod,
      customerName: input.customerName || undefined,
      customerContact: input.customerContact || undefined,
      notes: input.notes || undefined,
      userId,
    });
    return cleanSale(sale.toObject());
  } catch (error) {
    await undo();
    throw toServiceError(error);
  }
}

/** Updates a sale. Fields left out keep their current values; stock is adjusted by the difference. */
export async function updateSale(userId: string, saleId: string, input: SaleUpdateInput) {
  if (!mongoose.Types.ObjectId.isValid(saleId)) throw new ServiceError('Invalid sale id', 400);
  await connectDB();

  const sale = await Sale.findOne({ _id: saleId, userId, deletedAt: null });
  if (!sale) {
    throw new ServiceError('Sale not found or you do not have permission to edit it', 404);
  }

  const saleDate = input.saleDate !== undefined ? parseSaleDate(input.saleDate) : sale.saleDate;
  const paymentMethod = input.paymentMethod ?? sale.paymentMethod;
  validatePaymentMethod(paymentMethod);

  const oldLines: SaleLine[] = sale.items.map((i: any) => ({
    inventoryId: String(i.inventoryId),
    name: i.name,
    size: i.size,
    quantity: i.quantity,
    price: i.price,
    total: i.total,
  }));

  let lines = oldLines;
  if (input.items !== undefined) {
    validateItemsShape(input.items);
    lines = await buildLines(userId, input.items, oldLines);
  }

  const subtotal = round2(lines.reduce((sum, l) => sum + l.total, 0));
  const discount = input.discount ?? sale.discount ?? 0;
  validateTotals(subtotal, discount);

  // Net stock change per product: new quantity sold minus what this sale already took
  const deltas = quantitiesById(lines);
  for (const [id, qty] of Array.from(quantitiesById(oldLines).entries())) {
    deltas.set(id, (deltas.get(id) || 0) - qty);
  }
  const names = new Map([...oldLines, ...lines].map((l) => [l.inventoryId, l.name]));
  const undo = await applyStockChanges(userId, deltas, names);

  try {
    sale.saleDate = saleDate;
    sale.items = lines as any;
    sale.subtotal = subtotal;
    sale.discount = discount;
    sale.total = round2(subtotal - discount);
    sale.paymentMethod = paymentMethod;
    if (input.customerName !== undefined) sale.customerName = input.customerName || undefined;
    if (input.customerContact !== undefined) sale.customerContact = input.customerContact || undefined;
    if (input.notes !== undefined) sale.notes = input.notes || undefined;
    await sale.save();
    return cleanSale(sale.toObject());
  } catch (error) {
    await undo();
    throw toServiceError(error);
  }
}
