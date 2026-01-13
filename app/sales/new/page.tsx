'use client';

import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect } from 'react';
import AuthGuard from '@/components/auth-guard';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface InventoryItem {
  _id: string;
  name: string;
  size: string;
  price: number;
  quantity: number;
}

interface SaleItem {
  inventoryId: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  total: number;
}

export default function NewSalePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [formData, setFormData] = useState({
    discount: '0',
    paymentMethod: 'cash',
    customerName: '',
    customerContact: '',
    notes: '',
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory');
      const data = await response.json();
      if (data.success) {
        setInventory(data.data.filter((item: InventoryItem) => item.quantity > 0));
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const addItem = (item: InventoryItem) => {
    const existingItem = saleItems.find((si) => si.inventoryId === item._id);
    
    if (existingItem) {
      if (existingItem.quantity >= item.quantity) {
        alert('Cannot add more items. Insufficient stock.');
        return;
      }
      const updatedItems = saleItems.map((si) =>
        si.inventoryId === item._id
          ? {
              ...si,
              quantity: si.quantity + 1,
              total: (si.quantity + 1) * si.price,
            }
          : si
      );
      setSaleItems(updatedItems);
    } else {
      setSaleItems([
        ...saleItems,
        {
          inventoryId: item._id,
          name: item.name,
          size: item.size,
          quantity: 1,
          price: item.price,
          total: item.price,
        },
      ]);
    }
  };

  const updateItemQuantity = (inventoryId: string, quantity: number) => {
    const item = inventory.find((i) => i._id === inventoryId);
    if (item && quantity > item.quantity) {
      alert('Insufficient stock.');
      return;
    }

    if (quantity <= 0) {
      setSaleItems(saleItems.filter((si) => si.inventoryId !== inventoryId));
    } else {
      const updatedItems = saleItems.map((si) =>
        si.inventoryId === inventoryId
          ? {
              ...si,
              quantity,
              total: quantity * si.price,
            }
          : si
      );
      setSaleItems(updatedItems);
    }
  };

  const removeItem = (inventoryId: string) => {
    setSaleItems(saleItems.filter((si) => si.inventoryId !== inventoryId));
  };

  const subtotal = saleItems.reduce((sum, item) => sum + item.total, 0);
  const discount = parseFloat(formData.discount) || 0;
  const total = subtotal - discount;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (saleItems.length === 0) {
      alert('Please add at least one item to the sale.');
      return;
    }

    if (total < 0) {
      alert('Total cannot be negative. Please adjust the discount.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: saleItems,
          discount,
          paymentMethod: formData.paymentMethod,
          customerName: formData.customerName || undefined,
          customerContact: formData.customerContact || undefined,
          notes: formData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/sales');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error creating sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link href="/sales" className="text-sm hover:underline mb-4 inline-block">
              ← Back to Sales
            </Link>
            <h2 className="text-2xl font-semibold">Record New Sale</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Available Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {inventory.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No items available</p>
                    ) : (
                      inventory.map((item) => (
                          <div
                          key={item._id}
                          className="flex justify-between items-center p-3 border rounded-md hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Size: {item.size} | Stock: {item.quantity} | ₱{item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => addItem(item)}
                            size="sm"
                          >
                            Add
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Sale Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {saleItems.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No items added</p>
                    ) : (
                      <div className="space-y-3 mb-4">
                        {saleItems.map((item) => (
                          <div key={item.inventoryId} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.name} ({item.size})</p>
                                <p className="text-xs text-muted-foreground">₱{item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(item.inventoryId)}
                              >
                                ×
                              </Button>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updateItemQuantity(item.inventoryId, item.quantity - 1)}
                              >
                                −
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItemQuantity(item.inventoryId, parseInt(e.target.value) || 1)
                                }
                                className="w-16 text-center"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => updateItemQuantity(item.inventoryId, item.quantity + 1)}
                              >
                                +
                              </Button>
                              <span className="ml-auto font-medium">
                                ₱{item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t pt-4 space-y-4">
                      <div>
                        <Label htmlFor="discount">Discount (₱)</Label>
                        <Input
                          id="discount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.discount}
                          onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="paymentMethod">Payment Method *</Label>
                        <Select
                          id="paymentMethod"
                          required
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="gcash">GCash</option>
                          <option value="paymaya">PayMaya</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="other">Other</option>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="customerName">Customer Name</Label>
                        <Input
                          id="customerName"
                          type="text"
                          value={formData.customerName}
                          onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="customerContact">Customer Contact</Label>
                        <Input
                          id="customerContact"
                          type="text"
                          value={formData.customerContact}
                          onChange={(e) => setFormData({ ...formData, customerContact: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>₱{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span>Discount:</span>
                            <span>-₱{discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t">
                          <span>Total:</span>
                          <span>₱{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      <div className="flex space-x-4 pt-4">
                        <Link href="/sales" className="flex-1">
                          <Button type="button" variant="outline" className="w-full">Cancel</Button>
                        </Link>
                        <Button
                          type="submit"
                          disabled={loading || saleItems.length === 0}
                          className="flex-1"
                        >
                          {loading ? 'Processing...' : 'Complete Sale'}
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
