import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => { try { if (!d) return '—'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d || '—'; } };

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

  const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';
  const FIRMA_RAUL_GARCIA_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/317004861_FirmaRaulGArcia.jpg';

  const exportPDF = async () => {
    const FIRMA_RAUL_GARCIA_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/317004861_FirmaRaulGArcia.jpg';
    let logoBase64 = null;
    try {
      const res = await fetch(MEJORES_LOGO_URL);
      const blob = await res.blob();
      logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {}

    // A4 landscape
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210, M = 10, C = W - M * 2;
    const FOOTER_H = 10;
    const SAFE_BOTTOM = H - FOOTER_H - 5; // zona segura antes del footer

    const pdfSubtotal = hasMedicion ? totalPresente : subtotalContrato;
    const pdfAnticipo = pdfSubtotal * (form.anticipo_pct / 100);
    const pdfFondoReparo = pdfSubtotal * (form.fondo_reparo_pct / 100);
    const pdfTotalNeto = pdfSubtotal - pdfAnticipo - pdfFondoReparo;

    // ── Dibujar header de página (reutilizable para cada página nueva) ──────
    const drawPageHeader = (isFirstPage) => {
      doc.setFillColor(15, 28, 46);
      doc.rect(0, 0, W, 22, 'F');
      if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', M, 1.5, 46, 18);
      } else {
        doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont('helvetica','bold');
        doc.text('MEJORES', M, 12);
        doc.setFontSize(7); doc.setFont('helvetica','normal');
        doc.text('en mantenimiento, obras y servicios', M, 17);
      }
      doc.setTextColor(255,255,255);
      doc.setFontSize(12); doc.setFont('helvetica','bold');
      doc.text(`CERTIFICADO N° ${form.numero}`, W - M, 10, { align: 'right' });
      doc.setFontSize(7.5); doc.setFont('helvetica','normal');
      doc.text(
        `${form.tipo === 'abono_mensual' ? 'ABONO MENSUAL' : 'OBRA'} · ${fmtDate(form.fecha_certificado)}`,
        W - M, 17, { align: 'right' }
      );
    };

    // ── Dibujar footer de página ─────────────────────────────────────────────
    const drawFooter = (pageNum, totalPages) => {
      doc.setFillColor(15,28,46);
      doc.rect(0, H - FOOTER_H, W, FOOTER_H, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
      doc.text('Av. Córdoba 1351 1°Piso · (C1055AAD) CABA · Tel 4816-0111 · www.mejores.ar', M, H - 3.5);
      doc.text(`CERT N° ${form.numero} · Pág ${pageNum}/${totalPages}`, W - M, H - 3.5, { align: 'right' });
    };

    // ── Dibujar encabezado de tabla (también reutilizable) ───────────────────
    const drawTableHeader = (atY) => {
      const ROW_H = 8;
      doc.setFillColor(15,28,46);
      doc.rect(M, atY, C, ROW_H, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(6.5); doc.setFont('helvetica','bold');

      // Columnas: [x, ancho, label, align]
      TABLE_COLS.forEach(({ x, w, label, align }) => {
        const cx = align === 'right' ? x + w - 1 : x + 1;
        doc.text(label, cx, atY + 5.5, { align: align === 'right' ? 'right' : 'left' });
      });
      return atY + ROW_H;
    };

    // Definición de columnas (x acumulado, ancho, label)
    const TABLE_COLS = (() => {
      const defs = [
        { w: 7,  label: 'N°',         align: 'right' },
        { w: 62, label: 'DESCRIPCIÓN', align: 'left'  },
        { w: 9,  label: 'UM',         align: 'left'  },
        { w: 12, label: 'CANT.',      align: 'right' },
        { w: 18, label: 'IMP.UNIT.',  align: 'right' },
        { w: 18, label: 'IMP.TOTAL',  align: 'right' },
        { w: 9,  label: 'A.ANT U',    align: 'right' },
        { w: 18, label: 'A.ANT $',    align: 'right' },
        { w: 9,  label: 'PRES. U',    align: 'right' },
        { w: 18, label: 'PRES. $',    align: 'right' },
        { w: 9,  label: 'A.PR. U',    align: 'right' },
        { w: 18, label: 'A.PR. $',    align: 'right' },
        { w: 9,  label: 'SALDO U',    align: 'right' },
        { w: 18, label: 'SALDO $',    align: 'right' },
      ];
      let cx = M;
      return defs.map(d => { const col = { ...d, x: cx }; cx += d.w; return col; });
    })();

    const DESCR_COL = TABLE_COLS[1]; // columna descripción para wrap

    // ── PÁGINA 1 ─────────────────────────────────────────────────────────────
    drawPageHeader(true);
    let y = 26;

    // Bloque de información: dos columnas bien espaciadas
    doc.setFontSize(8); doc.setTextColor(40,40,40);
    const leftInfo = [
      ['EMPRENDIMIENTO', form.emprendimiento],
      ['OBRA / SERVICIO', form.obra_servicio],
      ['CONTRATISTA', form.contratista],
      ['BASE', form.base || '—'],
    ];
    const rightInfo = [
      ['ADA N°', form.ada_numero],
      ['OC N°', form.oc_numero || '—'],
      ['MES / PERÍODO', form.mes_periodo],
      ['FECHA INICIO', fmtDate(form.fecha_inicio)],
      ['PLAZO', form.plazo_obra || '—'],
      ['FIN', fmtDate(form.fecha_finalizacion)],
      ['MONTO CONTRATADO', fmt(form.monto_contratado)],
    ];
    const INFO_LINE = 5.5;
    leftInfo.forEach(([k, v], i) => {
      const ry = y + i * INFO_LINE;
      doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80); doc.text(k + ':', M, ry);
      doc.setFont('helvetica','normal'); doc.setTextColor(20,20,20);
      doc.text(String(v || '—'), M + 40, ry);
    });
    rightInfo.forEach(([k, v], i) => {
      const ry = y + i * INFO_LINE;
      doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80); doc.text(k + ':', W / 2 + 5, ry);
      doc.setFont('helvetica','normal'); doc.setTextColor(20,20,20);
      doc.text(String(v || '—'), W / 2 + 48, ry);
    });
    y += Math.max(leftInfo.length, rightInfo.length) * INFO_LINE + 4;

    // Separador fino
    doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 4;

    // Encabezado de tabla
    y = drawTableHeader(y);

    // ── Filas de ítems ───────────────────────────────────────────────────────
    let pageNum = 1;
    doc.setFont('helvetica','normal');

    form.items.forEach((item, idx) => {
      // Calcular cuántas líneas ocupa la descripción
      doc.setFontSize(7);
      const descLines = doc.splitTextToSize(item.descripcion || '', DESCR_COL.w - 2);
      const ROW_H = Math.max(7, descLines.length * 4.2 + 2);

      // Verificar si cabe en la página actual
      if (y + ROW_H > SAFE_BOTTOM) {
        drawFooter(pageNum, '??');
        doc.addPage();
        pageNum++;
        drawPageHeader(false);
        y = 26;
        y = drawTableHeader(y);
      }

      // Fondo alternado
      doc.setFillColor(idx % 2 === 0 ? 255 : 245, idx % 2 === 0 ? 255 : 247, idx % 2 === 0 ? 255 : 250);
      doc.rect(M, y, C, ROW_H, 'F');
      // Borde inferior fino
      doc.setDrawColor(220,220,220); doc.setLineWidth(0.15);
      doc.line(M, y + ROW_H, M + C, y + ROW_H);

      const ty = y + ROW_H / 2 + 2; // centro vertical aproximado
      doc.setFontSize(7); doc.setTextColor(40,40,40);

      // N°
      const col0 = TABLE_COLS[0];
      doc.setFont('helvetica','normal');
      doc.text(String(item.numero || idx + 1), col0.x + col0.w - 1, ty, { align: 'right' });

      // Descripción (multilinea)
      doc.setFont('helvetica','normal');
      doc.text(descLines, DESCR_COL.x + 1, y + 4.5);

      // UM
      doc.text(item.um || '', TABLE_COLS[2].x + 1, ty);

      // Resto de celdas numéricas
      const numCell = (val, colIdx, bold = false) => {
        const col = TABLE_COLS[colIdx];
        if (bold) doc.setFont('helvetica','bold'); else doc.setFont('helvetica','normal');
        doc.text(String(val ?? ''), col.x + col.w - 1, ty, { align: 'right' });
      };

      numCell(item.cantidad || '', 3);
      numCell(fmt(item.importe_unitario), 4);
      numCell(fmt(item.importe_total), 5, true);
      numCell(item.med_acum_anterior_unidad || 0, 6);
      numCell(fmt(item.med_acum_anterior_importe), 7);
      numCell(item.med_presente_unidad || 0, 8);
      numCell(fmt(item.med_presente_importe), 9);
      numCell(item.med_acum_presente_unidad || 0, 10);
      numCell(fmt(item.med_acum_presente_importe), 11);
      numCell(item.saldo_pendiente_unidad || 0, 12);
      numCell(fmt(item.saldo_pendiente_importe), 13);

      y += ROW_H;
    });

    // ── Bloque de totales — verificar que entren en la página actual ─────────
    const TOTALS_H = hasMedicion ? 52 : 38;
    if (y + TOTALS_H > SAFE_BOTTOM) {
      drawFooter(pageNum, '??');
      doc.addPage();
      pageNum++;
      drawPageHeader(false);
      y = 26;
    }

    y += 5;

    if (hasMedicion) {
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(90,90,90);
      doc.text(`Total contrato: ${fmt(subtotalContrato)}`, W - M, y, { align: 'right' }); y += 6;
      doc.text(`Saldo pendiente: ${fmt(totalSaldo)}`, W - M, y, { align: 'right' }); y += 6;
    }

    // Importe certificado / subtotal
    doc.setFillColor(235, 243, 255);
    doc.rect(W - M - 90, y, 90, 8, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(15,28,46);
    doc.text(hasMedicion ? 'IMP. CERTIFICADO:' : 'SUBTOTAL:', W - M - 88, y + 5.5);
    doc.text(fmt(pdfSubtotal), W - M - 1, y + 5.5, { align: 'right' });
    y += 10;

    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(90,90,90);
    doc.text(`Anticipo/Desacopio (${form.anticipo_pct}%):   -${fmt(pdfAnticipo)}`, W - M, y, { align: 'right' }); y += 7;
    doc.text(`Fondo de Reparo (${form.fondo_reparo_pct}%):   -${fmt(pdfFondoReparo)}`, W - M, y, { align: 'right' }); y += 7;

    // Total Neto — caja destacada
    doc.setFillColor(15,28,46);
    doc.rect(W - M - 90, y, 90, 10, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text('TOTAL NETO:', W - M - 88, y + 7);
    doc.text(fmt(pdfTotalNeto), W - M - 1, y + 7, { align: 'right' });
    y += 14;

    // Barra de avance
    if (hasMedicion && y + 16 < SAFE_BOTTOM) {
      const pct = subtotalContrato > 0 ? (totalPresente / subtotalContrato) * 100 : 0;
      const barW = 130, barH = 6;
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(15,28,46);
      doc.text(`Avance: ${pct.toFixed(1)}%`, M, y + 5);
      doc.setFillColor(220,228,240); doc.rect(M + 30, y, barW, barH, 'F');
      doc.setFillColor(30,100,220); doc.rect(M + 30, y, barW * Math.min(pct / 100, 1), barH, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(80,80,80);
      doc.text(`${fmt(totalPresente)} de ${fmt(subtotalContrato)}`, M + 32, y + barH + 5);
    }

    // ── Firma del gerente Raúl García (siempre en aprobado) ──────────────────
    if (form.estado === 'aprobado') {
      try {
        const firmaRes = await fetch(FIRMA_RAUL_GARCIA_URL);
        const firmaBlob = await firmaRes.blob();
        const firmaBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(firmaBlob);
        });
        if (y + 35 > SAFE_BOTTOM) {
          drawFooter(pageNum, '??');
          doc.addPage();
          pageNum++;
          drawPageHeader(false);
          y = 26;
        }
        y += 6;
        doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(90,90,90);
        doc.text('Firma y aprobación gerencial:', M, y + 5);
        doc.addImage(firmaBase64, 'JPEG', M, y + 7, 55, 22);
        doc.setDrawColor(100,100,100); doc.setLineWidth(0.3);
        doc.line(M, y + 31, M + 55, y + 31);
        doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(40,40,40);
        doc.text('Arq. Raúl García', M, y + 35);
        doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(90,90,90);
        doc.text('Gerente de Contratos', M, y + 39);
        doc.text('Mejores Hospitales S.A.', M, y + 43);
      } catch {}
    }

    // ── Pies definitivos ─────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter(p, totalPages);
    }

    doc.save(`Certificado_N${form.numero}_${form.contratista?.replace(/ /g,'_') || ''}.pdf`);
  };

  const isAprobado = form.estado === 'aprobado';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-bold flex-1">Vista Previa — Certificado N° {form.numero}</h2>
        {isAprobado ? (
          <Button variant="outline" className="gap-2" onClick={exportPDF}>
            <Download className="h-4 w-4" />Descargar PDF
          </Button>
        ) : (
          <Button variant="outline" className="gap-2 opacity-50 cursor-not-allowed" disabled title="Disponible tras aprobación gerencial">
            <Download className="h-4 w-4" />PDF (pendiente aprobación)
          </Button>
        )}
        <Button className="gap-2" onClick={() => onSave(form)} disabled={saving}>{saving ? 'Guardando...' : 'Emitir y enviar a aprobación'}</Button>
      </div>
      {isAprobado && (
        <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-emerald-700">✓ Aprobado por {form.aprobado_por || 'Arq. Raúl García'}</span>
          <div className="flex flex-col items-center border-l pl-4 border-emerald-200">
            <img src={FIRMA_RAUL_GARCIA_URL} alt="Firma Arq. Raúl García" className="h-14 object-contain bg-white px-1" />
            <span className="text-[10px] font-bold text-slate-600 mt-0.5">Arq. Raúl García</span>
            <span className="text-[10px] text-slate-500">Gerente de Contratos · Mejores Hospitales S.A.</span>
          </div>
        </div>
      )}
      {!isAprobado && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
          ⏳ Este certificado está pendiente de aprobación gerencial. El PDF se habilitará una vez aprobado.
        </div>
      )}

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