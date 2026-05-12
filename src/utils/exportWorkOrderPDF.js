// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Work Order PDF (versión operarios: clara, visual, simple)
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
  try { return d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '—'; } catch { return d || '—'; }
};

// Colores
const C = {
  dark:   [30, 30, 30],
  red:    [192, 57, 43],
  redLt:  [253, 235, 232],
  green:  [39, 174, 96],
  greenLt:[232, 248, 238],
  amber:  [180, 120, 0],
  amberLt:[255, 248, 220],
  white:  [255, 255, 255],
  offWht: [248, 248, 250],
  gray1:  [40, 40, 40],
  gray2:  [90, 90, 90],
  gray3:  [150, 150, 150],
  gray4:  [215, 215, 215],
  rowAlt: [244, 245, 250],
  blue:   [41, 128, 185],
  blueLt: [232, 242, 251],
};

const STATUS_CFG = {
  pendiente:   { color: [150,150,150], label: '⏳  PENDIENTE' },
  asignada:    { color: [80,80,80],    label: '👤  ASIGNADA' },
  en_progreso: { color: [41,128,185],  label: '🔧  EN PROGRESO' },
  en_espera:   { color: [180,120,0],   label: '⏸  EN ESPERA' },
  completada:  { color: [39,174,96],   label: '✅  COMPLETADA' },
  cancelada:   { color: [150,50,50],   label: '❌  CANCELADA' },
};

const PRIORITY_CFG = {
  baja:    { color: [150,150,150], emoji: '🟢' },
  media:   { color: [41,128,185],  emoji: '🔵' },
  alta:    { color: [192,100,0],   emoji: '🟠' },
  urgente: { color: [192,57,43],   emoji: '🔴' },
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Mantenimiento Preventivo',
  mantenimiento_correctivo: 'Mantenimiento Correctivo',
  instalacion: 'Instalación', inspeccion: 'Inspección',
  reparacion: 'Reparación', emergencia: 'Emergencia',
};

const LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

async function toBase64(url) {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return new Promise(res => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result);
      fr.readAsDataURL(b);
    });
  } catch { return null; }
}

// Carga imágenes del checklist en paralelo
async function loadChecklistPhotos(checklist = []) {
  const entries = checklist.filter(t => t.photo_url);
  const results = await Promise.all(entries.map(t => toBase64(t.photo_url).then(b64 => ({ id: t.id, b64 }))));
  const map = {};
  results.forEach(({ id, b64 }) => { if (b64) map[id] = b64; });
  return map;
}

// Sección título rojo
function sectionTitle(doc, label, x, y, lineLen = 60) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.red);
  doc.text(label, x, y);
  doc.setDrawColor(...C.red);
  doc.setLineWidth(0.5);
  doc.line(x, y + 1.8, x + lineLen, y + 1.8);
}

export async function exportWorkOrderPDF(order, timeLogs = []) {
  const W = 210, M = 14, COL = W - M * 2;

  // Cargar recursos en paralelo
  const [logoB64, checklistPhotos] = await Promise.all([
    toBase64(LOGO_URL),
    loadChecklistPhotos(order.checklist || []),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;

  // ════════════════════════════════════════════════════════════
  // CABECERA
  // ════════════════════════════════════════════════════════════
  // Fondo cabecera
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, W, 48, 'F');

  // Logo
  if (logoB64) {
    doc.addImage(logoB64, 'JPEG', M, 5, 55, 20);
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...C.white);
    doc.text('MEJORES', M, 18);
  }

  // Línea roja decorativa
  doc.setFillColor(...C.red);
  doc.rect(0, 44, W, 4, 'F');

  // Info empresa
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray4);
  doc.text('info@mejores.com.ar  ·  +54 (11) 4000-0000', M, 39);

  // Título OT (lado derecho)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...C.white);
  doc.text('ORDEN DE TRABAJO', W - M, 13, { align: 'right' });

  const stCfg = STATUS_CFG[order.status] || STATUS_CFG.pendiente;
  doc.setFillColor(...stCfg.color);
  doc.roundedRect(W - M - 52, 17, 52, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
  doc.text(stCfg.label, W - M - 26, 22.2, { align: 'center' });

  const prCfg = PRIORITY_CFG[order.priority] || PRIORITY_CFG.media;
  doc.setFillColor(...prCfg.color);
  doc.roundedRect(W - M - 52, 28, 52, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.white);
  doc.text(`${prCfg.emoji} Prioridad: ${(order.priority || '').toUpperCase()}`, W - M - 26, 32.8, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray4);
  doc.text(`Código: ${order.code || '—'}  ·  Tipo: ${TYPE_LABELS[order.type] || order.type || '—'}`, W - M, 41, { align: 'right' });

  y = 56;

  // ════════════════════════════════════════════════════════════
  // TARJETA DE INFORMACIÓN PRINCIPAL
  // ════════════════════════════════════════════════════════════
  doc.setFillColor(...C.offWht);
  doc.roundedRect(M, y, COL, 42, 2, 2, 'F');
  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, COL, 42, 2, 2, 'S');

  const cell = (label, val, cx, cy, cw) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...C.gray3);
    doc.text(label.toUpperCase(), cx, cy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
    const lines = doc.splitTextToSize(String(val || '—'), cw - 2);
    doc.text(lines[0], cx, cy + 4.5);
  };

  const half = (COL - 8) / 2;
  const third = (COL - 8) / 3;

  cell('Título de la tarea', order.title, M + 3, y + 6, COL - 6);
  cell('Lugar / Ubicación', order.location, M + 3, y + 16, half);
  cell('Equipo o activo', order.asset_name, M + 3 + half + 4, y + 16, half);
  cell('Asignado a', order.assigned_name, M + 3, y + 26, third);
  cell('Fecha programada', fmtDate(order.scheduled_date), M + 3 + third + 4, y + 26, third);
  cell('Fecha completada', fmtDate(order.completed_date), M + 3 + 2 * (third + 4), y + 26, third);
  cell('Impreso', fmtDate(new Date()), M + 3, y + 36, COL / 2);

  y += 48;

  // Descripción
  if (order.description) {
    doc.setFillColor(...C.blueLt);
    const descLines = doc.splitTextToSize(order.description, COL - 8);
    const dh = descLines.length * 4.5 + 10;
    doc.roundedRect(M, y, COL, dh, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.blue);
    doc.text('📋  Descripción del trabajo', M + 4, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
    doc.text(descLines, M + 4, y + 10.5);
    y += dh + 6;
  }

  // ════════════════════════════════════════════════════════════
  // CHECKLIST
  // ════════════════════════════════════════════════════════════
  const checklist = order.checklist || [];
  if (checklist.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, '✅  LISTA DE TAREAS', M, y, 55);
    y += 5;

    const done = checklist.filter(t => t.completed).length;
    const pct = Math.round((done / checklist.length) * 100);

    // Barra de progreso visual grande
    doc.setFillColor(...C.gray4); doc.roundedRect(M, y, COL, 5, 1, 1, 'F');
    const barColor = pct === 100 ? C.green : pct > 50 ? C.blue : C.red;
    doc.setFillColor(...barColor);
    doc.roundedRect(M, y, Math.max(COL * pct / 100, 2), 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.gray1);
    doc.text(`${done} de ${checklist.length} tareas completadas (${pct}%)`, M, y + 10);
    y += 14;

    for (const task of checklist) {
      const isDone = task.completed;
      const taskH = task.photo_url && checklistPhotos[task.id] ? 32 : task.notes ? 14 : 10;

      if (y + taskH > 272) { doc.addPage(); y = 14; }

      // Fondo
      doc.setFillColor(...(isDone ? C.greenLt : C.offWht));
      doc.roundedRect(M, y, COL, taskH, 1.5, 1.5, 'F');
      doc.setDrawColor(...(isDone ? C.green : C.gray4));
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, COL, taskH, 1.5, 1.5, 'S');

      // Checkbox visual grande y claro
      doc.setFillColor(...(isDone ? C.green : C.white));
      doc.setDrawColor(...(isDone ? C.green : C.gray3));
      doc.setLineWidth(0.6);
      doc.roundedRect(M + 3, y + 2.5, 6, 6, 1, 1, isDone ? 'FD' : 'S');
      if (isDone) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.white);
        doc.text('✓', M + 4.2, y + 7.3);
      }

      // Texto tarea
      doc.setFont('helvetica', isDone ? 'normal' : 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...(isDone ? C.gray3 : C.gray1));
      const taskText = doc.splitTextToSize(task.task, COL - 18);
      doc.text(taskText[0], M + 12, y + 7);

      if (task.notes) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
        doc.text(`💬 ${task.notes}`, M + 12, y + 12);
      }

      // Foto de la tarea
      if (task.photo_url && checklistPhotos[task.id]) {
        doc.addImage(checklistPhotos[task.id], 'JPEG', W - M - 28, y + 1, 24, 20);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(6); doc.setTextColor(...C.gray3);
        doc.text('foto de ejemplo', W - M - 16, y + 23, { align: 'center' });
      }

      y += taskH + 2;
    }
    y += 4;
  }

  // ════════════════════════════════════════════════════════════
  // MATERIALES A UTILIZAR
  // ════════════════════════════════════════════════════════════
  const materials = order.materials_used || [];
  if (materials.length > 0) {
    if (y + 25 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, '🧰  MATERIALES A UTILIZAR', M, y, 70);
    y += 6;

    // Encabezado tabla
    doc.setFillColor(...C.dark); doc.roundedRect(M, y, COL, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
    doc.text('Material', M + 3, y + 4.8);
    doc.text('Cant.', M + 108, y + 4.8, { align: 'right' });
    doc.text('Costo/u', M + 140, y + 4.8, { align: 'right' });
    doc.text('Subtotal', W - M - 2, y + 4.8, { align: 'right' });
    y += 8;

    let matTotal = 0;
    materials.forEach((m, i) => {
      if (y + 7 > 272) { doc.addPage(); y = 14; }
      const sub = (m.quantity || 0) * (m.unit_cost || 0);
      matTotal += sub;
      doc.setFillColor(...(i % 2 === 0 ? C.white : C.rowAlt));
      doc.rect(M, y, COL, 6.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
      doc.text(doc.splitTextToSize(m.material_name || '', 95)[0], M + 3, y + 4.5);
      doc.text(String(m.quantity || 0), M + 108, y + 4.5, { align: 'right' });
      doc.setTextColor(...C.gray2);
      doc.text(m.unit_cost > 0 ? fmt(m.unit_cost) : '—', M + 140, y + 4.5, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1);
      doc.text(sub > 0 ? fmt(sub) : '—', W - M - 2, y + 4.5, { align: 'right' });
      y += 6.5;
    });

    if (matTotal > 0) {
      doc.setFillColor(...C.dark); doc.roundedRect(W - M - 58, y + 1, 58, 8, 1, 1, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
      doc.text('TOTAL MATERIALES', W - M - 56, y + 6);
      doc.setTextColor(...C.red); doc.text(fmt(matTotal), W - M - 2, y + 6, { align: 'right' });
    }
    y += 14;
  }

  // ════════════════════════════════════════════════════════════
  // MATERIALES FALTANTES
  // ════════════════════════════════════════════════════════════
  const faltantes = order.materiales_faltantes || [];
  if (faltantes.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }

    // Caja naranja de advertencia
    doc.setFillColor(...C.amberLt);
    const faltH = faltantes.length * 9 + 22;
    doc.roundedRect(M, y, COL, faltH, 2, 2, 'F');
    doc.setDrawColor(...C.amber); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, COL, faltH, 2, 2, 'S');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.amber);
    doc.text('⚠️  MATERIALES QUE FALTARON', M + 4, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray2);
    doc.text('Reportado por el operario durante la ejecución', M + 4, y + 12);

    y += 15;
    faltantes.forEach((f, i) => {
      doc.setFillColor(255, 255, 255); doc.roundedRect(M + 3, y, COL - 6, 7.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
      doc.text(`• ${f.material_name}`, M + 5, y + 5);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray2);
      doc.text(`Faltaron: ${f.cantidad_faltante} u.${f.motivo ? `  —  ${f.motivo}` : ''}`, M + 5 + doc.getTextWidth(`• ${f.material_name}`) + 2, y + 5);
      y += 9;
    });
    y += 4;
  }

  // ════════════════════════════════════════════════════════════
  // MOTIVOS INCOMPLETO
  // ════════════════════════════════════════════════════════════
  const motivos = order.motivos_incompleto || [];
  if (motivos.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }

    doc.setFillColor(...C.redLt);
    const mH = motivos.length * 9 + 22;
    doc.roundedRect(M, y, COL, mH, 2, 2, 'F');
    doc.setDrawColor(...C.red); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, COL, mH, 2, 2, 'S');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.red);
    doc.text('🚧  POR QUÉ NO SE TERMINÓ', M + 4, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray2);
    doc.text('Motivos informados por el operario', M + 4, y + 12);

    y += 15;
    motivos.forEach((m) => {
      doc.setFillColor(255, 255, 255); doc.roundedRect(M + 3, y, COL - 6, 7.5, 1, 1, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.gray1);
      doc.text(`• ${m.texto}`, M + 5, y + 5);
      y += 9;
    });
    y += 4;
  }

  // ════════════════════════════════════════════════════════════
  // FOTOS GENERALES DE LA OT
  // ════════════════════════════════════════════════════════════
  const photos = order.photos || [];
  if (photos.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, '📷  FOTOS DE LA OBRA', M, y, 52);
    y += 6;

    const photoB64s = await Promise.all(photos.map(url => toBase64(url)));
    const valid = photoB64s.filter(Boolean);

    if (valid.length > 0) {
      const perRow = 3;
      const imgW = (COL - (perRow - 1) * 4) / perRow;
      const imgH = imgW * 0.65;

      for (let i = 0; i < valid.length; i += perRow) {
        if (y + imgH + 4 > 272) { doc.addPage(); y = 14; }
        const row = valid.slice(i, i + perRow);
        row.forEach((b64, j) => {
          doc.addImage(b64, 'JPEG', M + j * (imgW + 4), y, imgW, imgH);
          doc.setDrawColor(...C.gray4); doc.setLineWidth(0.3);
          doc.rect(M + j * (imgW + 4), y, imgW, imgH, 'S');
        });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray3);
        row.forEach((_, j) => {
          doc.text(`Foto ${i + j + 1}`, M + j * (imgW + 4) + imgW / 2, y + imgH + 3, { align: 'center' });
        });
        y += imgH + 7;
      }
      y += 2;
    }
  }

  // ════════════════════════════════════════════════════════════
  // REGISTRO DE HORAS
  // ════════════════════════════════════════════════════════════
  if (timeLogs.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, '⏱  HORAS TRABAJADAS', M, y, 52);
    y += 6;

    doc.setFillColor(...C.dark); doc.roundedRect(M, y, COL, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
    doc.text('Técnico', M + 3, y + 4.8);
    doc.text('Fecha', M + 85, y + 4.8, { align: 'right' });
    doc.text('Tipo', M + 130, y + 4.8, { align: 'right' });
    doc.text('Horas', W - M - 2, y + 4.8, { align: 'right' });
    y += 8;

    let totalHrs = 0;
    timeLogs.forEach((tl, i) => {
      if (y + 7 > 272) { doc.addPage(); y = 14; }
      totalHrs += tl.hours || 0;
      doc.setFillColor(...(i % 2 === 0 ? C.white : C.rowAlt));
      doc.rect(M, y, COL, 6.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
      doc.text(tl.employee_name || '—', M + 3, y + 4.5);
      doc.text(fmtDate(tl.date), M + 85, y + 4.5, { align: 'right' });
      doc.setTextColor(...C.gray2); doc.text(tl.type || '—', M + 130, y + 4.5, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1);
      doc.text(`${tl.hours}h`, W - M - 2, y + 4.5, { align: 'right' });
      y += 6.5;
    });
    doc.setFillColor(...C.dark); doc.roundedRect(W - M - 42, y + 1, 42, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
    doc.text('TOTAL', W - M - 40, y + 5.8);
    doc.setTextColor(...C.red); doc.text(`${totalHrs}h`, W - M - 2, y + 5.8, { align: 'right' });
    y += 14;
  }

  // ════════════════════════════════════════════════════════════
  // NOTAS
  // ════════════════════════════════════════════════════════════
  if (order.notes) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, '📝  NOTAS Y OBSERVACIONES', M, y, 65);
    y += 5;
    const lines = doc.splitTextToSize(order.notes, COL - 8);
    const nh = lines.length * 4.5 + 8;
    doc.setFillColor(...C.offWht); doc.roundedRect(M, y, COL, nh, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray2);
    doc.text(lines, M + 4, y + 6);
    y += nh + 8;
  }

  // ════════════════════════════════════════════════════════════
  // FIRMAS
  // ════════════════════════════════════════════════════════════
  const sigY = Math.max(y + 4, 245);
  if (sigY + 35 > 285) { doc.addPage(); y = 14; }

  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.5);
  const sigW = (COL - 16) / 2;

  // Caja firma operario
  doc.setFillColor(...C.offWht); doc.roundedRect(M, sigY, sigW, 30, 2, 2, 'F');
  doc.setDrawColor(...C.gray4); doc.roundedRect(M, sigY, sigW, 30, 2, 2, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
  doc.text('FIRMA DEL OPERARIO', M + sigW / 2, sigY + 6, { align: 'center' });
  doc.setDrawColor(...C.gray3); doc.setLineWidth(0.4);
  doc.line(M + 6, sigY + 23, M + sigW - 6, sigY + 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
  doc.text(order.assigned_name || 'Nombre y apellido', M + sigW / 2, sigY + 27, { align: 'center' });

  // Caja firma supervisor
  const s2x = M + sigW + 16;
  doc.setFillColor(...C.offWht); doc.roundedRect(s2x, sigY, sigW, 30, 2, 2, 'F');
  doc.setDrawColor(...C.gray4); doc.roundedRect(s2x, sigY, sigW, 30, 2, 2, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
  doc.text('FIRMA DEL SUPERVISOR', s2x + sigW / 2, sigY + 6, { align: 'center' });
  doc.setDrawColor(...C.gray3); doc.setLineWidth(0.4);
  doc.line(s2x + 6, sigY + 23, s2x + sigW - 6, sigY + 23);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
  doc.text('Fecha: ___ / ___ / ______', s2x + sigW / 2, sigY + 27, { align: 'center' });

  // Firma digital si existe
  if (order.signature_url) {
    const sigB64 = await toBase64(order.signature_url);
    if (sigB64) {
      doc.addImage(sigB64, 'PNG', M + 6, sigY + 8, sigW - 12, 12);
    }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(...C.green);
    doc.text(`✅ Firmado digitalmente: ${order.signature_name || ''}`, M + sigW / 2, sigY + 22, { align: 'center' });
  }

  // ════════════════════════════════════════════════════════════
  // PIE DE PÁGINA en todas las páginas
  // ════════════════════════════════════════════════════════════
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.dark); doc.rect(0, 286, W, 11, 'F');
    doc.setFillColor(...C.red); doc.rect(0, 285, W, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray4);
    doc.text('MEJORES — Mantenimiento, Obras y Servicios  ·  info@mejores.com.ar', M, 292);
    doc.text(`${order.code || 'OT'}  ·  Página ${i} de ${pages}`, W - M, 292, { align: 'right' });
    if (i > 1) {
      doc.setFillColor(...C.red); doc.rect(0, 0, W, 2, 'F');
    }
  }

  doc.save(`OT_${order.code || order.id}_MEJORES.pdf`);
}