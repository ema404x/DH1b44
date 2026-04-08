import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, FileText, FileSpreadsheet, Building2, MapPin, User, Hash, Gavel, Calendar } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  try { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d; }
};

const estadoConfig = {
  borrador:  { label: 'Borrador',  className: 'bg-slate-100 text-slate-700 border-slate-300' },
  enviado:   { label: 'Enviado',   className: 'bg-blue-100 text-blue-700 border-blue-300' },
  aprobado:  { label: 'Aprobado',  className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  rechazado: { label: 'Rechazado', className: 'bg-red-100 text-red-700 border-red-300' },
  facturado: { label: 'Facturado', className: 'bg-purple-100 text-purple-700 border-purple-300' },
};

function MetaField({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-muted-foreground min-w-[90px] shrink-0">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function PresupuestoPreview({ form, onClose, onExportPDF, onExportExcel }) {
  const rubros = form.rubros || [];
  const subtotal = rubros.reduce((acc, r) => acc + (r.items || []).reduce((a, i) => a + (Number(i.total) || 0), 0), 0);
  const gg = subtotal * ((form.gastos_generales_pct || 0) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 0) / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 0) / 100);
  const total = baseImponible + iva;
  const estado = estadoConfig[form.estado] || estadoConfig.borrador;
  const totalItems = rubros.reduce((a, r) => a + (r.items || []).length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl my-4 overflow-hidden">

        {/* Header del documento - simula membrete */}
        <div className="bg-[#0a1834] text-white px-8 py-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-1">Ministerio de Educación GCBA · DGMESC</p>
            <h1 className="text-lg font-bold tracking-wide">PLANILLA DE CÓMPUTO Y PRESUPUESTO</h1>
            <p className="text-xs text-white/60 mt-1">{form.licitacion || 'Sin licitación asignada'}</p>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <Badge variant="outline" className={`text-xs ${estado.className}`}>{estado.label}</Badge>
            <p className="text-xs font-mono text-white/70">{form.codigo || '—'}</p>
            <button onClick={onClose} className="text-white/50 hover:text-white mt-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Banda roja */}
        <div className="h-1 bg-red-600" />

        <div className="px-8 py-6 space-y-6">

          {/* Info del proyecto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border">
            <div className="space-y-2">
              <MetaField icon={Hash}       label="Código"       value={form.codigo} />
              <MetaField icon={FileText}   label="Título"       value={form.titulo} />
              <MetaField icon={User}       label="Comitente"    value={form.cliente_nombre} />
              <MetaField icon={Building2}  label="Escuela"      value={form.proyecto_nombre} />
              <MetaField icon={MapPin}     label="Dirección"    value={form.direccion_obra} />
              <MetaField icon={User}       label="Supervisor"   value={form.responsable} />
            </div>
            <div className="space-y-2">
              <MetaField icon={Gavel}      label="Licitación"   value={form.licitacion} />
              <MetaField icon={Hash}       label="Comuna"       value={form.comuna} />
              <MetaField icon={Calendar}   label="Emisión"      value={fmtDate(form.fecha_emision)} />
              <MetaField icon={Calendar}   label="Validez"      value={fmtDate(form.fecha_validez)} />
              <MetaField icon={Calendar}   label="Plazo"        value={form.plazo} />
              <div className="flex items-center gap-4 text-sm pt-1">
                <span className="text-muted-foreground">Coef. Pase:</span>
                <span className="font-mono font-semibold">{form.coef_pase ?? 1.6504}</span>
                <span className="text-muted-foreground">Coef. Oferta:</span>
                <span className="font-mono font-semibold">{form.coef_oferta ?? 1.38}</span>
              </div>
            </div>
          </div>

          {/* Rubros e ítems */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Cómputo y Presupuesto
              </h2>
              <span className="text-xs text-muted-foreground">{totalItems} ítems · {rubros.length} rubros</span>
            </div>

            {rubros.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm border rounded-xl border-dashed">
                Sin rubros cargados
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                {/* Tabla header */}
                <div className="grid grid-cols-12 bg-[#1d4060] text-white text-[10px] font-semibold uppercase tracking-wide px-3 py-2">
                  <div className="col-span-1 text-center">Ítem</div>
                  <div className="col-span-1">Cód.</div>
                  <div className="col-span-4">Descripción</div>
                  <div className="col-span-1 text-center">Unid.</div>
                  <div className="col-span-1 text-right">Cant.</div>
                  <div className="col-span-2 text-right">P.Unitario</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {rubros.map((rubro, ri) => {
                  const rubroSub = (rubro.items || []).reduce((a, i) => a + (Number(i.total) || 0), 0);
                  return (
                    <div key={ri}>
                      {/* Rubro header */}
                      <div className="grid grid-cols-12 bg-[#cdd9e5] px-3 py-1.5 border-t border-[#b0c4d8]">
                        <div className="col-span-10 text-xs font-bold text-[#0a1834] uppercase">
                          {rubro.nombre || `RUBRO ${ri + 1}`}
                        </div>
                        <div className="col-span-2 text-right text-xs font-bold text-[#1d4060]">{fmt(rubroSub)}</div>
                      </div>

                      {/* Ítems */}
                      {(rubro.items || []).map((item, ii) => (
                        <div key={ii} className={`grid grid-cols-12 px-3 py-1.5 text-xs border-t border-border/40 ${ii % 2 === 1 ? 'bg-muted/30' : ''}`}>
                          <div className="col-span-1 text-center text-muted-foreground">{ii + 1}</div>
                          <div className="col-span-1 text-muted-foreground font-mono truncate">{item.codigo || ''}</div>
                          <div className="col-span-4 text-foreground leading-tight">{item.descripcion}</div>
                          <div className="col-span-1 text-center text-muted-foreground">{item.unidad}</div>
                          <div className="col-span-1 text-right">{item.cantidad}</div>
                          <div className="col-span-2 text-right text-muted-foreground">{fmt(item.precio_unitario)}</div>
                          <div className="col-span-2 text-right font-semibold">{fmt(item.total)}</div>
                        </div>
                      ))}

                      {/* Subtotal rubro */}
                      <div className="grid grid-cols-12 px-3 py-1.5 bg-green-50 border-t border-green-200">
                        <div className="col-span-10 text-xs text-green-700 font-medium">Subtotal {rubro.nombre}</div>
                        <div className="col-span-2 text-right text-xs font-bold text-green-700">{fmt(rubroSub)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumen financiero */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resumen Financiero</div>
              {[
                [`Subtotal de obra`, subtotal],
                [`Gastos generales (${form.gastos_generales_pct || 0}%)`, gg],
                [`Beneficio / utilidad (${form.beneficio_pct || 0}%)`, ben],
                [`Base imponible`, baseImponible],
                [`IVA (${form.iva_pct || 0}%)`, iva],
              ].map(([label, val], i) => (
                <div key={i} className={`flex justify-between text-sm px-3 py-1.5 rounded ${i % 2 === 0 ? 'bg-muted/40' : ''}`}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{fmt(val)}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between items-center bg-[#0a1834] text-white rounded-lg px-4 py-3">
                <span className="font-bold text-sm">TOTAL PRESUPUESTO</span>
                <span className="font-bold text-lg">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {form.notas && (
            <div className="p-4 bg-muted/30 rounded-xl border text-sm">
              <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Notas y Condiciones</p>
              <p className="text-foreground leading-relaxed">{form.notas}</p>
            </div>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="px-8 py-4 border-t bg-muted/20 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Cerrar vista previa
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-slate-700 border-slate-300" onClick={onExportPDF}>
              <FileText className="h-3.5 w-3.5" /> Exportar PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50" onClick={onExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel PCP
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}