import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Package, Pencil, Trash2, AlertTriangle, Sparkles,
  ArrowDownCircle, ArrowUpCircle, History, Plus, Zap, TrendingUp, Layers, ShoppingCart
} from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';
import EntityFormDialog from '@/components/shared/EntityFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import InventoryImporter from '@/components/inventory/InventoryImporter';
import MovimientoDialog from '@/components/inventory/MovimientoDialog';
import MovimientosLog from '@/components/inventory/MovimientosLog';
import RequerimientosList from '@/components/inventory/RequerimientosList';
import { useEffect } from 'react';

const categoryLabels = {
  electrico: 'Eléctrico', plomeria: 'Plomería', pintura: 'Pintura', construccion: 'Construcción',
  herreria: 'Herrería', herramientas: 'Herramientas', seguridad: 'Seguridad', climatizacion: 'Climatización', otros: 'Otros',
};
const unitLabels = {
  unidad: 'Unidad', metro: 'Metro', metro2: 'm²', metro3: 'm³', kg: 'Kg', litro: 'Litro', bolsa: 'Bolsa', caja: 'Caja',
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
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => base44.entities.Material.list('-created_date'),
  });

  const stats = useMemo(() => ({
    total: materials.length,
    totalValue: materials.reduce((sum, m) => sum + (m.stock || 0) * (m.unit_cost || 0), 0),
    lowStock: materials.filter(m => m.stock <= m.min_stock && m.min_stock > 0).length,
  }), [materials]);

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

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 space-y-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Package className="h-6 w-6 text-white" />
              </div>
              Inventario · Pañol
            </h1>
            <p className="text-slate-400 mt-1">{stats.total} materiales • ${stats.totalValue.toLocaleString()}</p>
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg shadow-emerald-500/50 transition-all">
            <Plus className="h-4 w-4" /> Nuevo Material
          </Button>
        </div>

        {/* Stats */}
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Layers, color: 'from-blue-500' },
            { label: 'Stock Bajo', value: stats.lowStock, icon: AlertTriangle, color: 'from-red-500', highlight: stats.lowStock > 0 },
          ].map((stat, i) => (
            <motion.div key={i} variants={item}>
              <div className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur border rounded-lg p-4 transition-all ${
                stat.highlight ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 uppercase">{stat.label}</p>
                  <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${stat.color} to-transparent flex items-center justify-center`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Alert */}
      {stats.lowStock > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 rounded-lg bg-red-500/20 border border-red-500/30 backdrop-blur">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 font-medium">{stats.lowStock} material{stats.lowStock > 1 ? 'es' : ''} con stock bajo</span>
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Tabs defaultValue="stock" className="w-full">
          <TabsList className="grid w-full sm:w-auto grid-cols-3 bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger value="stock" className="gap-1.5"><Package className="h-4 w-4" /> Stock</TabsTrigger>
            <TabsTrigger value="movimientos" className="gap-1.5"><History className="h-4 w-4" /> Movimientos</TabsTrigger>
            <TabsTrigger value="requerimientos" className="gap-1.5"><ShoppingCart className="h-4 w-4" /> Requerimientos</TabsTrigger>
          </TabsList>

          {/* Stock Tab */}
          <TabsContent value="stock" className="space-y-4 mt-4">
            <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col sm:flex-row gap-3">
              <motion.div variants={item} className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Buscar materiales..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500"
                />
              </motion.div>
              <motion.div variants={item}>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="w-full sm:w-44 bg-slate-800/50 border-slate-700/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
              <motion.div variants={item}>
                <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setShowImporter(true)}>
                  <Sparkles className="h-3.5 w-3.5" /> Importar
                </Button>
              </motion.div>
            </motion.div>

            {filtered.length === 0 && !isLoading ? (
              <EmptyState icon={Package} title="No hay materiales" description="Agregá materiales al inventario" actionLabel="Nuevo Material" onAction={() => { setEditing(null); setDialogOpen(true); }} />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show">
                <Card className="border-0 bg-slate-800/50 backdrop-blur overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700/50">
                          <TableHead className="text-slate-300">Material</TableHead>
                          <TableHead className="text-slate-300">Categoría</TableHead>
                          <TableHead className="text-right text-slate-300">Stock</TableHead>
                          <TableHead className="text-right text-slate-300">Costo Unit.</TableHead>
                          <TableHead className="text-right text-slate-300">Total</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((mat, idx) => {
                          const isLow = mat.stock <= mat.min_stock && mat.min_stock > 0;
                          return (
                            <motion.tr key={mat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className={`border-slate-700/50 group hover:bg-slate-700/20 transition-colors ${isLow ? 'bg-red-500/5' : ''}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-white">{mat.name}</p>
                                  {mat.code && <p className="text-xs text-slate-500 font-mono">{mat.code}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-200">{categoryLabels[mat.category]}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={isLow ? 'text-red-400 font-semibold' : 'text-white font-medium'}>
                                  {mat.stock} {unitLabels[mat.unit]}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-slate-400">${mat.unit_cost?.toLocaleString() || 0}</TableCell>
                              <TableCell className="text-right text-white font-medium">${((mat.stock || 0) * (mat.unit_cost || 0)).toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400 hover:bg-emerald-500/10" onClick={() => setMovimientoDialog({ tipo: 'entrada', material: mat })}>
                                    <ArrowDownCircle className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-400 hover:bg-orange-500/10" onClick={() => setMovimientoDialog({ tipo: 'salida', material: mat })}>
                                    <ArrowUpCircle className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => { setEditing(mat); setDialogOpen(true); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar material?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteMutation.mutate(mat.id)}>Eliminar</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* Movimientos Tab */}
          <TabsContent value="movimientos" className="mt-4">
            <MovimientosLog />
          </TabsContent>

          {/* Requerimientos Tab */}
          <TabsContent value="requerimientos" className="mt-4">
            <RequerimientosList user={currentUser} />
          </TabsContent>
        </Tabs>
      </motion.div>

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