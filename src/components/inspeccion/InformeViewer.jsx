import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Download, Copy, CheckCircle2, Loader2 } from 'lucide-react';
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
      const M = 15;
      const C = W - M * 2;
      const pageH = 297;
      const footerH = 12;
      const safeBottom = pageH - footerH - 4;
      let y = 0;
      let pageNum = 1;

      const fechaStr = fecha || new Date().toLocaleDateString('es-AR');
      const estabStr = establecimiento || 'Establecimiento';

      const drawHeader = () => {
        doc.setFillColor(10, 30, 70);
        doc.rect(0, 0, W, 26, 'F');
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 4, 26, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('INFORME TÉCNICO DE INSPECCIÓN', M, 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(160, 200, 255);
        const estabTrunc = doc.splitTextToSize(estabStr.toUpperCase(), C - 30)[0];
        doc.text(estabTrunc, M, 20);
        doc.text(`Fecha: ${fechaStr}`, W - M, 20, { align: 'right' });
      };

      const drawFooter = (pn, total) => {
        doc.setFillColor(235, 240, 252);
        doc.rect(0, pageH - footerH, W, footerH, 'F');
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.4);
        doc.line(0, pageH - footerH, W, pageH - footerH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(60, 80, 130);
        doc.text('Mejores Hospitales S.A. · Sistema de Gestión de Inspecciones', M, pageH - 4);
        doc.text(`Pág. ${pn} / ${total}`, W - M, pageH - 4, { align: 'right' });
      };

      const addPage = () => {
        doc.addPage();
        pageNum++;
        drawHeader();
        y = 34;
      };

      drawHeader();
      y = 32;

      // Info box
      doc.setFillColor(230, 240, 255);
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, C, 14, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(10, 30, 70);
      doc.text('Establecimiento:', M + 3, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(estabStr, M + 35, y + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha:', M + 3, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.text(fechaStr, M + 16, y + 11);
      y += 19;

      const lines = informe.split('\n');
      let inTable = false;
      let tableRows = [];

      const flushTable = () => {
        if (!tableRows.length) return;
        const validRows = tableRows.filter(r => !r.startsWith('|---') && !r.startsWith('|:--') && !r.startsWith('| ---') && !r.startsWith('| :--'));
        if (validRows.length < 2) { tableRows = []; inTable = false; return; }

        const parseCells = (row) =>
          row.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);

        const headers = parseCells(validRows[0]);
        const dataRows = validRows.slice(1);
        const colW = C / Math.max(headers.length, 1);

        // Calcular altura real de cada fila
        const rowHeights = dataRows.map(row => {
          const cells = parseCells(row);
          const maxLines = Math.max(...cells.map(cell => doc.splitTextToSize(cell, colW - 4).length), 1);
          return Math.max(7, maxLines * 4.5 + 3);
        });
        const tableH = 8 + rowHeights.reduce((a, b) => a + b, 0);
        if (y + tableH > safeBottom) addPage();

        // Header tabla
        doc.setFillColor(10, 30, 70);
        doc.rect(M, y, C, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        headers.forEach((h, i) => doc.text(h, M + i * colW + 2, y + 5.5));
        y += 8;

        dataRows.forEach((row, ri) => {
          const cells = parseCells(row);
          const rh = rowHeights[ri];
          if (y + rh > safeBottom) addPage();
          doc.setFillColor(ri % 2 === 0 ? 248 : 238, ri % 2 === 0 ? 251 : 245, ri % 2 === 0 ? 255 : 255);
          doc.rect(M, y, C, rh, 'F');
          doc.setDrawColor(200, 215, 245);
          doc.setLineWidth(0.1);
          doc.line(M, y + rh, M + C, y + rh);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(20, 30, 60);
          cells.forEach((cell, i) => {
            const wrapped = doc.splitTextToSize(cell, colW - 4);
            doc.text(wrapped, M + i * colW + 2, y + 4.5);
          });
          y += rh;
        });

        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.3);
        const tStart = y - rowHeights.reduce((a, b) => a + b, 0) - 8;
        doc.rect(M, tStart, C, y - tStart, 'S');
        y += 4;
        tableRows = [];
        inTable = false;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim().startsWith('|')) {
          inTable = true;
          tableRows.push(line.trim());
          if (!lines[i + 1]?.trim().startsWith('|')) flushTable();
          continue;
        }
        if (inTable) flushTable();

        const h1 = line.match(/^# (.+)/);
        const h2 = line.match(/^## (.+)/);
        const h3 = line.match(/^### (.+)/);

        if (h1) {
          if (y + 14 > safeBottom) addPage();
          y += 5;
          doc.setFillColor(10, 30, 70);
          doc.rect(M, y, C, 10, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(255, 255, 255);
          const wrapped = doc.splitTextToSize(h1[1], C - 6);
          doc.text(wrapped[0], M + 3, y + 7);
          y += 14;
          continue;
        }

        if (h2) {
          if (y + 13 > safeBottom) addPage();
          y += 5;
          doc.setFillColor(37, 99, 235);
          doc.rect(M, y, 3, 9, 'F');
          doc.setFillColor(225, 235, 255);
          doc.rect(M + 3, y, C - 3, 9, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(10, 30, 70);
          const wrapped = doc.splitTextToSize(h2[1], C - 10);
          doc.text(wrapped[0], M + 6, y + 6.5);
          y += 13;
          continue;
        }

        if (h3) {
          if (y + 9 > safeBottom) addPage();
          y += 3;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(37, 99, 235);
          const wrapped = doc.splitTextToSize(h3[1], C);
          doc.text(wrapped[0], M, y + 5);
          y += 8;
          continue;
        }

        const listMatch = line.match(/^[-*•] (.+)/);
        if (listMatch) {
          const txt = listMatch[1].replace(/\*\*(.+?)\*\*/g, '$1');
          const wrappedLines = doc.splitTextToSize(txt, C - 7);
          const blockH = wrappedLines.length * 5 + 2;
          if (y + blockH > safeBottom) addPage();
          doc.setFillColor(37, 99, 235);
          doc.circle(M + 2, y + 3.5, 1, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(20, 30, 60);
          doc.text(wrappedLines, M + 5, y + 4.5);
          y += blockH + 1;
          continue;
        }

        if (line.trim() === '') { y += 2; continue; }

        const cleanLine = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/━/g, '');
        if (!cleanLine.trim()) continue;
        const wrappedLines = doc.splitTextToSize(cleanLine, C);
        const blockH = wrappedLines.length * 5 + 1;
        if (y + blockH > safeBottom) addPage();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 40, 65);
        doc.text(wrappedLines, M, y + 4);
        y += blockH + 2;
      }

      if (inTable) flushTable();

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

  const md = {
    h1: ({ children }) => (
      <div className="bg-blue-950 text-white rounded-lg px-4 py-3 mt-6 mb-3 first:mt-0">
        <h1 className="text-sm font-bold tracking-wide m-0 leading-snug">{children}</h1>
      </div>
    ),
    h2: ({ children }) => (
      <div className="flex items-stretch mt-5 mb-3">
        <div className="w-1.5 bg-blue-600 rounded-l shrink-0" />
        <div className="bg-blue-700 border border-blue-600 border-l-0 rounded-r px-4 py-2 flex-1">
          <h2 className="text-sm font-bold text-white m-0 leading-snug">{children}</h2>
        </div>
      </div>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-bold text-blue-300 mt-4 mb-2 border-b border-blue-800 pb-1 leading-snug">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-sm text-slate-100 leading-relaxed my-2">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-2 space-y-1.5 pl-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 space-y-1.5 pl-4 list-decimal text-sm text-slate-100">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="flex items-start gap-2 text-sm text-slate-100 leading-relaxed">
        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
        <span>{children}</span>
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-white">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-blue-200">{children}</em>
    ),
    hr: () => (
      <hr className="border-blue-700 my-4" />
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-blue-700 shadow">
        <table className="w-full text-xs border-collapse min-w-[500px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-blue-950 text-white">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2.5 text-left font-bold text-xs tracking-wide border-r border-blue-800 last:border-r-0 whitespace-nowrap">{children}</th>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-blue-800">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="even:bg-blue-900/40 hover:bg-blue-800/50 transition-colors">{children}</tr>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-slate-200 border-r border-blue-800/50 last:border-r-0 align-top">{children}</td>
    ),
    code: ({ children }) => (
      <code className="bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 bg-blue-900/40 pl-4 py-2 my-3 rounded-r text-slate-200 text-sm italic">{children}</blockquote>
    ),
  };

  return (
    <div className="space-y-3">
      {/* Barra de acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span className="font-semibold text-sm text-foreground">Informe generado</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs">
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadPDF}
            disabled={exportando}
            className="gap-1.5 text-xs bg-blue-700 hover:bg-blue-800 text-white border-0"
          >
            {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exportando ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      {/* Visor del informe — fondo oscuro para máxima legibilidad en móvil */}
      <div className="rounded-xl border border-blue-800 bg-blue-950 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-950 border-b border-blue-800 px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">INFORME TÉCNICO DE INSPECCIÓN</p>
            <p className="text-blue-300 text-xs mt-0.5 truncate">{establecimiento}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-blue-400 text-[10px] uppercase tracking-wide">Fecha</p>
            <p className="text-white text-xs font-semibold">{fecha}</p>
          </div>
        </div>

        {/* Contenido markdown */}
        <div className="px-4 py-4 overflow-y-auto" style={{ maxHeight: 'min(70vh, 600px)' }}>
          <ReactMarkdown components={md}>{informe}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}