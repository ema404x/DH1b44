import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const estadoLabels = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

// Column definitions: key, header, width (mm), align
const COLS = [
  { key: 'numero_sap',     header: 'N° SAP',         w: 24, align: 'center' },
  { key: 'inspector',      header: 'Inspector',       w: 30 },
  { key: 'jefe_sitio',     header: 'Jefe Sitio',      w: 30 },
  { key: 'establecimiento',header: 'Establecimiento', w: 36 },
  { key: 'descripcion',    header: 'Tareas',          w: 64 },
  { key: 'sitio',          header: 'Ubicación',       w: 36 },
  { key: 'fecha_inicio',   header: 'F. Inicio',       w: 20, align: 'center' },
  { key: 'fecha_limite',   header: 'F. Límite',       w: 20, align: 'center' },
  { key: 'clase_orden',    header: 'Clase',           w: 14, align: 'center' },
  { key: 'estado',         header: 'Estado',          w: 22, align: 'center' },
];

const ESTADO_FILL = {
  pendiente:   [254, 249, 195],
  asignado:    [219, 234, 254],
  en_progreso: [237, 233, 254],
  resuelto:    [209, 250, 229],
  cancelado:   [241, 245, 249],
};

const ESTADO_TEXT = {
  pendiente:   [161, 98,  7],
  asignado:    [29,  78,  216],
  en_progreso: [109, 40,  217],
  resuelto:    [21,  128, 61],
  cancelado:   [100, 116, 139],
};

function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(String(text || '—'), maxWidth - 4);
}

function drawTableHeader(doc, startX, y, cols) {
  doc.setFillColor(30, 41, 59);
  let x = startX;
  const rowH = 7;
  cols.forEach(col => {
    doc.rect(x, y, col.w, rowH, 'F');
    x += col.w;
  });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  x = startX;
  cols.forEach(col => {
    doc.text(col.header, x + col.w / 2, y + 4.5, { align: 'center', maxWidth: col.w - 2 });
    x += col.w;
  });
  return y + rowH;
}

function drawRow(doc, startX, y, row, cols, isAlt, isVencido) {
  const cellPad = 2.5;
  // Measure height: tallest cell
  doc.setFontSize(6.5);
  let maxLines = 1;
  cols.forEach(col => {
    const lines = wrapText(doc, row[col.key], col.w);
    if (lines.length > maxLines) maxLines = lines.length;
  });
  const lineH = 3.5;
  const rowH = Math.max(7, maxLines * lineH + cellPad * 2);

  let x = startX;
  cols.forEach(col => {
    // Fill
    if (col.key === 'estado' && ESTADO_FILL[row._estado]) {
      doc.setFillColor(...ESTADO_FILL[row._estado]);
    } else if (isVencido && col.key === 'fecha_limite') {
      doc.setFillColor(254, 226, 226);
    } else if (isAlt) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(x, y, col.w, rowH, 'F');

    // Border
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, y, col.w, rowH, 'S');

    // Text color
    if (col.key === 'estado' && ESTADO_TEXT[row._estado]) {
      doc.setTextColor(...ESTADO_TEXT[row._estado]);
      doc.setFont('helvetica', 'bold');
    } else if (isVencido && col.key === 'fecha_limite') {
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
    } else if (col.key === 'jefe_sitio' && row[col.key] === 'Sin asignar') {
      doc.setTextColor(202, 138, 4);
      doc.setFont('helvetica', 'italic');
    } else if (col.key === 'numero_sap') {
      doc.setTextColor(30, 41, 59);
      doc.setFont('courier', 'bold');
    } else {
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
    }

    doc.setFontSize(6.5);
    const lines = wrapText(doc, row[col.key], col.w);
    const align = col.align || 'left';
    const textX = align === 'center' ? x + col.w / 2 : x + cellPad;
    lines.forEach((line, li) => {
      doc.text(line, textX, y + cellPad + lineH * li + lineH * 0.7, { align });
    });

    x += col.w;
  });

  return y + rowH;
}

function generarExcel(pendientes, agrupacion) {
  const estadoLabelsLocal = {
    pendiente: 'Pendiente', asignado: 'Asignado',
    en_progreso: 'En progreso', resuelto: 'Resuelto', cancelado: 'Cancelado',
  };

  const rows = pendientes.map(p => ({
    'N° SAP':          p.numero_sap || '',
    'Inspector':       p.inspector || '',
    'Jefe de Sitio':   p.jefe_sitio || '',
    'Establecimiento': p.establecimiento || '',
    'Tareas':          p.descripcion || '',
    'Ubicación':       p.sitio || '',
    'Clase Orden':     p.clase_orden || '',
    'Estado':          estadoLabelsLocal[p.estado] || p.estado || '',
    'Comuna':          p.comuna || '',
    'F. Inicio':       p.fecha_emision_sap ? format(new Date(p.fecha_emision_sap), 'dd/MM/yyyy') : '',
    'F. Límite':       p.fecha_limite ? format(new Date(p.fecha_limite), 'dd/MM/yyyy') : '',
    'Vencido':         p.fecha_limite && isPast(new Date(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado' ? 'Sí' : 'No',
    'Prioridad':       p.prioridad || '',
    'N° SAP Desaprobado': p.numero_sap_desaprobado || '',
  }));

  const wb = XLSX.utils.book_new();

  if (agrupacion === 'sin_agrupar') {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [10, 20, 22, 28, 50, 28, 14, 14, 10, 14, 14, 10, 10, 18].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Pendientes');
  } else {
    const grupos = {};
    pendientes.forEach((p, i) => {
      const key = agrupacion === 'comuna' ? (p.comuna || 'Sin comuna') : (p.jefe_sitio || 'Sin asignar');
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(rows[i]);
    });

    Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, items]) => {
      const sheetName = key.replace(/[:\\/?*\[\]]/g, '_').substring(0, 31);
      const ws = XLSX.utils.json_to_sheet(items);
      ws['!cols'] = [10, 20, 22, 28, 50, 28, 14, 14, 10, 14, 14, 10, 10, 18].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  const slug = agrupacion === 'comuna' ? 'por-comuna' : agrupacion === 'jefe_sitio' ? 'por-jefe' : 'completo';
  XLSX.writeFile(wb, `pendientes-sap-${slug}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export default function ExportarPendientesPDF({ pendientes, filterInfo }) {
  const [open, setOpen] = useState(false);
  const [agrupacion, setAgrupacion] = useState('comuna');
  const [generando, setGenerando] = useState(false);

  const generarPDF = async () => {
    setGenerando(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginL = 10;
      const marginR = 10;
      const fechaHoy = format(new Date(), 'dd/MM/yyyy HH:mm');

      // Determine columns: swap jefe_sitio / comuna depending on grouping
      const cols = COLS.map(c => {
        if (agrupacion === 'jefe_sitio' && c.key === 'jefe_sitio') return { ...c, header: 'Comuna', key: 'comuna_val' };
        return c;
      });

      // Group
      const grupos = {};
      pendientes.forEach(p => {
        const key = agrupacion === 'comuna'
          ? (p.comuna || 'Sin comuna')
          : (p.jefe_sitio || 'Sin asignar');
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(p);
      });
      const gruposOrdenados = Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));

      let isFirstPage = true;

      for (const [grupoKey, items] of gruposOrdenados) {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        // ── PAGE HEADER ──
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageW, 20, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE DE ÓRDENES PENDIENTES SAP', marginL, 9);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Generado: ${fechaHoy}`, marginL, 15);
        doc.text(`${pendientes.length} órdenes exportadas${filterInfo ? '  |  Filtros: ' + filterInfo : ''}`, pageW / 2, 15, { align: 'center' });

        // ── GROUP HEADER ──
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 21, pageW, 11, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        const groupLabel = agrupacion === 'comuna' ? `COMUNA: ${grupoKey}` : `JEFE DE SITIO: ${grupoKey}`;
        doc.text(groupLabel, marginL, 28);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`${items.length} orden${items.length !== 1 ? 'es' : ''}`, pageW - marginR, 28, { align: 'right' });

        // ── STATS BAR ──
        const statsData = [
          { label: 'Sin asignar', count: items.filter(i => i.estado === 'pendiente').length, fill: [253, 224, 71], text: [133, 77, 14] },
          { label: 'Asignado',    count: items.filter(i => i.estado === 'asignado').length,    fill: [96,  165, 250], text: [29,  78, 216] },
          { label: 'En progreso', count: items.filter(i => i.estado === 'en_progreso').length, fill: [167, 139, 250], text: [109, 40, 217] },
          { label: 'Resuelto',    count: items.filter(i => i.estado === 'resuelto').length,    fill: [52,  211, 153], text: [6,  95,  70] },
          { label: 'Vencidos',    count: items.filter(i => i.fecha_limite && isPast(new Date(i.fecha_limite)) && i.estado !== 'resuelto' && i.estado !== 'cancelado').length, fill: [252, 165, 165], text: [185, 28, 28] },
        ];

        const sbY = 34;
        const sbH = 10;
        const sbW = (pageW - marginL - marginR) / statsData.length;
        statsData.forEach((s, idx) => {
          const sx = marginL + idx * sbW;
          doc.setFillColor(...s.fill);
          doc.roundedRect(sx, sbY, sbW - 1, sbH, 1.5, 1.5, 'F');
          doc.setTextColor(...s.text);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(String(s.count), sx + sbW / 2, sbY + 6, { align: 'center' });
          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'normal');
          doc.text(s.label.toUpperCase(), sx + sbW / 2, sbY + 9.2, { align: 'center' });
        });

        // ── TABLE ──
        let y = sbY + sbH + 4;
        const startX = marginL;

        const drawHeader = () => {
          y = drawTableHeader(doc, startX, y, cols);
        };
        drawHeader();

        items.forEach((p, idx) => {
          const isVencido = p.fecha_limite && isPast(new Date(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado';
          const row = {
            numero_sap:      p.numero_sap || '—',
            inspector:       p.inspector || '—',
            jefe_sitio:      p.jefe_sitio || 'Sin asignar',
            comuna_val:      p.comuna || '—',
            establecimiento: p.establecimiento || '—',
            descripcion:     p.descripcion || '—',
            sitio:           p.sitio || '—',
            fecha_inicio:    p.fecha_emision_sap ? format(new Date(p.fecha_emision_sap), 'dd/MM/yy') : '—',
            fecha_limite:    p.fecha_limite ? format(new Date(p.fecha_limite), 'dd/MM/yy') + (isVencido ? ' ⚠' : '') : '—',
            clase_orden:     p.clase_orden || '—',
            estado:          estadoLabels[p.estado] || p.estado,
            _estado:         p.estado,
          };

          // Estimate row height to check page break
          doc.setFontSize(6.5);
          let maxLines = 1;
          cols.forEach(col => {
            const lines = wrapText(doc, row[col.key], col.w);
            if (lines.length > maxLines) maxLines = lines.length;
          });
          const estimatedH = Math.max(7, maxLines * 3.5 + 5);

          if (y + estimatedH > pageH - 14) {
            doc.addPage();
            // Re-draw page header
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageW, 14, 'F');
            doc.setTextColor(148, 163, 184);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(`${groupLabel} (continuación)`, marginL, 9);
            y = 16;
            drawHeader();
          }

          y = drawRow(doc, startX, y, row, cols, idx % 2 === 1, isVencido);
        });

        // ── PAGE FOOTER ──
        doc.setFillColor(15, 23, 42);
        doc.rect(0, pageH - 10, pageW, 10, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento generado automáticamente — Uso interno / Gestión de Contratistas', marginL, pageH - 4);
        doc.text(`Pág. ${doc.internal.getCurrentPageInfo().pageNumber}`, pageW - marginR, pageH - 4, { align: 'right' });
      }

      const slug = agrupacion === 'comuna' ? 'por-comuna' : 'por-jefe';
      doc.save(`pendientes-sap-${slug}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      setOpen(false);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileDown className="h-4 w-4" /> Exportar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" /> Exportar Pendientes
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground">
              Se exportarán{' '}
              <span className="font-semibold text-foreground">{pendientes.length}</span>{' '}
              órdenes con los filtros actuales.
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Organizar reporte por</Label>
              <Select value={agrupacion} onValueChange={setAgrupacion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comuna">Comuna</SelectItem>
                  <SelectItem value="jefe_sitio">Jefe de Sitio</SelectItem>
                  <SelectItem value="sin_agrupar">Sin agrupar (una hoja)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={() => { generarExcel(pendientes, agrupacion); setOpen(false); }}
                disabled={pendientes.length === 0}
                className="flex-1 gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button
                onClick={generarPDF}
                disabled={generando || pendientes.length === 0}
                className="flex-1 gap-2"
              >
                {generando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
                  : <><FileDown className="h-4 w-4" /> PDF</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}