import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Save, Loader2 } from 'lucide-react';
import { exportCertificadoPDF } from '@/utils/exportCertificadoPDF';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => { try { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d || '—'; } };

export default function CertificadoPreview({ form, onBack, onSave, saving }) {
  const [exporting, setExporting] = useState(false);

  const subtotal = (form.items || []).reduce((a, i) => a + (i.importe_total || 0), 0);
  const totalPresente = (form.items || []).reduce((a, i) => a + (i.med_presente_importe || 0), 0);
  const hasMedicion = totalPresente > 0;
  const pdfSubtotal = hasMedicion ? totalPresente : subtotal;
  const anticipo_pct = form.anticipo_pct ?? 0;
  const fondo_reparo_pct = form.fondo_reparo_pct ?? 0;
  const anticipo = pdfSubtotal * (anticipo_pct / 100);
  const fondoReparo = pdfSubtotal * (fondo_reparo_pct / 100);
  const totalNeto = pdfSubtotal - anticipo - fondoReparo;

  const handleExportPDF = async () => {
    setExporting(true);
    await exportCertificadoPDF(form);
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver al editor
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
          {onSave && (
            <Button size="sm" onClick={() => onSave(form)} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Emitir Certificado
            </Button>
          )}
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-card border rounded-xl p-8 space-y-6 max-w-4xl mx-auto">
        {/* Header del certificado */}
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold mb-2">Certificado N° {form.numero}</h1>
          <p className="text-sm text-muted-foreground capitalize">{form.tipo?.replace(/_/g, ' ')} · {fmtDate(form.fecha_certificado)}</p>
        </div>

        {/* Info general - Una columna para mejor legibilidad */}
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Emprendimiento:</span>
              <span className="font-semibold">{form.emprendimiento || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">ADA N°:</span>
              <span className="font-semibold">{form.ada_numero || '—'}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Obra / Servicio:</span>
              <span className="font-semibold">{form.obra_servicio || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">OC N°:</span>
              <span className="font-semibold">{form.oc_numero || '—'}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Contratista:</span>
              <span className="font-semibold">{form.contratista || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Mes / Período:</span>
              <span className="font-semibold">{form.mes_periodo || '—'}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Fecha inicio:</span>
              <span className="font-semibold">{fmtDate(form.fecha_inicio)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Fecha finalización:</span>
              <span className="font-semibold">{fmtDate(form.fecha_finalizacion)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Plazo:</span>
              <span className="font-semibold">{form.plazo_obra || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Monto contratado:</span>
              <span className="font-semibold text-primary">{fmt(form.monto_contratado)}</span>
            </div>

            {form.base && (
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground font-medium">Base:</span>
                <span className="font-semibold">{form.base}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de ítems — Bug #4 fix: misma lógica de filtrado que el PDF */}
        {(form.items || []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="px-2 py-2 text-left">N°</th>
                  <th className="px-2 py-2 text-left">Descripción</th>
                  <th className="px-2 py-2 text-left">UM</th>
                  <th className="px-2 py-2 text-right">Cant.</th>
                  <th className="px-2 py-2 text-right">Imp. Unit.</th>
                  <th className="px-2 py-2 text-right">Imp. Total</th>
                  {hasMedicion && <>
                    <th className="px-2 py-2 text-right">A.Ant $</th>
                    <th className="px-2 py-2 text-right">Pres. $</th>
                    <th className="px-2 py-2 text-right">Saldo $</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {(hasMedicion ? form.items.filter(it => (it.med_presente_importe || 0) > 0) : form.items).map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    <td className="px-2 py-1.5 text-muted-foreground">{item.numero || i + 1}</td>
                    <td className="px-2 py-1.5">{item.descripcion}</td>
                    <td className="px-2 py-1.5">{item.um}</td>
                    <td className="px-2 py-1.5 text-right">{item.cantidad}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(item.importe_unitario)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmt(item.importe_total)}</td>
                    {hasMedicion && <>
                      <td className="px-2 py-1.5 text-right">{fmt(item.med_acum_anterior_importe)}</td>
                      <td className="px-2 py-1.5 text-right text-primary">{fmt(item.med_presente_importe)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(item.saldo_pendiente_importe)}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totales */}
        <div className="flex justify-end">
          <div className="space-y-2 text-sm min-w-64">
            <div className="flex justify-between gap-8 text-muted-foreground">
              <span>{hasMedicion ? 'Imp. Certificado:' : 'Subtotal:'}</span>
              <span className="font-semibold text-foreground">{fmt(pdfSubtotal)}</span>
            </div>
            {anticipo_pct > 0 && (
              <div className="flex justify-between gap-8 text-muted-foreground">
                <span>Anticipo ({anticipo_pct}%):</span>
                <span>-{fmt(anticipo)}</span>
              </div>
            )}
            <div className="flex justify-between gap-8 text-muted-foreground">
              <span>Fondo de Reparo ({fondo_reparo_pct}%):</span>
              <span>-{fmt(fondoReparo)}</span>
            </div>
            <div className="flex justify-between gap-8 bg-primary text-primary-foreground font-bold rounded-lg px-3 py-2 text-base">
              <span>Total Neto:</span>
              <span>{fmt(totalNeto)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}