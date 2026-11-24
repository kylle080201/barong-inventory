# Barong Inventory Management System

A comprehensive inventory and sales management system built with Next.js 14, TypeScript, MongoDB, and Tailwind CSS.

## Features

- **Inventory Management**
  - Add, edit, and delete inventory items
  - Track product details (name, category, size, color, price, cost, quantity, SKU)
  - Search and filter inventory items
  - Low stock alerts (items with quantity < 10)

- **Sales Management**
  - Record new sales with multiple items
  - Automatic inventory deduction
  - Support for multiple payment methods (Cash, Card, GCash, PayMaya, Bank Transfer)
  - Customer information tracking
  - Discount support

- **Sales Reports & Analytics**
  - Sales summary dashboard
  - Total sales and revenue tracking
  - Payment method statistics
  - Top selling items
  - Daily sales reports
  - Date range filtering

- **Dashboard**
  - Overview statistics
  - Quick actions
  - Real-time data updates

## Prerequisites

- Node.js 18+ and npm
- MongoDB database (local or MongoDB Atlas)

## Setup Instructions

1. **Clone or navigate to the project directory**
   ```bash
   cd barong-inventory
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/barong-inventory
   ```
   
   For MongoDB Atlas, use:
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/barong-inventory?retryWrites=true&w=majority
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
barong-inventory/
├── app/
│   ├── api/              # API routes
│   │   ├── inventory/    # Inventory CRUD operations
│   │   └── sales/        # Sales operations and summaries
│   ├── inventory/        # Inventory pages
│   ├── sales/            # Sales pages
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Dashboard
│   └── globals.css       # Global styles
├── lib/
│   └── mongodb.ts        # MongoDB connection
├── models/
│   ├── Inventory.ts      # Inventory model
│   └── Sale.ts           # Sale model
└── package.json
```

## API Endpoints

### Inventory
- `GET /api/inventory` - Get all inventory items (supports `?search=` and `?category=`)
- `POST /api/inventory` - Create new inventory item
- `GET /api/inventory/[id]` - Get single inventory item
- `PUT /api/inventory/[id]` - Update inventory item
- `DELETE /api/inventory/[id]` - Delete inventory item

### Sales
- `GET /api/sales` - Get all sales (supports `?startDate=` and `?endDate=`)
- `POST /api/sales` - Create new sale
- `GET /api/sales/summary` - Get sales summary (supports `?startDate=` and `?endDate=`)

## MCP Server

The app exposes an [MCP](https://modelcontextprotocol.io) endpoint at `/api/mcp` so AI assistants (Claude Desktop, Claude Code, etc.) can record and update sales and stock for you. It uses the same logic as the web app, so stock is adjusted the same way.

| Tool | What it does |
| --- | --- |
| `list_inventory` | List products with ids, size, price, cost and stock (optional search) |
| `add_inventory_item` | Add a product with its starting stock |
| `update_inventory_item` | Change a product's details (only the fields given) |
| `restock_item` | Add arriving stock to a product |
| `list_sales` | List recent sales with ids, items and totals |
| `record_sale` | Record a sale (with optional sale date); deducts stock |
| `update_sale` | Edit a sale; stock is adjusted by the difference |

### Connecting ChatGPT, claude.ai and other OAuth clients

The endpoint supports OAuth 2.1 sign-in (the MCP authorization spec), so web apps can connect without a token:

1. Deploy the app at a public **https** URL and set `NEXTAUTH_URL` (or `OAUTH_ISSUER`) to that exact URL, e.g. `https://inventory.example.com`.
2. In the client, add a custom connector / MCP server with the URL `https://inventory.example.com/api/mcp`. Leave any client ID/secret fields empty; the client registers itself.
3. You're sent to the app to log in and approve access. Only approve connections you started yourself.

How it works:
- **Discovery:** `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`.
- **Registration:** dynamic client registration at `/api/oauth/register`.
- **Sign-in:** authorization code with PKCE (S256) through the approval page at `/oauth/authorize`.
- **Tokens:** issued at `/api/oauth/token`. Access tokens last 1 hour and only work on `/api/mcp`. Refresh tokens last 30 days and are replaced each time they're used. They can be revoked at `/api/oauth/revoke`.

### Connecting with a token (Claude Code, Claude Desktop, Gemini CLI)

1. Create a token for your account (signed with `NEXTAUTH_SECRET` from `.env.local`, which must match the deployed app's):

   ```bash
   npm run mcp-token you@example.com        # valid 90 days
   npm run mcp-token you@example.com 365d   # custom expiry
   ```

   Anyone with the token can change sales and stock as you, so keep it private. Changing `NEXTAUTH_SECRET` invalidates all tokens.

2. Add the server to your client. For Claude Code:

   ```bash
   claude mcp add --transport http barong-inventory https://your-app-url/api/mcp --header "Authorization: Bearer <token>"
   ```

   Other clients: use the Streamable HTTP URL `https://your-app-url/api/mcp` (or `http://localhost:3000/api/mcp` locally) with the header `Authorization: Bearer <token>`.

Sale dates given as `YYYY-MM-DD` are read as that day in Philippine time (UTC+8); set `BUSINESS_UTC_OFFSET` (e.g. `+08:00`) to change this.

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM
- **Tailwind CSS** - Styling
- **React** - UI library

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Notes

- The system automatically deducts inventory quantities when sales are recorded
- Low stock items (quantity < 10) are highlighted in yellow
- All prices are displayed in Philippine Peso (₱)
- The sales summary page provides comprehensive analytics and reporting

## License

This project is private and proprietary.






