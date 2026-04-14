import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, ChevronDown, ChevronRight, Search, X, BookOpen, GripVertical, Calculator } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n, d = 2) => n ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(n) : '—';

function calcItem(item, cp, co) {
  const pu_mat  = Number(item.pu_mat)  || 0;
  const pu_mo   = Number(item.pu_mo)   || 0;
  const pu_tot  = pu_mat + pu_mo;
  const t_pase  = pu_tot * cp;
  const p_res   = t_pase * co;
  const subtotal = p_res * (Number(item.cantidad) || 0);
  return { pu_tot, t_pase, p_res, subtotal };
}

export default function RubroSection({ rubro, idx, precario, coefPase, coefOferta, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const cp = coefPase  ?? 1.6504;
  const co = coefOferta ?? 1.38;

  const rubroSubtotal = (rubro.items || []).reduce((a, i) => a + calcItem(i, cp, co).subtotal, 0);

  const addFromPrecario = (p) => {
    // Usar precios BASE del preciario (sin coefs), los coefs se aplican al renderizar/exportar
    const pu_mat = Number(p.pu_mat) || 0;
    const pu_mo  = Number(p.pu_mo)  || 0;
    const p_res  = (pu_mat + pu_mo) * cp * co;
    const item = {
      precario_id: p.id,
      codigo: p.codigo || '',
      descripcion: p.descripcion,
      unidad: p.unidad,
      cantidad: 1,
      pu_mat,
      pu_mo,
      precio_unitario: p_res,   // precio resultante = base × cp × co
      total: p_res * 1,         // subtotal (cantidad=1)
    };
    onChange({ ...rubro, items: [...(rubro.items || []), item] });
  };

  const addEmptyItem = () => {
    onChange({ ...rubro, items: [...(rubro.items || []), { codigo: '', descripcion: '', unidad: 'UN', cantidad: 1, pu_mat: 0, pu_mo: 0, precio_unitario: 0 }] });
  };

  const updateItem = (iIdx, key, value) => {
    const items = [...(rubro.items || [])];
    items[iIdx] = { ...items[iIdx], [key]: value };
    // Recalculate derived fields
    const pu_mat = Number(items[iIdx].pu_mat) || 0;
    const pu_mo  = Number(items[iIdx].pu_mo)  || 0;
    const t_pase  = (pu_mat + pu_mo) * cp;
    const p_res   = t_pase * co;
    const cantidad = Number(items[iIdx].cantidad) || 0;
    items[iIdx].precio_unitario = p_res;           // precio resultante unitario
    items[iIdx].total = p_res * cantidad;           // subtotal usado por PDF/Excel
    onChange({ ...rubro, items });
  };

  const removeItem = (iIdx) => onChange({ ...rubro, items: (rubro.items || []).filter((_, i) => i !== iIdx) });

  const categorias = [...new Set(precario.map(p => p.categoria).filter(Boolean))].sort();
  const filteredPrecario = precario.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.descripcion?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.subcategoria?.toLowerCase().includes(q))
      && (!categoriaFilter || p.categoria === categoriaFilter);
  }).slice(0, 200);

  return (
    <>
      <div className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-all ${expanded ? 'border-border' : 'border-border/50'}`}>
        {/* ── Rubro Header ── */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold shrink-0">
            {idx + 1}
          </div>
          <Input
            value={rubro.nombre || ''}
            onChange={e => { e.stopPropagation(); onChange({ ...rubro, nombre: e.target.value }); }}
            onClick={e => e.stopPropagation()}
            placeholder="Nombre del rubro..."
            className="font-semibold h-8 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 flex-1 cursor-text"
          />
          <div className="flex items-center gap-2 ml-auto shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-bold text-primary">{fmt(rubroSubtotal)}</span>
            <Badge variant="outline" className="text-[10px] hidden sm:flex bg-muted/50">
              {(rubro.items || []).length} ítems
            </Badge>
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button
              onClick={onDelete}
              className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Items Table ── */}
        {expanded && (
          <div className="border-t">
            {/* Table header */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b">
                    <th className="text-left px-2 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-20">Código</th>
                    <th className="text-left px-2 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Descripción</th>
                    <th className="text-center px-2 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-14">UM</th>
                    <th className="text-right px-2 py-2 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] w-18">Cant.</th>
                    <th className="text-right px-2 py-2 font-semibold text-[10px] text-blue-600 w-22">PU MAT.</th>
                    <th className="text-right px-2 py-2 font-semibold text-[10px] text-blue-600 w-22">PU M.O.</th>
                    <th className="text-right px-2 py-2 font-semibold text-[10px] text-indigo-600 w-22">c/ Pase</th>
                    <th className="text-right px-2 py-2 font-semibold text-[10px] text-violet-600 w-24">P. Result.</th>
                    <th className="text-right px-2 py-2 font-semibold text-[10px] text-emerald-700 w-28">SUBTOTAL</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {(rubro.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground text-sm">
                        <BookOpen className="h-7 w-7 mx-auto mb-2 opacity-20" />
                        <p>Sin ítems. Agregá del preciario o ingresá manualmente.</p>
                      </td>
                    </tr>
                  ) : (rubro.items || []).map((item, iIdx) => {
                    const { pu_tot, t_pase, p_res, subtotal } = calcItem(item, cp, co);
                    return (
                      <tr key={iIdx} className="group/row border-b hover:bg-primary/[0.02] transition-colors">
                        <td className="px-1 py-1">
                          <Input
                            value={item.codigo || ''}
                            onChange={e => updateItem(iIdx, 'codigo', e.target.value)}
                            className="h-7 text-xs font-mono border-transparent bg-transparent px-1.5 focus-visible:border-input focus-visible:bg-background w-full"
                            placeholder="COD"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={item.descripcion || ''}
                            onChange={e => updateItem(iIdx, 'descripcion', e.target.value)}
                            className="h-7 text-xs border-transparent bg-transparent px-1.5 focus-visible:border-input focus-visible:bg-background min-w-[220px]"
                            placeholder="Descripción del ítem..."
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            value={item.unidad || ''}
                            onChange={e => updateItem(iIdx, 'unidad', e.target.value)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 text-center focus-visible:border-input focus-visible:bg-background w-14"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            value={item.cantidad ?? ''}
                            onChange={e => updateItem(iIdx, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 text-right focus-visible:border-input focus-visible:bg-background w-18"
                          />
                        </td>
                        {/* PU MAT */}
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            value={item.pu_mat ?? ''}
                            onChange={e => updateItem(iIdx, 'pu_mat', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 text-right focus-visible:border-input focus-visible:bg-background w-22 text-blue-700"
                          />
                        </td>
                        {/* PU MO */}
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            value={item.pu_mo ?? ''}
                            onChange={e => updateItem(iIdx, 'pu_mo', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent bg-transparent px-1 text-right focus-visible:border-input focus-visible:bg-background w-22 text-blue-700"
                          />
                        </td>
                        {/* Total c/ Pase (calculado) */}
                        <td className="px-2 py-1 text-right text-indigo-600 font-medium whitespace-nowrap tabular-nums">
                          {fmtN(t_pase)}
                        </td>
                        {/* Precio resultante (calculado, highlight) */}
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <span className="bg-yellow-50 text-violet-700 font-semibold px-1.5 py-0.5 rounded tabular-nums text-xs">
                            {fmtN(p_res)}
                          </span>
                        </td>
                        {/* Subtotal */}
                        <td className="px-2 py-1 text-right font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                          {fmt(subtotal)}
                        </td>
                        <td className="px-1 py-1">
                          <button
                            onClick={() => removeItem(iIdx)}
                            className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive p-1 rounded"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {(rubro.items || []).length > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50/60 border-t-2 border-emerald-200">
                      <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        Subtotal {rubro.nombre}
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold text-emerald-700 tabular-nums text-sm">
                        {fmt(rubroSubtotal)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 px-3 py-2.5 bg-muted/20 border-t">
              <Button
                size="sm" variant="outline"
                className="text-xs h-7 gap-1.5 border-primary/30 text-primary hover:bg-primary/5 font-medium"
                onClick={() => setSelectorOpen(true)}
                disabled={precario.length === 0}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {precario.length === 0 ? 'Sin preciario' : 'Del Preciario'}
              </Button>
              <Button
                size="sm" variant="ghost"
                className="text-xs h-7 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={addEmptyItem}
              >
                <Plus className="h-3.5 w-3.5" /> Ítem manual
              </Button>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Calculator className="h-3 w-3" />
                <span>× {coefPase} × {coefOferta}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Selector de Preciario ── */}
      <Dialog
        open={selectorOpen}
        onOpenChange={(o) => { setSelectorOpen(o); if (!o) { setSearch(''); setCategoriaFilter(''); } }}
      >
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b bg-muted/20 shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Preciario Ministerial
              <Badge variant="outline" className="text-xs ml-1">{precario.length} ítems</Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Filters */}
          <div className="px-5 py-3 border-b space-y-2.5 shrink-0 bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por descripción, código o subcategoría..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {categorias.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setCategoriaFilter('')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${!categoriaFilter ? 'bg-primary text-white border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
                >
                  Todas
                </button>
                {categorias.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategoriaFilter(c === categoriaFilter ? '' : c)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${categoriaFilter === c ? 'bg-primary text-white border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Precario table */}
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">Código</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descripción</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Subcategoría</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-14">UM</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-blue-600 uppercase tracking-wide w-28">c/ Pase</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-violet-600 uppercase tracking-wide w-28">Total Oferta</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrecario.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => addFromPrecario(p)}
                    className={`cursor-pointer hover:bg-primary/5 border-b transition-colors group/prec ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.codigo || '—'}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-sm leading-snug group-hover/prec:text-primary transition-colors">{p.descripcion}</p>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {p.subcategoria && <span className="text-xs text-muted-foreground">{p.subcategoria}</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">{p.unidad}</td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-blue-700 tabular-nums">{fmt(p.total_coef_pase)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded tabular-nums">{fmt(p.total_coef_oferta)}</span>
                    </td>
                  </tr>
                ))}
                {filteredPrecario.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-14 text-sm">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      {precario.length === 0 ? 'No hay preciario cargado para esta comuna.' : 'Sin resultados.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filteredPrecario.length === 200 && (
              <p className="text-center text-xs text-muted-foreground py-3 bg-muted/20">Mostrando primeros 200 resultados — refiná la búsqueda.</p>
            )}
          </div>

          <div className="px-5 py-3 border-t bg-muted/10 flex items-center justify-between shrink-0">
            <p className="text-xs text-muted-foreground">Hacé click en un ítem para agregarlo al rubro</p>
            <Button size="sm" variant="outline" onClick={() => setSelectorOpen(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}