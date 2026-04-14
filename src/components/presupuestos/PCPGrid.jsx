import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, ChevronDown, ChevronRight, Search, X, BookOpen } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n, d = 2) => n ? new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n) : '—';

const ORDEN_TAREAS = [
  'DEMOLICIONES', 'MOVIMIENTO DE SUELOS', 'ESTRUCTURAS', 'ALBAÑILERÍA',
  'CONSTRUCCIÓN EN SECO Y TABIQUERÍA', 'CARPINTERÍAS', 'HERRERÍA', 'REVOQUES',
  'REVESTIMIENTOS', 'CIELORRASOS', 'AISLACIONES', 'CUBIERTA', 'PINTURA',
  'INSTALACIÓN ELÉCTRICA', 'INSTALACIÓN SANITARIA', 'INSTALACIÓN GAS',
  'INSTALACIÓN TÉRMICA', 'INSTALACIÓN ELECTROMECÁNICA',
];

function calcItem(item, cp, co) {
  const pu_mat  = Number(item.pu_mat)  || 0;
  const pu_mo   = Number(item.pu_mo)   || 0;
  const pu_tot  = pu_mat + pu_mo;
  const t_pase  = pu_tot * cp;
  const p_res   = t_pase * co;
  const subtotal = p_res * (Number(item.cantidad) || 0);
  return { pu_mat, pu_mo, pu_tot, t_pase, p_res, subtotal };
}

// ── Selector de Preciario ──────────────────────────────────────────────────
function PrecarioSelector({ open, onClose, precario, cp, co, onSelect }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');

  const categorias = [...new Set(precario.map(p => p.categoria).filter(Boolean))].sort();
  const filtered = precario.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.descripcion?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q))
      && (!cat || p.categoria === cat);
  }).slice(0, 300);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b bg-gray-50 shrink-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-red-600" />
            Preciario Ministerial — {precario.length} ítems
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 py-3 border-b space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Buscar por descripción o código..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" autoFocus />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="h-3.5 w-3.5" /></button>}
          </div>
          {categorias.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setCat('')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${!cat ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-500 hover:border-red-300'}`}>
                Todas
              </button>
              {categorias.map(c => (
                <button key={c} onClick={() => setCat(c === cat ? '' : c)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${cat === c ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 text-gray-500 hover:border-red-300'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-900">
              <tr>
                <th className="text-left px-3 py-2.5 text-gray-300 font-semibold uppercase tracking-wide w-24">Código</th>
                <th className="text-left px-3 py-2.5 text-gray-300 font-semibold uppercase tracking-wide">Descripción</th>
                <th className="text-center px-3 py-2.5 text-gray-300 font-semibold uppercase tracking-wide w-14">UM</th>
                <th className="text-right px-3 py-2.5 text-gray-300 font-semibold uppercase tracking-wide w-24">PU MAT</th>
                <th className="text-right px-3 py-2.5 text-gray-300 font-semibold uppercase tracking-wide w-24">PU MO</th>
                <th className="text-right px-3 py-2.5 text-red-300 font-semibold uppercase tracking-wide w-28">P. Resultante</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const pRes = ((Number(p.pu_mat) || 0) + (Number(p.pu_mo) || 0)) * cp * co;
                return (
                  <tr key={p.id} onClick={() => { onSelect(p); }}
                    className={`cursor-pointer hover:bg-red-50 border-b border-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-3 py-2 font-mono text-gray-500">{p.codigo || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 leading-snug">{p.descripcion}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{p.unidad}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtN(Number(p.pu_mat) || 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{fmtN(Number(p.pu_mo) || 0)}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-700 tabular-nums">{fmtN(pRes)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center shrink-0">
          <p className="text-xs text-gray-400">Click para agregar al rubro</p>
          <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs">Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Rubro Row ─────────────────────────────────────────────────────────────
function RubroBlock({ rubro, idx, globalStart, precario, cp, co, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const rubroTotal = (rubro.items || []).reduce((a, item) => a + calcItem(item, cp, co).subtotal, 0);

  const addFromPrecario = (p) => {
    const pu_mat = Number(p.pu_mat) || 0;
    const pu_mo  = Number(p.pu_mo)  || 0;
    const p_res  = (pu_mat + pu_mo) * cp * co;
    onChange({ ...rubro, items: [...(rubro.items || []), {
      precario_id: p.id, codigo: p.codigo || '', descripcion: p.descripcion,
      unidad: p.unidad, cantidad: 1, pu_mat, pu_mo,
      precio_unitario: p_res, total: p_res,
    }]});
    setSelectorOpen(false);
  };

  const addEmpty = () => onChange({ ...rubro, items: [...(rubro.items || []),
    { codigo: '', descripcion: '', unidad: 'UN', cantidad: 1, pu_mat: 0, pu_mo: 0, precio_unitario: 0 }
  ]});

  const updateItem = (iIdx, key, value) => {
    const items = [...(rubro.items || [])];
    items[iIdx] = { ...items[iIdx], [key]: value };
    const pu_mat = Number(items[iIdx].pu_mat) || 0;
    const pu_mo  = Number(items[iIdx].pu_mo)  || 0;
    const p_res  = (pu_mat + pu_mo) * cp * co;
    items[iIdx].precio_unitario = p_res;
    items[iIdx].total = p_res * (Number(items[iIdx].cantidad) || 0);
    onChange({ ...rubro, items });
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Rubro header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors select-none border-b border-gray-200"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-center h-5 w-5 rounded bg-red-600 text-white text-[10px] font-bold shrink-0">
            {idx + 1}
          </div>
          <Input
            value={rubro.nombre || ''}
            onChange={e => { e.stopPropagation(); onChange({ ...rubro, nombre: e.target.value }); }}
            onClick={e => e.stopPropagation()}
            placeholder="Nombre del rubro..."
            className="h-7 text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 flex-1"
          />
          <div className="flex items-center gap-3 ml-auto shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-bold text-red-700 tabular-nums">{fmt(rubroTotal)}</span>
            <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 bg-white">
              {(rubro.items || []).length} ítems
            </span>
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
            <button onClick={onDelete} className="text-gray-300 hover:text-red-600 transition-colors p-0.5 rounded">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Items table */}
        {expanded && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="text-center px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-8 border-r border-gray-700">#</th>
                    <th className="text-left px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-20 border-r border-gray-700">Código</th>
                    <th className="text-left px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] border-r border-gray-700">Descripción</th>
                    <th className="text-center px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-14 border-r border-gray-700">UM</th>
                    <th className="text-right px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-16 border-r border-gray-700">Cant.</th>
                    <th className="text-right px-2 py-2 text-blue-400 font-semibold uppercase tracking-wide text-[10px] w-24 border-r border-gray-700">PU MAT</th>
                    <th className="text-right px-2 py-2 text-blue-400 font-semibold uppercase tracking-wide text-[10px] w-24 border-r border-gray-700">PU MO</th>
                    <th className="text-right px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-24 border-r border-gray-700">Total PU</th>
                    <th className="text-right px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-20 border-r border-gray-700">Coef. Pase</th>
                    <th className="text-right px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-24 border-r border-gray-700">Tot. Pase</th>
                    <th className="text-right px-2 py-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-20 border-r border-gray-700">Coef. Of.</th>
                    <th className="text-right px-2 py-2 text-red-400 font-semibold uppercase tracking-wide text-[10px] w-28 border-r border-gray-700">P. Result.</th>
                    <th className="text-right px-2 py-2 text-red-300 font-semibold uppercase tracking-wide text-[10px] w-28 border-r border-gray-700">SUBTOTAL</th>
                    <th className="w-8 border-r border-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {(rubro.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-10 text-center text-gray-400 text-sm bg-white">
                        <BookOpen className="h-7 w-7 mx-auto mb-2 opacity-20" />
                        <p>Sin ítems. Agregá del preciario o ingresá manualmente.</p>
                      </td>
                    </tr>
                  ) : (rubro.items || []).map((item, iIdx) => {
                    const { pu_mat, pu_mo, pu_tot, t_pase, p_res, subtotal } = calcItem(item, cp, co);
                    const globalIdx = globalStart + iIdx + 1;
                    return (
                      <tr key={iIdx} className={`group/row border-b border-gray-100 hover:bg-red-50/30 transition-colors ${iIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-2 py-1 text-center text-gray-400 font-mono text-[10px] border-r border-gray-100">{globalIdx}</td>
                        <td className="px-1 py-1 border-r border-gray-100">
                          <Input value={item.codigo || ''} onChange={e => updateItem(iIdx, 'codigo', e.target.value)}
                            className="h-7 text-xs font-mono border-0 bg-transparent px-1.5 focus-visible:border-input focus-visible:bg-white w-full" placeholder="COD" />
                        </td>
                        <td className="px-1 py-1 border-r border-gray-100">
                          <Input value={item.descripcion || ''} onChange={e => updateItem(iIdx, 'descripcion', e.target.value)}
                            className="h-7 text-xs border-0 bg-transparent px-1.5 focus-visible:border-input focus-visible:bg-white min-w-[200px]" placeholder="Descripción..." />
                        </td>
                        <td className="px-1 py-1 border-r border-gray-100">
                          <Input value={item.unidad || ''} onChange={e => updateItem(iIdx, 'unidad', e.target.value)}
                            className="h-7 text-xs border-0 bg-transparent px-1 text-center focus-visible:border-input focus-visible:bg-white w-14" />
                        </td>
                        <td className="px-1 py-1 border-r border-gray-100">
                          <Input type="number" value={item.cantidad ?? ''} onChange={e => updateItem(iIdx, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-0 bg-transparent px-1 text-right focus-visible:border-input focus-visible:bg-white w-16" />
                        </td>
                        <td className="px-1 py-1 border-r border-gray-100">
                          <Input type="number" value={item.pu_mat ?? ''} onChange={e => updateItem(iIdx, 'pu_mat', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-0 bg-transparent px-1 text-right focus-visible:border-input focus-visible:bg-white w-24 text-blue-700" />
                        </td>
                        <td className="px-1 py-1 border-r border-gray-100">
                          <Input type="number" value={item.pu_mo ?? ''} onChange={e => updateItem(iIdx, 'pu_mo', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-0 bg-transparent px-1 text-right focus-visible:border-input focus-visible:bg-white w-24 text-blue-700" />
                        </td>
                        <td className="px-2 py-1 text-right text-gray-600 font-medium tabular-nums text-[11px] border-r border-gray-100">{fmtN(pu_tot)}</td>
                        <td className="px-2 py-1 text-right text-gray-400 tabular-nums text-[10px] border-r border-gray-100">{cp}</td>
                        <td className="px-2 py-1 text-right text-gray-600 tabular-nums text-[11px] border-r border-gray-100">{fmtN(t_pase)}</td>
                        <td className="px-2 py-1 text-right text-gray-400 tabular-nums text-[10px] border-r border-gray-100">{co}</td>
                        <td className="px-2 py-1 text-right border-r border-gray-100">
                          <span className="bg-amber-50 border border-amber-200 text-amber-800 font-semibold px-1.5 py-0.5 rounded tabular-nums text-[11px]">
                            {fmtN(p_res)}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right border-r border-gray-100">
                          <span className="font-bold text-red-700 tabular-nums">{fmt(subtotal)}</span>
                        </td>
                        <td className="px-1 py-1">
                          <button onClick={() => onChange({ ...rubro, items: (rubro.items || []).filter((_, i) => i !== iIdx) })}
                            className="opacity-0 group-hover/row:opacity-100 transition-opacity text-gray-300 hover:text-red-600 p-1 rounded">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {(rubro.items || []).length > 0 && (
                  <tfoot>
                    <tr className="bg-red-50 border-t-2 border-red-200">
                      <td colSpan={12} className="px-3 py-2 text-xs font-semibold text-red-800">
                        Subtotal {rubro.nombre}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-red-800 tabular-nums text-sm">{fmt(rubroTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {/* Actions */}
            <div className="flex gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100">
              <Button size="sm" variant="outline" onClick={() => setSelectorOpen(true)} disabled={precario.length === 0}
                className="text-xs h-7 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 font-medium">
                <BookOpen className="h-3.5 w-3.5" />
                {precario.length === 0 ? 'Sin preciario' : 'Del Preciario'}
              </Button>
              <Button size="sm" variant="ghost" onClick={addEmpty}
                className="text-xs h-7 gap-1.5 text-gray-500 hover:text-gray-800">
                <Plus className="h-3.5 w-3.5" /> Ítem manual
              </Button>
              <span className="ml-auto text-[10px] text-gray-400 self-center font-mono">× {cp} × {co}</span>
            </div>
          </div>
        )}
      </div>

      <PrecarioSelector open={selectorOpen} onClose={() => setSelectorOpen(false)}
        precario={precario} cp={cp} co={co} onSelect={addFromPrecario} />
    </>
  );
}

// ── Main PCPGrid ──────────────────────────────────────────────────────────
export default function PCPGrid({ rubros, onChange, precario, coefPase, coefOferta }) {
  const cp = coefPase  ?? 1.6504;
  const co = coefOferta ?? 1.38;
  const [showOrden, setShowOrden] = useState(false);

  const handleAddRubro = (nombre) => {
    onChange([...(rubros || []), { nombre: nombre || `Rubro ${(rubros || []).length + 1}`, items: [] }]);
    setShowOrden(false);
  };

  // Compute global item offset per rubro
  let offset = 0;
  const offsets = (rubros || []).map(r => {
    const o = offset;
    offset += (r.items || []).length;
    return o;
  });

  return (
    <div className="space-y-3">
      {(rubros || []).map((rubro, idx) => (
        <RubroBlock
          key={idx}
          rubro={rubro}
          idx={idx}
          globalStart={offsets[idx]}
          precario={precario}
          cp={cp}
          co={co}
          onChange={(r) => {
            const next = [...(rubros || [])];
            next[idx] = r;
            onChange(next);
          }}
          onDelete={() => onChange((rubros || []).filter((_, i) => i !== idx))}
        />
      ))}

      {/* Add rubro buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowOrden(!showOrden)}
          className="flex-1 border border-dashed border-gray-300 rounded-lg py-2.5 text-xs text-gray-500 hover:border-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar rubro del orden de tareas
        </button>
        <button
          onClick={() => handleAddRubro('')}
          className="border border-dashed border-gray-300 rounded-lg px-4 py-2.5 text-xs text-gray-500 hover:border-red-400 hover:text-red-600 hover:bg-red-50/50 transition-colors flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Personalizado
        </button>
      </div>

      {/* Orden de tareas picker */}
      {showOrden && (
        <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Orden de Tareas — Ministerio</p>
            <button onClick={() => setShowOrden(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 p-3">
            {ORDEN_TAREAS.map((t, i) => (
              <button key={t} onClick={() => handleAddRubro(t)}
                className="text-left px-3 py-2 rounded-lg text-xs hover:bg-red-50 hover:text-red-700 transition-colors border border-transparent hover:border-red-200 flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-mono w-5 shrink-0">{i + 1}.</span>
                <span className="font-medium text-gray-700">{t}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}