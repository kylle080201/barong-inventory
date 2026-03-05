'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Navbar from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trash2, Edit } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

interface SaleItem {
  inventoryId: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  total: number;
}

interface Sale {
  _id: string;
  saleDate: string;
  items: SaleItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  customerName?: string;
  customerContact?: string;
  notes?: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [editFormData, setEditFormData] = useState({
    saleDate: '',
    items: [] as SaleItem[],
    discount: '0',
    paymentMethod: 'cash',
    customerName: '',
    customerContact: '',
    notes: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchSales();
  }, [startDate, endDate]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/sales?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSales(data.data);
      }
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPaymentMethod = (method: string) => {
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleDeleteClick = (saleId: string) => {
    setSaleToDelete(saleId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;

    try {
      const response = await fetch(`/api/sales/${saleToDelete}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Sale deleted successfully');
        fetchSales(); // Refresh the list
        setDeleteDialogOpen(false);
        setSaleToDelete(null);
      } else {
        toast.error(data.error || 'Failed to delete sale');
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete sale');
    }
  };

  const handleEditClick = (sale: Sale) => {
    // Format current date for input (YYYY-MM-DDTHH:mm) - default to current date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    setSaleToEdit(sale);
    setEditFormData({
      saleDate: dateTimeString,
      items: sale.items.map(item => ({ ...item })),
      discount: String(sale.discount || 0),
      paymentMethod: sale.paymentMethod,
      customerName: sale.customerName || '',
      customerContact: sale.customerContact || '',
      notes: sale.notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleEditItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      const newItems = editFormData.items.filter((_, i) => i !== index);
      setEditFormData({ ...editFormData, items: newItems });
    } else {
      const newItems = [...editFormData.items];
      newItems[index] = {
        ...newItems[index],
        quantity,
        total: quantity * newItems[index].price,
      };
      setEditFormData({ ...editFormData, items: newItems });
    }
  };

  const handleEditRemoveItem = (index: number) => {
    const newItems = editFormData.items.filter((_, i) => i !== index);
    setEditFormData({ ...editFormData, items: newItems });
  };

  const handleEditSubmit = async () => {
    if (!saleToEdit) return;

    if (editFormData.items.length === 0) {
      toast.error('Sale must have at least one item');
      return;
    }

    const subtotal = editFormData.items.reduce((sum, item) => sum + item.total, 0);
    const discount = parseFloat(editFormData.discount) || 0;
    const total = subtotal - discount;

    if (total < 0) {
      toast.error('Total cannot be negative. Please adjust the discount.');
      return;
    }

    setEditLoading(true);

    try {
      const response = await fetch(`/api/sales/${saleToEdit._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          saleDate: editFormData.saleDate,
          items: editFormData.items,
          discount,
          paymentMethod: editFormData.paymentMethod,
          customerName: editFormData.customerName || undefined,
          customerContact: editFormData.customerContact || undefined,
          notes: editFormData.notes || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Sale updated successfully');
        fetchSales(); // Refresh the list
        setEditDialogOpen(false);
        setSaleToEdit(null);
      } else {
        toast.error(data.error || 'Failed to update sale');
      }
    } catch (error) {
      console.error('Error updating sale:', error);
      toast.error('Failed to update sale');
    } finally {
      setEditLoading(false);
    }
  };

  // Get max date for date input (today)
  const getMaxDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Sales</h2>
            <Link href="/sales/new">
              <Button>Record New Sale</Button>
            </Link>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          ) : sales.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No sales found.</p>
                <Link href="/sales/new">
                  <Button variant="outline">Record your first sale</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sales.map((sale) => (
                <Card key={sale._id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Sale #{sale._id.slice(-6).toUpperCase()}
                        </h3>
                        <p className="text-sm text-muted-foreground">{formatDate(sale.saleDate)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            ₱{sale.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatPaymentMethod(sale.paymentMethod)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(sale)}
                            className="flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteClick(sale._id)}
                            className="flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="space-y-2 mb-4">
                        {sale.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>
                              {item.name} ({item.size}) × {item.quantity}
                            </span>
                            <span className="font-medium">
                              ₱{item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t pt-2 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>₱{sale.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount:</span>
                          <span>
                            {sale.discount && sale.discount > 0 ? (
                              <span className="text-green-600">-₱{sale.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            ) : (
                              <span className="text-muted-foreground">₱0.00</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t">
                          <span>Total:</span>
                          <span>₱{sale.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {(sale.customerName || sale.customerContact || sale.notes) && (
                        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                          {sale.customerName && <p>Customer: {sale.customerName}</p>}
                          {sale.customerContact && <p>Contact: {sale.customerContact}</p>}
                          {sale.notes && <p className="mt-2">Notes: {sale.notes}</p>}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Sale</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this sale? This action will restore the inventory quantities and cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSaleToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Sale</DialogTitle>
              <DialogDescription>
                Update the sale information. Date cannot be set to a future date.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editSaleDate">Sale Date & Time *</Label>
                <Input
                  id="editSaleDate"
                  type="datetime-local"
                  value={editFormData.saleDate}
                  max={getMaxDateTime()}
                  onChange={(e) => setEditFormData({ ...editFormData, saleDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Items</Label>
                <div className="space-y-2 mt-2">
                  {editFormData.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items</p>
                  ) : (
                    editFormData.items.map((item, index) => (
                      <div key={index} className="border rounded-md p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name} ({item.size})</p>
                            <p className="text-xs text-muted-foreground">
                              ₱{item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRemoveItem(index)}
                          >
                            ×
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditItemQuantity(index, item.quantity - 1)}
                          >
                            −
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleEditItemQuantity(index, parseInt(e.target.value) || 1)
                            }
                            className="w-16 text-center"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditItemQuantity(index, item.quantity + 1)}
                          >
                            +
                          </Button>
                          <span className="ml-auto font-medium">
                            ₱{item.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="editDiscount">Discount (₱)</Label>
                <Input
                  id="editDiscount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editFormData.discount}
                  onChange={(e) => setEditFormData({ ...editFormData, discount: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="editPaymentMethod">Payment Method *</Label>
                <Select
                  id="editPaymentMethod"
                  required
                  value={editFormData.paymentMethod}
                  onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
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
                <Label htmlFor="editCustomerName">Customer Name</Label>
                <Input
                  id="editCustomerName"
                  type="text"
                  value={editFormData.customerName}
                  onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="editCustomerContact">Customer Contact</Label>
                <Input
                  id="editCustomerContact"
                  type="text"
                  value={editFormData.customerContact}
                  onChange={(e) => setEditFormData({ ...editFormData, customerContact: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="editNotes">Notes</Label>
                <Textarea
                  id="editNotes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>
                    ₱{editFormData.items.reduce((sum, item) => sum + item.total, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span>
                    {parseFloat(editFormData.discount) > 0 ? (
                      <span className="text-green-600">
                        -₱{parseFloat(editFormData.discount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">₱0.00</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>
                    ₱{(editFormData.items.reduce((sum, item) => sum + item.total, 0) - (parseFloat(editFormData.discount) || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSaleToEdit(null);
                }}
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={editLoading || editFormData.items.length === 0}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  );
}
