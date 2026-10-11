'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface InventoryItem {
  _id: string;
  name: string;
  description?: string;
  size: string;
  price: number;
  cost: number;
  quantity: number;
  imageUrl?: string;
}

const PAGE_SIZE = 5;

function formatPrice(price: number) {
  return `₱${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    fetchItems();
  }, [search]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/api/inventory?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.data);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchItems();
      } else {
        alert('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item');
    }
  };

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedItems = items.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold">Inventory</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/inventory/restock">
                <Button variant="outline">Restock</Button>
              </Link>
              <Link href="/inventory/new">
                <Button>Add New Item</Button>
              </Link>
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or description..."
                />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No inventory items found.</p>
                <Link href="/inventory/new">
                  <Button variant="outline">Add your first item</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {pagedItems.map((item) => (
                  <Card key={item._id} data-inventory-card className={item.quantity < 10 ? 'bg-muted/40' : ''}>
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground break-words">{item.description}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-md bg-background px-2 py-1 text-xs">
                          {item.size}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Price</p>
                          <p className="font-medium">{formatPrice(item.price)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Quantity</p>
                          <p className="font-medium">
                            {item.quantity}
                            {item.quantity < 10 && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">Low stock</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <Link href={`/inventory/restock?id=${item._id}`} className="block">
                          <Button variant="outline" size="sm" className="w-full">Restock</Button>
                        </Link>
                        <Link href={`/inventory/${item._id}/edit`} className="block">
                          <Button variant="outline" size="sm" className="w-full">Edit</Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDelete(item._id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {pageCount > 1 && (
                  <div className="space-y-3 pt-1">
                    <p className="text-center text-sm text-muted-foreground">
                      {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, items.length)} of {items.length}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={safePage === 1}
                        onClick={() => setPage(safePage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={safePage === pageCount}
                        onClick={() => setPage(safePage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Card className="hidden md:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item._id} className={item.quantity < 10 ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-sm text-muted-foreground">{item.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 text-xs rounded-md bg-muted">
                              {item.size}
                            </span>
                          </TableCell>
                          <TableCell>{formatPrice(item.price)}</TableCell>
                          <TableCell>
                            <span className={item.quantity < 10 ? 'font-medium' : ''}>
                              {item.quantity}
                            </span>
                            {item.quantity < 10 && (
                              <span className="ml-2 text-xs text-muted-foreground">Low Stock</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link href={`/inventory/restock?id=${item._id}`}>
                                <Button variant="ghost" size="sm">Restock</Button>
                              </Link>
                              <Link href={`/inventory/${item._id}/edit`}>
                                <Button variant="ghost" size="sm">Edit</Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item._id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
