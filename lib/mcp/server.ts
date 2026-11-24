import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ServiceError } from '@/lib/services/errors';
import {
  INVENTORY_SIZES,
  createInventoryItem,
  listInventory,
  restockInventoryItem,
  updateInventoryItem,
} from '@/lib/services/inventory';
import { PAYMENT_METHODS, listSales, recordSale, updateSale } from '@/lib/services/sales';
import type { TokenPayload } from '@/lib/jwt';

const LOW_STOCK = 10;

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Runs a tool body, turning expected failures into tool errors the model can read and act on. */
async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (error: any) {
    if (!(error instanceof ServiceError)) console.error('MCP tool error:', error);
    const message = error instanceof ServiceError ? error.message : 'Unexpected server error';
    return { isError: true, content: [{ type: 'text', text: message }] };
  }
}

function inventorySummary(item: any) {
  return {
    id: item._id,
    name: item.name,
    description: item.description,
    size: item.size,
    price: item.price,
    cost: item.cost,
    quantity: item.quantity,
    lowStock: item.quantity < LOW_STOCK,
  };
}

function saleSummary(sale: any) {
  return {
    id: sale._id,
    reference: `#${String(sale._id).slice(-6).toUpperCase()}`,
    saleDate: sale.saleDate,
    recordedAt: sale.createdAt,
    items: sale.items.map((i: any) => ({
      inventoryId: i.inventoryId,
      name: i.name,
      size: i.size,
      quantity: i.quantity,
      price: i.price,
      total: i.total,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount ?? 0,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    customerName: sale.customerName,
    customerContact: sale.customerContact,
    notes: sale.notes,
  };
}

const sizeSchema = z.enum(INVENTORY_SIZES);
const paymentSchema = z.enum(PAYMENT_METHODS);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Must be a 24-character id');
const saleDateSchema = z
  .string()
  .describe(
    'When the sale happened: YYYY-MM-DD (a day in Philippine time) or a full ISO date-time. Defaults to now. Cannot be in the future.'
  );
const saleItemsSchema = z
  .array(
    z.object({
      inventoryId: idSchema.describe('Product id from list_inventory'),
      quantity: z.number().int().min(1),
      price: z
        .number()
        .min(0)
        .optional()
        .describe(
          "Unit price in PHP. Leave out to use the product's current price (or, when editing a sale, the price it sold at)."
        ),
    })
  )
  .min(1);

/** Builds an MCP server whose tools act as the given app user. */
export function createInventoryMcpServer(user: TokenPayload) {
  const server = new McpServer(
    { name: 'barong-inventory', version: '1.0.0' },
    {
      instructions:
        'Tools for a barong shop\'s inventory and sales (amounts in PHP). ' +
        'Look up product ids with list_inventory and sale ids with list_sales before changing anything. ' +
        'Recording or editing a sale adjusts stock automatically; use restock_item to add stock that arrived.',
    }
  );
  const userId = user.id;

  server.registerTool(
    'list_inventory',
    {
      title: 'List inventory',
      description: 'List products with their ids, size, price, cost and stock. Optionally filter by name or description.',
      inputSchema: { search: z.string().optional().describe('Text to match in name or description') },
      annotations: { readOnlyHint: true },
    },
    ({ search }) => run(async () => (await listInventory(userId, search)).map(inventorySummary))
  );

  server.registerTool(
    'add_inventory_item',
    {
      title: 'Add product',
      description: 'Add a new product to inventory with its starting stock.',
      inputSchema: {
        name: z.string().min(1),
        size: sizeSchema,
        price: z.number().min(0).describe('Selling price in PHP'),
        cost: z.number().min(0).describe('Cost in PHP'),
        quantity: z.number().int().min(0).describe('Starting stock'),
        description: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    (input) => run(async () => inventorySummary(await createInventoryItem(userId, input)))
  );

  server.registerTool(
    'update_inventory_item',
    {
      title: 'Update product',
      description:
        'Change a product\'s details. Only the fields you pass are changed. ' +
        'Setting quantity overwrites the stock count; to add arriving stock use restock_item instead.',
      inputSchema: {
        id: idSchema.describe('Product id from list_inventory'),
        name: z.string().min(1).optional(),
        size: sizeSchema.optional(),
        price: z.number().min(0).optional(),
        cost: z.number().min(0).optional(),
        quantity: z.number().int().min(0).optional().describe('New stock count (replaces the current one)'),
        description: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ id, ...patch }) => run(async () => inventorySummary(await updateInventoryItem(userId, id, patch)))
  );

  server.registerTool(
    'restock_item',
    {
      title: 'Restock product',
      description: 'Add newly arrived stock to a product (increases its quantity by amount).',
      inputSchema: {
        id: idSchema.describe('Product id from list_inventory'),
        amount: z.number().int().min(1).describe('How many units to add'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ id, amount }) => run(async () => inventorySummary(await restockInventoryItem(userId, id, amount)))
  );

  server.registerTool(
    'list_sales',
    {
      title: 'List sales',
      description: 'List recent sales, newest sale date first, with their ids, items and totals.',
      inputSchema: {
        startDate: z.string().optional().describe('Only sales on or after this ISO date-time'),
        endDate: z.string().optional().describe('Only sales on or before this ISO date-time'),
        limit: z.number().int().min(1).max(200).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    ({ startDate, endDate, limit }) =>
      run(async () => (await listSales(userId, { startDate, endDate, limit })).map(saleSummary))
  );

  server.registerTool(
    'record_sale',
    {
      title: 'Record sale',
      description:
        'Record a sale of one or more products. Stock is deducted; the sale is rejected if any product lacks stock. ' +
        'The time it was entered is saved separately as the recorded date.',
      inputSchema: {
        items: saleItemsSchema,
        saleDate: saleDateSchema.optional(),
        discount: z.number().min(0).optional().describe('Discount in PHP off the whole sale'),
        paymentMethod: paymentSchema.default('cash'),
        customerName: z.string().optional(),
        customerContact: z.string().optional(),
        notes: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    (input) => run(async () => saleSummary(await recordSale(userId, input)))
  );

  server.registerTool(
    'update_sale',
    {
      title: 'Update sale',
      description:
        'Edit a recorded sale. Only the fields you pass are changed. Passing items replaces the whole item list, ' +
        'and stock is adjusted by the difference (rejected if there is not enough stock).',
      inputSchema: {
        id: idSchema.describe('Sale id from list_sales'),
        items: saleItemsSchema.optional().describe('Full new item list (replaces the existing items)'),
        saleDate: saleDateSchema.optional(),
        discount: z.number().min(0).optional(),
        paymentMethod: paymentSchema.optional(),
        customerName: z.string().optional(),
        customerContact: z.string().optional(),
        notes: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    ({ id, ...input }) => run(async () => saleSummary(await updateSale(userId, id, input)))
  );

  return server;
}
