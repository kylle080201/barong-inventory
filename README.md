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



