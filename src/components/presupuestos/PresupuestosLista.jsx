import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Pencil, Trash2, FileSpreadsheet, FileText, Loader2, Plus,
  Calendar, TrendingUp, Download, CheckCircle2, Clock, FilePlus2, MoreVertical } from 'lucide-react';
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

// Paleta Mejores — rojo corporativo del Excel
const RED_MAIN = '#C53030';  // Rojo principal
const RED_DARK = '#9B1C1C';  // Rojo más oscuro para headers
const RED_LIGHT = '#FED7D7'; // Rojo muy claro para fondos
const GRAY_ACCENT = '#4A5568'; // Gris para secundarios

const ESTADO = {
  borrador:  { label: 'Borrador',  bar: '#94a3b8', pill: 'bg-slate-100 text-slate-700 border-slate-200' },
  enviado:   { label: 'Enviado',   bar: '#3b82f6', pill: 'bg-blue-50  text-blue-700  border-blue-200' },
  aprobado:  { label: 'Aprobado',  bar: '#22c55e', pill: 'bg-green-50 text-green-700 border-green-200' },
  rechazado: { label: 'Rechazado', bar: '#ef4444', pill: 'bg-red-50   text-red-700   border-red-200' },
  facturado: { label: 'Facturado', bar: '#a855f7', pill: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const FILTERS = ['todos', 'borrador', 'enviado', 'aprobado', 'rechazado', 'facturado'];

export default function PresupuestosLista({ presupuestos, isLoading, onEdit, onDelete, onNew }) {
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [exporting, setExporting] = useState(null);

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
      } else toast.error(res.data?.error || 'Error');
    } catch (err) { toast.error(err.message); }
    finally { setExporting(null); }
  };

  const aprobados    = presupuestos.filter(p => p.estado === 'aprobado');
  const totalAprobado = aprobados.reduce((a, p) => a + (p.total || 0), 0);
  const borradores   = presupuestos.filter(p => p.estado === 'borrador').length;
  const enviados     = presupuestos.filter(p => p.estado === 'enviado').length;

  const filtered = presupuestos.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.titulo?.toLowerCase().includes(q) || p.cliente_nombre?.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) || p.licitacion?.toLowerCase().includes(q)) &&
      (estadoFilter === 'todos' || p.estado === estadoFilter);
  });

  return (
    <div className="space-y-5">

      {/* ── KPI bar (réplica header del Excel rojo) ────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-0 rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: RED_DARK }}>
        {[
          { label: 'TOTAL',     value: presupuestos.length, sub: fmt(presupuestos.reduce((a,p)=>a+(p.total||0),0)), icon: FileText },
          { label: 'APROBADOS', value: aprobados.length,   sub: fmt(totalAprobado),   icon: CheckCircle2 },
          { label: 'BORRADOR',  value: borradores,         sub: 'pendientes de envío', icon: FilePlus2 },
          { label: 'ENVIADOS',  value: enviados,           sub: 'esperando respuesta', icon: Clock },
        ].map(({ label, value, sub, icon: Icon }, i) => (
          <div key={label} className={`flex items-center gap-3 px-4 py-3 ${i < 3 ? 'border-r' : ''}`}
            style={{ background: i === 0 ? RED_DARK : i === 1 ? RED_MAIN : '#FFFFFF', borderColor: RED_DARK }}>
            <Icon className="h-5 w-5 shrink-0" style={{ color: i < 2 ? 'white' : RED_MAIN }} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: i < 2 ? '#FFE4E4' : '#6B7280' }}>{label}</p>
              <p className="text-xl font-bold tabular-nums leading-none mt-0.5" style={{ color: i < 2 ? '#FFFFFF' : RED_DARK }}>{value}</p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: i < 2 ? '#FFE4E4' : '#9CA3AF' }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Buscar presupuesto..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 border-[#E5E7EB] focus-visible:ring-[#C53030]" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setEstadoFilter(f)}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-all border"
              style={estadoFilter === f
                ? { background: RED_DARK, color: '#fff', borderColor: RED_DARK }
                : { background: '#F8FAFC', color: '#475569', borderColor: '#CBD5E1' }}>
              {f === 'todos' ? 'Todos' : ESTADO[f]?.label}
              {f !== 'todos' && <span className="ml-1.5 opacity-60">{presupuestos.filter(p => p.estado === f).length}</span>}
            </button>
          ))}
        </div>
        <Button onClick={onNew} className="gap-2 ml-auto shrink-0 text-white"
          style={{ background: RED_DARK, borderColor: RED_DARK }}>
          <Plus className="h-4 w-4" /> Nuevo Presupuesto
        </Button>
      </div>

      {/* ── Lista ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: BLUE_H }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-20 gap-3" style={{ borderColor: RED_LIGHT }}>
          <div className="h-14 w-14 rounded-xl flex items-center justify-center" style={{ background: RED_LIGHT }}>
            <FileText className="h-7 w-7" style={{ color: RED_MAIN }} />
          </div>
          <p className="font-bold text-base" style={{ color: RED_DARK }}>{presupuestos.length === 0 ? 'Sin presupuestos aún' : 'Sin resultados'}</p>
          <p className="text-sm text-gray-400">{presupuestos.length === 0 ? 'Creá tu primer presupuesto basado en el preciario ministerial.' : 'Probá con otros filtros.'}</p>
          {presupuestos.length === 0 && (
            <Button onClick={onNew} className="gap-2 mt-1 text-white" style={{ background: RED_DARK }}>
              <Plus className="h-4 w-4" /> Nuevo Presupuesto
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: RED_DARK }}>
          {/* Table header — replica Excel encabezado */}
          <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: RED_DARK, color: '#FFE4E4' }}>
            <div className="col-span-4">Obra / Presupuesto</div>
            <div className="col-span-2">Cliente / Licitación</div>
            <div className="col-span-1 text-center">Plazo</div>
            <div className="col-span-1 text-center">Coef.</div>
            <div className="col-span-1 text-center">Estado</div>
            <div className="col-span-2 text-right">Total</div>
            <div className="col-span-1"></div>
          </div>

          {/* Rows */}
          {filtered.map((p, idx) => {
            const est = ESTADO[p.estado] || ESTADO.borrador;
            const totalItems = (p.rubros || []).reduce((a, r) => a + (r.items || []).length, 0);
            const isAlt = idx % 2 === 1;
            return (
              <div key={p.id}
                onClick={() => onEdit(p)}
                className="grid grid-cols-12 px-4 py-3 border-b cursor-pointer transition-colors group"
                style={{ background: isAlt ? RED_LIGHT : '#FFFFFF', borderColor: '#E2E8F0' }}>

                {/* Acento de estado */}
                <div className="absolute left-0 top-0 h-full w-1 rounded-r" style={{ background: est.bar }} />

                {/* Obra / código */}
                <div className="col-span-4 min-w-0">
                  <p className="font-semibold text-sm truncate leading-snug group-hover:text-red-600 transition-colors"
                    style={{ color: RED_DARK }}>{p.titulo || '(Sin título)'}</p>
                  {p.codigo && <p className="text-[10px] font-mono mt-0.5" style={{ color: '#94A3B8' }}>{p.codigo}</p>}
                  {totalItems > 0 && <p className="text-[10px] mt-0.5" style={{ color: RED_DARK }}>{totalItems} ítems · {(p.rubros||[]).length} rubros</p>}
                </div>

                {/* Cliente */}
                <div className="col-span-2 min-w-0 self-center">
                  {p.cliente_nombre && <p className="text-xs truncate" style={{ color: '#475569' }}>{p.cliente_nombre}</p>}
                  {p.licitacion && <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: '#94A3B8' }}>{p.licitacion}</p>}
                  {p.fecha_emision && (
                    <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: '#94A3B8' }}>
                      <Calendar className="h-2.5 w-2.5" />
                      {format(new Date(p.fecha_emision + 'T00:00:00'), 'dd/MM/yy', { locale: es })}
                    </p>
                  )}
                </div>

                {/* Plazo */}
                <div className="col-span-1 self-center text-center">
                  <span className="text-xs font-mono" style={{ color: GRAY_ACCENT }}>{p.plazo ? `${p.plazo}d` : '—'}</span>
                </div>

                {/* Coef */}
                <div className="col-span-1 self-center text-center">
                  <span className="text-[10px] font-mono" style={{ color: RED_MAIN }}>{p.coef_pase || '—'}</span>
                </div>

                {/* Estado */}
                <div className="col-span-1 self-center text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${est.pill}`}>
                    <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: est.bar }} />
                    {est.label}
                  </span>
                </div>

                {/* Total */}
                <div className="col-span-2 self-center text-right">
                  <span className="text-sm font-bold tabular-nums" style={{ color: RED_DARK }}>{fmt(p.total)}</span>
                  {p.comuna && p.comuna !== 'otro' && (
                    <p className="text-[10px] font-semibold mt-0.5" style={{ color: RED_MAIN }}>Comuna {p.comuna}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-1 self-center flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Download className="h-3.5 w-3.5" style={{ color: RED_MAIN }} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => generatePresupuestoPDF(p)}>
                        <FileText className="h-3.5 w-3.5 mr-2 text-slate-500" /> PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPresupuestoExcel(p)}>
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-blue-500" /> Excel Ministerio
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleExportPCP(e, p)} disabled={exporting === `pcp-${p.id}`}>
                        {exporting === `pcp-${p.id}` ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5 mr-2 text-emerald-500" />}
                        Excel PCP
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-3.5 w-3.5 text-gray-400" />
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
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDelete(p.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-center pb-2" style={{ color: '#94A3B8' }}>
          {filtered.length} presupuesto{filtered.length !== 1 ? 's' : ''}{filtered.length !== presupuestos.length && ` de ${presupuestos.length}`}
        </p>
      )}
    </div>
  );
}