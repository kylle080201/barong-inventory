'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InventoryItem {
  _id: string;
  name: string;
  size: string;
  quantity: number;
}

function RestockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetId = searchParams.get('id') ?? '';
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [productId, setProductId] = useState(presetId);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch('/api/inventory');
        const data = await response.json();
        if (data.success) {
          const products: InventoryItem[] = data.data;
          setItems(products);
          if (presetId && products.some((item) => item._id === presetId)) {
            setProductId(presetId);
          }
        }
      } catch (fetchError) {
        console.error('Error fetching inventory:', fetchError);
        setError('Could not load products.');
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [presetId]);

  const selected = items.find((item) => item._id === productId);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const quantityToAdd = Number(amount);
    if (!productId) {
      setError('Select a product to restock.');
      return;
    }
    if (!Number.isInteger(quantityToAdd) || quantityToAdd < 1) {
      setError('Enter a whole number greater than 0.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/inventory/${productId}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: quantityToAdd }),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to restock product.');
        return;
      }

      const updated: InventoryItem = data.data;
      setItems((current) =>
        current.map((item) =>
          item._id === updated._id ? { ...item, quantity: updated.quantity } : item
        )
      );
      setAmount('');
      setSuccess(
        `Added ${quantityToAdd} to ${updated.name}. Stock is now ${updated.quantity}.`
      );
      router.refresh();
    } catch (submitError) {
      console.error('Error restocking product:', submitError);
      setError('Failed to restock product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add stock</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingItems ? (
          <p className="text-sm text-muted-foreground">Loading products...</p>
        ) : items.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              There are no products to restock yet.
            </p>
            <Link href="/inventory/new">
              <Button variant="outline">Add your first item</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="product">Product *</Label>
              <Select
                id="product"
                required
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setSuccess('');
                  setError('');
                }}
              >
                <option value="">Select a product</option>
                {items.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name} ({item.size}) — {item.quantity} in stock
                  </option>
                ))}
              </Select>
            </div>

            {selected && (
              <p className="text-sm text-muted-foreground">
                Current stock for {selected.name} ({selected.size}): {selected.quantity}
              </p>
            )}

            <div>
              <Label htmlFor="amount">Amount to add *</Label>
              <Input
                id="amount"
                type="number"
                required
                min="1"
                step="1"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Enter quantity to add"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm">{success}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Link href="/inventory">
                <Button type="button" variant="outline">
                  Back to Inventory
                </Button>
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Restocking...' : 'Restock'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function RestockPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link href="/inventory" className="text-sm hover:underline mb-4 inline-block">
              ← Back to Inventory
            </Link>
            <h2 className="text-2xl font-semibold">Restock</h2>
          </div>
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
            <RestockForm />
          </Suspense>
        </main>
      </div>
    </AuthGuard>
  );
}
