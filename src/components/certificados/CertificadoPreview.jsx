import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => { try { return d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '—'; } catch { return d || '—'; } };

export default function CertificadoPreview({ form, onBack, onSave, saving }) {
  const subtotalContrato = form.items.reduce((acc, it) => acc + (it.importe_total || 0), 0);
  // Si hay medición presente aplicada, usar ese importe para los totales del certificado
  const totalPresente = form.items.reduce((acc, it) => acc + (it.med_presente_importe || 0), 0);
  const totalSaldo = form.items.reduce((acc, it) => acc + (it.saldo_pendiente_importe || 0), 0);
  const hasMedicion = totalPresente > 0;
  const subtotal = hasMedicion ? totalPresente : subtotalContrato;
  const anticipo = subtotal * (form.anticipo_pct / 100);
  const fondoReparo = subtotal * (form.fondo_reparo_pct / 100);
  const totalNeto = subtotal - anticipo - fondoReparo;
  const pctCertificado = subtotalContrato > 0 ? (totalPresente / subtotalContrato) * 100 : 0;

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, M = 10, C = W - M * 2;
    // Usar importe presente si hay medición, sino el contrato completo
    const pdfSubtotal = hasMedicion ? totalPresente : subtotalContrato;
    const pdfAnticipo = pdfSubtotal * (form.anticipo_pct / 100);
    const pdfFondoReparo = pdfSubtotal * (form.fondo_reparo_pct / 100);
    const pdfTotalNeto = pdfSubtotal - pdfAnticipo - pdfFondoReparo;

    // Header
    doc.setFillColor(15, 28, 46); doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('MEJORES', M, 10);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('en mantenimiento, obras y servicios', M, 15);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`CERTIFICADO N° ${form.numero}`, W - M, 10, { align: 'right' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`${form.tipo === 'abono_mensual' ? 'ABONO MENSUAL' : 'OBRA'} · ${fmtDate(form.fecha_certificado)}`, W - M, 16, { align: 'right' });

    let y = 28;
    // Info block
    doc.setTextColor(60, 60, 60); doc.setFontSize(7.5);
    const leftInfo = [
      ['EMPRENDIMIENTO', form.emprendimiento],
      ['OBRA / SERVICIO', form.obra_servicio],
      ['CONTRATISTA', form.contratista],
    ];
    const rightInfo = [
      ['ADA N°', form.ada_numero],
      ['OC N°', form.oc_numero || '—'],
      ['MES / PERÍODO', form.mes_periodo],
      ['FECHA INICIO', fmtDate(form.fecha_inicio)],
      ['MONTO CONTRATADO', fmt(form.monto_contratado)],
    ];
    leftInfo.forEach(([k, v], i) => {
      doc.setFont('helvetica', 'bold'); doc.text(k + ': ', M, y + i * 5);
      doc.setFont('helvetica', 'normal'); doc.text(v || '—', M + 38, y + i * 5);
    });
    rightInfo.forEach(([k, v], i) => {
      doc.setFont('helvetica', 'bold'); doc.text(k + ': ', W / 2 + 5, y + i * 5);
      doc.setFont('helvetica', 'normal'); doc.text(v || '—', W / 2 + 42, y + i * 5);
    });
    y += 28;

    // Table header
    doc.setFillColor(15, 28, 46); doc.rect(M, y, C, 6, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
    const cols = [M+1, M+8, M+70, M+80, M+92, M+110, M+128, M+146, M+164, M+182, M+200, M+218, M+240, M+258];
    ['N°','DESCRIPCIÓN','UM','CANT.T','IMP.UNIT','IMP.TOTAL','AC.ANT.U','AC.ANT.$','PRES.U','PRES.$','AC.PR.U','AC.PR.$','SALDO.U','SALDO.$'].forEach((h,i) => {
      doc.text(h, cols[i], y + 4);
    });
    y += 7;

    // Rows
    doc.setTextColor(50, 50, 50); doc.setFont('helvetica', 'normal');
    form.items.forEach((item, i) => {
      if (y > 178) { doc.addPage(); y = 15; }
      if (i % 2 === 0) { doc.setFillColor(247,247,247); doc.rect(M, y-1, C, 5.5, 'F'); }
      doc.setFontSize(5.5);
      doc.text(String(item.numero || i+1), cols[0], y+3);
      doc.text(doc.splitTextToSize(item.descripcion || '', 58)[0], cols[1], y+3);
      doc.text(item.um || '', cols[2], y+3);
      doc.text(String(item.cantidad || ''), cols[3], y+3);
      doc.text(fmt(item.importe_unitario), cols[4], y+3);
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(item.importe_total), cols[5], y+3);
      doc.setFont('helvetica', 'normal');
      doc.text(String(item.med_acum_anterior_unidad||0), cols[6], y+3);
      doc.text(fmt(item.med_acum_anterior_importe), cols[7], y+3);
      doc.text(String(item.med_presente_unidad||0), cols[8], y+3);
      doc.text(fmt(item.med_presente_importe), cols[9], y+3);
      doc.text(String(item.med_acum_presente_unidad||0), cols[10], y+3);
      doc.text(fmt(item.med_acum_presente_importe), cols[11], y+3);
      doc.text(String(item.saldo_pendiente_unidad||0), cols[12], y+3);
      doc.text(fmt(item.saldo_pendiente_importe), cols[13], y+3);
      y += 5.5;
    });

    // Totals
    y += 3;
    if (hasMedicion) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(80,80,80);
      doc.text(`Total contrato: ${fmt(subtotalContrato)}`, W - M - 1, y, { align: 'right' }); y += 5;
      doc.text(`Saldo pendiente: ${fmt(totalSaldo)}`, W - M - 1, y, { align: 'right' }); y += 5;
    }
    doc.setFillColor(230, 240, 255); doc.rect(M + C - 80, y, 80, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(15,28,46);
    doc.text(hasMedicion ? 'IMP. CERTIFICADO:' : 'SUBTOTAL:', M + C - 78, y + 3.5);
    doc.text(fmt(pdfSubtotal), W - M - 1, y + 3.5, { align: 'right' });
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(80,80,80);
    doc.text(`Anticipo/Desacopio (${form.anticipo_pct}%): ${fmt(pdfAnticipo)}`, W - M - 1, y, { align: 'right' }); y += 5;
    doc.text(`Fondo de Reparo (${form.fondo_reparo_pct}%): ${fmt(pdfFondoReparo)}`, W - M - 1, y, { align: 'right' }); y += 5;
    doc.setFillColor(15,28,46); doc.rect(M + C - 80, y, 80, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('TOTAL NETO:', M + C - 78, y + 5);
    doc.text(fmt(pdfTotalNeto), W - M - 1, y + 5, { align: 'right' });
    y += 10;

    // Barra de % certificado
    if (hasMedicion) {
      const pct = subtotalContrato > 0 ? (totalPresente / subtotalContrato) * 100 : 0;
      const barW = 120, barH = 5, barX = M;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(15,28,46);
      doc.text(`Avance certificado: ${pct.toFixed(1)}%`, barX, y); y += 4;
      // fondo gris
      doc.setFillColor(220,220,220); doc.rect(barX, y, barW, barH, 'F');
      // barra azul
      doc.setFillColor(30, 100, 220); doc.rect(barX, y, barW * Math.min(pct / 100, 1), barH, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(80,80,80);
      doc.text(`${fmt(totalPresente)} certificado de ${fmt(subtotalContrato)} total contrato`, barX, y + barH + 4);
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFillColor(15,28,46); doc.rect(0, 197, W, 8, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.text('Av. Córdoba 1351 1°Piso · (C1055AAD) Ciudad Aut. de Bs. As. · Tel 4816-0111 · www.mejores.ar', M, 202);
      doc.text(`CERT N° ${form.numero} · Pág ${p}/${pages}`, W - M, 202, { align: 'right' });
    }

    doc.save(`Certificado_N${form.numero}_${form.contratista?.replace(/ /g,'_') || ''}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-bold flex-1">Vista Previa — Certificado N° {form.numero}</h2>
        <Button variant="outline" className="gap-2" onClick={exportPDF}><Download className="h-4 w-4" />PDF</Button>
        <Button className="gap-2" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Guardando...' : 'Guardar certificado'}</Button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden text-[13px]">
        {/* Header del certificado */}
        <div className="bg-[#0f1c2e] text-white px-6 py-4 flex justify-between items-start">
          <div>
            <div className="font-bold text-lg">MEJORES</div>
            <div className="text-xs text-white/60">en mantenimiento, obras y servicios</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-xl">CERTIFICADO N° {form.numero}</div>
            <div className="text-xs text-white/70 mt-1">{form.tipo === 'abono_mensual' ? 'ABONO MENSUAL' : 'OBRA'} · {fmtDate(form.fecha_certificado)}</div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-px bg-border">
          {[
            ['EMPRENDIMIENTO', form.emprendimiento],
            ['ADA N°', form.ada_numero],
            ['OBRA / SERVICIO', form.obra_servicio],
            ['OC N°', form.oc_numero || '—'],
            ['CONTRATISTA', form.contratista],
            ['MES / PERÍODO', form.mes_periodo],
            ['FECHA INICIO', fmtDate(form.fecha_inicio)],
            ['PLAZO', form.plazo_obra],
            ['FECHA FINALIZACIÓN', fmtDate(form.fecha_finalizacion)],
            ['MONTO CONTRATADO', fmt(form.monto_contratado)],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-2 flex gap-3">
              <span className="text-xs font-bold text-muted-foreground w-36 shrink-0">{k}:</span>
              <span className="font-medium truncate">{v || '—'}</span>
            </div>
          ))}
        </div>

        {/* Tabla de ítems */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0f1c2e] text-white">
                {['N°','DESCRIPCIÓN','UM','CANT TOTAL','IMP. UNITARIO','IMP. TOTAL','ACUM. ANT. U','ACUM. ANT. $','PRES. U','PRES. $','ACUM. PRES. U','ACUM. PRES. $','SALDO PEND. U','SALDO PEND. $'].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, i) => {
                const tieneAvance = (item.med_presente_unidad || 0) > 0;
                const tieneSaldo = (item.saldo_pendiente_importe || 0) > 0;
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2 py-2">{item.numero || i+1}</td>
                    <td className="px-2 py-2 max-w-xs font-medium">{item.descripcion}</td>
                    <td className="px-2 py-2">{item.um}</td>
                    <td className="px-2 py-2 text-right">{item.cantidad}</td>
                    <td className="px-2 py-2 text-right">{fmt(item.importe_unitario)}</td>
                    <td className="px-2 py-2 text-right font-bold">{fmt(item.importe_total)}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{item.med_acum_anterior_unidad||0}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">{fmt(item.med_acum_anterior_importe)}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${tieneAvance ? 'text-blue-700' : 'text-muted-foreground'}`}>{item.med_presente_unidad||0}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${tieneAvance ? 'text-blue-700' : 'text-muted-foreground'}`}>{fmt(item.med_presente_importe)}</td>
                    <td className="px-2 py-2 text-right">{item.med_acum_presente_unidad||0}</td>
                    <td className="px-2 py-2 text-right">{fmt(item.med_acum_presente_importe)}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${tieneSaldo ? 'text-orange-600' : 'text-muted-foreground'}`}>{item.saldo_pendiente_unidad||0}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${tieneSaldo ? 'text-orange-600' : 'text-muted-foreground'}`}>{fmt(item.saldo_pendiente_importe)}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold border-t-2 text-xs">
                <td colSpan={5} className="px-2 py-2">TOTALES</td>
                <td className="px-2 py-2 text-right">{fmt(subtotalContrato)}</td>
                <td colSpan={2}></td>
                <td colSpan={2} className="px-2 py-2 text-right text-blue-700 font-bold">{fmt(totalPresente)}</td>
                <td colSpan={2}></td>
                <td colSpan={2} className="px-2 py-2 text-right text-orange-600 font-bold">{fmt(totalSaldo)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Barra de avance certificado */}
        {hasMedicion && (
          <div className="px-4 py-3 border-t bg-blue-50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-blue-800">Avance certificado</span>
              <span className="text-lg font-bold text-blue-700">{pctCertificado.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-3 overflow-hidden">
              <div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.min(100, pctCertificado)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-blue-700 mt-1">
              <span>{fmt(totalPresente)} certificado</span>
              <span>{fmt(subtotalContrato)} total contrato</span>
            </div>
          </div>
        )}

        {/* Totales finales */}
        <div className="flex justify-end p-4 border-t bg-slate-50">
          <div className="w-80 space-y-2 text-sm">
            {hasMedicion && (
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Total contrato:</span><span>{fmt(subtotalContrato)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{hasMedicion ? 'Importe certificado (presente):' : 'Subtotal:'}</span>
              <span className="font-semibold text-blue-700">{fmt(subtotal)}</span>
            </div>
            {hasMedicion && totalSaldo > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Saldo pendiente:</span>
                <span className="text-orange-600 font-semibold">{fmt(totalSaldo)}</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Desacopio ({form.anticipo_pct}%):</span><span>-{fmt(anticipo)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fondo de Reparo ({form.fondo_reparo_pct}%):</span><span>-{fmt(fondoReparo)}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>TOTAL NETO:</span><span className="text-primary">{fmt(totalNeto)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Nota: los importes no incluyen impuestos</p>
          </div>
        </div>
      </div>
    </div>
  );
}