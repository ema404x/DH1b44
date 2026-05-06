import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Download, Copy, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function InformeViewer({ informe, establecimiento, fecha }) {
  const [exportando, setExportando] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(informe);
    toast.success('Informe copiado al portapapeles');
  };

  const handleDownloadPDF = async () => {
    setExportando(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210;
      const M = 18;
      const C = W - M * 2;
      const pageH = 297;
      const footerH = 14;
      const safeBottom = pageH - footerH - 6;
      let y = 0;
      let pageNum = 1;

      const fechaStr = fecha || new Date().toLocaleDateString('es-AR');
      const estabStr = establecimiento || 'Establecimiento';

      const drawHeader = () => {
        // Franja azul oscura
        doc.setFillColor(15, 40, 80);
        doc.rect(0, 0, W, 28, 'F');
        // Acento lateral izquierdo
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 5, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('INFORME TÉCNICO DE INSPECCIÓN', M + 2, 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 210, 255);
        doc.text(estabStr.toUpperCase(), M + 2, 20);
        doc.text(`Fecha: ${fechaStr}`, W - M, 20, { align: 'right' });
      };

      const drawFooter = (pn, total) => {
        doc.setFillColor(240, 244, 252);
        doc.rect(0, pageH - footerH, W, footerH, 'F');
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.5);
        doc.line(0, pageH - footerH, W, pageH - footerH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(80, 100, 140);
        doc.text('Mejores Hospitales S.A. · Sistema de Gestión de Inspecciones', M, pageH - 5);
        doc.text(`Pág. ${pn} / ${total}`, W - M, pageH - 5, { align: 'right' });
      };

      const addPage = () => {
        doc.addPage();
        pageNum++;
        drawHeader();
        y = 36;
      };

      drawHeader();
      y = 36;

      // Caja de datos del establecimiento
      doc.setFillColor(237, 244, 255);
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, y, C, 16, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 40, 80);
      doc.text('Establecimiento:', M + 4, y + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(estabStr, M + 38, y + 6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha de inspección:', M + 4, y + 12.5);
      doc.setFont('helvetica', 'normal');
      doc.text(fechaStr, M + 42, y + 12.5);
      y += 22;

      // Parsear el markdown y renderizar secciones
      const lines = informe.split('\n');

      const HEADING_COLORS = {
        1: [15, 40, 80],
        2: [30, 64, 175],
        3: [59, 130, 246],
      };

      let inTable = false;
      let tableRows = [];

      const flushTable = () => {
        if (!tableRows.length) return;

        const validRows = tableRows.filter(r => !r.startsWith('|---') && !r.startsWith('|:--'));
        if (validRows.length < 2) { tableRows = []; inTable = false; return; }

        const headerRow = validRows[0];
        const dataRows = validRows.slice(1);

        const parseCells = (row) =>
          row.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);

        const headers = parseCells(headerRow);
        const colW = C / headers.length;

        // Verificar espacio
        const tableH = 8 + dataRows.length * 8;
        if (y + tableH > safeBottom) addPage();

        // Encabezado tabla
        doc.setFillColor(15, 40, 80);
        doc.rect(M, y, C, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        headers.forEach((h, i) => doc.text(h, M + i * colW + 2, y + 5.5));
        y += 8;

        dataRows.forEach((row, ri) => {
          const cells = parseCells(row);
          const rowH = 7;
          if (y + rowH > safeBottom) addPage();
          doc.setFillColor(ri % 2 === 0 ? 247 : 237, ri % 2 === 0 ? 250 : 244, ri % 2 === 0 ? 255 : 255);
          doc.rect(M, y, C, rowH, 'F');
          doc.setDrawColor(200, 215, 240);
          doc.setLineWidth(0.15);
          doc.line(M, y + rowH, M + C, y + rowH);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(30, 40, 70);
          cells.forEach((cell, i) => {
            const cellText = doc.splitTextToSize(cell, colW - 3);
            doc.text(cellText, M + i * colW + 2, y + 4.5);
          });
          y += rowH;
        });

        // Borde de la tabla
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.4);
        doc.rect(M, y - (dataRows.length * 7 + 8), C, dataRows.length * 7 + 8, 'S');

        y += 5;
        tableRows = [];
        inTable = false;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detectar tabla
        if (line.trim().startsWith('|')) {
          if (!inTable) inTable = true;
          tableRows.push(line.trim());
          // Si siguiente línea no es tabla, flush
          if (!lines[i + 1]?.trim().startsWith('|')) {
            flushTable();
          }
          continue;
        }

        if (inTable) flushTable();

        // Headings
        const h1 = line.match(/^# (.+)/);
        const h2 = line.match(/^## (.+)/);
        const h3 = line.match(/^### (.+)/);

        if (h1) {
          if (y + 16 > safeBottom) addPage();
          y += 4;
          doc.setFillColor(...HEADING_COLORS[1]);
          doc.rect(M, y, C, 11, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(255, 255, 255);
          doc.text(h1[1], M + 4, y + 7.5);
          y += 15;
          continue;
        }

        if (h2) {
          if (y + 14 > safeBottom) addPage();
          y += 5;
          // Línea lateral azul
          doc.setFillColor(37, 99, 235);
          doc.rect(M, y, 3, 10, 'F');
          doc.setFillColor(237, 244, 255);
          doc.rect(M + 3, y, C - 3, 10, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(15, 40, 80);
          doc.text(h2[1], M + 7, y + 7);
          y += 14;
          continue;
        }

        if (h3) {
          if (y + 10 > safeBottom) addPage();
          y += 3;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 64, 175);
          doc.text(h3[1], M, y + 5);
          y += 9;
          continue;
        }

        // Listas
        const listMatch = line.match(/^[-*] (.+)/);
        if (listMatch) {
          const txt = listMatch[1].replace(/\*\*(.+?)\*\*/g, '$1');
          const wrappedLines = doc.splitTextToSize(txt, C - 8);
          const blockH = wrappedLines.length * 5 + 2;
          if (y + blockH > safeBottom) addPage();
          doc.setFillColor(37, 99, 235);
          doc.circle(M + 2.5, y + 3, 1, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(30, 40, 70);
          doc.text(wrappedLines, M + 6, y + 4.5);
          y += blockH + 1;
          continue;
        }

        // Línea en blanco
        if (line.trim() === '') {
          y += 2;
          continue;
        }

        // Texto normal
        const cleanLine = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
        const wrappedLines = doc.splitTextToSize(cleanLine, C);
        const blockH = wrappedLines.length * 5 + 1;
        if (y + blockH > safeBottom) addPage();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(40, 50, 70);
        doc.text(wrappedLines, M, y + 4);
        y += blockH + 2;
      }

      // Footers
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawFooter(p, totalPages);
      }

      const nombre = `Informe_Inspeccion_${estabStr.replace(/\s+/g, '_')}_${fechaStr.replace(/\//g, '-')}.pdf`;
      doc.save(nombre);
      toast.success('PDF descargado correctamente');
    } catch (e) {
      toast.error('Error al generar PDF: ' + e.message);
    } finally {
      setExportando(false);
    }
  };

  // Componentes Markdown con estilos mejorados para la vista
  const components = {
    h1: ({ children }) => (
      <div className="bg-blue-900 text-white rounded-lg px-5 py-3 mt-6 mb-4 first:mt-0">
        <h1 className="text-base font-bold tracking-wide m-0">{children}</h1>
      </div>
    ),
    h2: ({ children }) => (
      <div className="flex items-stretch mt-5 mb-3">
        <div className="w-1 bg-blue-600 rounded-l shrink-0" />
        <div className="bg-blue-50 border border-blue-200 border-l-0 rounded-r px-4 py-2 flex-1">
          <h2 className="text-sm font-bold text-blue-900 m-0">{children}</h2>
        </div>
      </div>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold text-blue-700 mt-4 mb-2 border-b border-blue-100 pb-1">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-sm text-slate-800 leading-relaxed my-2">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-2 space-y-1 pl-2">{children}</ul>
    ),
    li: ({ children }) => (
      <li className="flex items-start gap-2 text-sm text-slate-800">
        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
        <span>{children}</span>
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-slate-900">{children}</strong>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-blue-200 shadow-sm">
        <table className="w-full text-xs border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-blue-900 text-white">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2.5 text-left font-semibold text-xs tracking-wide border-r border-blue-700 last:border-r-0">{children}</th>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-blue-100">{children}</tbody>
    ),
    tr: ({ children, ...props }) => (
      <tr className="even:bg-blue-50 hover:bg-blue-100/60 transition-colors">{children}</tr>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-slate-800 border-r border-blue-100 last:border-r-0">{children}</td>
    ),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <h3 className="font-semibold text-sm">Informe generado</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={exportando} className="gap-1.5 bg-blue-700 hover:bg-blue-800 text-white">
            <Download className="h-3.5 w-3.5" />
            {exportando ? 'Generando PDF...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-y-auto max-h-[650px]">
        {/* Header decorativo */}
        <div className="bg-blue-900 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm">INFORME TÉCNICO DE INSPECCIÓN</h2>
            <p className="text-blue-300 text-xs mt-0.5">{establecimiento}</p>
          </div>
          <div className="text-right">
            <p className="text-blue-300 text-xs">Fecha</p>
            <p className="text-white text-xs font-semibold">{fecha}</p>
          </div>
        </div>

        <div className="px-6 py-4 prose-none">
          <ReactMarkdown components={components}>{informe}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}