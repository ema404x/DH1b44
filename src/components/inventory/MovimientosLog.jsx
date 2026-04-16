import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Search, Package, FolderKanban, User, FileText, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const unitLabels = {
  unidad: 'UN', metro: 'ML', metro2: 'm²', metro3: 'm³',
  kg: 'Kg', litro: 'Lt', bolsa: 'Bolsa', caja: 'Caja', rollo: 'Rollo',
};

const MOTIVO_LABELS = {
  compra: 'Compra',
  devolucion: 'Devolución',
  ajuste_entrada: 'Ajuste +',
  asignacion_proyecto: 'Asig. proyecto',
  consumo: 'Consumo',
  perdida: 'Pérdida',
  ajuste_salida: 'Ajuste -',
};

const MOTIVO_COLORS = {
  compra: 'bg-emerald-100 text-emerald-700',
  devolucion: 'bg-blue-100 text-blue-700',
  ajuste_entrada: 'bg-teal-100 text-teal-700',
  asignacion_proyecto: 'bg-orange-100 text-orange-700',
  consumo: 'bg-amber-100 text-amber-700',
  perdida: 'bg-red-100 text-red-700',
  ajuste_salida: 'bg-rose-100 text-rose-700',
};

export default function MovimientosLog() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');

  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ['movimientos-panol'],
    queryFn: () => base44.entities.MovimientoPanol.list('-created_date', 200),
  });

  const filtered = movimientos.filter(m => {
    const matchTipo = tipoFilter === 'all' || m.tipo === tipoFilter;
    const matchSearch = !search ||
      m.material_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      m.proyecto_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      m.responsable?.toLowerCase().includes(search.toLowerCase()) ||
      m.remito?.toLowerCase().includes(search.toLowerCase());
    return matchTipo && matchSearch;
  });

  // Stats
  const totalEntradas = movimientos.filter(m => m.tipo === 'entrada').reduce((s, m) => s + (m.cantidad || 0), 0);
  const totalSalidas = movimientos.filter(m => m.tipo === 'salida').reduce((s, m) => s + (m.cantidad || 0), 0);
  const hoy = new Date().toDateString();
  const movHoy = movimientos.filter(m => new Date(m.created_date).toDateString() === hoy).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total entradas</p>
            <p className="text-lg font-bold">{movimientos.filter(m => m.tipo === 'entrada').length}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <ArrowUpCircle className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total salidas</p>
            <p className="text-lg font-bold">{movimientos.filter(m => m.tipo === 'salida').length}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Mov. hoy</p>
            <p className="text-lg font-bold">{movHoy}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por material, proyecto, responsable..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="entrada">Solo Entradas</SelectItem>
            <SelectItem value="salida">Solo Salidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando movimientos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay movimientos registrados</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y">
            {filtered.map(mov => (
              <div key={mov.id} className="flex items-start gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                {/* Icon */}
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${mov.tipo === 'entrada' ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                  {mov.tipo === 'entrada'
                    ? <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                    : <ArrowUpCircle className="h-5 w-5 text-orange-500" />
                  }
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{mov.material_nombre}</span>
                    {mov.material_codigo && <span className="text-xs font-mono text-muted-foreground">{mov.material_codigo}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${MOTIVO_COLORS[mov.motivo] || 'bg-muted text-muted-foreground'}`}>
                      {MOTIVO_LABELS[mov.motivo] || mov.motivo}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                    {mov.proyecto_nombre && (
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" /> {mov.proyecto_nombre}
                      </span>
                    )}
                    {mov.responsable && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {mov.responsable}
                      </span>
                    )}
                    {mov.remito && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {mov.remito}
                      </span>
                    )}
                    {mov.created_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(mov.created_date), "d MMM yyyy HH:mm", { locale: es })}
                      </span>
                    )}
                  </div>
                  {/* Stock trace */}
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <span className="text-muted-foreground">Stock:</span>
                    <span className="font-medium">{mov.stock_anterior}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={`font-bold ${mov.tipo === 'entrada' ? 'text-emerald-600' : 'text-orange-600'}`}>{mov.stock_nuevo}</span>
                    <span className="text-muted-foreground">{unitLabels[mov.material_unidad] || ''}</span>
                  </div>
                </div>

                {/* Quantity */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-bold ${mov.tipo === 'entrada' ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {mov.tipo === 'entrada' ? '+' : '-'}{mov.cantidad}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{unitLabels[mov.material_unidad] || ''}</p>
                  {mov.costo_unitario > 0 && (
                    <p className="text-[10px] text-muted-foreground">${(mov.cantidad * mov.costo_unitario).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}