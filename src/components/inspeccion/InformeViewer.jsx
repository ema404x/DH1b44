import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Download, Copy, CheckCircle2, Loader2, FileText, Camera, X, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function InformeViewer({ informe, establecimiento, fecha, secciones = [] }) {
  const [exportando, setExportando] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(informe);
    toast.success('Informe copiado al portapapeles');
  };

  const handleDownloadPDF = async () => {
    setExportando(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210;
      const M = 14;
      const C = W - M * 2;
      const pageH = 297;
      const footerH = 11;
      const safeBottom = pageH - footerH - 5;
      let y = 0;
      let pageNum = 1;

      const fechaStr = fecha || new Date().toLocaleDateString('es-AR');
      const estabStr = establecimiento || 'Establecimiento';
      const totalFotos = secciones.reduce((acc, s) => acc + (s.fotos?.length || 0), 0);

      // ── Header ──────────────────────────────────────────────────────────────
      const drawHeader = () => {
        // Barra azul oscura
        doc.setFillColor(15, 35, 80);
        doc.rect(0, 0, W, 28, 'F');
        // Acento izquierdo
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 5, 28, 'F');
        // Logo / título
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('INFORME TÉCNICO DE INSPECCIÓN EDILICIA', M + 2, 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 190, 255);
        const trunc = doc.splitTextToSize(estabStr.toUpperCase(), C - 40)[0];
        doc.text(trunc, M + 2, 19);
        doc.text(`Fecha: ${fechaStr}`, W - M, 19, { align: 'right' });
        // Línea separadora
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.3);
        doc.line(0, 28, W, 28);
      };

      // ── Footer ──────────────────────────────────────────────────────────────
      const drawFooter = (pn, total) => {
        doc.setFillColor(240, 244, 255);
        doc.rect(0, pageH - footerH, W, footerH, 'F');
        doc.setDrawColor(200, 215, 250);
        doc.setLineWidth(0.3);
        doc.line(0, pageH - footerH, W, pageH - footerH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(80, 100, 150);
        doc.text('Sistema de Gestión de Inspecciones · Documento de uso interno', M, pageH - 3.5);
        doc.text(`Página ${pn} de ${total}`, W - M, pageH - 3.5, { align: 'right' });
      };

      const addPage = () => {
        doc.addPage();
        pageNum++;
        drawHeader();
        y = 35;
      };

      const checkY = (needed) => { if (y + needed > safeBottom) addPage(); };

      drawHeader();
      y = 34;

      // ── Info box inicial ─────────────────────────────────────────────────────
      doc.setFillColor(232, 240, 255);
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.4);
      doc.roundedRect(M, y, C, 18, 2, 2, 'FD');
      // Acento izquierdo del box
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(M, y, 3, 18, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 35, 80);
      doc.text('Establecimiento:', M + 6, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.text(estabStr, M + 36, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.text('Fecha:', M + 6, y + 12.5);
      doc.setFont('helvetica', 'normal');
      doc.text(fechaStr, M + 20, y + 12.5);
      if (totalFotos > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Fotografías:', M + 100, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(`${totalFotos} imágenes adjuntas`, M + 124, y + 6);
      }
      y += 23;

      // ── Procesamiento de líneas del informe ──────────────────────────────────
      const lines = informe.split('\n');
      let inTable = false;
      let tableRows = [];

      const flushTable = () => {
        if (!tableRows.length) return;
        const validRows = tableRows.filter(r =>
          !r.match(/^\|[-:\s|]+\|$/)
        );
        if (validRows.length < 2) { tableRows = []; inTable = false; return; }

        const parseCells = (row) =>
          row.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);

        const headers = parseCells(validRows[0]);
        const dataRows = validRows.slice(1);
        const colW = C / Math.max(headers.length, 1);

        // Calcular altura real de cada fila
        const rowHeights = dataRows.map(row => {
          const cells = parseCells(row);
          const maxLines = Math.max(...cells.map(cell => doc.splitTextToSize(cell.replace(/[🔴🟡🟢✅]/g, ''), colW - 4).length), 1);
          return Math.max(7, maxLines * 4.2 + 3);
        });

        const tableH = 8 + rowHeights.reduce((a, b) => a + b, 0);
        checkY(tableH + 2);
        const tStartY = y;

        // Header tabla
        doc.setFillColor(15, 35, 80);
        doc.rect(M, y, C, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(220, 235, 255);
        headers.forEach((h, i) => doc.text(h, M + i * colW + 2.5, y + 5.5));
        y += 8;

        dataRows.forEach((row, ri) => {
          const cells = parseCells(row);
          const rh = rowHeights[ri];
          checkY(rh);
          // Zebra
          doc.setFillColor(ri % 2 === 0 ? 248 : 240, ri % 2 === 0 ? 251 : 246, ri % 2 === 0 ? 255 : 255);
          doc.rect(M, y, C, rh, 'F');
          doc.setDrawColor(210, 220, 245);
          doc.setLineWidth(0.1);
          doc.line(M, y + rh, M + C, y + rh);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(20, 35, 70);
          cells.forEach((cell, i) => {
            const clean = cell.replace(/[🔴🟡🟢✅]/g, '').trim();
            const urgLabel = cell.includes('🔴') ? 'URGENTE' : cell.includes('🟡') ? 'IMPORTT.' : cell.includes('🟢') ? 'LEVE' : '';
            if (urgLabel) {
              const color = cell.includes('🔴') ? [200, 30, 30] : cell.includes('🟡') ? [180, 120, 0] : [0, 140, 80];
              doc.setTextColor(...color);
              doc.setFont('helvetica', 'bold');
              doc.text(urgLabel, M + i * colW + 2.5, y + 4.5);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(20, 35, 70);
            } else {
              const wrapped = doc.splitTextToSize(clean, colW - 4);
              doc.text(wrapped, M + i * colW + 2.5, y + 4.5);
            }
          });
          y += rh;
        });

        // Borde exterior tabla
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.4);
        doc.rect(M, tStartY, C, y - tStartY, 'S');
        y += 5;
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
          checkY(16);
          y += 4;
          // Fondo completo h1
          doc.setFillColor(15, 35, 80);
          doc.roundedRect(M, y, C, 11, 1.5, 1.5, 'F');
          doc.setFillColor(37, 99, 235);
          doc.roundedRect(M, y, 4, 11, 1.5, 1.5, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(255, 255, 255);
          const wrapped = doc.splitTextToSize(h1[1], C - 10);
          doc.text(wrapped[0], M + 7, y + 7.5);
          y += 15;
          continue;
        }

        if (h2) {
          checkY(14);
          y += 4;
          doc.setFillColor(225, 235, 255);
          doc.roundedRect(M, y, C, 9, 1, 1, 'F');
          doc.setFillColor(37, 99, 235);
          doc.roundedRect(M, y, 3.5, 9, 1, 1, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(15, 35, 80);
          const wrapped = doc.splitTextToSize(h2[1], C - 8);
          doc.text(wrapped[0], M + 6, y + 6.5);
          y += 13;
          continue;
        }

        if (h3) {
          checkY(10);
          y += 2;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(37, 99, 235);
          const wrapped = doc.splitTextToSize(h3[1], C - 2);
          doc.text(wrapped[0], M, y + 5);
          // Línea bajo h3
          doc.setDrawColor(37, 99, 235);
          doc.setLineWidth(0.2);
          doc.line(M, y + 6.5, M + C * 0.4, y + 6.5);
          y += 9;
          continue;
        }

        // Lista con guiones o asteriscos
        const listMatch = line.match(/^[-*•]\s+(.+)/);
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);

        if (listMatch) {
          const txt = listMatch[1].replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
          const wrappedLines = doc.splitTextToSize(txt, C - 8);
          const blockH = wrappedLines.length * 4.8 + 2;
          checkY(blockH);
          // Bullet punto azul
          doc.setFillColor(37, 99, 235);
          doc.circle(M + 2, y + 3.2, 1, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(25, 40, 75);
          doc.text(wrappedLines, M + 5.5, y + 4.2);
          y += blockH + 0.5;
          continue;
        }

        if (numMatch) {
          const txt = numMatch[2].replace(/\*\*(.+?)\*\*/g, '$1');
          const wrappedLines = doc.splitTextToSize(txt, C - 9);
          const blockH = wrappedLines.length * 4.8 + 2;
          checkY(blockH);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(37, 99, 235);
          doc.text(numMatch[1] + '.', M + 0.5, y + 4.2);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(25, 40, 75);
          doc.text(wrappedLines, M + 6, y + 4.2);
          y += blockH + 0.5;
          continue;
        }

        if (line.trim() === '') { y += 2.5; continue; }

        // Línea separadora ━━━
        if (line.trim().startsWith('━')) {
          checkY(5);
          doc.setDrawColor(37, 99, 235);
          doc.setLineWidth(0.2);
          doc.line(M, y + 2, M + C, y + 2);
          y += 5;
          continue;
        }

        // Texto bold (línea entera con **)
        const boldLine = line.match(/^\*\*(.+?)\*\*:?\s*(.*)/);
        if (boldLine) {
          const labelTxt = boldLine[1] + (boldLine[0].includes(':') ? ':' : '');
          const valueTxt = boldLine[2] || '';
          const combined = labelTxt + (valueTxt ? ' ' + valueTxt : '');
          const wrappedLines = doc.splitTextToSize(combined, C);
          const blockH = wrappedLines.length * 4.8 + 1;
          checkY(blockH);
          // Primera línea: label bold + valor
          const labelEnd = labelTxt.length;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(15, 35, 80);
          doc.text(wrappedLines[0], M, y + 4);
          if (wrappedLines.length > 1) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(30, 45, 80);
            doc.text(wrappedLines.slice(1), M, y + 4 + 4.8);
          }
          y += blockH + 1.5;
          continue;
        }

        // Texto normal
        const cleanLine = line
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/━/g, '');
        if (!cleanLine.trim()) continue;

        const wrappedLines = doc.splitTextToSize(cleanLine, C);
        const blockH = wrappedLines.length * 4.8 + 1;
        checkY(blockH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 45, 80);
        doc.text(wrappedLines, M, y + 4);
        y += blockH + 1.5;
      }

      if (inTable) flushTable();

      // ── Páginas de fotos ─────────────────────────────────────────────────────
      const seccionesConFotos = secciones.filter(s => s.fotos?.length > 0);
      if (seccionesConFotos.length > 0) {
        addPage();
        // Título sección fotos
        doc.setFillColor(15, 35, 80);
        doc.roundedRect(M, y, C, 11, 1.5, 1.5, 'F');
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(M, y, 4, 11, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text('REGISTRO FOTOGRÁFICO', M + 7, y + 7.5);
        y += 18;

        for (const sec of seccionesConFotos) {
          // Nombre de sección
          checkY(12);
          doc.setFillColor(225, 235, 255);
          doc.roundedRect(M, y, C, 8, 1, 1, 'F');
          doc.setFillColor(37, 99, 235);
          doc.roundedRect(M, y, 3.5, 8, 1, 1, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(15, 35, 80);
          doc.text(sec.nombre, M + 6, y + 5.5);
          y += 12;

          // Fotos en grilla 3 columnas
          const fotoW = (C - 8) / 3;
          const fotoH = fotoW * 0.75; // ratio 4:3
          let col = 0;
          let rowStartX = M;

          for (let fi = 0; fi < sec.fotos.length; fi++) {
            if (col === 3) { col = 0; y += fotoH + 8; }
            checkY(fotoH + 10);
            const fx = rowStartX + col * (fotoW + 4);

            try {
              // Intentar cargar imagen
              await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    // Borde foto
                    doc.setDrawColor(180, 200, 240);
                    doc.setLineWidth(0.3);
                    doc.roundedRect(fx, y, fotoW, fotoH, 1, 1, 'S');
                    doc.addImage(dataUrl, 'JPEG', fx + 0.5, y + 0.5, fotoW - 1, fotoH - 1);
                  } catch (_) {
                    doc.setFillColor(240, 244, 255);
                    doc.roundedRect(fx, y, fotoW, fotoH, 1, 1, 'F');
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6);
                    doc.setTextColor(120, 140, 180);
                    doc.text(`Foto ${fi + 1}`, fx + fotoW / 2, y + fotoH / 2, { align: 'center' });
                  }
                  resolve();
                };
                img.onerror = () => {
                  doc.setFillColor(240, 244, 255);
                  doc.roundedRect(fx, y, fotoW, fotoH, 1, 1, 'F');
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(6);
                  doc.setTextColor(120, 140, 180);
                  doc.text(`Foto ${fi + 1}`, fx + fotoW / 2, y + fotoH / 2, { align: 'center' });
                  resolve();
                };
                img.src = sec.fotos[fi];
                // Timeout fallback
                setTimeout(resolve, 5000);
              });
            } catch (_) { /* continuar */ }

            // Número de foto al pie
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(80, 100, 150);
            doc.text(`Foto ${fi + 1}`, fx + fotoW / 2, y + fotoH + 4, { align: 'center' });

            col++;
          }
          y += fotoH + 12;
        }
      }

      // ── Numerar páginas ──────────────────────────────────────────────────────
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

  // ── Componentes Markdown para visor en pantalla ───────────────────────────
  const md = {
    h1: ({ children }) => (
      <div className="relative flex items-center bg-gradient-to-r from-blue-950 to-blue-900 rounded-xl px-4 py-3 mt-8 mb-4 first:mt-0 shadow overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />
        <h1 className="text-sm font-bold tracking-wide text-white ml-2 leading-snug">{children}</h1>
      </div>
    ),
    h2: ({ children }) => (
      <div className="flex items-stretch mt-6 mb-3">
        <div className="w-1 bg-blue-500 rounded-l shrink-0" />
        <div className="bg-blue-900/60 border border-blue-700/60 border-l-0 rounded-r px-4 py-2 flex-1">
          <h2 className="text-sm font-bold text-blue-100 leading-snug">{children}</h2>
        </div>
      </div>
    ),
    h3: ({ children }) => (
      <div className="flex items-center gap-2 mt-4 mb-2">
        <div className="h-px flex-1 bg-blue-800/40 max-w-[20px]" />
        <h3 className="text-sm font-bold text-blue-300 leading-snug">{children}</h3>
        <div className="h-px flex-1 bg-blue-800/40" />
      </div>
    ),
    p: ({ children }) => (
      <p className="text-sm text-slate-200 leading-relaxed my-2">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-2 space-y-1 pl-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 space-y-1.5 pl-1 list-none">{children}</ol>
    ),
    li: ({ children, ...props }) => {
      const isOrdered = props['data-ordered'];
      return (
        <li className="flex items-start gap-2 text-sm text-slate-200 leading-relaxed py-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
          <span className="flex-1">{children}</span>
        </li>
      );
    },
    strong: ({ children }) => (
      <strong className="font-bold text-white">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-blue-200">{children}</em>
    ),
    hr: () => (
      <hr className="border-blue-800/50 my-4" />
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-xl border border-blue-700/60 shadow-lg">
        <table className="w-full text-xs border-collapse min-w-[520px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-blue-950 text-white">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2.5 text-left font-bold text-xs tracking-wide border-r border-blue-800/60 last:border-r-0 whitespace-nowrap text-blue-100">{children}</th>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-blue-800/30">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="even:bg-blue-900/30 hover:bg-blue-800/40 transition-colors">{children}</tr>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-slate-200 border-r border-blue-800/30 last:border-r-0 align-top leading-relaxed">{children}</td>
    ),
    code: ({ children }) => (
      <code className="bg-blue-900/60 text-blue-200 px-1.5 py-0.5 rounded text-xs font-mono border border-blue-700/40">{children}</code>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 bg-blue-900/30 pl-4 py-2.5 my-3 rounded-r-lg text-slate-200 text-sm italic">{children}</blockquote>
    ),
  };

  // Fotos agrupadas por sección para mostrar en el visor
  const seccionesConFotos = secciones.filter(s => s.fotos?.length > 0);
  const totalFotos = secciones.reduce((acc, s) => acc + (s.fotos?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Barra de acciones */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-blue-950/50 border border-blue-800/60 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="font-semibold text-sm text-white leading-tight">Informe generado</p>
            {totalFotos > 0 && (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Camera className="h-3 w-3" /> {totalFotos} fotografía{totalFotos !== 1 ? 's' : ''} adjunta{totalFotos !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleCopy}
            className="gap-1.5 text-xs border-blue-700/60 bg-transparent text-slate-300 hover:text-white hover:bg-blue-900/40">
            <FileText className="h-3.5 w-3.5" /> Copiar texto
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={exportando}
            className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0 shadow">
            {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exportando ? 'Generando PDF...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      {/* Visor del informe */}
      <div className="rounded-xl border border-blue-800/60 bg-blue-950 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 to-blue-900 border-b border-blue-800/60 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight tracking-wide">INFORME TÉCNICO DE INSPECCIÓN EDILICIA</p>
            <p className="text-blue-300 text-xs mt-1 font-medium">{establecimiento}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-blue-400 text-[10px] uppercase tracking-widest">Fecha</p>
            <p className="text-white text-sm font-bold mt-0.5">{fecha}</p>
          </div>
        </div>

        {/* Contenido markdown */}
        <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: 'min(75vh, 680px)' }}>
          <ReactMarkdown components={md}>{informe}</ReactMarkdown>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox} alt="Foto" className="max-w-full max-h-[90dvh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Galería de fotos inline */}
      {seccionesConFotos.length > 0 && (
        <div className="rounded-xl border border-blue-800/60 bg-blue-950 overflow-hidden">
          <div className="bg-blue-900/50 border-b border-blue-800/50 px-5 py-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-white">Registro Fotográfico</span>
            <span className="ml-auto text-xs text-slate-400">{totalFotos} fotografías</span>
          </div>
          <div className="px-5 py-4 space-y-5">
            {seccionesConFotos.map((sec) => (
              <div key={sec.id || sec.nombre}>
                <p className="text-xs font-bold text-blue-300 uppercase tracking-wide mb-2">{sec.nombre}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {sec.fotos.map((url, i) => (
                    <button key={i} onClick={() => setLightbox(url)} className="group relative">
                      <img
                        src={url}
                        alt={`Foto ${i + 1} - ${sec.nombre}`}
                        className="w-full aspect-[4/3] object-cover rounded-lg border border-blue-800/40 group-hover:border-blue-500 transition-all group-hover:scale-105"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}