import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Package, Pencil, Trash2, AlertTriangle, Sparkles,
  ArrowDownCircle, ArrowUpCircle, History, Plus
} from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import InventoryImporter from '@/components/inventory/InventoryImporter';
import MovimientoDialog from '@/components/inventory/MovimientoDialog';
import MovimientosLog from '@/components/inventory/MovimientosLog';

const categoryLabels = {
  electrico: 'Eléctrico', plomeria: 'Plomería', pintura: 'Pintura', construccion: 'Construcción',
  herreria: 'Herrería', herramientas: 'Herramientas', seguridad: 'Seguridad', climatizacion: 'Climatización', otros: 'Otros',
};
const unitLabels = {
  unidad: 'Unidad', metro: 'Metro', metro2: 'm²', metro3: 'm³', kg: 'Kg', litro: 'Litro', bolsa: 'Bolsa', caja: 'Caja', rollo: 'Rollo',
};

const materialFields = [
  { key: 'name', label: 'Nombre del Material', required: true },
  { key: 'code', label: 'Código', placeholder: 'MAT-001' },
  { key: 'category', label: 'Categoría', type: 'select', options: Object.entries(categoryLabels).map(([value, label]) => ({ value, label })) },
  { key: 'unit', label: 'Unidad', type: 'select', options: Object.entries(unitLabels).map(([value, label]) => ({ value, label })) },
  { key: 'stock', label: 'Stock Actual', type: 'number' },
  { key: 'min_stock', label: 'Stock Mínimo', type: 'number' },
  { key: 'unit_cost', label: 'Costo Unitario ($)', type: 'number' },
  { key: 'supplier', label: 'Proveedor' },
  { key: 'location', label: 'Ubicación en Depósito' },
  { key: 'notes', label: 'Notas', type: 'textarea' },
];

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImporter, setShowImporter] = useState(false);
  const [movimientoDialog, setMovimientoDialog] = useState(null);
  const queryClient = useQueryClient();

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => base44.entities.Material.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Material.update(editing.id, data) : base44.entities.Material.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materials'] }); setDialogOpen(false); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Material.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] })
  });

  const filtered = materials.filter(m => {
    const matchSearch = !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.code?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || m.category === catFilter;
    return matchSearch && matchCat;
  });

  const totalValue = materials.reduce((sum, m) => sum + (m.stock || 0) * (m.unit_cost || 0), 0);
  const lowStockCount = materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventario · Pañol</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {materials.length} materiales · Valor total: <span className="font-semibold">${totalValue.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowImporter(true)}>
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Importar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={() => setMovimientoDialog({ tipo: 'entrada' })}>
            <ArrowDownCircle className="h-3.5 w-3.5" /> Entrada
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50"
            onClick={() => setMovimientoDialog({ tipo: 'salida' })}>
            <ArrowUpCircle className="h-3.5 w-3.5" /> Salida
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Nuevo
          </Button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800 font-medium">{lowStockCount} material(es) con stock bajo o agotado</span>
        </div>
      )}

      <Tabs defaultValue="stock">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="stock" className="gap-1.5"><Package className="h-4 w-4" /> Stock actual</TabsTrigger>
          <TabsTrigger value="movimientos" className="gap-1.5"><History className="h-4 w-4" /> Movimientos</TabsTrigger>
        </TabsList>

        {/* ── Tab: Stock ── */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar materiales..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 && !isLoading ? (
            <EmptyState icon={Package} title="No hay materiales" description="Agregá materiales al inventario" actionLabel="Nuevo Material" onAction={() => { setEditing(null); setDialogOpen(true); }} />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Mín.</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Costo Unit.</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Valor Total</TableHead>
                      <TableHead className="hidden lg:table-cell">Proveedor</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(mat => {
                      const isLow = mat.stock <= mat.min_stock && mat.min_stock > 0;
                      return (
                        <TableRow key={mat.id} className="group">
                          <TableCell>
                            <div>
                              <p className="font-medium">{mat.name}</p>
                              {mat.code && <p className="text-xs text-muted-foreground font-mono">{mat.code}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{categoryLabels[mat.category] || mat.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={isLow ? 'text-red-600 font-semibold' : 'font-medium'}>
                              {mat.stock} {unitLabels[mat.unit] || mat.unit}
                            </span>
                            {isLow && <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right text-muted-foreground">{mat.min_stock || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell text-right">${mat.unit_cost?.toLocaleString() || 0}</TableCell>
                          <TableCell className="hidden lg:table-cell text-right font-medium">${((mat.stock || 0) * (mat.unit_cost || 0)).toLocaleString()}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">{mat.supplier || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                title="Entrada rápida"
                                onClick={() => setMovimientoDialog({ tipo: 'entrada', material: mat })}>
                                <ArrowDownCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 hover:bg-orange-50"
                                title="Salida rápida"
                                onClick={() => setMovimientoDialog({ tipo: 'salida', material: mat })}>
                                <ArrowUpCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(mat); setDialogOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>¿Eliminar material?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(mat.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Movimientos ── */}
        <TabsContent value="movimientos" className="mt-4">
          <MovimientosLog />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EntityFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar Material' : 'Nuevo Material'}
        fields={materialFields}
        initialData={editing || { category: 'construccion', unit: 'unidad', stock: 0, min_stock: 0, unit_cost: 0 }}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />

      {showImporter && (
        <InventoryImporter
          onClose={() => setShowImporter(false)}
          onImported={() => setShowImporter(false)}
        />
      )}

      {movimientoDialog && (
        <MovimientoDialog
          tipo={movimientoDialog.tipo}
          materialPreseleccionado={movimientoDialog.material || null}
          onClose={() => setMovimientoDialog(null)}
        />
      )}
    </div>
  );
}