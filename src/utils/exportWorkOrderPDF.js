// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Work Order PDF
// ─────────────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
  try { return d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '-'; } catch { return d || '-'; }
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
  pendiente:   { color: [150,150,150], label: 'PENDIENTE' },
  asignada:    { color: [80,80,80],    label: 'ASIGNADA' },
  en_progreso: { color: [41,128,185],  label: 'EN PROGRESO' },
  en_espera:   { color: [180,120,0],   label: 'EN ESPERA' },
  completada:  { color: [39,174,96],   label: 'COMPLETADA' },
  cancelada:   { color: [150,50,50],   label: 'CANCELADA' },
};

const PRIORITY_CFG = {
  baja:    { color: [150,150,150] },
  media:   { color: [41,128,185] },
  alta:    { color: [192,100,0] },
  urgente: { color: [192,57,43] },
};

const TYPE_LABELS = {
  mantenimiento_preventivo: 'Mantenimiento Preventivo',
  mantenimiento_correctivo: 'Mantenimiento Correctivo',
  instalacion: 'Instalacion', inspeccion: 'Inspeccion',
  reparacion: 'Reparacion', emergencia: 'Emergencia',
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

async function loadChecklistPhotos(checklist = []) {
  const entries = checklist.filter(t => t.photo_url);
  const results = await Promise.all(
    entries.map(t => toBase64(t.photo_url).then(b64 => ({ id: t.id, b64 })))
  );
  const map = {};
  results.forEach(({ id, b64 }) => { if (b64) map[id] = b64; });
  return map;
}

// Dibuja titulo de seccion (sin emojis — solo texto ASCII)
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

  const [logoB64, checklistPhotos] = await Promise.all([
    toBase64(LOGO_URL),
    loadChecklistPhotos(order.checklist || []),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;

  // ── CABECERA ──────────────────────────────────────────────
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, W, 48, 'F');

  if (logoB64) {
    doc.addImage(logoB64, 'JPEG', M, 5, 55, 20);
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...C.white);
    doc.text('MEJORES', M, 18);
  }

  doc.setFillColor(...C.red);
  doc.rect(0, 44, W, 4, 'F');

  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray4);
  doc.text('info@mejores.com.ar  ·  +54 (11) 4000-0000', M, 39);

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
  doc.text('Prioridad: ' + (order.priority || '').toUpperCase(), W - M - 26, 32.8, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray4);
  doc.text(
    'Codigo: ' + (order.code || '-') + '  |  Tipo: ' + (TYPE_LABELS[order.type] || order.type || '-'),
    W - M, 41, { align: 'right' }
  );

  y = 56;

  // ── TARJETA INFO PRINCIPAL ────────────────────────────────
  doc.setFillColor(...C.offWht);
  doc.roundedRect(M, y, COL, 42, 2, 2, 'F');
  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, COL, 42, 2, 2, 'S');

  const cell = (label, val, cx, cy, cw) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...C.gray3);
    doc.text(label.toUpperCase(), cx, cy);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
    const lines = doc.splitTextToSize(String(val || '-'), cw - 2);
    doc.text(lines[0], cx, cy + 4.5);
  };

  const half = (COL - 8) / 2;
  const third = (COL - 8) / 3;

  cell('Titulo de la tarea', order.title, M + 3, y + 6, COL - 6);
  cell('Lugar / Ubicacion', order.location, M + 3, y + 16, half);
  cell('Equipo o activo', order.asset_name, M + 3 + half + 4, y + 16, half);
  cell('Asignado a', order.assigned_name, M + 3, y + 26, third);
  cell('Fecha programada', fmtDate(order.scheduled_date), M + 3 + third + 4, y + 26, third);
  cell('Fecha completada', fmtDate(order.completed_date), M + 3 + 2 * (third + 4), y + 26, third);
  cell('Impreso el', fmtDate(new Date()), M + 3, y + 36, COL / 2);

  y += 48;

  // ── DESCRIPCION ───────────────────────────────────────────
  if (order.description) {
    doc.setFillColor(...C.blueLt);
    const descLines = doc.splitTextToSize(order.description, COL - 8);
    const dh = descLines.length * 4.5 + 10;
    doc.roundedRect(M, y, COL, dh, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.blue);
    doc.text('Descripcion del trabajo', M + 4, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
    doc.text(descLines, M + 4, y + 10.5);
    y += dh + 6;
  }

  // ── CHECKLIST ─────────────────────────────────────────────
  const checklist = order.checklist || [];
  if (checklist.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, 'LISTA DE TAREAS', M, y, 50);
    y += 5;

    const done = checklist.filter(t => t.completed).length;
    const pct = Math.round((done / checklist.length) * 100);

    // Barra de progreso
    doc.setFillColor(...C.gray4); doc.roundedRect(M, y, COL, 5, 1, 1, 'F');
    const barColor = pct === 100 ? C.green : pct > 50 ? C.blue : C.red;
    if (pct > 0) {
      doc.setFillColor(...barColor);
      doc.roundedRect(M, y, Math.max(COL * pct / 100, 2), 5, 1, 1, 'F');
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.gray1);
    doc.text(done + ' de ' + checklist.length + ' tareas completadas (' + pct + '%)', M, y + 10);
    y += 14;

    for (const task of checklist) {
      const isDone = task.completed;
      const hasPhoto = task.photo_url && checklistPhotos[task.id];
      const hasNotes = task.notes && task.notes.trim();
      const taskH = hasPhoto ? 34 : hasNotes ? 14 : 10;

      if (y + taskH > 272) { doc.addPage(); y = 14; }

      doc.setFillColor(...(isDone ? C.greenLt : C.offWht));
      doc.roundedRect(M, y, COL, taskH, 1.5, 1.5, 'F');
      doc.setDrawColor(...(isDone ? C.green : C.gray4));
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, COL, taskH, 1.5, 1.5, 'S');

      // Checkbox
      doc.setFillColor(...(isDone ? C.green : C.white));
      doc.setDrawColor(...(isDone ? C.green : C.gray3));
      doc.setLineWidth(0.6);
      doc.roundedRect(M + 3, y + 2.5, 6, 6, 1, 1, isDone ? 'FD' : 'S');
      if (isDone) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
        doc.text('OK', M + 4.2, y + 7);
      }

      // Texto tarea
      doc.setFont('helvetica', isDone ? 'normal' : 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...(isDone ? C.gray3 : C.gray1));
      const textMaxW = hasPhoto ? COL - 44 : COL - 16;
      const taskLines = doc.splitTextToSize(task.task, textMaxW);
      doc.text(taskLines[0], M + 12, y + 7);

      if (hasNotes) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
        doc.text('Nota: ' + task.notes, M + 12, y + 12);
      }

      // Foto de la tarea
      if (hasPhoto) {
        doc.addImage(checklistPhotos[task.id], 'JPEG', W - M - 28, y + 2, 24, 20);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...C.gray3);
        doc.text('foto referencia', W - M - 16, y + 24, { align: 'center' });
      }

      y += taskH + 2;
    }
    y += 4;
  }

  // ── MATERIALES A UTILIZAR (siempre aparece) ───────────────
  if (y + 30 > 272) { doc.addPage(); y = 14; }
  sectionTitle(doc, 'MATERIALES A UTILIZAR', M, y, 65);
  y += 6;

  // Encabezado tabla
  doc.setFillColor(...C.dark); doc.roundedRect(M, y, COL, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
  doc.text('Material / Descripcion', M + 3, y + 4.8);
  doc.text('Cantidad', M + 108, y + 4.8, { align: 'right' });
  doc.text('Unidad', M + 140, y + 4.8, { align: 'right' });
  doc.text('Observaciones', W - M - 2, y + 4.8, { align: 'right' });
  y += 8;

  const materials = order.materials_used || [];
  let matTotal = 0;
  materials.forEach((m, i) => {
    if (y + 7 > 272) { doc.addPage(); y = 14; }
    const sub = (m.quantity || 0) * (m.unit_cost || 0);
    matTotal += sub;
    doc.setFillColor(...(i % 2 === 0 ? C.white : C.rowAlt));
    doc.rect(M, y, COL, 7, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
    doc.text(doc.splitTextToSize(m.material_name || '', 95)[0], M + 3, y + 4.8);
    doc.text(String(m.quantity || 0), M + 108, y + 4.8, { align: 'right' });
    doc.setTextColor(...C.gray2);
    doc.text('-', M + 140, y + 4.8, { align: 'right' });
    doc.text(m.unit_cost > 0 ? fmt(m.unit_cost) : '-', W - M - 2, y + 4.8, { align: 'right' });
    y += 7;
  });

  // Filas en blanco para completar a mano (al menos 4 vacías, o hasta completar 5 filas total)
  const blankRowsMat = Math.max(5 - materials.length, 4);
  for (let b = 0; b < blankRowsMat; b++) {
    if (y + 7 > 272) { doc.addPage(); y = 14; }
    doc.setFillColor(...(( materials.length + b) % 2 === 0 ? C.white : C.rowAlt));
    doc.rect(M, y, COL, 7, 'F');
    doc.setDrawColor(...C.gray4); doc.setLineWidth(0.2);
    // Líneas guía punteadas para escribir
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M + 3, y + 5.5, M + 95, y + 5.5);
    doc.line(M + 98, y + 5.5, M + 112, y + 5.5);
    doc.line(M + 130, y + 5.5, M + 143, y + 5.5);
    doc.line(M + 152, y + 5.5, W - M - 2, y + 5.5);
    doc.setLineDashPattern([], 0);
    y += 7;
  }

  if (matTotal > 0) {
    doc.setFillColor(...C.dark); doc.roundedRect(W - M - 58, y + 1, 58, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
    doc.text('TOTAL MATERIALES', W - M - 56, y + 6);
    doc.setTextColor(...C.red); doc.text(fmt(matTotal), W - M - 2, y + 6, { align: 'right' });
    y += 10;
  } else {
    y += 4;
  }

  // ── MATERIALES FALTANTES (siempre aparece) ────────────────
  if (y + 30 > 272) { doc.addPage(); y = 14; }

  // Cabecera naranja
  doc.setFillColor(...C.amberLt);
  doc.roundedRect(M, y, COL, 10, 2, 2, 'F');
  doc.setDrawColor(...C.amber); doc.setLineWidth(0.5);
  doc.roundedRect(M, y, COL, 10, 2, 2, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.amber);
  doc.text('MATERIALES QUE FALTARON', M + 4, y + 6.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray2);
  doc.text('(para que el operario complete en campo)', W - M - 2, y + 6.5, { align: 'right' });
  y += 12;

  // Encabezado tabla faltantes
  doc.setFillColor(...[180, 120, 0]); doc.roundedRect(M, y, COL, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
  doc.text('Material que faltó', M + 3, y + 4.8);
  doc.text('Cantidad', M + 108, y + 4.8, { align: 'right' });
  doc.text('Unidad', M + 140, y + 4.8, { align: 'right' });
  doc.text('Motivo / Comentario', W - M - 2, y + 4.8, { align: 'right' });
  y += 8;

  const faltantes = order.materiales_faltantes || [];
  faltantes.forEach((f, i) => {
    if (y + 7 > 272) { doc.addPage(); y = 14; }
    doc.setFillColor(...(i % 2 === 0 ? C.white : C.rowAlt));
    doc.rect(M, y, COL, 7, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray1);
    doc.text(doc.splitTextToSize(f.material_name || '', 90)[0], M + 3, y + 4.8);
    doc.text(String(f.cantidad_faltante || ''), M + 108, y + 4.8, { align: 'right' });
    doc.setTextColor(...C.gray2);
    doc.text(f.motivo || '-', W - M - 2, y + 4.8, { align: 'right' });
    y += 7;
  });

  // Filas en blanco para que el operario complete a mano
  const blankRowsFalt = Math.max(5 - faltantes.length, 4);
  for (let b = 0; b < blankRowsFalt; b++) {
    if (y + 7 > 272) { doc.addPage(); y = 14; }
    doc.setFillColor(...((faltantes.length + b) % 2 === 0 ? C.white : C.rowAlt));
    doc.rect(M, y, COL, 7, 'F');
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(...C.amber); doc.setLineWidth(0.2);
    doc.line(M + 3, y + 5.5, M + 95, y + 5.5);
    doc.line(M + 98, y + 5.5, M + 112, y + 5.5);
    doc.line(M + 130, y + 5.5, M + 143, y + 5.5);
    doc.line(M + 152, y + 5.5, W - M - 2, y + 5.5);
    doc.setLineDashPattern([], 0);
    y += 7;
  }
  y += 6;

  // ── MOTIVOS INCOMPLETO ────────────────────────────────────
  const motivos = order.motivos_incompleto || [];
  if (motivos.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }

    const mH = motivos.length * 9 + 22;
    doc.setFillColor(...C.redLt);
    doc.roundedRect(M, y, COL, mH, 2, 2, 'F');
    doc.setDrawColor(...C.red); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, COL, mH, 2, 2, 'S');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.red);
    doc.text('POR QUE NO SE TERMINO', M + 4, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray2);
    doc.text('Motivos informados por el operario', M + 4, y + 12);

    let my = y + 15;
    motivos.forEach((m) => {
      if (my + 8 > 272) { doc.addPage(); my = 14; }
      doc.setFillColor(...C.white); doc.roundedRect(M + 3, my, COL - 6, 7.5, 1, 1, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.gray1);
      doc.text('- ' + (m.texto || ''), M + 5, my + 5);
      my += 9;
    });
    y = my + 4;
  }

  // ── FOTOS GENERALES ───────────────────────────────────────
  const photos = order.photos || [];
  if (photos.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, 'FOTOS DE LA OBRA', M, y, 48);
    y += 6;

    const photoB64s = await Promise.all(photos.map(url => toBase64(url)));
    const valid = photoB64s.filter(Boolean);

    if (valid.length > 0) {
      const perRow = 3;
      const imgW = (COL - (perRow - 1) * 4) / perRow;
      const imgH = imgW * 0.65;

      for (let i = 0; i < valid.length; i += perRow) {
        if (y + imgH + 6 > 272) { doc.addPage(); y = 14; }
        const row = valid.slice(i, i + perRow);
        row.forEach((b64, j) => {
          const px = M + j * (imgW + 4);
          doc.addImage(b64, 'JPEG', px, y, imgW, imgH);
          doc.setDrawColor(...C.gray4); doc.setLineWidth(0.3);
          doc.rect(px, y, imgW, imgH, 'S');
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray3);
          doc.text('Foto ' + (i + j + 1), px + imgW / 2, y + imgH + 3.5, { align: 'center' });
        });
        y += imgH + 8;
      }
      y += 2;
    }
  }

  // ── HORAS TRABAJADAS ──────────────────────────────────────
  if (timeLogs.length > 0) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, 'HORAS TRABAJADAS', M, y, 48);
    y += 6;

    doc.setFillColor(...C.dark); doc.roundedRect(M, y, COL, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.white);
    doc.text('Tecnico', M + 3, y + 4.8);
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
      doc.text(tl.employee_name || '-', M + 3, y + 4.5);
      doc.text(fmtDate(tl.date), M + 85, y + 4.5, { align: 'right' });
      doc.setTextColor(...C.gray2);
      doc.text(tl.type || '-', M + 130, y + 4.5, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray1);
      doc.text(tl.hours + 'h', W - M - 2, y + 4.5, { align: 'right' });
      y += 6.5;
    });
    doc.setFillColor(...C.dark); doc.roundedRect(W - M - 42, y + 1, 42, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
    doc.text('TOTAL', W - M - 40, y + 5.8);
    doc.setTextColor(...C.red); doc.text(totalHrs + 'h', W - M - 2, y + 5.8, { align: 'right' });
    y += 14;
  }

  // ── NOTAS ─────────────────────────────────────────────────
  if (order.notes) {
    if (y + 20 > 272) { doc.addPage(); y = 14; }
    sectionTitle(doc, 'NOTAS Y OBSERVACIONES', M, y, 60);
    y += 5;
    const lines = doc.splitTextToSize(order.notes, COL - 8);
    const nh = lines.length * 4.5 + 8;
    doc.setFillColor(...C.offWht); doc.roundedRect(M, y, COL, nh, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.gray2);
    doc.text(lines, M + 4, y + 6);
    y += nh + 8;
  }

  // ── FIRMAS ────────────────────────────────────────────────
  // Asegurar que las firmas queden en la misma página
  if (y + 38 > 272) { doc.addPage(); y = 14; }
  const sigY = Math.max(y + 4, 240);
  // Si sigY queda fuera de la página actual, nueva página
  const finalSigY = sigY + 38 > 285 ? (() => { doc.addPage(); return 14; })() : sigY;

  const sigW = (COL - 16) / 2;

  // Caja firma operario
  doc.setFillColor(...C.offWht); doc.roundedRect(M, finalSigY, sigW, 32, 2, 2, 'F');
  doc.setDrawColor(...C.gray4); doc.setLineWidth(0.3);
  doc.roundedRect(M, finalSigY, sigW, 32, 2, 2, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
  doc.text('FIRMA DEL OPERARIO', M + sigW / 2, finalSigY + 6, { align: 'center' });
  doc.setDrawColor(...C.gray3); doc.setLineWidth(0.4);
  doc.line(M + 6, finalSigY + 24, M + sigW - 6, finalSigY + 24);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
  doc.text(order.assigned_name || 'Nombre y apellido', M + sigW / 2, finalSigY + 28, { align: 'center' });

  // Firma digital si existe
  if (order.signature_url) {
    const sigB64 = await toBase64(order.signature_url);
    if (sigB64) {
      // Respetar aspect ratio de la firma
      const maxSigW = sigW - 12;
      const maxSigH = 14;
      let drawW = maxSigW, drawH = maxSigH;
      await new Promise(res => {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const r = img.naturalWidth / img.naturalHeight;
            if (r > maxSigW / maxSigH) { drawW = maxSigW; drawH = maxSigW / r; }
            else { drawH = maxSigH; drawW = maxSigH * r; }
          }
          res();
        };
        img.onerror = res;
        img.src = sigB64;
      });
      const sigImgX = M + 6 + (maxSigW - drawW) / 2;
      const sigImgY = finalSigY + 8 + (maxSigH - drawH) / 2;
      doc.addImage(sigB64, 'PNG', sigImgX, sigImgY, drawW, drawH);
    }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(...C.green);
    doc.text('Firmado: ' + (order.signature_name || ''), M + sigW / 2, finalSigY + 23, { align: 'center' });
  }

  // Caja firma jefe de sitio
  const s2x = M + sigW + 16;
  doc.setFillColor(...C.offWht); doc.roundedRect(s2x, finalSigY, sigW, 32, 2, 2, 'F');
  doc.setDrawColor(...C.gray4);
  doc.roundedRect(s2x, finalSigY, sigW, 32, 2, 2, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.gray2);
  doc.text('FIRMA DEL JEFE DE SITIO', s2x + sigW / 2, finalSigY + 6, { align: 'center' });
  doc.setDrawColor(...C.gray3); doc.setLineWidth(0.4);
  doc.line(s2x + 6, finalSigY + 24, s2x + sigW - 6, finalSigY + 24);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.gray3);
  doc.text('Fecha:  _____ / _____ / _________', s2x + sigW / 2, finalSigY + 28, { align: 'center' });

  // ── PIE DE PAGINA ─────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...C.dark); doc.rect(0, 286, W, 11, 'F');
    doc.setFillColor(...C.red); doc.rect(0, 285, W, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.gray4);
    doc.text('MEJORES - Mantenimiento, Obras y Servicios  |  info@mejores.com.ar', M, 292);
    doc.text((order.code || 'OT') + '  |  Pagina ' + i + ' de ' + pages, W - M, 292, { align: 'right' });
    if (i > 1) {
      doc.setFillColor(...C.red); doc.rect(0, 0, W, 2, 'F');
    }
  }

  doc.save('OT_' + (order.code || order.id) + '_MEJORES.pdf');
}