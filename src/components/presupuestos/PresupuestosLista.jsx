import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Pencil, Trash2, FileSpreadsheet, Download, Loader2, Plus,
  Calendar, TrendingUp, FilePlus2, FileText, DollarSign, CheckCircle2, Clock,
  MoreVertical, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { generatePresupuestoPDF } from '@/components/presupuestos/presupuestoPDF';
import { exportPresupuestoExcel } from '@/utils/exportExcel';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const ESTADO = {
  borrador:  { label: 'Borrador',  dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-700 border-slate-200' },
  enviado:   { label: 'Enviado',   dot: 'bg-blue-500',    pill: 'bg-blue-50  text-blue-700  border-blue-200'  },
  aprobado:  { label: 'Aprobado',  dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazado: { label: 'Rechazado', dot: 'bg-red-500',     pill: 'bg-red-50   text-red-700   border-red-200'   },
  facturado: { label: 'Facturado', dot: 'bg-purple-500',  pill: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const COMUNA_PILL = {
  '8A':  'bg-sky-50 text-sky-700 border-sky-200',
  '8B':  'bg-teal-50 text-teal-700 border-teal-200',
  '10A': 'bg-violet-50 text-violet-700 border-violet-200',
};

const FILTERS = ['todos', 'borrador', 'enviado', 'aprobado', 'rechazado', 'facturado'];

export default function PresupuestosLista({ presupuestos, isLoading, onEdit, onDelete, onNew }) {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [exporting, setExporting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const handleExportPCP = async (e, p) => {
    e.stopPropagation();
    setExporting(`pcp-${p.id}`);
    try {
      const res = await base44.functions.invoke('exportPresupuestoPCP', { presupuestoId: p.id });
      if (res.data?.file_url) {
        const a = document.createElement('a');
        a.href = res.data.file_url;
        a.download = `PCP_${p.codigo || p.titulo}_MEJORES.xlsx`;
        a.click();
        toast.success('Excel PCP generado');
      } else toast.error(res.data?.error || 'Error al generar Excel PCP');
    } catch (err) { toast.error('Error: ' + err.message); }
    finally { setExporting(null); }
  };

  // Stats
  const aprobados = presupuestos.filter(p => p.estado === 'aprobado');
  const totalAprobado = aprobados.reduce((a, p) => a + (p.total || 0), 0);
  const totalGlobal = presupuestos.reduce((a, p) => a + (p.total || 0), 0);
  const borradores = presupuestos.filter(p => p.estado === 'borrador').length;
  const enviados = presupuestos.filter(p => p.estado === 'enviado').length;

  const filtered = presupuestos.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.titulo?.toLowerCase().includes(q) || p.cliente_nombre?.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) || p.licitacion?.toLowerCase().includes(q)) &&
      (estadoFilter === 'todos' || p.estado === estadoFilter);
  });

  return (
    <div className="space-y-6">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: presupuestos.length, sub: fmt(totalGlobal), icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
          { label: 'Aprobados', value: aprobados.length, sub: fmt(totalAprobado), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
          { label: 'En borrador', value: borradores, sub: 'pendientes de envío', icon: FilePlus2, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
          { label: 'Enviados', value: enviados, sub: 'esperando respuesta', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
        ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
          <div key={label} className={`rounded-xl border ${border} bg-card p-4 flex items-start justify-between gap-3`}>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
            </div>
            <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar presupuesto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setEstadoFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                estadoFilter === f
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {f === 'todos' ? 'Todos' : ESTADO[f]?.label}
              {f !== 'todos' && (
                <span className={`ml-1.5 opacity-70`}>
                  {presupuestos.filter(p => p.estado === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button onClick={onNew} className="gap-2 ml-auto shrink-0">
          <Plus className="h-4 w-4" /> Nuevo Presupuesto
        </Button>
      </div>

      {/* ── Grid / Empty ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <FileText className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-semibold text-base">{presupuestos.length === 0 ? 'Sin presupuestos aún' : 'Sin resultados'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {presupuestos.length === 0 ? 'Creá tu primer presupuesto basado en el preciario ministerial.' : 'Probá con otros filtros.'}
            </p>
          </div>
          {presupuestos.length === 0 && (
            <Button onClick={onNew} className="gap-2 mt-2"><Plus className="h-4 w-4" />Nuevo Presupuesto</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const est = ESTADO[p.estado] || ESTADO.borrador;
            const totalItems = (p.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);
            return (
              <div
                key={p.id}
                onClick={() => onEdit(p)}
                className="group relative rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Status accent bar */}
                <div className={`h-1 w-full ${est.dot.replace('bg-', 'bg-')}`} />

                <div className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {p.titulo || '(Sin título)'}
                      </p>
                      {p.codigo && (
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{p.codigo}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${est.pill} border`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${est.dot} mr-1 inline-block`} />
                        {est.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="space-y-1">
                    {p.cliente_nombre && (
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="text-foreground/60">Cliente:</span> {p.cliente_nombre}
                      </p>
                    )}
                    {p.licitacion && (
                      <p className="text-xs text-muted-foreground font-mono truncate">{p.licitacion}</p>
                    )}
                  </div>

                  {/* Tags row */}
                  <div className="flex flex-wrap gap-1.5">
                    {p.comuna && p.comuna !== 'otro' && (
                      <Badge variant="outline" className={`text-[10px] ${COMUNA_PILL[p.comuna] || ''}`}>
                        Comuna {p.comuna}
                      </Badge>
                    )}
                    {totalItems > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground">
                        {totalItems} ítem{totalItems !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {p.fecha_emision && (
                      <Badge variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {format(new Date(p.fecha_emision + 'T00:00:00'), 'dd MMM yy', { locale: es })}
                      </Badge>
                    )}
                  </div>

                  {/* Total + actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total oferta</p>
                      <p className="text-base font-bold text-primary tabular-nums">{fmt(p.total)}</p>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      {/* Export dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                            <Download className="h-3.5 w-3.5" /> Exportar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-sm">
                          <DropdownMenuItem onClick={() => generatePresupuestoPDF(p)}>
                            <FileText className="h-3.5 w-3.5 mr-2 text-slate-500" /> PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportPresupuestoExcel(p)}>
                            <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-blue-500" /> Excel Ministerio
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleExportPCP(e, p)}
                            disabled={exporting === `pcp-${p.id}`}
                          >
                            {exporting === `pcp-${p.id}`
                              ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              : <TrendingUp className="h-3.5 w-3.5 mr-2 text-emerald-500" />}
                            Excel PCP
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Actions dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(p)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará "{p.titulo}" permanentemente.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDelete(p.id)}>
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Hover arrow */}
                <div className="absolute top-3 right-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pb-2">
          {filtered.length} presupuesto{filtered.length !== 1 ? 's' : ''}{filtered.length !== presupuestos.length && ` de ${presupuestos.length}`}
        </p>
      )}
    </div>
  );
}