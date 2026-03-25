import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const emptyItem = { codigo: '', descripcion: '', unidad: 'unidad', cantidad: 1, precio_unitario: 0, total: 0 };

export default function RubroSection({ rubro, idx, precario, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [search, setSearch] = useState('');

  const subtotal = rubro.items.reduce((a, i) => a + (i.total || 0), 0);

  const addEmptyItem = () => {
    onChange({ ...rubro, items: [...rubro.items, { ...emptyItem }] });
  };

  const addFromPrecario = (precItem) => {
    const item = {
      precario_id: precItem.id,
      codigo: precItem.codigo || '',
      descripcion: precItem.descripcion,
      unidad: precItem.unidad,
      cantidad: 1,
      precio_unitario: precItem.precio_unitario,
      total: precItem.precio_unitario,
    };
    onChange({ ...rubro, items: [...rubro.items, item] });
    setSelectorOpen(false);
    setSearch('');
  };

  const updateItem = (iIdx, key, value) => {
    const items = [...rubro.items];
    items[iIdx] = { ...items[iIdx], [key]: value };
    if (key === 'cantidad' || key === 'precio_unitario') {
      items[iIdx].total = (items[iIdx].cantidad || 0) * (items[iIdx].precio_unitario || 0);
    }
    onChange({ ...rubro, items });
  };

  const removeItem = (iIdx) => {
    onChange({ ...rubro, items: rubro.items.filter((_, i) => i !== iIdx) });
  };

  const filteredPrecario = precario.filter(p =>
    !search ||
    p.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    p.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
          <Input
            value={rubro.nombre}
            onChange={e => onChange({ ...rubro, nombre: e.target.value })}
            className="font-semibold h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 w-auto"
          />
          <span className="ml-auto text-sm font-semibold text-primary">{fmt(subtotal)}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-3 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs w-20">Código</TableHead>
                  <TableHead className="text-xs">Descripción</TableHead>
                  <TableHead className="text-xs w-20">Unidad</TableHead>
                  <TableHead className="text-xs w-24">Cantidad</TableHead>
                  <TableHead className="text-xs w-32">Precio Unit.</TableHead>
                  <TableHead className="text-xs w-32 text-right">Total</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubro.items.map((item, iIdx) => (
                  <TableRow key={iIdx} className="hover:bg-muted/20">
                    <TableCell className="py-1.5">
                      <Input value={item.codigo || ''} onChange={e => updateItem(iIdx, 'codigo', e.target.value)} className="h-7 text-xs font-mono border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:border focus-visible:border-input" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input value={item.descripcion || ''} onChange={e => updateItem(iIdx, 'descripcion', e.target.value)} className="h-7 text-xs border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:border focus-visible:border-input" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input value={item.unidad || ''} onChange={e => updateItem(iIdx, 'unidad', e.target.value)} className="h-7 text-xs border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:border focus-visible:border-input" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input type="number" value={item.cantidad || ''} onChange={e => updateItem(iIdx, 'cantidad', parseFloat(e.target.value) || 0)} className="h-7 text-xs border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:border focus-visible:border-input" />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input type="number" value={item.precio_unitario || ''} onChange={e => updateItem(iIdx, 'precio_unitario', parseFloat(e.target.value) || 0)} className="h-7 text-xs border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:border focus-visible:border-input" />
                    </TableCell>
                    <TableCell className="py-1.5 text-right font-semibold text-sm">{fmt(item.total)}</TableCell>
                    <TableCell className="py-1.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeItem(iIdx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rubro.items.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-4">Sin ítems. Agregá del precario o manualmente.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelectorOpen(true)}>
              <Search className="h-3 w-3 mr-1" /> Agregar del Precario
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={addEmptyItem}>
              <Plus className="h-3 w-3 mr-1" /> Ítem manual
            </Button>
          </div>
        </CardContent>
      )}

      {/* Selector de precario */}
      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Seleccionar del Precario Ministerial</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar descripción, código o categoría..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrecario.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-primary/5" onClick={() => addFromPrecario(p)}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.codigo || '-'}</TableCell>
                    <TableCell className="text-sm">{p.descripcion}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{p.categoria}</Badge></TableCell>
                    <TableCell className="text-xs">{p.unidad}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{fmt(p.precio_unitario)}</TableCell>
                  </TableRow>
                ))}
                {filteredPrecario.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">No se encontraron ítems en el precario</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}