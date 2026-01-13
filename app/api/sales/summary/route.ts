import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/models/Sale';
import { requireAuth } from '@/lib/auth-middleware';

// GET - Get sales summary
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    await connectDB();
    
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    let query: any = {};
    
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) {
        query.saleDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.saleDate.$lte = new Date(endDate);
      }
    }
    
    const sales = await Sale.find(query);
    
    // Calculate summary statistics
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalItemsSold = sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0),
      0
    );
    
    // Group by payment method
    const paymentMethodStats = sales.reduce((acc: any, sale) => {
      const method = sale.paymentMethod;
      acc[method] = (acc[method] || 0) + sale.total;
      return acc;
    }, {});
    
    // Group by date (for daily sales)
    const dailySales = sales.reduce((acc: any, sale) => {
      const date = new Date(sale.saleDate).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, count: 0, revenue: 0 };
      }
      acc[date].count += 1;
      acc[date].revenue += sale.total;
      return acc;
    }, {});
    
    // Top selling items
    const itemSales = sales.reduce((acc: any, sale) => {
      sale.items.forEach((item: any) => {
        if (!acc[item.name]) {
          acc[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        }
        acc[item.name].quantity += item.quantity;
        acc[item.name].revenue += item.total;
      });
      return acc;
    }, {});
    
    const topSellingItems = Object.values(itemSales)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 10);
    
    return NextResponse.json({
      success: true,
      data: {
        totalSales,
        totalRevenue,
        totalItemsSold,
        averageOrderValue: totalSales > 0 ? totalRevenue / totalSales : 0,
        paymentMethodStats,
        dailySales: Object.values(dailySales),
        topSellingItems,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

