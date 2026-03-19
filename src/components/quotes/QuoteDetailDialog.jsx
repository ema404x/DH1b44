import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';

export default function QuoteDetailDialog({ quote, onClose }) {
  const [items, setItems] = useState([]);
  const [taxRate, setTaxRate] = useState(21);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (quote) {
      setItems(quote.items || []);
      setTaxRate(quote.tax_rate || 21);
    }
  }, [quote]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Quote.update(quote.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quotes'] }); onClose(); }
  });

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unit_price || 0);
    }
    setItems(newItems);
  };

  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const total = subtotal * (1 + taxRate / 100);

  const handleSave = () => {
    updateMutation.mutate({ items, subtotal, tax_rate: taxRate, total });
  };

  if (!quote) return null;

  return (
    <Dialog open={!!quote} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>{quote.title}</DialogTitle>
            <StatusBadge value={quote.status} />
          </div>
          <p className="text-sm text-muted-foreground">{quote.client_name} · {quote.code}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Ítems del presupuesto</h3>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Agregar ítem
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-20">Cant.</TableHead>
                <TableHead className="w-28">Precio Unit.</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Descripción" className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} className="h-8" />
                  </TableCell>
                  <TableCell className="text-right font-medium">${(item.total || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin ítems. Hacé click en "Agregar ítem".</TableCell></TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium w-28 text-right">${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">IVA:</span>
              <Input type="number" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} className="h-7 w-16 text-right" />
              <span className="text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-4 text-lg font-bold pt-2">
              <span>Total:</span>
              <span>${total.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Presupuesto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}