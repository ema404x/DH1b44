// ─────────────────────────────────────────────────────────────────────────────
// MEJORES — Professional Excel export (.xlsx / SpreadsheetML)
// No external dependencies — pure browser ZIP builder
// ─────────────────────────────────────────────────────────────────────────────

const n = (v) => Number(v || 0);

function escXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Shared strings ────────────────────────────────────────────────────────────
function buildSST(sharedStrings) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${sharedStrings.map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('\n')}
</sst>`;
}

// ── Styles XML with real formatting ─────────────────────────────────────────
// Font indices: 0=normal, 1=bold, 2=bold-white, 3=bold-blue, 4=bold-navy, 5=bold-accent-white, 6=italic-gray
// Fill indices: 0=none(patternType=none), 1=gray(required by spec), 2=navy, 3=blue, 4=blueLt, 5=gold, 6=offwhite, 7=green
// Border indices: 0=none, 1=thin-all, 2=thin-bottom
// XF (cell format) indices: ...see xfList below
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="8">
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF2563EB"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0A1834"/><name val="Calibri"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><i/><sz val="9"/><color rgb="FF8090AA"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFF59E0B"/><name val="Calibri"/></font>
  </fonts>
  <fills count="9">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0A1834"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF59E0B"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF10B981"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0E7EF"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    </border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="16">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="8" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="4" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="4" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="4" fontId="7" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="4" fontId="1" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment horizontal="left"/></xf>
    <xf numFmtId="0" fontId="2" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;

// XF index constants (easier to read)
const XF = {
  normal:       0,   // default
  bold:         1,   // bold normal
  hdrNavy:      2,   // bold white on navy (centered)
  hdrBlue:      3,   // bold white on blue (centered)
  rubroHdr:     4,   // bold navy on light-blue
  kpiLabel:     5,   // bold right-aligned on gray
  numAlt:       6,   // number right-aligned on offwhite with border
  numTotal:     7,   // bold number right-aligned with bottom border
  italic:       8,   // italic muted
  totalNavy:    9,   // bold white large on navy (left)
  totalGold:    10,  // gold bold number on navy (right)
  numNormal:    11,  // number right-aligned on offwhite
  blueText:     12,  // blue bold text
  hdrGreen:     13,  // bold white on green (centered)
  centered:     14,  // bold centered with bottom border
  altRow:       15,  // normal on offwhite with border
};

// ── Cell ref builder ──────────────────────────────────────────────────────────
function colName(idx) {
  let name = '';
  idx++;
  while (idx > 0) {
    name = String.fromCharCode(64 + (idx % 26 || 26)) + name;
    idx = Math.floor((idx - 1) / 26);
  }
  return name;
}

// ── Sheet builder ─────────────────────────────────────────────────────────────
// cell format: { v: value, t: 's'|'n', s: xfIndex, merge?: {r,c} }
function buildSheetXml(rows, colWidths, merges) {
  const sharedStrings = [];
  const ssMap = {};

  function getSSIndex(val) {
    const s = String(val);
    if (ssMap[s] === undefined) { ssMap[s] = sharedStrings.length; sharedStrings.push(s); }
    return ssMap[s];
  }

  const rowsXml = rows.map((row, ri) => {
    const h = row._h ? ` ht="${row._h}" customHeight="1"` : '';
    const cells = row.filter ? [] : row;
    const cellsXml = (Array.isArray(row) ? row : []).map((cell, ci) => {
      if (cell === null || cell === undefined) return '';
      const ref = `${colName(ci)}${ri + 1}`;
      const s = cell.s !== undefined ? ` s="${cell.s}"` : '';
      if (cell.t === 'n' || typeof cell.v === 'number') {
        const val = typeof cell.v === 'number' ? cell.v : 0;
        return `<c r="${ref}" t="n"${s}><v>${val}</v></c>`;
      } else {
        const idx = getSSIndex(cell.v ?? '');
        return `<c r="${ref}" t="s"${s}><v>${idx}</v></c>`;
      }
    }).join('');
    return `<row r="${ri + 1}"${h}>${cellsXml}</row>`;
  }).join('');

  const colsXml = colWidths
    ? `<cols>${colWidths.map((w, i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const mergesXml = (merges && merges.length)
    ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}
<sheetData>${rowsXml}</sheetData>
${mergesXml}
</worksheet>`;

  return { xml, sharedStrings };
}

// ── Multi-sheet xlsx builder ──────────────────────────────────────────────────
function buildXlsx(sheets) {
  // Merge all shared strings across sheets
  const globalSS = [];
  const globalSSMap = {};

  function globalIdx(val) {
    const s = String(val);
    if (globalSSMap[s] === undefined) { globalSSMap[s] = globalSS.length; globalSS.push(s); }
    return globalSSMap[s];
  }

  const processedSheets = sheets.map(({ name, rows, colWidths, merges }) => {
    const rowsXml = rows.map((row, ri) => {
      const hAttr = row._h ? ` ht="${row._h}" customHeight="1"` : '';
      const cellsXml = (Array.isArray(row) ? row : []).map((cell, ci) => {
        if (cell === null || cell === undefined) return '';
        const ref = `${colName(ci)}${ri + 1}`;
        const s = cell.s !== undefined ? ` s="${cell.s}"` : '';
        if (cell.t === 'n' || typeof cell.v === 'number') {
          return `<c r="${ref}" t="n"${s}><v>${n(cell.v)}</v></c>`;
        } else {
          const idx = globalIdx(cell.v ?? '');
          return `<c r="${ref}" t="s"${s}><v>${idx}</v></c>`;
        }
      }).join('');
      return `<row r="${ri + 1}"${hAttr}>${cellsXml}</row>`;
    }).join('');

    const colsXml = colWidths
      ? `<cols>${colWidths.map((w, i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const mergesXml = (merges && merges.length)
      ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';

    return {
      name,
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}<sheetData>${rowsXml}</sheetData>${mergesXml}
</worksheet>`,
    };
  });

  const ssXml = buildSST(globalSS);

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${processedSheets.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i+1}" r:id="rId${i+2}"/>`).join('\n')}
</sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId2a" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${processedSheets.map((_, i) => `<Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('\n')}
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${processedSheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const files = {
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': workbookRels,
    'xl/sharedStrings.xml': ssXml,
    'xl/styles.xml': STYLES_XML,
  };
  processedSheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i+1}.xml`] = s.xml;
  });

  return buildZip(files);
}

// ── ZIP builder ───────────────────────────────────────────────────────────────
function str2bytes(str) { return new TextEncoder().encode(str); }

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  let offset = 0;
  const localParts = [];
  const centralHeaders = [];

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = str2bytes(name);
    const dataBytes = str2bytes(content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    localParts.push(lh, dataBytes);
    centralHeaders.push(ch);
    offset += lh.length + dataBytes.length;
  }

  const cdSize = centralHeaders.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, centralHeaders.length, true); ev.setUint16(10, centralHeaders.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);

  const parts = [...localParts, ...centralHeaders, eocd];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) { result.set(part, pos); pos += part.length; }
  return result;
}

// ── Helper: cell factory ──────────────────────────────────────────────────────
const s = (v, style) => ({ v, s: style });
const num = (v, style) => ({ v: n(v), t: 'n', s: style });
const empty = (style) => ({ v: '', s: style ?? 0 });

// ── Formatted currency text for portada ──────────────────────────────────────
function fmtARS(val) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);
}

// ── Image embedding helpers ───────────────────────────────────────────────────
async function fetchImageBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]); // raw base64
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildXlsxWithImage(sheets, imageBase64) {
  const globalSS = [];
  const globalSSMap = {};
  function globalIdx(val) {
    const str = String(val);
    if (globalSSMap[str] === undefined) { globalSSMap[str] = globalSS.length; globalSS.push(str); }
    return globalSSMap[str];
  }

  const processedSheets = sheets.map(({ name, rows, colWidths, merges }) => {
    const rowsXml = rows.map((row, ri) => {
      const hAttr = row._h ? ` ht="${row._h}" customHeight="1"` : '';
      const cellsXml = (Array.isArray(row) ? row : []).map((cell, ci) => {
        if (cell === null || cell === undefined) return '';
        const ref = `${colName(ci)}${ri + 1}`;
        const st = cell.s !== undefined ? ` s="${cell.s}"` : '';
        if (cell.t === 'n' || typeof cell.v === 'number') {
          return `<c r="${ref}" t="n"${st}><v>${n(cell.v)}</v></c>`;
        } else {
          const idx = globalIdx(cell.v ?? '');
          return `<c r="${ref}" t="s"${st}><v>${idx}</v></c>`;
        }
      }).join('');
      return `<row r="${ri + 1}"${hAttr}>${cellsXml}</row>`;
    }).join('');

    const colsXml = colWidths
      ? `<cols>${colWidths.map((w, i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';
    const mergesXml = (merges && merges.length)
      ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';

    return { name, xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsXml}<sheetData>${rowsXml}</sheetData>${mergesXml}</worksheet>` };
  });

  const ssXml = buildSST(globalSS);

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${processedSheets.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i+1}" r:id="rId${i+2}"/>`).join('')}</sheets>
</workbook>`;

  const hasImage = !!imageBase64;

  // Sheet 1 gets the image drawing; other sheets don't
  const sheetRels = processedSheets.map((_, i) => {
    if (i === 0 && hasImage) {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
    }
    return null;
  });

  // Patch sheet1 xml to reference drawing
  if (hasImage) {
    processedSheets[0].xml = processedSheets[0].xml.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>');
    // Add xmlns:r to worksheet
    processedSheets[0].xml = processedSheets[0].xml.replace(
      'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    );
  }

  const drawingXml = hasImage ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:oneCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>50000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>50000</xdr:rowOff></xdr:from>
    <xdr:ext cx="1800000" cy="630000"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="Logo"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="1800000" cy="630000"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>` : null;

  const drawingRels = hasImage ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.jpg"/>
</Relationships>` : null;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId1a" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${processedSheets.map((_, i) => `<Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('\n')}
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${hasImage ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ''}
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${processedSheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
${hasImage ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // Build file map
  const fileMap = {};
  const addText = (path, content) => { fileMap[path] = { type: 'text', content }; };
  const addBin  = (path, bytes)   => { fileMap[path] = { type: 'bin',  content: bytes }; };

  addText('[Content_Types].xml', contentTypes);
  addText('_rels/.rels', rootRels);
  addText('xl/workbook.xml', workbookXml);
  addText('xl/_rels/workbook.xml.rels', workbookRels);
  addText('xl/sharedStrings.xml', ssXml);
  addText('xl/styles.xml', STYLES_XML);
  processedSheets.forEach((sh, i) => {
    addText(`xl/worksheets/sheet${i+1}.xml`, sh.xml);
    if (sheetRels[i]) addText(`xl/worksheets/_rels/sheet${i+1}.xml.rels`, sheetRels[i]);
  });
  if (hasImage && drawingXml && drawingRels) {
    addText('xl/drawings/drawing1.xml', drawingXml);
    addText('xl/drawings/_rels/drawing1.xml.rels', drawingRels);
    addBin('xl/media/logo.jpg', base64ToBytes(imageBase64));
  }

  return buildZipMixed(fileMap);
}

function buildZipMixed(files) {
  let offset = 0;
  const localParts = [];
  const centralHeaders = [];

  for (const [name, entry] of Object.entries(files)) {
    const nameBytes = str2bytes(name);
    const dataBytes = entry.type === 'bin' ? entry.content : str2bytes(entry.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    localParts.push(lh, dataBytes);
    centralHeaders.push(ch);
    offset += lh.length + dataBytes.length;
  }

  const cdSize = centralHeaders.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, centralHeaders.length, true); ev.setUint16(10, centralHeaders.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);

  const parts = [...localParts, ...centralHeaders, eocd];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const part of parts) { result.set(part, pos); pos += part.length; }
  return result;
}

const MEJORES_LOGO_URL = 'https://media.base44.com/images/public/69bc7d2a6f0e7ed160c90003/b6844473f_mejores_cover.jpg';

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
export async function exportPresupuestoExcel(form) {
  const imageBase64 = await fetchImageBase64(MEJORES_LOGO_URL);

  // ── Sheet 1: Portada ──────────────────────────────────────────────────────
  const portadaColWidths = [28, 45, 20, 20];

  const subtotal = (form.rubros || []).reduce((acc, r) =>
    acc + (r.items || []).reduce((a, i) => a + n(i.total), 0), 0);
  const gg  = subtotal * ((form.gastos_generales_pct || 15) / 100);
  const ben = (subtotal + gg) * ((form.beneficio_pct || 10) / 100);
  const baseImponible = subtotal + gg + ben;
  const iva = baseImponible * ((form.iva_pct || 21) / 100);
  const total = baseImponible + iva;

  const portadaRows = [
    // Row 1 — Logo placeholder row (height 50 para la imagen)
    Object.assign([s('', XF.hdrNavy), empty(XF.hdrNavy), empty(XF.hdrNavy), empty(XF.hdrNavy)], { _h: 50 }),
    Object.assign([s('info@mejores.com.ar  ·  Sistema de Gestión ERP', XF.italic), empty(), empty(), empty()], { _h: 14 }),
    // Row 3 — blank
    [empty(), empty(), empty(), empty()],
    // Row 4 — Document title
    Object.assign([s('PRESUPUESTO DE OBRA', XF.blueText), empty(), empty(), empty()], { _h: 20 }),
    // Row 5–11 — Data fields
    [s('Código:', XF.bold), s(form.codigo || '—', XF.normal), s('Estado:', XF.bold), s((form.estado || '').toUpperCase(), XF.normal)],
    [s('Título:', XF.bold), s(form.titulo || '—', XF.normal), empty(), empty()],
    [s('Cliente:', XF.bold), s(form.cliente_nombre || '—', XF.normal), empty(), empty()],
    [s('Proyecto:', XF.bold), s(form.proyecto_nombre || '—', XF.normal), empty(), empty()],
    [s('Dirección de obra:', XF.bold), s(form.direccion_obra || '—', XF.normal), empty(), empty()],
    [s('Responsable:', XF.bold), s(form.responsable || '—', XF.normal), empty(), empty()],
    [s('Fecha emisión:', XF.bold), s(form.fecha_emision || '—', XF.normal), s('Válido hasta:', XF.bold), s(form.fecha_validez || '—', XF.normal)],
    [empty(), empty(), empty(), empty()],
    // Financial summary header
    Object.assign([s('RESUMEN FINANCIERO', XF.hdrBlue), empty(), empty(), empty()], { _h: 18 }),
    [s('Subtotal de obra', XF.bold), s(fmtARS(subtotal), XF.kpiLabel), empty(), empty()],
    [s(`Gastos generales (${form.gastos_generales_pct || 15}%)`, XF.normal), s(fmtARS(gg), XF.kpiLabel), empty(), empty()],
    [s(`Beneficio / utilidad (${form.beneficio_pct || 10}%)`, XF.normal), s(fmtARS(ben), XF.kpiLabel), empty(), empty()],
    [s('Base imponible', XF.bold), s(fmtARS(baseImponible), XF.kpiLabel), empty(), empty()],
    [s(`IVA (${form.iva_pct || 21}%)`, XF.normal), s(fmtARS(iva), XF.kpiLabel), empty(), empty()],
    [empty(), empty(), empty(), empty()],
    // TOTAL row
    Object.assign([s('TOTAL PRESUPUESTO', XF.totalNavy), s(fmtARS(total), XF.totalGold), empty(XF.hdrNavy), empty(XF.hdrNavy)], { _h: 22 }),
  ];

  const portadaMerges = [
    'A1:D1', 'A2:D2', 'A4:D4', 'A13:D13', 'A19:D19', 'A20:D20',
    'B6:D6', 'B7:D7', 'B8:D8', 'B9:D9',
  ];

  // ── Sheet 2: Planilla ────────────────────────────────────────────────────
  const planColWidths = [6, 16, 58, 10, 10, 18, 18];
  const planMerges = [];
  const planRows = [];

  // Title row
  planRows.push(
    Object.assign([
      s('MEJORES — PRESUPUESTO DE OBRA', XF.hdrNavy),
      empty(XF.hdrNavy), empty(XF.hdrNavy), empty(XF.hdrNavy),
      empty(XF.hdrNavy), empty(XF.hdrNavy), empty(XF.hdrNavy),
    ], { _h: 24 })
  );
  planMerges.push(`A1:G1`);

  planRows.push(
    Object.assign([
      s(`${form.codigo || ''}  ·  ${form.titulo || ''}  ·  Cliente: ${form.cliente_nombre || '—'}`, XF.italic),
      empty(), empty(), empty(), empty(), empty(), empty(),
    ], { _h: 14 })
  );
  planMerges.push(`A2:G2`);

  planRows.push([empty(), empty(), empty(), empty(), empty(), empty(), empty()]);

  // Table header
  planRows.push(
    Object.assign([
      s('Ítem', XF.hdrBlue),
      s('Código', XF.hdrBlue),
      s('Descripción', XF.hdrBlue),
      s('Unidad', XF.hdrBlue),
      s('Cantidad', XF.hdrBlue),
      s('P. Unitario', XF.hdrBlue),
      s('Total', XF.hdrBlue),
    ], { _h: 16 })
  );

  let itemNum = 1;
  let rowIdx = planRows.length; // 0-indexed

  (form.rubros || []).forEach((rubro) => {
    // Rubro header
    const rubroSub = (rubro.items || []).reduce((s, i) => s + n(i.total), 0);
    planRows.push(
      Object.assign([
        s((rubro.nombre || 'RUBRO').toUpperCase(), XF.rubroHdr),
        empty(XF.rubroHdr), empty(XF.rubroHdr), empty(XF.rubroHdr),
        empty(XF.rubroHdr), empty(XF.rubroHdr),
        s(fmtARS(rubroSub), XF.kpiLabel),
      ], { _h: 15 })
    );
    rowIdx++;
    planMerges.push(`A${rowIdx + planRows.length - planRows.length + 1}:F${rowIdx + planRows.length - planRows.length + 1}`);

    const rubroRowNum = planRows.length; // 1-indexed for merges
    planMerges.push(`A${rubroRowNum}:F${rubroRowNum}`);

    // Items
    (rubro.items || []).forEach((item, iIdx) => {
      const alt = iIdx % 2 === 1;
      planRows.push([
        num(itemNum++, alt ? XF.numAlt : XF.normal),
        s(item.codigo || '', alt ? XF.altRow : XF.normal),
        s(item.descripcion || '', alt ? XF.altRow : XF.normal),
        s(item.unidad || '', alt ? XF.centered : XF.normal),
        num(item.cantidad, alt ? XF.numAlt : XF.numNormal),
        num(item.precio_unitario, alt ? XF.numAlt : XF.numNormal),
        num(item.total, alt ? XF.numAlt : XF.numTotal),
      ]);
    });

    // Rubro subtotal
    planRows.push([
      empty(), empty(), empty(), empty(), empty(),
      s(`Subtotal ${rubro.nombre || ''}`, XF.bold),
      num(rubroSub, XF.numTotal),
    ]);
    planRows.push([empty(), empty(), empty(), empty(), empty(), empty(), empty()]);
  });

  // Financial summary
  planRows.push([empty(), empty(), empty(), empty(), empty(), empty(), empty()]);

  const summaryRows = [
    [`Subtotal de obra`, subtotal],
    [`Gastos generales (${form.gastos_generales_pct || 15}%)`, gg],
    [`Beneficio / utilidad (${form.beneficio_pct || 10}%)`, ben],
    [`Base imponible`, baseImponible],
    [`IVA (${form.iva_pct || 21}%)`, iva],
  ];

  summaryRows.forEach(([label, val]) => {
    planRows.push([
      empty(), empty(), empty(), empty(), empty(),
      s(label, XF.bold),
      s(fmtARS(val), XF.kpiLabel),
    ]);
  });

  planRows.push([empty(), empty(), empty(), empty(), empty(), empty(), empty()]);

  // TOTAL row
  planRows.push(
    Object.assign([
      s('TOTAL FINAL', XF.totalNavy),
      empty(XF.hdrNavy), empty(XF.hdrNavy), empty(XF.hdrNavy),
      empty(XF.hdrNavy),
      empty(XF.hdrNavy),
      s(fmtARS(total), XF.totalGold),
    ], { _h: 20 })
  );
  const totalRow = planRows.length;
  planMerges.push(`A${totalRow}:F${totalRow}`);

  // Notes
  if (form.notas) {
    planRows.push([empty(), empty(), empty(), empty(), empty(), empty(), empty()]);
    planRows.push([
      s('NOTAS Y CONDICIONES:', XF.bold),
      s(form.notas, XF.italic),
      empty(), empty(), empty(), empty(), empty(),
    ]);
    const notasRow = planRows.length;
    planMerges.push(`B${notasRow}:G${notasRow}`);
  }

  // ── Build xlsx ─────────────────────────────────────────────────────────────
  const zipBytes = buildXlsxWithImage([
    { name: 'Portada',           rows: portadaRows, colWidths: portadaColWidths, merges: portadaMerges },
    { name: 'Planilla Ministerio', rows: planRows,    colWidths: planColWidths,   merges: planMerges },
  ], imageBase64);

  const blob = new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${form.codigo || 'presupuesto'}_MEJORES.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}