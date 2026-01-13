'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Navbar from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStock: 0,
    totalSales: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [inventoryRes, summaryRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/sales/summary'),
      ]);

      if (inventoryRes.ok) {
        const inventoryData = await inventoryRes.json();
        const items = inventoryData.data || [];
        const lowStockItems = items.filter((item: any) => item.quantity < 10);
        
        setStats((prev) => ({
          ...prev,
          totalItems: items.length,
          lowStock: lowStockItems.length,
        }));
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        const summary = summaryData.data || {};
        
        setStats((prev) => ({
          ...prev,
          totalSales: summary.totalSales || 0,
          totalRevenue: summary.totalRevenue || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardDescription>Total Items</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Low Stock Items</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.lowStock}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total Sales</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.totalSales}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total Revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ₱{stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Link href="/inventory/new">
                  <Button className="w-full">Add New Item</Button>
                </Link>
                <Link href="/sales/new">
                  <Button className="w-full" variant="outline">Record New Sale</Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/inventory" className="block text-sm hover:underline">
                  → View All Inventory
                </Link>
                <Link href="/sales" className="block text-sm hover:underline">
                  → View All Sales
                </Link>
                <Link href="/sales/summary" className="block text-sm hover:underline">
                  → Sales Summary & Reports
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
