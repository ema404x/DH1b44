import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

// Deriva la URL base de la app (igual que LocationQRModal) para que el QR
// apunte al portal operario correcto, sin importar desde qué ruta se ejecute.
function getAppBaseUrl() {
  const path = window.location.pathname.replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  segments.pop();
  return segments.length > 0 ? '/' + segments.join('/') : '';
}

/**
 * Genera un PDF con todos los QRs de ubicaciones, listos para imprimir/pegar.
 * Cada tarjeta: QR + nombre + dirección. Escaneado abre el portal operario
 * con las OTs de esa ubicación.
 * @param {Array} locations — lista de LocationQR
 */
export async function exportarQRsUbicacionesPDF(locations) {
  const list = (locations || []).filter(Boolean);
  if (!list.length) return;

  const origin = window.location.origin;
  const base = getAppBaseUrl();

  // Generar data URLs de cada QR (en lotes para no saturar el render)
  const items = [];
  const BATCH = 12;
  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    const datas = await Promise.all(
      chunk.map(async (l) => {
        const url = `${origin}${base}/portal-operario?loc=${l.id}`;
        try {
          return await QRCode.toDataURL(url, {
            width: 300,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          });
        } catch {
          return null;
        }
      })
    );
    chunk.forEach((l, idx) => items.push({ location: l, dataUrl: datas[idx] }));
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  const gap = 6;
  const cols = 2;
  const cardW = (pageW - margin * 2 - gap) / cols;
  const cardH = 62;
  const qrSize = 42;
  const startY = margin + 18;
  const lineH = cardH + gap;

  let y = startY;
  let c = 0;
  let page = 0;

  const header = () => {
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('Códigos QR · Ubicaciones', margin, margin + 5);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Total: ${items.length} ubicaciones · ${new Date().toLocaleDateString('es-AR')}`,
      margin,
      margin + 10
    );
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, margin + 13, pageW - margin, margin + 13);
  };

  header();

  for (const it of items) {
    if (y + cardH > pageH - margin) {
      doc.addPage();
      header();
      y = startY;
      c = 0;
    }

    const x = margin + c * (cardW + gap);

    // Tarjeta
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5);

    // QR
    if (it.dataUrl) {
      doc.addImage(it.dataUrl, 'PNG', x + 5, y + 10, qrSize, qrSize);
    } else {
      doc.setFontSize(8);
      doc.setTextColor(200, 0, 0);
      doc.text('QR no disponible', x + 5, y + 20);
    }

    // Texto a la derecha del QR
    const textX = x + qrSize + 11;
    const textW = cardW - qrSize - 13;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const name = it.location.name || 'Ubicación';
    const nameLines = doc.splitTextToSize(name, textW);
    doc.text(nameLines.slice(0, 3), textX, y + 14);

    if (it.location.address) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const addrLines = doc.splitTextToSize(it.location.address, textW);
      doc.text(addrLines.slice(0, 3), textX, y + 22);
    }

    // Pie de tarjeta
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Escanear para ver OTs de la ubicación', x + 5, y + cardH - 4);

    c++;
    if (c >= cols) {
      c = 0;
      y += lineH;
    }
  }

  // Pie de página en cada hoja
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `DH1 Software · ${p}/${totalPages}`,
      pageW - margin,
      pageH - 5,
      { align: 'right' }
    );
  }

  doc.save('QRs_Ubicaciones.pdf');
}