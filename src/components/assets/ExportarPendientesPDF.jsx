import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const estadoLabels = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

const estadoColors = {
  pendiente: [255, 193, 7],
  asignado: [13, 110, 253],
  en_progreso: [111, 66, 193],
  resuelto: [25, 135, 84],
  cancelado: [108, 117, 125],
};

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
      const fechaHoy = format(new Date(), 'dd/MM/yyyy');
      const horaHoy = format(new Date(), 'HH:mm');

      // Agrupar pendientes
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

        // ── HEADER ──
        // Franja superior azul oscuro
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageW, 22, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE DE ÓRDENES PENDIENTES SAP', 14, 10);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Generado: ${fechaHoy} ${horaHoy}`, 14, 16);
        doc.text(`Total: ${pendientes.length} órdenes filtradas`, pageW / 2, 16, { align: 'center' });

        // Filtros activos
        const filtrosTexto = filterInfo ? filterInfo : '';
        if (filtrosTexto) {
          doc.text(`Filtros: ${filtrosTexto}`, pageW - 14, 16, { align: 'right' });
        }

        // ── SUBHEADER de grupo ──
        const groupY = 28;
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 24, pageW, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');

        const groupLabel = agrupacion === 'comuna'
          ? `COMUNA: ${grupoKey}`
          : `JEFE DE SITIO: ${grupoKey}`;
        doc.text(groupLabel, 14, groupY);

        // Contador del grupo
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`${items.length} orden${items.length !== 1 ? 'es' : ''}`, pageW - 14, groupY, { align: 'right' });

        // ── ESTADÍSTICAS rápidas del grupo ──
        const statsY = 40;
        const statItems = [
          { label: 'Pendiente', count: items.filter(i => i.estado === 'pendiente').length, color: [234, 179, 8] },
          { label: 'Asignado', count: items.filter(i => i.estado === 'asignado').length, color: [59, 130, 246] },
          { label: 'En progreso', count: items.filter(i => i.estado === 'en_progreso').length, color: [139, 92, 246] },
          { label: 'Resuelto', count: items.filter(i => i.estado === 'resuelto').length, color: [34, 197, 94] },
          { label: 'Vencidos', count: items.filter(i => i.fecha_limite && isPast(new Date(i.fecha_limite)) && i.estado !== 'resuelto' && i.estado !== 'cancelado').length, color: [239, 68, 68] },
        ];

        const boxW = 36;
        const boxH = 14;
        const boxGap = 4;
        const totalBoxW = statItems.length * boxW + (statItems.length - 1) * boxGap;
        let boxX = (pageW - totalBoxW) / 2;

        statItems.forEach(s => {
          doc.setFillColor(...s.color);
          doc.roundedRect(boxX, statsY, boxW, boxH, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(String(s.count), boxX + boxW / 2, statsY + 8, { align: 'center' });
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.text(s.label.toUpperCase(), boxX + boxW / 2, statsY + 12.5, { align: 'center' });
          boxX += boxW + boxGap;
        });

        // ── TABLA ──
        const tableY = statsY + boxH + 6;

        const columns = [
          { header: 'N° SAP', dataKey: 'numero_sap' },
          { header: 'Inspector', dataKey: 'inspector' },
          { header: agrupacion === 'comuna' ? 'Jefe Sitio' : 'Comuna', dataKey: agrupacion === 'comuna' ? 'jefe_sitio' : 'comuna' },
          { header: 'Establecimiento', dataKey: 'establecimiento' },
          { header: 'Tareas a Realizar', dataKey: 'descripcion' },
          { header: 'Ubicación', dataKey: 'sitio' },
          { header: 'F. Inicio', dataKey: 'fecha_inicio' },
          { header: 'F. Límite', dataKey: 'fecha_limite_fmt' },
          { header: 'Clase', dataKey: 'clase_orden' },
          { header: 'Estado', dataKey: 'estado_label' },
        ];

        const rows = items.map(p => {
          const isVencido = p.fecha_limite && isPast(new Date(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado';
          return {
            numero_sap: p.numero_sap || '—',
            inspector: p.inspector || '—',
            jefe_sitio: p.jefe_sitio || 'Sin asignar',
            comuna: p.comuna || '—',
            establecimiento: p.establecimiento || '—',
            descripcion: p.descripcion || '—',
            sitio: p.sitio || '—',
            fecha_inicio: p.fecha_emision_sap ? format(new Date(p.fecha_emision_sap), 'dd/MM/yy') : '—',
            fecha_limite_fmt: p.fecha_limite ? format(new Date(p.fecha_limite), 'dd/MM/yy') + (isVencido ? ' ⚠' : '') : '—',
            clase_orden: p.clase_orden || '—',
            estado_label: estadoLabels[p.estado] || p.estado,
            _estado: p.estado,
            _vencido: isVencido,
          };
        });

        doc.autoTable({
          startY: tableY,
          columns,
          body: rows,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
          },
          bodyStyles: {
            fontSize: 7,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            textColor: [30, 41, 59],
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            numero_sap: { cellWidth: 22, font: 'courier', fontStyle: 'bold' },
            inspector: { cellWidth: 28 },
            jefe_sitio: { cellWidth: 28 },
            comuna: { cellWidth: 18 },
            establecimiento: { cellWidth: 30 },
            descripcion: { cellWidth: 60, overflow: 'linebreak' },
            sitio: { cellWidth: 35 },
            fecha_inicio: { cellWidth: 18, halign: 'center' },
            fecha_limite_fmt: { cellWidth: 20, halign: 'center' },
            clase_orden: { cellWidth: 14, halign: 'center' },
            estado_label: { cellWidth: 22, halign: 'center' },
          },
          didParseCell(data) {
            if (data.section === 'body') {
              const row = rows[data.row.index];
              // Resaltar vencidos
              if (row?._vencido && data.column.dataKey === 'fecha_limite_fmt') {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
              }
              // Color de estado
              if (data.column.dataKey === 'estado_label' && row?._estado) {
                const col = estadoColors[row._estado];
                if (col) {
                  data.cell.styles.fillColor = col.map(c => Math.min(255, c + 180));
                  data.cell.styles.textColor = col;
                  data.cell.styles.fontStyle = 'bold';
                }
              }
              // Sin asignar en rojo suave
              if ((data.column.dataKey === 'jefe_sitio') && data.cell.text[0] === 'Sin asignar') {
                data.cell.styles.textColor = [202, 138, 4];
                data.cell.styles.fontStyle = 'italic';
              }
            }
          },
          margin: { left: 14, right: 14 },
          tableWidth: 'wrap',
        });

        // ── FOOTER ──
        const footerY = pageH - 8;
        doc.setFillColor(15, 23, 42);
        doc.rect(0, pageH - 12, pageW, 12, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento generado automáticamente — Uso interno / Gestión de Contratistas', 14, footerY);
        doc.text(`Página ${doc.internal.getCurrentPageInfo().pageNumber}`, pageW - 14, footerY, { align: 'right' });
      }

      // Guardar
      const agrupLabel = agrupacion === 'comuna' ? 'por-comuna' : 'por-jefe';
      doc.save(`pendientes-sap-${agrupLabel}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <FileDown className="h-4 w-4" /> Exportar PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" /> Exportar a PDF
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground">
              Se exportarán <span className="font-semibold text-foreground">{pendientes.length}</span> órdenes con los filtros actuales.
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Organizar por</Label>
              <Select value={agrupacion} onValueChange={setAgrupacion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comuna">Comuna</SelectItem>
                  <SelectItem value="jefe_sitio">Jefe de Sitio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>El reporte incluye:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Una sección por cada {agrupacion === 'comuna' ? 'comuna' : 'jefe de sitio'}</li>
                <li>Resumen de estados por sección</li>
                <li>Tabla completa con N° SAP, inspector, establecimiento, fechas y estado</li>
                <li>Órdenes vencidas marcadas en rojo</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={generarPDF} disabled={generando || pendientes.length === 0} className="flex-1 gap-2">
                {generando ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</> : <><FileDown className="h-4 w-4" /> Generar PDF</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}